# HyperFrames 엔진 내부 해부 — 씬 편집 대시보드 + 부분 재렌더 통합 지점

- 분석 대상: `/mnt/d/deck-factory/vendor/hyperframes` (모노레포 풀소스, 패키지 버전 **0.7.26**, 마지막 커밋 a7c3cc7d 2026-07-02)
- 비교본: npx 캐시 `~/.npm/_npx/702923228c2ce1e6/node_modules/hyperframes` = **0.7.37** (dist만, 소스 없음). npm latest도 0.7.37 — 벤더 사본은 11패치 뒤처짐. 0.7.26→0.7.37 간 변경 내용은 미확인.
- `~/.hyperframes` = 설정/캐시(config.json, auto-update.log), `~/.cache/hyperframes` = chrome/fonts 캐시. 소스 아님.
- 모노레포 구성: `packages/{cli, core, engine, producer, player, studio, studio-server, parsers, lint, sdk, aws-lambda, gcp-cloud-run, shader-transitions}`

---

## 1. 렌더 파이프라인 내부

**브라우저 = Puppeteer(-core) + chrome-headless-shell, BeginFrame 결정론 캡처.**

- `packages/engine/src/services/browserManager.ts` — `puppeteer` 없으면 `puppeteer-core` 동적 임포트(L38-47). 캡처 전용 바이너리로 `~/.cache/puppeteer/chrome-headless-shell/`를 스캔해 chrome-headless-shell을 해석(L109-138). "BeginFrame requires chrome-headless-shell AND Linux"(L348) — 리눅스에서는 CDP `HeadlessExperimental` BeginFrame 모드로 프레임을 명시적으로 틱시킴.
- `packages/engine/src/services/frameCapture.ts` — 헤더 주석: "window.__hf seek protocol … Chrome's BeginFrame API or Page.captureScreenshot fallback"(L6-8). 페이지 준비 판정은 `window.__hf && typeof __hf.seek === "function" && __hf.duration > 0`(L630). 프레임마다 `seek(time)` 호출 → 스크린샷 → 다음 프레임. 정적 프레임 중복 제거(`staticDedupIndex`), 워밍업 틱 고정(`LOCKED_WARMUP_TICKS = 60`, engine/src/types.ts의 CaptureOptions 주석) 존재.

**시킹 계약(HfProtocol)** — `packages/engine/src/types.ts` L60-78:
```ts
interface HfProtocol {
  duration: number;                 // 초
  seek(time: number): void;        // 결정론적 시각 출력 필수
  media?: HfMediaElement[];        // video/audio 선언 → 엔진이 프레임 주입/오디오 추출
  transitions?: HfTransitionMeta[]; // 셰이더 트랜지션 메타 (fromScene/toScene 포함)
}
```
"엔진은 애니메이션 프레임워크를 신경쓰지 않는다 — seek()이 결정론적이면 GSAP/CSS/Three.js 뭐든 OK"(같은 파일 주석). 즉 **단일 paused timeline을 프레임별 seek하는 구조 맞음**.

- 헤드리스 Chrome은 `<video>` 재생/오디오가 안 되므로 `HfMediaElement`(elementId/src/startTime/endTime/mediaOffset/volume)로 선언된 미디어를 **ffmpeg로 사전 추출해 프레임 주입 + 오디오 믹스**: `videoFrameExtractor.ts`, `videoFrameInjector.ts`, `audioMixer.ts` (engine/src/services/).

**ffmpeg 합성**
- `packages/engine/src/services/streamingEncoder.ts` — "streaming FFmpeg encoder – spawns FFmpeg with `-f image2pipe`"(L12), 캡처 PNG/JPEG를 stdin 파이프로 스트리밍 인코딩. fps는 유리수(`{num,den}`, NTSC 30000/1001)로 ffmpeg에 그대로 전달(engine/src/types.ts CaptureOptions.fps 주석).
- 병렬 렌더: `parallelCoordinator.ts` + `chunkEncoder.ts` — 워커별 청크 인코딩 후 결합(파일 구조로 확인; 상세 결합 방식은 미상술).

