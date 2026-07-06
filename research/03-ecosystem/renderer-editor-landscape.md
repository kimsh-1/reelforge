# 프로그래매틱 비디오 렌더러 / 오픈소스 비디오 에디터 지형도

- 조사일: 2026-07-07
- 목적: "AI 영상 생성 스킬 + 띄워서 수정 UI"의 렌더/편집 레이어 선택지 지도
- 방법: gh CLI로 스타·최근 푸시·라이선스 실측 + 5개 레포 얕은 클론 후 구조 확인
  (클론: OpenCut, opencut-classic, motion-canvas, react-video-editor, html-video → `scratchpad/refs/`)
- 제외(이미 깊게 분석 완료): **Remotion**(React 컴포넌트→서버 헤드리스 렌더, 소스공개·유료 티어), **revideo**(motion-canvas 포크의 API-first 렌더러), **MoviePy 계열**(Python+ffmpeg), **hyperframes**(HTML→비디오, 현재 우리 기본 스택)
- 원칙: 아래 수치·구조는 전부 gh CLI/클론으로 직접 확인한 것만. 추정은 "추정"으로 표기.

---

## 1. 비교표

| 프로젝트 | ★ | 최근 푸시 | 렌더 방식 | 입력 계약 | 편집 UI | 라이선스 |
|---|---:|---|---|---|---|---|
| OpenCut (rewrite) | 61,633 | 2026-06 | (설계 중) Rust core 예고 | Editor API·MCP·headless 예고 | 리라이트 중 — 현재 빈 껍데기 | MIT |
| opencut-classic | (본체 98) | 2026-05 | 브라우저 canvas 합성 + opencut-wasm GPU 이펙트 + mediabunny(WebCodecs) 인코딩 | 앱 내부 상태(zustand) | **풀 타임라인 NLE** (스냅·그룹·그래프에디터·undo 커맨드) | MIT |
| motion-canvas | 18,760 | 2026-07 | 브라우저 canvas, exporter 플러그인(이미지 시퀀스 / FFmpeg client-server) | **TS 제너레이터 코드** (씬 함수) | 코드 중심 에디터(Preact) — 타임라인은 검사/스크럽용 | MIT |
| mediabunny | 6,635 | 2026-07 | (렌더러 아님) 순수 TS 미디어 IO/변환, WebCodecs | 코드 API | 없음 (라이브러리) | MPL-2.0 |
| editly | 5,447 | 2025-05 | Node + ffmpeg 스트리밍, canvas/fabric.js + GL 셰이더 전환 | **JSON5 선언 스펙** + JS API + CLI | 없음 (헤드리스) | MIT |
| pyJianYingDraft | 3,856 | 2026-07 | 렌더는 剪映(CapCut CN)에 위임 | **draft_content.json 생성** Python 라이브러리 | 剪映 본체가 UI | (레포 확인 필요, PyPI 배포) |
| html-video (nexu-io) | 3,844 | 2026-06 | **hyperframes 엔진**(헤드리스 Chromium 녹화 + ffmpeg libx264), 엔진 어댑터 구조 | 프롬프트/링크 → **content-graph IR** → 프레임별 HTML | 로컬 스튜디오(갤러리·프레임 인라인 수정) + CLI | Apache-2.0 |
| FFCreator | 3,152 | 2024-12 | Node canvas + OpenGL + FFmpeg | JS 코드 API | 없음 | MIT |
| trykimu/videoeditor (Kimu) | 2,130 | 2026-06 | **Remotion 풀셋** (@remotion/player 프리뷰 + @remotion/renderer 익스포트) | React/Remotion 컴포지션 + AI 어시스턴트 | 멀티트랙 타임라인 + **"Vibe" AI 채팅 편집** | Other(커스텀 — 차용 전 확인 필수) |
| WebAV | 2,065 | 2026-01 | 브라우저 WebCodecs SDK | 코드 API (@webav/av-cliper 등) | 데모 수준, Pro는 유료 | MIT (Pro 별도) |
| react-video-editor (designcombo→OpenVideo) | 1,720 | 2026-06 | 브라우저 WebCodecs (**mediabunny** 채택, WebCodecs 미지원 브라우저 차단 모달 존재) | 앱 내부 스토어 + @openvideo/timeline SDK | CapCut/Canva 클론급 타임라인 | **OpenVideo 이중 라이선스** (개인·소기업 무료 / 기업 유료) |
| omniclip | 1,429 | 2026-07 | 브라우저 WebCodecs, 최대 4K 렌더 | 앱 내부 상태 (컴포넌트 임베드 가능 표방) | 브라우저 NLE (트림·분할·프리뷰 직접조작·undo·WebRTC 협업) | MIT |
| capcut-mate | 1,307 | 2026-07 | 렌더는 剪映 클라우드 렌더링에 위임 | **REST API로 draft JSON 생성** (FastAPI) | 剪映 본체가 UI | Apache-2.0 |
| diffusionstudio/core | 1,181 | 2025-11 | 브라우저 WebCodecs 컴포지팅 엔진 | 코드 API | 없음 | MPL-2.0 |
| etro | 1,142 | 2026-06 | 브라우저 canvas + GLSL 필터, 실시간 record(오프라인 렌더 "coming soon") | 코드 API + JSON 직렬화/역직렬화 | 없음 (framework-agnostic 표방) | **GPL-3.0 주의** |

