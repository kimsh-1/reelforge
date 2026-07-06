분석 완료. 아래는 파일 경로 근거 기반 구조화 보고입니다. (모든 경로는 클론 루트 `…/scratchpad/refs/revideo` 기준 절대경로)

---

# revideo 해부 보고 — "띄워서 수정 가능한 영상 편집 UI" 관점

## 패키지 지형 (모노레포, npm workspaces + lerna/nx)
`packages/`: `core`(런타임/플레이어/렌더러 코어, Motion Canvas 포크), `2d`(컴포넌트), `ui`(비주얼 에디터), `player`(웹컴포넌트 프리뷰), `player-react`(React 래퍼), `renderer`(헤드리스 렌더러), `ffmpeg`, `vite-plugin`, `cli`, `template/examples/docs`.
근거: `/packages/*/package.json`, 루트 `/package.json`.

---

## 1. 에디터/플레이어 아키텍처 — 브라우저 프리뷰 동작

프리뷰 경로가 **두 갈래**로 명확히 분리돼 있음:

### (A) 풀 비주얼 에디터 (`@revideo/ui`, Motion Canvas 상속)
- `revideo editor` CLI → Vite dev 서버 + `@revideo/vite-plugin`으로 기동. `/packages/cli/src/editor.ts`, `/packages/cli/src/index.ts:42`.
- 에디터 UI는 타임라인/뷰포트/사이드바/플레이백 컨트롤을 갖춘 완전한 편집기. 컴포넌트 디렉토리 근거: `/packages/ui/src/components/{timeline,viewport,playback,sidebar,controls,fields}`. 타임라인: `/packages/ui/src/components/timeline/Timeline.tsx`, 프리뷰 스테이지: `/packages/ui/src/components/viewport/{EditorPreview,PreviewStage}.tsx`, 재생 시간 훅: `/packages/ui/src/hooks/usePlayerTime.ts`.
- 이건 "코드 기반 편집기"(코드가 진실원본, UI는 프리뷰+미세조정)이지 완전 GUI 드래그 편집기는 아님.

### (B) 임베드용 경량 프리뷰 플레이어 (핵심 참고 대상)
- `@revideo/player`: **커스텀 엘리먼트**(`<revideo-player>`)로 구현. Shadow DOM + `<canvas>` + 오버레이 + 자체 `<input type=range>` 타임라인. `/packages/player/src/main.ts:18,73~88,101`.
- 실시간 시킹: 타임라인 `input`/`change` → `player.requestSeek(value)`. `/packages/player/src/main.ts:101-108`. 매 프레임 `onRender` 구독 콜백에서 `stage.render(currentScene, previousScene)` 후 타임라인 위치/그라디언트/시간표시 갱신. `main.ts:268-305`.
- 재생/일시정지·hover 자동재생·마우스 이동 시 컨트롤 페이드 로직 내장. `main.ts:110-194`.
- `src` 속성으로 **빌드된 project 번들을 동적 `import()`** 하여 로드(`updateSource`), `getFullPreviewSettings(project)`로 기본 설정 산출 후 `new Player(project)` 생성. `main.ts:196-235`.

### (C) React 래퍼 (`@revideo/player-react`)
- 내부적으로 같은 `<revideo-player>` 커스텀 엘리먼트를 정의(`/packages/player-react/src/internal.ts:38,297`)하고, React 컴포넌트가 이를 감싸 props를 속성/CustomEvent로 브릿지. `/packages/player-react/src/index.tsx`.
- 통신 계약: React→엘리먼트는 **CustomEvent**(`seekto`, `volumechange`)로, 엘리먼트→React는 `timeupdate`/`duration`/`playerready` 이벤트로. `index.tsx:198-213`, `internal.ts:211-227,258-278`.
- 콜백 API: `onDurationChange/onTimeUpdate/onPlayerReady/onPlayerResize`, `currentTime` prop을 외부에서 밀어넣으면 diff>0.05일 때 강제 시킹. `index.tsx:44-48,93-98`. ResizeObserver로 리사이즈 통지. 스페이스바 재생토글. `index.tsx:125-130`.
- 핵심: **mp4 export 없이** 변수 변경을 실시간 프리뷰. 코어 `Player`가 브라우저에서 씬 제너레이터를 그대로 재생.

> 주의: 코드상 React `Player`는 `project: Project` prop을 받지만(`index.tsx:30`), docs(`/packages/docs/src/content/guide/building-webapps/using-the-player.mdx`)는 `src="http://localhost:4000/player/"` 형태를 안내 — 문서/코드 버전 간 API 표기 차이 있음(확인된 코드 기준은 `project`).

---

