# nexu-io/html-video 정밀 해부

- 분석일: 2026-07-07 · 분석 대상: 로컬 클론 (`scratchpad/refs/html-video`, HEAD = `c414ecc` PR#52 머지)
- 라이선스: Apache-2.0 (`LICENSE`) · pnpm 모노레포 · Open Design(nexu-io) 팀 공식 프로젝트
- 한 줄 정의: **로컬 코딩 에이전트(14종)를 스폰해 "프롬프트/기사링크/깃헙레포 → content-graph JSON → 프레임별 단일 HTML → Playwright 녹화 → ffmpeg concat MP4"를 돌리는 GUI 스튜디오 + CLI**

패키지 지도:

| 패키지 | 역할 | 규모 |
|---|---|---|
| `packages/content-graph/src/index.ts` | IR 스키마 + validate + topoSort | 351줄 (파일 1개가 전부) |
| `packages/core/src/types/index.ts` | 엔진 어댑터·템플릿 메타·프로젝트 타입 (RFC-01/02/05) | 439줄 |
| `packages/core/src/project.ts` | 오케스트레이터 (frames 렌더→concat→오디오 mux) | 954줄 |
| `packages/adapter-hyperframes/src/render.ts` | "hyperframes" 렌더러 — 실체는 Playwright+ffmpeg | 617줄 |
| `packages/adapter-remotion/src/render.ts` | Remotion 네이티브 렌더 (bundle→renderMedia) | 242줄 |
| `packages/runtime/src/` | 에이전트 스폰 계층 (defs 14종, detect, spawn, ACP) | ~700줄 |
| `packages/cli/src/studio-server.ts` | **핵심 몸통** — HTTP 서버 + 대화 상태기계 + 전 프롬프트 | 3,472줄 |
| `packages/project-studio/public/app.js` | 스튜디오 프런트 (바닐라 JS SPA) | 3,257줄 |
| `templates/` | 템플릿 23개 디렉토리 (README 표기 21) + `NOTICE.md` | — |
| `research/` | RFC-01~09 스펙 문서 (설계 근거 원문) | — |

---

## 1. content-graph IR 스키마 전수 조사

출처: `packages/content-graph/src/index.ts` (전체), `packages/core/src/types/index.ts` (FrameRecord/Project).

### 1-1. 그래프 루트 (`ContentGraph`)

```ts
{
  schemaVersion: 1,
  intent: 'single-frame' | 'explainer' | 'data-viz' | 'promo' | 'comparison' | 'other',
  synopsis?: string,          // 한 줄 시놉시스 (studio 그래프 뷰 헤더용)
  nodes: Node[],
  edges: Edge[],
}
```

### 1-2. 노드 — 종류 딱 3개

공통(BaseNode): `id`(가독 슬러그, 예 "intro_logo"), `kind`, `label?`, `frameIntent?`(자유형 힌트: "intro"/"data-bar"/"quote"…), `durationSec?`(기본 3초, `DEFAULT_FRAME_DURATION_SEC`).

| kind | 고유 필드 | 용도 |
|---|---|---|
| `entity` | `props: Record<string,unknown>` (자유형: 로고 경로, 브랜드 컬러 등) | 브랜딩/아웃트로 |
| `data` | `data: unknown` (permissive JSON; 실전 프롬프트는 `{title?, unit?, items:[{label,value}]}` 강제 — server 3287행) | 수치 프레임 |
| `text` | `text: string` | 헤드라인/인용/카피 |

### 1-3. 엣지 — 3종

`{ from, to, kind: 'sequence'|'contrast'|'dependency', reason? }`

- **dependency만 순서를 강제** — Kahn 위상정렬 대상 (`topoSort`, 212행). 사이클은 validate에서 에러.
- **sequence는 soft preference** — indeg=0인 후보들 사이 타이브레이커로만 사용 (230행).
- **contrast는 정렬에 전혀 안 쓰임** — "frame-composer가 레이아웃 힌트로 읽는다"는 주석뿐, 소비하는 코드 없음(검색 결과 topoSort/validate 외 참조 無).

### 1-4. validate()

에러 코드 7종: `duplicate-node-id / edge-from-unknown-node / edge-to-unknown-node / self-edge / cycle / empty-graph / invalid-kind`. warnings 배열은 존재하나 채우는 코드 없음.

### 1-5. IR에 **없는 것** (우리 씬 매니페스트와의 결정적 차이)

- 레이아웃/컴포지션 정보 없음 (그리드, 영역, 요소 배치 전부 프레임 HTML 안에만 존재)
- 디자인 토큰 없음 (팔레트·타이포·모션 규칙이 IR 밖 — 프롬프트에 템플릿 HTML 4,000자 잘라 넣는 방식으로만 일관성 유지, server 3357행)
- 씬 전환(트랜지션) 개념 없음 — 프레임 MP4를 ffmpeg concat으로 하드컷 이어붙임
- 레이어 개념 없음 (프레임=단일 HTML 문서 1장)
- 애니메이션 스펙 없음 (durationSec 하나가 타이밍의 전부)
- 에셋 참조 없음 (에셋은 `Project.assets[]`에 따로 살고 프롬프트로만 연결)

### 1-6. IR ↔ 렌더 산출물 연결 (`FrameRecord`, core/types 333행)

```ts
{ graphNodeId, htmlPath, durationSec, posterPath?, order,
  engine?: 'remotion',        // 프레임 단위 엔진 오버라이드 (RFC-08/09 "enhance")
  nativeTemplateId?, data?,   // enhance 시 DataNode.data 스냅샷
  previewMp4Path? }
```

프레임 HTML은 `frames/<order>-<nodeId>.html`로 저장 (`project.ts` writeFrameHtml, 275행). 그래프는 `content-graph.json`으로 프로젝트 디렉토리에 영속 — **"IR을 디스크의 진실 소스로 커밋 가능하게"**가 명시된 설계 결정 (`research/2026-05-28-understand-anything-takeaways.md` §1: Understand-Anything의 knowledge-graph.json에서 차용, "렌더층과 데이터층 분리 → 스타일 변경에 re-chat 불필요, 데이터 수정은 영향 프레임만 갱신").

`Project`에는 그 외 `preferences`(aspect/durationTarget/fps/mood/brandColors/fontFamilies/language/commercial — **brandColors·mood 필드는 정의만 있고 프롬프트로 흘러가는 경로 미확인**), `soundtrack`, `exports[]`(최근 20개 이력) 등.

---

## 2. hyperframes 통합 방식 — **가장 중요한 발견: 사실상 통합이 아님**

`packages/adapter-hyperframes/src/render.ts` 12-13행 주석 원문:

> "Upstream Hyperframes was never required at runtime for this adapter — our generated HTML is plain inline-CSS+JS, chromium runs it as-is."

즉 **hyperframes CLI/렌더러/프레임워크를 런타임에 전혀 호출하지 않는다.** "hyperframes 엔진"은 브랜드명일 뿐, 실제 파이프라인은:

1. Playwright chromium headless + `recordVideo` (컨텍스트 생성 순간부터 **실시간 wall-clock 녹화**) — 71~82행
2. `file://`로 프레임 HTML 로드 → `durationSec`만큼 실제로 기다림 → webm 획득
3. ffmpeg `libx264 crf20`으로 mp4 인코딩 → `project.ts`의 concat demuxer(`-c copy`)로 이어붙임

### 2-1. 소비하는 hyperframes 자산 (전부 정적 자산 차원)

- 템플릿 8개가 `heygen-com/hyperframes` registry/examples의 **무수정 포크** (`templates/NOTICE.md`: warm-grain, swiss-grid, kinetic-type, nyt-graph, decision-tree, play-mode, product-promo, vignelli)
- 그 템플릿들의 `data-composition-src="compositions/x.html"` 컨벤션(서브컴포지션)을 지원하기 위해 **자체 인라인 플레이어를 주입** (render.ts `prepareSourceHtml`, 430행): 컴포지션 파일을 Node에서 읽어 `window.__COMPOSITIONS__` 맵으로 인라인 → `<template>` graft + 스크립트 재실행 → `window.__timelines` GSAP 타임라인들을 paused 등록 → 녹화 시작 순간 `__hvPlayAll()` 호출
- hyperframes의 `data-at` 타이밍 속성, `class="clip"`, variables API, 결정론적 seek 렌더 — **아무것도 사용 안 함** (전 패키지 grep으로 확인)

### 2-2. 실시간 캡처의 부작용과 그들의 대응 (엔지니어링 밀도가 높은 부분)

| 문제 | 대응 (render.ts) |
|---|---|
| 폰트 로딩 중 CSS 애니메이션이 이미 재생돼 오프닝이 녹화됨 | `addInitScript`로 **문서 파싱 시작 전 전 요소 `animation-play-state: paused` 주입**(`__hv_freeze`, 96행) → 폰트 준비 후 unfreeze = 진짜 t=0 |
| `document.fonts.ready`가 stylesheet 도착 전 즉시 resolve되는 버그 | 3단계: link 로드 대기 → 각 face 강제 `load()` → `fonts.ready` + rAF×2, 8초 하드캡 (155~223행) |
| 사용자가 준 duration이 애니메이션보다 짧아 잘림 | computed style + GSAP globalTimeline 자식 순회로 **유한 애니메이션 최장 길이 프로브**(repeat:-1 제외, 30초 캡) 후 `durationMode:'auto'`일 때만 연장 (234~273행) |
| 명시 duration인데 녹화가 모자람/넘침 | ffmpeg `tpad=stop_mode=clone`으로 마지막 프레임 홀드 후 `-t`로 정밀 트림 (349행) |
| 페이지 로드~애니메이션 시작 dead lead-in | `leadInMs` 측정 후 `-ss`로 앞부분 절삭 (341행) |

**함의: 렌더는 결정론이 아니다.** 60초 영상은 60초 이상 실녹화, 부하 시 프레임 드랍 가능, fps는 ffmpeg 출력 파라미터일 뿐. hyperframes 본연의 seek 기반 프레임 단위 결정 렌더와 정반대.

### 2-3. 엔진 어댑터 계약 (RFC-01, core/types 133행)

`EngineAdapter { id, capabilities, validate(), render(), preview?(), renderToHtml?(), listNativeTemplates?() }` — validate는 파일 존재 확인 수준 (`adapter-hyperframes/src/validate.ts`). **Remotion 어댑터는 실제 구현돼 있고**(bundle→selectComposition→renderMedia) "데이터 프레임 네이티브 강화"(숫자 롤링/막대 성장, 템플릿 `frame-data-rollup` 1종)에 쓰인다. 프레임별 엔진이 섞이면 concat demuxer 대신 concat **filter**+재인코딩 (project.ts 736행 주석: 타임베이스 불일치로 PTS 누적 오류 방지).

---

## 3. 스튜디오 수정 UI

프런트는 React 아님 — 바닐라 JS 3,257줄 (`packages/project-studio/public/app.js`), 서버는 Node http + SSE. (`packages/studio-next/`는 Vite+React 스파이크만 있고 본편 아님.)

### 3-1. 편집 가능한 것 / 불가능한 것

| 대상 | 방식 | 근거 |
|---|---|---|
| **텍스트 (프레임 내)** | ✅ 2경로. (1) 프리뷰 iframe에서 `[data-hv-text]` 요소 hover 하이라이트→클릭→`contenteditable` 직접 편집, blur 시 커밋. (2) 우측 패널 텍스트 필드 목록(입력 500ms 디바운스 자동저장) | app.js `attachTextEditOverlay`(1972행), `refreshTextFields`(2304행) |
| 텍스트 커밋 방식 | 디스크의 프레임 HTML을 fetch → DOMParser로 파싱 → 같은 `data-hv-text` 키의 textContent만 치환 → PUT `raw-html`. **재렌더 없음** (프리뷰는 라이브 HTML iframe이므로 즉시 반영) | `commitInlineTextEdits`(2053행) |
| **타이밍** | △ 직접 조절 UI 없음. (a) 채팅 카드 서브플로우 "改时长"으로 per-frame 초 재설정→전 프레임 재생성, (b) `fit-durations` API: 내레이션 글자수 비례 배분(0.18초/자, 프레임 최소 2초)으로 그래프만 재타이밍(`preserveFrames:true` — 렌더된 프레임 유지) | studio-server 1265행 |
| **레이아웃/스타일** | ❌ GUI 없음. "换风格"(restyle) = 그래프 텍스트 그대로 두고 프레임 HTML만 에이전트가 전부 재생성 (`restyleOnly`, server 3199행) | — |
| **프레임 순서 재배열** | ❌ 미구현 (README는 "reorder" 표기하나 strip에 드래그 코드 없음 — grep 확인) | app.js 2150~ |
| **그래프 직접 편집** | ❌ 그래프 모달은 JSON 읽기 전용 표시 (`openGraphModal`, 2247행) | — |

### 3-2. 프리뷰 아키텍처

- 중앙 프리뷰 = 프레임 HTML의 **라이브 iframe** (`sandbox="allow-scripts allow-same-origin"`), 네이티브(Remotion 강화) 프레임만 `<video>`(미리 렌더한 `NN.preview.mp4`). 디자인 원본 해상도로 렌더 후 `--preview-scale` transform 축소, ResizeObserver 동기화.
- 하단 프레임 스트립 = 프레임별 미니 iframe 썸네일(애니메이션 실재생), `?v=<updatedAt>` 캐시버스트. 클릭=활성 전환+**핀**(focusFrameId), 핀 상태에서 채팅하면 그 프레임만 단독 재생성(iterate 프롬프트에 `focusFrameId` 전달).
- 데이터 프레임 썸네일에 "⚡ Enhance/revert" 배지 → Remotion 강화 토글 (비파괴: `htmlPath` 보존, `unenhanceFrame`으로 완전 복귀).

### 3-3. 편집→저장→재렌더 루프 / 부분 재렌더

- 텍스트 편집: 저장만, 재렌더 불필요 (iframe 라이브).
- 최종 MP4: 항상 **전 프레임을 각각 다시 녹화** 후 concat (project.ts exportMp4 381행). 프레임 MP4 캐시/증분 없음 — durationSec만 같아도 매 export마다 전량 재녹화.
- 부분 "재생성"은 있음: 핀 프레임 단독 HTML 재작성, restyle(전 프레임 HTML만), fit-durations(그래프만). 부분 "재렌더(인코딩)"는 없음.

---

## 4. 에이전트 인터페이스

**MCP 아님, 스킬 아님.** 스튜디오 서버가 로컬 에이전트 CLI를 **child process로 스폰해 stdout을 파싱**하는 구조.

### 4-1. 런타임 계층 (`packages/runtime/`)

- `src/defs/` 14종: claude, codex, cursor-agent, gemini, grok, qwen, opencode, copilot, aider, hermes, trae-cli, qoder, amr(Open Design vela, ACP JSON-RPC), anthropic-api(HTTP kind).
- `AgentDef` (types.ts): `bin`+`binFallbacks`+`resolveBinFallback`(번들 npm에서 바이너리 해석), `buildArgs(prompt)`, `streamFormat: 'plain'|'claude-stream'|'json-event-stream'|'acp-json-rpc'`, `promptViaStdin`, `extraDetect`(설치됐지만 미로그인 감지), `httpHandler/httpProbe`.
- `detect.ts`: PATH `which` 병렬 프로브(Windows 대비 8초 타임아웃 — 2초면 오탐된다는 실측 주석).
- 호출은 전부 원샷 `callAgentSimple`(server 3455행): 스폰→text 이벤트 버퍼→종료. 세션/툴콜 없음.

### 4-2. 프롬프트→IR 경로: 하드코딩 대화 상태기계

`studio-server.ts`의 `detectPhase`(1879행) — **LLM이 아니라 정규식이 대화 단계를 라우팅**한다:

```
opener → [hv-options meta.phase:"type"] 콘텐츠 유형 4택
       → content (자유 채팅; 소스 자료 있으면 자동 스킵)
       → [hv-options "style"] 스타일 프리셋 or 템플릿
       → [hv-form "format"] aspect / per-frame초 / 프레임수 / Remotion강화 토글
       → [hv-confirm] → generate
생성 후: edit-menu 카드(风格/内容/时长) → restyle / iterate-content / iterate-format / (핀)단일 iterate
```

- 카드 프로토콜: 에이전트에게 ` ```hv-options / hv-form / hv-confirm ` 펜스 JSON을 **문자 그대로** 뱉게 시키고(meta.phase 포함, 프롬프트에 완성 JSON을 통째로 박아둠), 프런트가 파싱해 버튼 UI로 렌더. 사용자가 카드 대신 자유 텍스트로 답하면 `parseFormatReply`(2306행)가 "16:9 / 5s / 10" 류를 구조 파싱해 구제.
- **주제 잠금**: 첫 사용자 메시지를 `openingTopic`으로 200자 고정, "随便/랜덤" 답변이 문자 그대로 주제가 되는 사고("Open Design 홍보 요청이 '무작위성 해설 영상'이 된 사건")를 프롬프트 규칙으로 차단 (2197~2219행, 3220행).

### 4-3. 생성 실행: split multi-frame (`runSplitMultiFrameGenerate`, 3140행)

한 번에 그래프+HTML N장을 시키면 `claude --print`가 100초+ 타임아웃에 1바이트를 뱉는다는 실측 → **1콜=그래프 JSON, 이후 노드당 1콜=프레임 HTML**로 분할. 각 단계 SSE 진행 이벤트.

신뢰성 장치 (전부 실측 주석 딸림):
- 스켈레톤 강제: "예시 없으면 1바이트, 있으면 ~10KB" — 그래프/프레임 프롬프트 모두 완성형 스켈레톤 포함 (2859행)
- `parseGraphJsonTolerant`(2413행): trailing comma 제거 → 문자열 내 맨따옴표 이스케이프 2단 수리
- 빈 응답 1회 재시도(더 짧은 프롬프트), 프레임 상한 10
- iterate 시 기존 HTML 원문을 프롬프트에 안 넣음 — "6-8KB HTML 포함 시 claude --print가 70% 확률로 1바이트 반환(수동 검증)" → 텍스트+팔레트+폰트 요약만 추출(`summariseHtmlForIterate`) 후 **재작성** 지시 (2960행)
- 그라운딩 규칙: 모든 노드 text는 소스의 실명·수치 인용 필수, "看清本质/第一性原理" 류 만능 필러 명시적 금지, 데이터 프레임 비교가능성 규칙(단위·자릿수 혼합 금지) (3245, 3287행)
- `design.md`/`frame.md` 첨부 자동 감지(파일명+헤딩 핑거프린트) → "디자인/모션 스펙으로 복종" 블록 분리 주입 (2376행)
- 전송 프롬프트를 `last-prompt.txt`로 디스크 덤프(디버깅용)

### 4-4. 소스 인제스트 (`packages/cli/src/fetch-source.ts`)

에이전트가 아니라 **서버가** URL을 fetch: 기사는 자체 정규식 본문 추출 + 자체 htmlToMarkdown(8,000자 캡, WeChat 공중호 대응), GitHub 레포는 공개 API로 description+톱레벨 트리+README. 결과 마크다운을 프롬프트에 인라인.

---

## 5. 오디오 / TTS / 자막

- **단일 프로바이더 MiniMax** (`packages/core/src/minimax.ts`): TTS=`speech-02-turbo`, 음악=`music-1.5`(2.6은 자기들 키로 180초 무응답 실측이라 회피; 1.5는 instrumental 플래그가 없어 허밍 가사 플레이스홀더 주입). 응답 hex 문자열 → MP3 버퍼 → 프로젝트 에셋 저장.
- **내레이션 작성은 에이전트**: "프레임당 정확히 1문장, 프레임 순서대로" 프롬프트 → `narrationByFrame` (server 546~576행). 보이스 6종 프리셋(MiniMax voice_id 하드코딩, 중국어권 보이스 — app.js 29행).
- **fit-durations**: 내레이션 글자수 비례로 프레임 durationSec 재배분 (0.18초/자 휴리스틱). **실제 TTS 오디오 길이와의 동기화는 아님** — 합성 전 추정치.
- 믹싱은 export 시 ffmpeg 1회: 음악 -18dB 더킹 + fade in/out(기본 자동 페이드아웃 ≤1.5s), amix, `-shortest` (project.ts `muxAudioWithFfmpeg`, 833행). 프레임별 오디오는 "v2 concern"으로 명시 유보 (types 375행).
- **자막: 없음.** capabilities.ts에 `subtitles: ['burn-in','sidecar']` 선언만 있고 구현 경로 없음(전 코드 grep — caption/subtitle은 설정 패널 라벨뿐). 워드 타임스탬프·Whisper·가라오케 전무.

---

## 6. 우리와의 차이 분석 (결론)

### (a) 훔칠 것 — 이들이 잘한 것

1. **IR을 디스크의 진실 소스로**: `content-graph.json` 영속 + "restyle은 그래프 보존·HTML만 재생성, re-time은 preserveFrames로 렌더물 보존" 같은 **부분 무효화 규칙**. 우리 씬 매니페스트에도 "어떤 편집이 무엇을 무효화하는가" 매트릭스를 계약으로 박을 것.
2. **`data-hv-text` 안정 키 계약**: 에이전트 생성 시점에 모든 가시 텍스트에 stable key를 태깅시키는 것 하나로 (i) iframe 클릭 편집, (ii) 폼 필드 패널, (iii) iterate용 HTML 요약 추출이 전부 공짜로 나온다. 비용 대비 효과가 가장 큰 설계. 우리는 텍스트뿐 아니라 `data-scene-role`(타이밍·레이아웃 슬롯)까지 확장 가능.
3. **split-generate 실측 지식**: "그래프 1콜 + 프레임당 1콜", 스켈레톤 미포함 시 빈 응답, 대형 HTML 인라인 시 70% 무응답 — `--print` 원샷 파이프라인의 함정들이 주석으로 문서화돼 있음. 우리 스킬의 서브에이전트 분할 근거로 그대로 유효.
4. **프롬프트 방어 패턴**: openingTopic 잠금("随便=디테일 위임, 주제 변경 아님"), 만능 필러 금지문("어떤 기사에도 맞는 문장이면 틀린 것"), 데이터 비교가능성 규칙, tolerant JSON 수리, 빈 응답 재시도. 전부 이식 가치 있음.
5. **durationMode 'explicit' vs 'auto'** 이원화 + 애니메이션 길이 프로브 + `tpad` pad-then-trim: "사용자 지정은 하드캡, 미지정은 애니메이션에 맞춰 연장" — 우리 씬 타이밍 계약에도 동일 구분 필요.
6. **실시간 캡처 안정화 3종**(frame-0 freeze / 3단계 폰트 대기 / lead-in 트림): 우리가 hyperframes 결정 렌더를 쓰면 대부분 불필요하지만, 프리뷰 썸네일이나 폴백 캡처 경로엔 그대로 유용.
7. **템플릿 메타 스키마** (`template.html-video.yaml`): `best_for/not_for`, `inputs.schema`(JSON Schema)+examples, 3층 provenance(origin 디자인 계보 / via_skill 라이선스 주체 / transformation 변경 내역), 성능 레퍼런스. 우리 블루프린트 카탈로그 메타에 이식할 만함.
8. **묻는 UI, 침묵하는 no-op 금지**: 모호한 "고쳐줘"는 추측하지 않고 edit-menu 카드로 라우팅 — "지시가 안 먹는 것 같다"는 사용자 불만을 상태기계로 해결한 사례.
9. **fit-durations**(내레이션 분량→씬 타이밍 자동 배분) 아이디어 자체 — 단, 아래 (b)처럼 실오디오 기반으로 격상해야 함.

### (b) 이들이 안 한 것 = 우리 차별화 여지

1. **진짜 hyperframes**: seek 기반 결정론 렌더, `data-at` 타이밍, 서브컴포지션/variables, lint/validate, Lambda — 전부 미사용. **"hyperframes 채택"은 사실상 마케팅이고 실체는 화면 녹화기.** 우리가 결정 렌더 + 프레임 정밀 타이밍을 쓰는 것만으로 품질·재현성에서 구조적 우위.
2. **IR에 디자인 시스템 없음**: 스타일 일관성이 "템플릿 HTML 4,000자 프롬프트 인라인"에 매달려 있음. auto_kairos식 세밀 디자인 토큰(팔레트·타이포 스케일·모션 커브·간격)을 씬 매니페스트의 1급 시민으로 두면 이들이 못 하는 "토큰 단위 수정→해당 씬만 재컴파일"이 가능.
3. **품질 게이트 전무**: 프레임 HTML이 제대로 렌더되는지 아무도 검증 안 함(validate는 파일 존재 체크). 씬 단위 하드게이트(스크린샷 채점, 텍스트 오버플로 검사, 시각 판정)는 통째로 비어 있는 영역 — deck-factory/card-shorts 게이트 자산 직결.
4. **씬 전환 없음**: 하드컷 concat뿐. 트랜지션 문법(크로스페이드·와이프·매치컷)을 IR에 넣으면 즉시 차별화.
5. **오디오-영상 동기 없음**: 내레이션은 글자수 휴리스틱, 자막 0, 워드 타임스탬프 0. 한국어 TTS(HeyGen/ElevenLabs/Kokoro) + Whisper 정렬 + 자막/캡션은 완전 공백지. MiniMax 보이스도 중국어권 프리셋.
6. **에이전트 네이티브 아님**: GUI 스튜디오가 주인공이고 에이전트는 텍스트 생성기로 강등(원샷 스폰, 툴 없음). "스킬로서의 영상 생성"(에이전트가 IR을 직접 소유·검증·수리)은 우리 쪽 구도가 우월. 반대로 이들의 GUI 편집 루프(iframe 클릭 편집)는 우리 대시보드가 배울 지점.
7. **부분 재렌더 없음**: export마다 전 프레임 재녹화. 프레임 해시 기반 증분 렌더 캐시는 손쉬운 차별화.
8. **레이아웃·타이밍 GUI 편집 없음, 그래프 편집 없음, 프레임 재배열 없음** — "씬 편집 대시보드"의 본론이 전부 미개척.

### (c) Apache 2.0 코드 재사용 범위

- 본체·템플릿 전부 Apache-2.0 (`LICENSE`, 템플릿 yaml의 `license.spdx: Apache-2.0`). **상업적 이용·수정·재배포 모두 허용.** 조건: LICENSE 사본 동봉, 변경 사실 고지, 기존 저작권/NOTICE 고지 유지(우리 배포물에 `templates/NOTICE.md` 상당의 귀속 이전), 특허 그랜트 포함(특허 소송 시 라이선스 종료 조항 유의).
- 직접 재사용 후보: `content-graph` 패키지(351줄, 의존성 제로 — validate/topoSort 그대로 이식 가능), `parseGraphJsonTolerant`, render.ts의 폰트 대기/freeze 블록, `muxAudioWithFfmpeg`/`concatFramesWithFfmpeg`, fetch-source의 htmlToMarkdown. 단 CLAUDE.md·프롬프트 문구도 Apache 범위이므로 문구 차용 자체는 적법하나, 우리 스킬 품질 기준상 재작성 권장.
- 역주의: 이들의 hyperframes 포크 템플릿 8종은 원 저작권이 heygen(역시 Apache-2.0)이므로 이중 귀속 표기 필요.

### 총평

**"컨셉은 우리와 겹치고 실행은 다른 층에 있다."** 이들은 (i) IR-렌더 분리, (ii) 편집 가능 텍스트 계약, (iii) 원샷 CLI 에이전트의 신뢰성 공학에서 실전 지식이 농축된 레퍼런스다. 반면 렌더 결정론·디자인 토큰·품질 게이트·전환·오디오 동기·한국어 — 우리가 계획한 축은 전부 비어 있다. 훔칠 것은 계약(IR 영속·data-hv-text·무효화 규칙)이고, 싸울 곳은 렌더 품질과 게이트다.