기타 확인만 한 것(상세 생략): openreel-video 3,738★(브라우저 CapCut 대체 표방), Clypra 2,257★(Tauri+React), freecut 1,505★(브라우저 WebCodecs), flycut 923★(2024-10 이후 정체), cutia 754★, video-autopilot-kit 539★(CapCut JSON+ffmpeg 템플릿 프레임워크, MIT), xzdarcy/react-timeline-editor 762★(타임라인 단독 React 컴포넌트, 2026-01), palmier-pro 10,031★(macOS 네이티브 "AI를 위한" 에디터 — 웹 아님), 데스크톱 C++/Qt 계열(shotcut 14.5k·kdenlive 5.3k = MLT 프레임워크, olive 9.1k 중단, openshot 6.0k)은 우리 용도(웹 UI 임베드)와 무관하여 한 줄 처리.

---

## 2. 프로젝트별 상세

### 2.1 OpenCut — "본 레포와 classic이 다른 물건" (핵심 주의사항)

- **OpenCut-app/OpenCut (61.6k★, MIT)**: README 명시 — "OpenCut is being rewritten from the ground up." 현재 레포는 TanStack 라우트 2개짜리 빈 껍데기(`apps/web/src/routes`에 `__root.tsx`, `index.tsx`뿐). 마지막 커밋 2026-06-21 "ci: update workflow for rewrite".
- 리라이트 목표(README): **Editor API, 플러그인-퍼스트 아키텍처, Rust core로 데스크톱/모바일/브라우저 단일 코드베이스, MCP 서버(AI 에이전트용), headless 모드(배치 렌더), 에디터 내 스크립팅 탭**. → 우리가 만들려는 것과 방향이 정확히 겹침. 완성 전이므로 "지켜볼 대상"이지 "쓸 대상"이 아님.
- **실물은 opencut-app/opencut-classic** (MIT, 2026-05까지 푸시, opencut.app 운영 버전):
  - 렌더: `src/services/renderer/`에 canvas-renderer + compositor + scene-builder/scene-exporter. GPU 이펙트는 `opencut-wasm` npm 패키지(Rust→WASM, 실패 시 CPU 폴백). 익스포트는 **mediabunny**(WebCodecs) 사용을 scene-exporter.ts에서 직접 확인.
  - 타임라인: `src/timeline/`에 30여 파일 — snapping(요소/플레이헤드 스냅 소스 분리), drag-source/drag-utils, group-move/group-resize, track-capabilities, ruler/zoom/pixel-utils, scenes, `components/`에 graph-editor(키프레임 그래프)·audio-waveform·selection-hit-testing까지. 상태는 zustand(timeline-store).
  - 편집 명령: `src/commands/`에 `abstract class Command` + BatchCommand — **커맨드 패턴 undo/redo**가 timeline/scene/media/project 도메인별로 정리됨.