**결정론 장치**
- BeginFrame 모드(가상 시간 틱, 리눅스+headless-shell 한정) + `--docker` 결정론 렌더 경로(cli/src/commands/render.ts L33).
- `packages/producer/src/services/fileServer.ts` L187-197 — 옵션 `seedRandomFromFrame`: `Math.random`/`crypto.getRandomValues`를 프레임 가상시간 키의 Mulberry32 PRNG로 치환(기본 off).
- `packages/producer/src/services/deterministicFonts.ts` — 폰트 결정론(구글 서브셋/시스템 캡처/fail-closed 테스트 존재).
- `packages/producer/src/parity-harness.ts`, `regression-harness*.ts` — 픽셀 패리티 회귀 하니스.

producer(`packages/producer/`)가 상위 오케스트레이터: `renderOrchestrator.ts`, `htmlCompiler.ts`(컴포지션 컴파일), `frameDirCache.ts`(프레임 디렉토리 캐시 — 재렌더 가속 장치로 보이나 상세 미확인).

## 2. preview / play 서버

**두 종류의 서버.**

- `hyperframes preview` = **Studio 서버** (`packages/cli/src/commands/preview.ts` → `packages/cli/src/server/studioServer.ts`). Hono 기반, `packages/studio-server/src/createStudioApi.ts`가 API 전부 등록: projects / storyboard / files / preview / lint / render / thumbnail / waveform / fonts / registry / selection.
- `hyperframes play` = 경량 플레이어 서버 (`packages/cli/src/commands/play.ts`) — 정적 서빙 + 런타임 주입(`compositionServer.ts`) + `@hyperframes/player`(브라우저에서 실시간 재생/시킹 컨트롤: `packages/player/src/hyperframes-player.ts`, `direct-timeline-clock.ts`, `controls.ts`).

**핫리로드 = fs.watch + SSE (WebSocket 아님).**
- `packages/cli/src/server/fileWatcher.ts` — `fs.watch(recursive)` + 300ms 디바운스, renders/outputs/node_modules 등 제외.
- `packages/cli/src/server/studioServer.ts` L579-589 — `GET /api/events` 가 SSE 스트림으로 `file-change` 이벤트(`{path}`)를 푸시. **외부 대시보드도 이 SSE를 그대로 구독 가능.**

**핵심 API 훅 (studio-server routes, 파일:라인)**
- `GET /api/projects/:id/preview` — 메인 컴포지션 번들+런타임 주입 HTML (preview.ts L241)
- `GET /api/projects/:id/preview/comp/*` — **서브 컴포지션 단독 프리뷰** (preview.ts L324, `buildSubCompositionHtml` 헬퍼가 fragment/template도 완전한 문서로 감쌈 — helpers/subComposition.ts)
- `GET/PUT/POST/DELETE /api/projects/:id/files/*` — 소스 파일 읽기/쓰기 (files.ts L1585-1638)
- `POST /api/projects/:id/file-mutations/{remove,split,patch,wrap,unwrap,probe}-element/*` — **요소 단위 구조적 소스 변형 API** (files.ts L1657-1884), `data-hf-id` 안정 ID 기반(`ensureHfIds`/`hfIdPersist.ts`)
- `POST /api/projects/:id/gsap-mutations/*`, `GET .../gsap-animations/*` — 키프레임/모션 편집 (files.ts L1990-2013)
- `POST /api/projects/:id/render` + SSE 진행률 — 아래 §3
- `GET /api/projects/:id/thumbnail/<comp.html>?t=1.25&w=&h=&selector=&format=png` — **임의 시각 t의 서버사이드 스크린샷** (thumbnail.ts L12-60, 콘텐츠 해시 캐시)
- `GET /api/projects/:id/storyboard` — STORYBOARD.md 파싱 결과 + SCRIPT.md (storyboard.ts L47)
- `GET/PUT /api/projects/:id/selection` — Studio↔CLI 선택 공유 (selection.ts)