## 2. Variables / 파라미터 주입 계약

**3계층으로 일관되게 관통**하는 시그널 기반 계약:

- **저작 측(씬 코드)**: `useScene().variables.get(name, initial)` → 반응형 시그널 반환. `/packages/core/src/scenes/Variables.ts:24-27`, 문서 예시 `/packages/docs/src/content/guide/parameterized-video.mdx:33`.
- **저장/기본값**: `makeProject({scenes, variables:{...}})`로 프로젝트 기본 변수. `Project.ts`, docs `parameterized-video.mdx:60-70`.
- **런타임 주입(프리뷰)**: `player.setVariables(obj)` → 각 씬 `variables.updateSignals(obj)`가 **이미 생성된 시그널만 즉시 갱신**. `/packages/core/src/app/Player.ts:301-304`, `Variables.ts:32-40`. 변수 바뀌면 `requestSeek(현재프레임)`로 즉시 재평가. player: `main.ts:250-253`, react-internal: `internal.ts:172-176`(+`playback.reload()`).
- **웹컴포넌트 계약**: `variables` HTML 속성에 **JSON 문자열**을 넣음 → `JSON.parse`. `main.ts:47-55`, react는 `JSON.stringify(variables)`로 직렬화 전달 `index.tsx:231`.
- **렌더 측 주입**: `renderVideo({projectFile, variables})` → vite 플러그인이 가상 모듈에서 `project.variables = JSON.parse(...)`로 **번들 시점에 코드 주입**. `/packages/renderer/server/renderer-plugin.ts` (load 훅, `escapeSpecialChars`로 이스케이프). 즉 **프리뷰 변수와 렌더 변수가 동일 스키마** → "편집 UI에서 만진 값 그대로 렌더" 계약이 자연 성립.

`Variables.get`이 시그널이라 값 교체 시 부분 리렌더/시크만으로 반영되는 게 핵심 설계.

---

## 3. 부분 렌더 / 병렬 렌더

**둘 다 1급 지원.**

- 병렬: `renderVideo`의 `settings.workers` 만큼 worker 루프 → 각 worker가 **독립 Vite 서버 + Puppeteer 브라우저**를 띄워 프레임 구간을 나눠 렌더. `/packages/renderer/server/render-video.ts:394-451`(`for i<numOfWorkers`), 포트는 `viteBasePort(기본9000)+i` `render-video.ts:240-241`.
- 프레임 구간 분할: `getWorkerFirstAndLastFrame` — 전체 프레임을 worker 수로 `Math.ceil` 분할, worker>0은 +1 offset으로 경계 중복 방지. `/packages/renderer/client/render.ts:108-126`.
- 병합: worker별 `visuals.mp4`+`audio.wav`를 `concatenateMedia` 후 `mergeAudioWithVideo`. 오디오 없으면 무음 생성. `render-video.ts:276-323`. 임시폴더/부분파일 `cleanup`. `render-video.ts:328-370`.
- **부분 렌더 공개 API**: `renderPartialVideo({workerId, numWorkers})` — 단일 구간만 렌더해 `{audioFile, videoFile}` 경로 반환(병합·정리 안 함). `render-video.ts:459-490`. → 분산/서버리스에서 조각별 렌더 후 외부 병합 시나리오용. docs `renderPartialVideo.mdx`.
- 범위 렌더: `range` 설정([시작초,끝초])으로 특정 구간만. `render.ts:30-34`.

---

## 4. 렌더 파이프라인 & 배포

**브라우저(캔버스) → 인코더 → 파일**, 인코더가 2종:

- 프레임 생성: Puppeteer가 Vite가 서빙하는 `/render` HTML(`renderer-plugin.ts` configureServer + `renderer.html`)로 이동 → 브라우저에서 코어 `Renderer`가 씬을 프레임 단위로 그림. 진행률은 `page.exposeFunction('logProgress'/'onRenderComplete'/'onRenderFailed')`로 Node에 콜백. `render-video.ts:140-224`.
- **인코더 A — WasmExporter(기본값)**: 브라우저 내부에서 `mp4-wasm` + WebCodecs `VideoFrame`으로 인코딩. 서버 ffmpeg 없이 mp4 생성. `defaultSettings.exporter = '@revideo/core/wasm'` `render-video.ts:372-378`, 구현 `/packages/core/src/exporter/WasmExporter.ts:29-42`.
- **인코더 B — FFmpeg 브릿지**: 브라우저 `FFmpegExporterClient`가 **Vite HMR WebSocket 채널**(`revideo:ffmpeg-exporter-ack`)로 프레임을 Node `FFmpegExporterServer`에 전송 → `ImageStream`을 `fluent-ffmpeg` stdin으로 파이프. `/packages/core/src/exporter/FFmpegExporter.ts:26-64`, `/packages/ffmpeg/src/ffmpeg-exporter-server.ts`, `/packages/ffmpeg/src/image-stream.ts`, 브릿지 `/packages/vite-plugin/src/partials/ffmpegBridge.ts`. 포맷별 픽셀포맷 지정(mp4/webm/proRes). 오디오는 `/packages/ffmpeg/src/generate-audio.ts` 별도 처리 후 머지.
- **배포/서비스화**: `revideo serve` = Express 렌더 엔드포인트. `POST /render`, `GET /download/:name`. `/packages/cli/src/server/index.ts`. `/render`는 3모드: (1) `callbackUrl` 있으면 비동기 렌더 후 콜백 POST, (2) `streamProgress`면 **SSE**(`event: progress/completed/error`)로 실시간 진행률 스트리밍, (3) 동기 JSON 응답. `/packages/cli/src/server/render.ts`. 임시결과 `scheduleCleanup`.
- docs 배포 가이드: `/packages/docs/src/content/guide/building-webapps/{deploy-rendering-service,rendering-endpoint,saas-template}.mdx`.

---

## 5. 훔칠 만한 독창 기능 Top 5

1. **커스텀 엘리먼트 프리뷰 플레이어 (`<revideo-player>`)** — Shadow DOM에 캔버스+자작 타임라인을 캡슐화, `src`로 빌드 번들을 동적 `import()`하여 로드. mp4 없이 씬 제너레이터를 브라우저에서 그대로 재생·시킹. 편집 UI에 "그냥 태그 하나 꽂으면 되는" 임베드 계약. 근거: `/packages/player/src/main.ts` 전체, `/packages/player-react/src/internal.ts`.

2. **시그널 기반 variables = 프리뷰·렌더 단일 스키마** — `useScene().variables.get()`이 반응형 시그널이라, 외부에서 `setVariables` → `requestSeek`만으로 즉시 반영. 같은 `variables` 객체가 `renderVideo`에도 그대로 들어가 "프리뷰에서 만진 값 = 렌더 결과" 보장. 근거: `/packages/core/src/scenes/Variables.ts`, `/packages/core/src/app/Player.ts:301`, `/packages/renderer/server/renderer-plugin.ts`.

3. **CustomEvent 양방향 브릿지 + 외부 제어 currentTime** — React↔웹컴포넌트를 `seekto`/`timeupdate`/`duration`/`playerready` 이벤트로 느슨결합. 부모가 `currentTime` prop을 밀면 강제 시킹(diff 임계값 0.05로 피드백루프 방지). 편집 UI 타임라인과 플레이어를 양방향 동기화하는 깔끔한 패턴. 근거: `/packages/player-react/src/index.tsx:93-98,198-213`.

4. **워커별 독립 브라우저+Vite 서버 병렬 렌더 & `renderPartialVideo`** — 프레임 구간을 나눠 N개 Puppeteer로 렌더 후 ffmpeg concat, 경계 offset으로 중복 프레임 방지. 부분 렌더 API가 따로 노출돼 서버리스/분산 팬아웃에 그대로 재사용 가능. 근거: `/packages/renderer/server/render-video.ts:394-490`, `/packages/renderer/client/render.ts:108-126`.

5. **SSE 진행률 스트리밍 + 콜백 URL 렌더 엔드포인트** — `revideo serve` 하나로 편집 웹앱이 붙을 렌더 서비스 완성. 동기/콜백/SSE 3모드 제공해 "편집 UI에서 렌더 버튼 → 실시간 프로그레스바 → 다운로드 링크" UX를 바로 구현 가능. 근거: `/packages/cli/src/server/render.ts`, `/packages/cli/src/server/index.ts`.

---

## 설계 참고 요약 (편집 UI 관점)
- **아키텍처 차용안**: 코어 렌더/재생 로직은 프레임워크 무관 커스텀 엘리먼트로 캡슐화(`player`), 편집 UI 프레임워크(React/Next)는 얇은 브릿지만. 실시간 프리뷰와 최종 렌더가 **동일 project 번들 + 동일 variables 스키마**를 공유하는 게 이 프로젝트의 최대 강점.
- **한계/유의**: 진짜 GUI 편집이 아니라 "코드=진실원본 + 변수 슬롯 + 타임라인 시킹" 모델. 드래그로 요소를 직접 편집하는 건 `@revideo/ui` 에디터(Motion Canvas 상속분)에 한정. 헤드리스 렌더는 워커마다 Puppeteer+Vite를 통째로 띄우는 무거운 구조(비용/메모리 고려 필요).