- **참고 포인트**: ① 브라우저 NLE 타임라인 구현의 가장 완성도 높은 MIT 레퍼런스(스냅·그룹이동·히트테스팅·그래프에디터를 통째로 읽을 수 있음). ② "canvas 합성 + WASM 이펙트 + mediabunny 인코딩"이라는 브라우저 렌더 파이프라인 정석 구성.

### 2.2 motion-canvas (18.8k★, MIT, 활발 — 2026-07 푸시)

- revideo의 원본. 렌더는 브라우저 canvas 위에서 결정론적 재생 후 **exporter 플러그인**으로 출력: core에 `Exporter.ts`/`ImageExporter.ts`(이미지 시퀀스), 별도 `packages/ffmpeg`에 FFmpegExporterClient/Server(클라이언트-서버 분리형 ffmpeg 인코딩).
- 입력 계약: **TypeScript 제너레이터 함수로 씬을 기술**(코드가 곧 타임라인). JSON 스펙 없음.
- 편집 UI: `packages/ui`(Preact + @preact/signals)에 timeline/viewport/playback/sidebar 컴포넌트가 있으나, 성격은 **코드 실행 결과를 스크럽·검사하는 개발자 에디터**이지 클립을 드래그해 편집하는 NLE가 아님. 그 외 `player`(웹 임베드 플레이어), `vite-plugin`, `2d`(씬 그래프) 패키지로 모듈화가 깔끔함.
- **참고 포인트**: ① "core(결정론 재생) / ui(에디터) / player(임베드) / exporter(출력)"의 패키지 경계 설계가 우리 스킬+UI 분리 구조의 좋은 본보기. ② 코드-중심 에디터라서 "AI가 코드 생성 → 사람이 타임라인에서 미세조정" UX의 한계(수정이 결국 코드로 되돌아감)도 함께 보여줌.

### 2.3 nexu-io/html-video (3.8k★, Apache-2.0, 2026-06 푸시) — **가장 직접적인 유사체**

- 컨셉이 우리 목표와 사실상 동일: "코딩 에이전트용 프로그래매틱 비디오 — HTML을 로컬에서 MP4로". 에이전트(14종 백엔드: Claude Code, Codex, Cursor 등 PATH 자동감지)가 스토리보드를 만들고 엔진이 렌더.
- 아키텍처(README + 클론 확인): 엔진을 `render(input, ctx)` 단일 어댑터 계약 뒤에 두는 **메타 레이어**. 패키지: `core / runtime / cli / content-graph / adapter-hyperframes / adapter-remotion / project-studio / studio-next`. 기본 엔진은 **hyperframes**(헤드리스 Chromium 프레임 녹화 → 프레임별 webm → ffmpeg libx264 concat). adapter-remotion 패키지가 소스에 존재하나 README는 "Planned"로 명시(bridge/capabilities/render/validate 골격만).
- 입력 계약: 프롬프트·기사 URL·GitHub 레포 → 에이전트가 **content-graph IR**(노드: entity/data/text, 엣지: sequence/dependency/contrast, 토폴로지 정렬로 프레임 순서·타이밍 결정) + 프레임별 자립 HTML 산출.
- 편집 UI: 로컬 브라우저 스튜디오 — 템플릿 21종 갤러리, 멀티프레임 스토리보드에서 **프레임별 텍스트 인라인 수정·순서 변경·부분 재렌더**. 타임라인 NLE는 아니고 "스토리보드 단위 수정" 모델.
- **참고 포인트**: ① "에이전트가 IR을 쓰고, 엔진 어댑터가 그린다 — 서로 침범하지 않는다"는 계약 분리가 우리 스킬 설계의 정답지에 가까움. ② "풀 타임라인 대신 프레임/장면 단위 수정 UI"라는 낮은 비용의 수정 UX 선례. ③ 동시에 직접 경쟁자이므로 차별점(우리는 타임라인급 수정? 한국어 파이프라인? 품질 게이트?)을 정해야 함.