즉 편집→반영 루프에 필요한 것(파일 뮤테이션, 씬 프리뷰, 썸네일, 파일변경 SSE, 렌더 잡)이 **전부 이미 HTTP API로 존재**한다.

## 3. 부분 렌더 가능성

- **CLI에 프레임 범위 옵션은 없음.** render.ts / engine·producer config에서 `frameRange|startFrame|--range` 계열 grep 결과 0건. 시간 구간 렌더는 공식 미지원.
- 단, **컴포지션 단위 부분 렌더는 공식 지원**:
  - CLI: `hyperframes render --composition <파일>` (render.ts에 composition validator 존재, L364 주석) — 프로젝트 내 특정 HTML 하나만 렌더.
  - Studio API: `POST /api/projects/:id/render` body `{composition: "scenes/03.html", fps, quality, format, resolution}` (render.ts L50-120) → `adapter.startRender`가 `createRenderJob({entryFile: opts.composition})`로 producer 직접 호출(studioServer.ts L351-395), 진행률은 잡 상태 폴링/SSE.
- **내부적으로는 프레임 청크 렌더가 1급 시민**: `packages/producer/src/distributed.ts` — `plan → renderChunk × N → assemble` 순수함수 3종. `renderChunk(planDir, chunkIndex, out)`는 프레임 슬라이스(`buildChunkSlices`) 하나만 렌더하고 바이트 동일 재시도 보장. **이 API를 쓰면 "씬 시간구간만 재렌더 후 재조립"을 라이브러리 수준에서 구현 가능** — 다만 CLI 표면에는 노출 안 됨(로컬 병렬·lambda가 소비자).
- `frameDirCache.ts`(producer) — 프레임 디렉토리 캐시. 변경 없는 구간 스킵 여부는 미확인.

## 4. variables / 데이터 주입 (공식 경로 3+1)

1. **CLI**: `render --variables '<json>'` / `--variables-file vars.json` / `--strict-variables`(선언·타입 검증) — render.ts L278-288.
2. **주입 메커니즘**: 엔진이 `page.evaluateOnNewDocument`로 `window.__hfVariables`를 페이지 스크립트 실행 전에 심음 — engine/src/types.ts CaptureOptions.variables 주석, frameCapture.ts L422.
3. **컴포지션 쪽 계약**: `<html data-composition-variables="...">` 선언 디폴트 + `window.__hfVariables` 오버라이드를 `window.__hyperframes.getVariables()`가 병합 반환 — `packages/core/src/runtime/getVariables.ts` L1-31. 서브컴포지션은 호스트 요소의 `data-variable-values`를 per-instance로 레이어링(`__hfVariablesByComp`, compositionScoping.ts).
4. **배치**: `render --batch rows.json --output "renders/{name}.mp4"` — 행마다 variables 세트로 다중 산출 (cli/src/commands/batchRender.ts, 스키마 검증 포함).

→ **씬 매니페스트(JSON) → variables로 꽂는 경로가 이미 공식**이다.

## 5. 보조 명령 구현 (전부 로컬, API 아님)

- `transcribe` — **whisper.cpp 로컬 실행**. 바이너리 탐색 순서 env→system→brew→소스빌드(git clone ggml-org/whisper.cpp + cmake), 모델은 huggingface `ggerganov/whisper.cpp`에서 ggml-*.bin 다운로드 → `~/.cache/hyperframes/whisper/models` (cli/src/whisper/manager.ts L9-156).
- `tts` — **Kokoro 로컬 onnx**(kokoro-v1.0.onnx + voices-v1.0.bin, GitHub release 다운로드, 54보이스), Python 브릿지(cli/src/tts/python.ts) 경유 (cli/src/tts/manager.ts L10-18). ※ HeyGen/ElevenLabs 프로바이더는 CLI 본체가 아니라 스킬(`hyperframes-media`) 레이어 소관.
- `remove-background` — **onnxruntime-node 로컬 추론**, u2net_human_seg.onnx 등 rembg 릴리스에서 다운로드 → `~/.cache/hyperframes/background-removal/models`, CPU 기본/CoreML/CUDA 옵션 (cli/src/background-removal/manager.ts L6-77).