### 2.4 designcombo/react-video-editor (1.7k★, 2026-06 푸시) — "OpenVideo"로 개편 중

- 설명문은 "react video editor using remotion"이지만 **클론한 현재 코드에는 remotion 의존성이 없음**. dependencies는 `@openvideo/timeline 1.3.1` + `mediabunny ^1.26.0`. 프리뷰/익스포트가 WebCodecs 기반으로 전환됨(`webcodecs-unsupported-modal.tsx` 존재 — WebCodecs 없으면 아예 차단).
- 구조: Next.js 앱. `components/editor/` 아래 timeline(controls/items/playhead/ruler/context-menu), canvas-panel, media-panel, right-panel(속성), floating-controls, export-modal. 상태는 zustand 스토어 5개(project/studio/assets/panel/download). 타임라인 코어는 `@openvideo/timeline`이라는 **별도 SDK 패키지**로 빠져 있어 앱 코드만으론 타임라인 내부 로직을 못 봄.
- 라이선스: **"OpenVideo License" 이중 체계** — 개인·소기업은 상용 포함 무료, 일정 규모 이상 영리 기업은 유료. MIT 아님. **코드 차용 시 조항 검토 필수.**
- **참고 포인트**: ① "타임라인을 SDK로 분리 + 얇은 앱"이라는 패키징(우리도 수정 UI를 재사용 패키지로 뺄 때의 모델). ② remotion→WebCodecs(mediabunny) 전환 자체가 업계 방향 신호.

### 2.5 editly (5.4k★, MIT, 마지막 푸시 2025-05)

- Node.js + ffmpeg **스트리밍** 편집(중간 파일 최소화). 화면은 HTML5 Canvas/fabric.js 커스텀 코드, 전환은 GL 셰이더(shadertoy 호환).
- 입력 계약이 이 조사에서 가장 순수한 **선언적 JSON5 스펙**: clips/layers/transitions를 JSON으로 기술, CLI 한 방(`editly spec.json5`) 또는 JS API. 편집 UI 없음.
- 활성도 낮음(1년+ 정체, 아카이브는 아님). **참고 포인트**: JSON 스펙 스키마 설계(clip/layer/transition/오디오 더킹·크로스페이드의 어휘)가 우리 IR 설계의 어휘집으로 유용. 실행 엔진으로 채택하기엔 유지보수 리스크.

### 2.6 FFCreator (3.2k★, MIT, 마지막 푸시 2024-12)

- Node canvas + OpenGL(헤드리스 GL) + FFmpeg의 서버 렌더러. 텐센트 TNFE 산. 입력은 JS 코드 API(FFScene/FFText 등 객체 트리). UI 없음.
- 2년 가까이 정체 → 신규 채택 비권장. 한 줄 교훈: "서버사이드 node-canvas 렌더" 계열(editly 포함)은 브라우저 WebCodecs 계열에 세대 교체당하는 중.

### 2.7 브라우저 WebCodecs 엔진 3종 (etro / WebAV / diffusionstudio) + 부품 표준 mediabunny

- **mediabunny (6.6k★, MPL-2.0, 매우 활발)**: 렌더러가 아니라 **브라우저 미디어 IO 툴킷**(MP4/WebM/MP3/HLS 읽기·쓰기·변환, 순수 TS, 의존성 0, 트리셰이커블). "웹을 위해 다시 만든 FFmpeg" 포지션. 스폰서에 Remotion·Diffusion Studio가 있고, opencut-classic과 react-video-editor가 모두 익스포트에 채택 — **사실상 브라우저 인코딩 부품의 표준**. MPL-2.0은 파일 단위 카피레프트(수정 파일만 공개, 링크는 자유)라 실무 채택 무난.
- **WebAV (2.1k★, MIT, 2026-01 푸시)**: WebCodecs 기반 생성/편집 SDK(@webav/av-cliper). 중국 생태계 중심, 고급 기능은 WebAV-Pro 유료. 코드 API, UI는 데모 수준.
- **diffusionstudio/core (1.2k★, MPL-2.0, 마지막 푸시 2025-11)**: WebCodecs 컴포지팅 엔진, 코드 API, UI 없음. 7개월+ 정체 기미 — 회사 우선순위 이동 추정(추정).
- **etro (1.1k★, GPL-3.0, 2026-06 푸시)**: 브라우저 canvas 합성 + GLSL 필터, 레이어/이펙트 코드 API에 **JSON 직렬화/역직렬화 내장**. 단 오프라인 렌더링이 아직 "coming soon"(실시간 record만). **GPL-3.0이라 우리 스택에 링크하는 순간 전염 — 사실상 배제.**

### 2.8 CapCut/剪映 드래프트 자동화 군 — "NLE를 렌더 백엔드로 쓰기"

- **pyJianYingDraft (3.9k★, 2026-07 활발)**: `draft_content.json`을 프로그램으로 생성하는 Python 라이브러리. 템플릿 모드(기존 초안 로드→소재 교체→텍스트 치환), 키프레임·마스크·특효·필터까지 커버, 剪映 6 이하에서 배치 익스포트 자동화. 剪映 6+는 draft가 암호문이라 명문 템플릿만 기본 지원(fallback_loader 훅 제공). CapCut 국제판용 pyCapCut 별도 개발 중.
- **capcut-mate (1.3k★, Apache-2.0, 2026-07 활발)**: 같은 패턴을 **FastAPI REST API**로 포장 — draft 생성/저장, 소재·자막·특효 추가, 키프레임, **클라우드 렌더링으로 최종 영상까지**. Coze/n8n 워크플로·LLM 연동을 전면에 내세움("대모델에 편집 능력을 부여").
- **video-autopilot-kit (539★, MIT)**: CapCut JSON + ffmpeg + 온보딩 설문의 쇼츠 자동화 프레임워크. 규모 작음.
- **참고 포인트**: ① "AI가 draft JSON을 쓰고, 사람이 CapCut에서 열어 다듬고, 렌더는 NLE가 한다" — **수정 UI를 직접 만들지 않고 기성 NLE에 넘기는 제3의 길**. 단 draft 포맷이 비공개·버전마다 깨짐(6+ 암호화, 7+ 컨트롤 숨김)이라 ByteDance 정책 리스크가 상시 존재. ② REST로 편집 동사를 노출하는 capcut-mate의 API 표면 설계는 우리 스킬의 도구 계약 참고용.

### 2.9 trykimu/videoeditor "Kimu" (2.1k★, 2026-06 푸시) — AI 코파일럿 편집기

- "friendly AI powered open-source alternative to CapCut, Canva". package.json 확인: **Remotion 풀셋**(@remotion/player로 실시간 프리뷰, @remotion/renderer로 익스포트, captions/transitions/media-parser까지).
- UI: 멀티트랙 타임라인(스냅·레이어) + **"Vibe" AI 어시스턴트** — 자연어로 편집·타이밍·레이아웃 생성. "AI 생성 + 띄워서 수정"이라는 우리 UX에 가장 근접한 완제품.
- 라이선스 "Other"(커스텀) — 코드 차용 전 원문 확인 필수. **참고 포인트**: Remotion player를 프리뷰 엔진으로 쓰면서 그 위에 자체 타임라인+AI 채팅을 얹는 조합 방식.

### 2.10 omniclip (1.4k★, MIT, 2026-07 푸시)

- 완전 브라우저 로컬(계정 없음, 업로드 없음) WebCodecs 에디터. 트림/분할/프리뷰 위 직접 조작(회전·리사이즈·텍스트 스타일)/undo·redo/4K 렌더/WebRTC 협업. "컴포넌트를 자기 웹 프로젝트에 임베드 가능" 표방. 2.0 개발 중.
- **참고 포인트**: MIT + 임베드 지향이라, opencut-classic 다음으로 부담 없이 뜯어볼 수 있는 브라우저 NLE.