## 6. lambda 클라우드 렌더 (개요)

`packages/aws-lambda/src/handler.ts` 헤더가 아키텍처 전체 요약: **Lambda 함수 1개, 역할 3개(Plan/RenderChunk/Assemble), Step Functions가 `event.Action`으로 디스패치**, Map 상태로 청크 팬아웃. 핸들러는 얇은 글루(S3 다운로드 → `@hyperframes/producer/distributed` 프리미티브 호출 → S3 업로드). Chrome은 `chromium.ts`로 Lambda용 경로 해석, 전송은 `s3Transport.ts`, 배포는 `cli/src/commands/lambda/{deploy,destroy,render,progress,policies}.ts` + CDK/SAM(`aws-lambda/cdk`, `sam.ts`). GCP Cloud Run 어댑터(`packages/gcp-cloud-run`)도 동일 프리미티브 소비.

## 7. 결론 — 편집 대시보드 최적 통합 지점

**권장: (b)+(c) 하이브리드 — "자체(또는 확장) 대시보드가 Studio 서버 API를 백엔드로 재사용 + 씬별 독립 컴포지션 파일 + composition 단위 재렌더".**

- (a) 프리뷰 서버 "재사용"은 사실상 정답의 절반이다. 다만 Studio UI(React, packages/studio)를 고치는 게 아니라 **`hyperframes preview`가 띄우는 HTTP API를 우리 대시보드의 백엔드로 그대로 쓰는 것**: 씬 소스 편집은 `PUT /files/*` 또는 구조적 `file-mutations/*`, 변경 감지는 `GET /api/events` SSE, 씬 썸네일은 `GET /thumbnail/<scene>.html?t=`, 씬 프리뷰는 `GET /preview/comp/<scene>.html`을 iframe으로 임베드(런타임이 주입된 재생 가능한 문서가 반환됨). 인증 없음·로컬 전용이므로 same-host 프록시만 붙이면 됨.
- (c) 씬 구조: 프로젝트를 **씬별 HTML 파일(서브 컴포지션) + 이를 조립하는 메인 index.html**로 짜면, "이 씬만 재렌더" = `POST /projects/:id/render {composition: "scenes/NN.html"}` 또는 `hyperframes render --composition` — **공식 지원 경로**라 업스트림 업그레이드에 안전. 최종본은 메인 컴포지션 전체 렌더 1회(트랜지션·오디오 일관성 보장) — 씬 mp4를 ffmpeg concat으로 잇는 방식은 셰이더 트랜지션(HfTransitionMeta)·BGM 연속성을 깨므로 초안 확인용으로만.
- 씬 매니페스트: 텍스트/타이밍 값은 `data-composition-variables` + `data-variable-values`(씬 인스턴스별)로 선언하고 대시보드는 JSON만 편집 → 렌더 시 `--variables`/render API로 주입. 구조 변경만 file-mutations로.
- 시간구간 부분 재렌더가 꼭 필요해지면 2단계로 `@hyperframes/producer/distributed`의 `plan/renderChunk/assemble`을 직접 소비하는 자체 러너를 붙일 수 있다(공식 라이브러리 표면, CLI 미노출).
- 주의: 벤더 사본 0.7.26 vs npm 0.7.37 — 통합 착수 전 벤더 사본 갱신 후 위 라우트들의 시그니처 재확인 필요(라우트 변경 여부 미확인).