---

## 3. 우리 스택 선택에 주는 시사점

**① 렌더 레이어는 3계열로 정리되고, 세대 교체 방향이 명확하다.**
- (a) HTML/DOM 녹화 계열: hyperframes, html-video — 에이전트 친화(HTML은 LLM이 가장 잘 쓰는 표면), 렌더는 무겁지만 표현력 최상. **우리 현 스택이 이미 이 계열의 선두 포맷.**
- (b) 브라우저 canvas+WebCodecs 계열: opencut-classic, omniclip, react-video-editor, WebAV, diffusionstudio — 실시간 프리뷰와 익스포트가 같은 엔진이라 "띄워서 수정"에 최적. 인코딩 부품은 **mediabunny로 수렴 중**(2개 에디터가 실채택 + Remotion이 스폰서).
- (c) 서버 node-canvas/ffmpeg 계열: editly, FFCreator — 둘 다 1~2년 정체. 신규 채택 근거 없음.
- → 결론: 렌더 품질·에이전트 저작은 (a) hyperframes 유지, **수정 UI의 실시간 프리뷰가 필요해지면 (b)에서 mediabunny 기반 부품을 가져오는 하이브리드**가 현실적.

**② "띄워서 수정 UI"의 코드 레퍼런스 우선순위.**
1. **opencut-classic (MIT)** — 스냅/그룹이동/히트테스팅/그래프에디터/커맨드 패턴 undo까지 갖춘 유일한 통째-MIT 타임라인. 최우선 정독 대상.
2. omniclip (MIT) — 임베드 지향 경량판.
3. react-video-editor — 구조(타임라인 SDK 분리)는 참고하되 OpenVideo 라이선스 때문에 코드 복사 금지.
4. motion-canvas ui — NLE가 아니라 코드 스크럽 에디터. "AI가 만든 코드 결과물을 훑는 뷰"의 레퍼런스로만.
- 풀 타임라인이 과하면 **html-video의 "프레임/장면 단위 인라인 수정 + 부분 재렌더" 모델**이 구현 비용 대비 효용이 가장 높은 선례.

**③ 에이전트 계약은 "중간 IR JSON + 렌더 어댑터"로 수렴 중.**
- html-video의 content-graph, editly의 JSON5 스펙, CapCut 군의 draft JSON, OpenCut 리라이트의 Editor API/MCP/headless 선언 — 전부 같은 방향. 우리 스킬도 **에이전트가 쓰는 IR(장면 그래프 JSON)과 렌더 엔진(hyperframes)을 어댑터로 분리**해 두면, 나중에 수정 UI가 IR만 읽고 쓰면 되고 엔진 교체도 열린다. editly의 clip/layer/transition 어휘와 html-video의 node/edge 어휘가 IR 설계의 출발점.

**④ 라이선스 지뢰 지도.**
- 안전: MIT(opencut-classic, motion-canvas, omniclip, editly, WebAV 코어, FFCreator), Apache-2.0(html-video, capcut-mate), MPL-2.0(mediabunny — 파일 단위 카피레프트만).
- 주의/배제: **etro GPL-3.0**(전염), **react-video-editor OpenVideo 이중 라이선스**(기업 유료), **Kimu "Other"**(원문 확인 전 차용 금지), WebAV-Pro·pyJianYingDraft의 암호화 우회 영역.

**⑤ 경쟁 인식.**
- html-video(3.8k★, hyperframes를 기본 엔진으로 명시 채택)와 OpenCut 리라이트(MCP 서버·headless 선언), Kimu(AI 코파일럿 NLE)가 "AI 영상 생성 + 수정 UI" 좌표에 이미 들어와 있음. 우리 차별점은 렌더 엔진이 아니라 **파이프라인 품질 게이트·한국어·스킬 생태계 통합**에서 잡는 것이 타당.
