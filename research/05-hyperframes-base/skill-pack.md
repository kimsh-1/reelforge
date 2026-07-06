# HyperFrames 스킬팩 해부 보고서 — "세세 설정 가능 영상 스킬 + 씬 편집 대시보드" 설계 재료

- 조사일: 2026-07-07
- 대상: `/home/seunghyeong/.claude/skills/` 아래 hyperframes 9개 스킬 (로컬 설치본 전수)
- 원칙: 파일에서 직접 확인한 내용만 기술. 파일경로 근거 병기.

---

## 0. 스킬팩 지도

| 스킬 | 역할 | 핵심 파일 |
|---|---|---|
| `hyperframes` | 라우터(READ FIRST). 캐퍼빌리티 맵 + 11개 워크플로우 인텐트 라우팅 | `hyperframes/SKILL.md` |
| `hyperframes-core` | **컴포지션 계약** — data-* 타이밍, clip/track, 서브컴포지션, variables, 결정론 | `hyperframes-core/SKILL.md` + references 12개 |
| `hyperframes-animation` | 모션 전부 — 원자 rule 40여 개, 블루프린트 15, 전환 카탈로그, 런타임 어댑터 7종 | `hyperframes-animation/SKILL.md`, `rules-index.md`, `blueprints-index.md`, `transitions/` |
| `hyperframes-keyframes` | seek-safe 키프레임 저작 계약 + `hyperframes keyframes` 진단 CLI | `hyperframes-keyframes/SKILL.md` |
| `hyperframes-media` | 오디오 엔진(audio.mjs) — TTS/BGM/SFX/전사/자막/배경제거 | `hyperframes-media/SKILL.md`, `scripts/audio.mjs` |
| `hyperframes-creative` | 디자인 스펙(frame.md), 프레임 프리셋 13종, 팔레트 9종, 내레이션/비트 | `hyperframes-creative/SKILL.md`, `references/design-spec.md` |
| `hyperframes-registry` | `hyperframes add`로 블록 97종·컴포넌트 6종 설치/와이어링 + 신규 기여 절차 | `hyperframes-registry/SKILL.md`, `references/discovery.md` |
| `hyperframes-cli` | init/lint/validate/inspect/snapshot/preview/play/render/publish/lambda | `hyperframes-cli/SKILL.md`, `references/preview-render.md` |
| `remotion-to-hyperframes` | Remotion→HF 포팅(단방향) + SSIM 평가 하네스. API 매핑표는 우리 컴파일러 참고자료 | `remotion-to-hyperframes/SKILL.md`, `references/api-map.md` |

핵심 명제: **HyperFrames는 HTML을 비디오로 렌더한다.** 컴포지션 = DOM이 `data-*`로 타이밍을 선언하고, 애니메이션 런타임이 seek 가능하고, 미디어 재생을 프레임워크가 소유하는 HTML 파일 (`hyperframes/SKILL.md:20`).

---

## 1. 컴포지션 계약 전체 (hyperframes-core) — 우리 "씬 매니페스트"의 컴파일 타깃

### 1.1 두 가지 루트 형태 (`SKILL.md:33-41`, `references/sub-compositions.md`)

- **Standalone**(최상위 `index.html`): `<body>` 직하에 `<div data-composition-id>`. `<template>` 래핑 금지(래핑하면 전부 숨김).
- **Sub-composition**(`data-composition-src`로 로드): 루트를 반드시 `<template>`로 감쌈. **런타임은 `<template>` 내용만 clone** — `<head>`의 style/script는 전부 버려지므로 `<style>`/`<script>`를 template 안에 넣어야 함(운송 규칙).

### 1.2 data-* 속성 전체 목록 (`references/data-attributes.md`)

**컴포지션 루트:**

| 속성 | 필수 | 의미 |
|---|---|---|
| `data-composition-id` | 예 | 고유 ID. `window.__timelines` 레지스트리 키와 정확히 일치 |
| `data-width` / `data-height` | 예 | 픽셀 프레임 크기 (1920x1080 / 1080x1920 / 1080x1080) |
| `data-duration` | 조건부 | 렌더 길이(초). **컴파일 타임에 1회 읽음** — 스크립트/`--variables`로 루트 duration을 바꿀 수 없음(클립 duration은 라이브 DOM에서 재독). GSAP 타임라인·유한 CSS/WAAPI·Lottie가 있으면 생략 가능(자동 추론), Three.js·무한 애니·무신호면 필수(`root_composition_missing_duration_source` lint) |
| `data-fps` | 아니오 | fps 힌트(렌더 플래그가 오버라이드 가능) |
| `data-composition-variables` | 아니오 | `<html>`에 변수 선언 JSON 배열 |

**클립(타이밍 붙는 자식):**

| 속성 | 필수 | 의미 |
|---|---|---|
| `id` | 예 | 안정적 DOM ID |
| `data-start` | 예 | 시작 초, 또는 **클립 참조식** (`intro`, `intro + 2`, `intro - 0.5`) |
| `data-duration` | div/img/서브컴포지션 필수 | 길이(초). video/audio는 미디어 길이로 디폴트 가능 |
| `data-track-index` | 예 | 트랙. 같은 트랙 시간 겹침 금지 |
| `data-media-start` | 아니오 | 소스 미디어 내부 오프셋(초) — 파일 트리밍 없이 앞부분 스킵 |
| `data-volume` | 아니오 | 정적 볼륨 0~1(페이드는 타임라인에서 `volume` 트윈) |
| `data-has-audio` | 아니오 | `<video>`가 오디오 트랙 있음을 명시 |

추가 저작 속성: `class="clip"`(가시 타임드 요소 필수 — 없으면 전체 길이 동안 계속 보임; `<video>`/`<audio>`는 생략), `data-layout-allow-overflow`(inspect 오버플로 의도 표시 — 하위트리 상속되어 perception 체크까지 침묵시키는 블라스트 반경 주의), `data-layout-bleed`, `data-layout-ignore`. 레거시: `data-layer`→`data-track-index`, `data-end`→`data-duration` (`data-attributes.md:53-70`).

가시성 창은 **양끝 포함**: `start ≤ t ≤ start+duration`, 마지막 프레임이 종료 상태를 홀드 (`data-attributes.md:37`).

**서브컴포지션 호스트(클립이 다른 파일을 로드할 때):** `data-composition-id`(내부 ID와 정확 일치 필수), `data-composition-src`, `data-width/height` 필수 + `data-variable-values`(인스턴스별 변수 오버라이드 JSON) (`data-attributes.md:39-50`).

### 1.3 트랙/클립 모델 (`references/tracks-and-clips.md`)

- 트랙은 **시간 겹침 개념이지 시각 스태킹이 아님** — 앞뒤는 CSS `z-index`. 같은 트랙 겹침은 lint 실패 + 렌더 미정의.
- 관례: 트랙 0 = 베이스 비디오(A-roll), 1+ = 씬/오버레이/자막, 10+ = 오디오.
- **상대 타이밍**: `data-start="intro + 2"` 식 참조. 같은 컴포지션 내부만 해석, 참조 대상은 duration이 알려져 있어야 하고, 순환 금지, 음수 오프셋 = 크로스페이드용 겹침(다른 트랙 필수).

### 1.4 서브컴포지션 와이어링 (`references/sub-compositions.md`, `references/composition-patterns.md`)

- 모듈형 오케스트레이터 패턴: `index.html`은 얇게(슬롯 선언 + 시간 배치 + 루트 오디오 + 거의 빈 루트 타임라인), 씬 애니메이션은 전부 서브컴포지션 안.
- 렌더에서만 터지는 3대 함정(정적 검사 통과): ① `<style>`을 `<head>`에 둠(template 밖 → CSS 소실), ② 호스트 id ≠ 내부 template id(타임라인 못 찾고 45초 대기 후 정지 프레임), ③ 루트를 클래스로 스타일(CSS 스코퍼가 `[data-composition-id] .frame` 후손 선택자로 바꿔 루트 매칭 실패 — `#root`로만 스타일). 유일한 게이트는 `snapshot` 눈검사 (`hyperframes-cli/SKILL.md:87-113`).
- 호스트 클립 `data-duration` = 슬롯 가시창. 내부 타임라인이 짧으면 마지막 프레임 홀드; 슬롯이 짧으면 blank(`subcomposition_blanks_before_host` lint).
- 서브컴 내부 엔트런스는 `gsap.from()` 대신 `gsap.fromTo()`(seek-back 재생 안정).
- 아키타입 4종: A(콘텐츠 씬), B(호스트 미디어 + 메인타임라인 드라이버 — 모든 `<video>/<audio>` 필수 패턴), C(멀티씬 머지 — 내부 phase div), D(루트 오디오 + 내부 audio-reactive는 프리베이크 곡선 샘플링) (`composition-patterns.md:127-235`).

### 1.5 Variables 주입 (`references/variables-and-media.md`)

- 선언: `<html data-composition-variables='[{"id","type","label","default", ...}]'>`. 타입 5종: `string`(placeholder/maxLength), `number`(min/max/step/unit), `color`, `boolean`, `enum`(options 필수). **Studio 편집 UI가 이 스키마를 소비** — 대시보드 폼 자동 생성의 근거.
- 소비: init 때 1회 `window.__hyperframes.getVariables()` (렌더 중 불변).
- 3개 주입 지점: ① 선언 default, ② 서브컴 호스트 `data-variable-values`(인스턴스별), ③ 렌더타임 `--variables '{...}'` / `--variables-file` (+ CI용 `--strict-variables`).
- 두 JSON 형태 구분: 선언 = 배열(스키마), 값 = id 키 객체.
- 미디어 컬러그레이딩은 `data-color-grading` JSON 안에서 `$gradingPreset` / `${gradingIntensity}` 변수 참조 가능 (`variables-and-media.md:39`).

### 1.6 미디어 재생 소유권 (`references/variables-and-media.md:48-90`)

- **`<video>/<audio>`는 호스트 루트 직계 자식만** — 서브컴 template/래퍼 div 안이면 seek/decode 안 돼 blank/black. lint/validate/inspect 전부 못 잡음(공식 블라인드스팟, `hyperframes-cli/references/lint-validate-inspect.md:26-32`).
- 컴포지션 코드에서 `play()/pause()/seek` 호출 금지 — 프레임워크가 재생 소유.
- 오디오는 항상 별도 `<audio>`(같은 파일이어도), `<video>`는 muted+playsinline.
- 볼륨 페이드/더킹은 타임라인 `volume` 트윈(프리뷰=렌더 동일 적용), `data-volume`은 정적 기준선.
- 서브컴 타임라인은 호스트 요소를 못 건드림 → 호스트 미디어의 씬별 모션은 **메인 타임라인에서 글로벌 시간**(씬 로컬시간 + 슬롯 data-start)으로 저작.

### 1.7 결정론 렌더 규칙 (`references/determinism-rules.md`)

- 렌더러는 프레임을 **매번 fresh seek** — "같은 t → 같은 픽셀". 순서 무관/병렬 샘플링.
- GSAP 계약: 페이지 로드 시 **동기적으로** `gsap.timeline({paused:true})` 생성 → `window.__timelines["<id>"]` 등록(키 = 루트 data-composition-id). async/Promise/setTimeout/이벤트핸들러 안에서 타임라인 구축 금지. `tl.play()` 금지. 후행 씬 클립에 `gsap.set()` 금지(로드 시 DOM에 없음 → `tl.set(sel,vars,time)`).
- 금지: `Date.now()`/`performance.now()`, 비시드 `Math.random()`, 렌더타임 네트워크, hover/scroll/pointer 상태, `repeat:-1`(유한 카운트 `Math.max(0, floor(duration/cycle)-1)`).
- **애니메이션 프로퍼티 허용목록**: `opacity, x, y, scale, rotation, color, backgroundColor, borderRadius, transforms`. `display/visibility` 트윈 금지, `width/height/top/left` 레이아웃 트윈 금지.
- 레이아웃 계약: 정적 HTML/CSS로 종단 상태 먼저 구축 → 거기서 애니. `<br>` 본문 금지, transform 대상은 block+sized, 텍스트 피팅은 `window.__hyperframes.fitTextFontSize()` / `pretext.prepare→layout`(순수 산술, ~0.0002ms).

### 1.8 검증 체인 (`hyperframes-core/SKILL.md:69-78`, `hyperframes-cli/references/lint-validate-inspect.md`)

`lint`(정적: id 누락·트랙 겹침·미등록 타임라인) → `validate`(헤드리스 크롬: 콘솔 에러 + WCAG 대비, 5개 타임스탬프 샘플) → `inspect`(타임라인 스윕 레이아웃: 텍스트 오버플로/클리핑/캔버스 이탈, `--samples`/`--at`/`--tolerance`/`--strict`) → 서브컴 프로젝트는 `snapshot --at <중간점들>` 눈검사 → `preview` 사용자 검토 → 승인 후 `render`.

**`*.motion.json` 사이드카**(inspect 자동 발견): `appearsBy / before / staysInFrame / keepsMoving` 4종 어서션으로 모션 의도를 기계 검증 — "렌더 보고 눈으로 확인"의 자동화 근사. 셀렉터 미매칭도 `motion_selector_missing`으로 시끄럽게 실패 (`lint-validate-inspect.md:86-111`). → **우리 파이프라인의 씬별 QA 게이트로 그대로 채용 가능.**

### 1.9 플랜 레이어: STORYBOARD.md / SCRIPT.md (`references/storyboard-format.md`, `references/script-format.md`)

- `STORYBOARD.md`: YAML 프론트매터(format/message/arc/audience) + `## Frame N — Title` 섹션(status: outline→built→animated, src, duration, transition_in, scene, voiceover, poster + 임의 키는 `extra`에 보존). 파서 관대(경고만), `StoryboardManifest`로 파싱, Studio가 콘택트시트로 렌더, `GET /api/projects/<id>/storyboard` 읽기 API 존재.
- `SCRIPT.md`: 확정 내레이션(Voice/Voice settings/Voice direction 헤더 + 라인별 Time/Delivery/들여쓴 발화 텍스트). TTS가 발화 텍스트만 추출, 실제 타이밍은 TTS 단어 타임스탬프가 대체.
- → **우리 scene_specs.json의 중간 표현이 이 두 파일과 거의 동형.** 대시보드가 storyboard API를 그대로 읽을 수도 있음.

---

## 2. 오디오/미디어 엔진 (hyperframes-media)

### 2.1 단일 엔진 계약 — `scripts/audio.mjs` (`SKILL.md:10-33`, `scripts/audio.mjs` 헤더)

```
node <MEDIA_DIR>/scripts/audio.mjs --request ./audio_request.json --hyperframes . --out ./audio_meta.json
```

- **입력** `audio_request.json`: `{ provider?(auto|heygen|elevenlabs|kokoro), lang?, speed?, lines: [{ id, text, sfx?: [names] }], bgm: { mode?(retrieve|generate|none), query?, prompt?, blob?, archetype?, arc? } }`. `id`가 호출자 모델(프레임/씬 번호)로 조인.
- **출력** `audio_meta.json`: `{ tts_provider, voice_id, bgm{path,volume,mode,query?,duration_s}, bgm_pending, voices:[{id, path, duration_s, words:[{id,text,start,end}]}], sfx:[{id,name,file,source,offset_s,duration_s,volume}], total_duration_s }`.
- `--only tts,bgm,sfx`로 부분 실행 + 기존 out에 **머지**(TTS·BGM 먼저, SFX는 큐 확정 후).
- TTS 동시성은 `HYPERFRAMES_TTS_CONCURRENCY`(기본 4)로 캡 — 무제한 Promise.all이 로컬 모델 콜드스타트 OOM 낸 실사례 2건 반영 (`audio.mjs:71-79`).
- **단일 스위치**: HeyGen 자격증명 유무(`$HEYGEN_API_KEY` / `$HYPERFRAMES_API_KEY` / 프로젝트 `.env` / `~/.heygen`)가 세 능력 전부의 경로를 결정. Preflight(`npx hyperframes auth status`) 후 사용자 선택 대기 규칙 있음(자율 모드는 노트 후 로컬 진행 허용, `SKILL.md:37-46`).

### 2.2 TTS 프로바이더 체인 (`references/tts.md`)

| 순서 | 프로바이더 | 트리거 | 단어 타임스탬프 | 비고 |
|---|---|---|---|---|
| 1 | HeyGen Starfish | HeyGen 자격증명 | **네이티브 있음**(`--words` 한 번에) | REST 직결 스크립트 `scripts/heygen-tts.mjs` 사용(공개 CLI는 Kokoro 전용 빌드일 수 있음). 영어 기본 보이스 Marcia 고정 |
| 2 | ElevenLabs | `$ELEVENLABS_API_KEY` | 없음 → transcribe 체인 | `--speed` 무시 |
| 3 | Kokoro-82M(로컬) | 항상(키 불요) | 없음 → transcribe 체인 | 54 보이스, 접두사=언어(a영/b영/e서/f불/h힌/i이/j일/p포/z중), 비영어는 espeak-ng 필요 |

속도 가이드 0.7~1.2, `--words`는 자막 파이프라인과 드롭인 호환되는 flat `[{id,text,start,end}]` 기록. **한국어**: Kokoro 언어 목록(en/es/fr/hi/it/pt/ja/zh)에 **ko 없음** — 한국어 TTS는 HeyGen/ElevenLabs 경로 또는 외부 필요 (확인된 갭).

### 2.3 BGM / SFX (`references/bgm.md`, `references/sfx.md`)

- BGM: 자격증명 있으면 HeyGen 카탈로그 **검색**(`/audio/sounds?type=music`, 상위 1곡 다운로드 → `assets/bgm/track.mp3`, 볼륨 0.8/무음영상 0.9); 없으면 **로컬 생성**(Lyria RealTime → MusicGen small, 분리 프로세스로 detached 스폰, `bgm_pending:true` → `scripts/wait-bgm.mjs`로 폴링, `bgm_status.json`). 무드 추론 `inferBgmPrompt()`: 산업 키워드(crypto/finance/creative/기본SaaS별 프롬프트+BPM) → 아키타입 → 감정 아크. BGM 실패는 절대 렌더를 막지 않음.
- SFX: 자격증명 있으면 HeyGen 검색(min_score 0.4 — 좋은 히트가 0.5~0.67이라 API 기본 0.7이면 다 떨어짐); 없으면 **번들 21파일 라이브러리**(`assets/sfx/` + `manifest.json`, 키/파일명/슬러그로 매칭, duration 오프라인 확정 — riser 10.03s를 climax−10.03s에 배치하는 식). 볼륨 ~0.35 고정(보이스·BGM 아래). 매칭 실패는 skip.

### 2.4 전사(Whisper) (`references/transcribe.md`)

`npx hyperframes transcribe <file> --model <m>` — **`--model` 항상 명시**(기본 `small.en`은 비영어를 영어로 번역해버림). 한국어는 `--model small --language ko` 패턴(비-.en 모델 + iso 코드). srt/vtt/openai-json 임포트도 지원. 출력 = 정규화된 flat 단어 배열 `[{id:"w0", text, start, end}]`.

### 2.5 자막/캡션 저작 — 워드 단위 스타일링 **지원 확인** (`references/captions/authoring.md`, `motion.md`)

- 입력은 위 flat 단어 배열. `id`(w0…)가 **단어별 오버라이드의 안정 참조**.
- 스타일 자동 감지 4차원(visual feel/palette/font mood/animation character) + 톤→스타일 매핑표(Hype/Corporate/Tutorial/Storytelling/Social별 폰트웨이트·이즈·크기 px).
- **Per-word styling 명시 지원**: 브랜드명·ALL CAPS·숫자·감정 키워드·CTA에 개별 크기/색/애니 + marker highlight 5종(highlight sweep/circle/burst/scribble/sketchout, `hyperframes-animation/rules/css-marker-patterns.md`).
- 워드 그루핑: 고에너지 2-3 / 대화체 3-5 / 차분 4-6 단어, 문장 경계·150ms+ 휴지에서 분할.
- 배치: 가로 하단 80-120px / 세로 하단 ~600-700px, 절대배치, 한 번에 1그룹.
- 오버플로: `fitTextFontSize()`(maxWidth 1600 가로/900 세로, base 78, min 42) + scale>1 강조 시 `maxWidth = safeWidth/maxScale` 헤드룸.
- **Exit 보장**: 모든 그룹에 `tl.set(el,{opacity:0,visibility:"hidden"}, group.end)` 하드킬 + 등록 전 self-lint 루프(seek해서 잔존 검사).
- 카라오케가 전 에너지 레벨의 베이스라인(강도만 차등), 음악 소스면 **audio-reactive 필수**(`extract-audio-data.py --fps 30 --bands 8`로 프리베이크한 밴드를 빌드타임에 읽어 그룹별 진폭 변조 — 3~6% 스케일만).
- **기성 캡션 컴포넌트 15종**이 레지스트리에 존재(`caption-highlight`(TikTok), `caption-pill-karaoke`, `caption-editorial-emphasis`, `caption-glitch-rgb`, `caption-kinetic-slam`, `caption-neon-glow`, `caption-neon-accent`, `caption-clip-wipe`, `caption-gradient-fill`, `caption-matrix-decode`, `caption-emoji-pop`, `caption-parallax-layers`, `caption-particle-burst`, `caption-texture`, `caption-weight-shift` + `caption-blend-difference`). `npx hyperframes catalog --tag caption-style`.
- 폰트 경고: 컴파일러가 내장 매핑 세트(Inter/Roboto/Montserrat 등)만 자동 임베드. **CJK 등 그 외 폰트는 프로젝트에 `.woff2` + `@font-face` 직접 동봉 필수** — 렌더 머신은 폰트 없는 클린 헤드리스 크롬 (`authoring.md:159`). → 한국어 자막의 핵심 체크포인트.
- TTS→자막 2경로: HeyGen(`--words` 한 방) / ElevenLabs·Kokoro(TTS 후 Whisper) (`references/tts-to-captions.md`).

### 2.6 배경 제거

`npx hyperframes remove-background` — 투명 컷아웃(RVM 매팅, embedded-captions가 피사체 뒤 자막 합성에 사용). `--background-output`은 hole-cut이지 인페인팅 아님 (`SKILL.md:95`).

---

## 3. 애니메이션 체계 (hyperframes-animation / keyframes)

### 3.1 런타임 어댑터 7종 (`hyperframes-animation/SKILL.md:39-58`)

| 런타임 | 등록 글로벌 | duration 자동 추론 | 용도 |
|---|---|---|---|
| GSAP(기본, 95%) | `window.__timelines[id]` | 타임라인 길이 | 오케스트레이션 전반, 모든 rule의 기반 |
| Lottie/dotLottie | `window.__hfLottie` | totalFrames/frameRate(항상 유한) | AE 익스포트 |
| Three.js | `hf-seek` 이벤트 포워딩 | **불가 → 루트 data-duration 필수** | 3D/셰이더 |
| Anime.js | `window.__hfAnime`(autoplay:false) | — | 경량 트윈 |
| CSS keyframes | (선언적) | delay+duration×유한 iteration | 장식/반복 모티프 |
| WAAPI | `element.animate()` currentTime seek | getComputedTiming().endTime | 무의존 네이티브 |
| TypeGPU/WebGPU | — | — | GPU 파티클/liquid glass(WGSL) |

복수 런타임 공존 가능 — 각자 글로벌에 등록하면 HF가 한 패스에 전부 seek.

### 3.2 원자 rule 라이브러리 (`rules-index.md` — 40개 rule)

카테고리: 텍스트/타이포(hacker-flip-3d, kinetic-beat-slam, discrete-text-sequence, asr-keyword-glow 등 10), 데이터/스탯(counting-dynamic-scale, stat-bars-and-fills), 카메라/뷰포트(coordinate-target-zoom, viewport-change, multi-phase-camera, depth-of-field-blur 등 5), 레이아웃/네트워크(avatar-cloud-network, 3d-page-scroll, orbit-3d-entry 등 8), SVG(icon-enrichment, path-draw), 앰비언트(sine-wave-loop, ambient-glow-bloom), 전환/모션(reactive-displacement, spring-pop-entrance, card-morph-anchor, motion-blur-streak 등 10), 이펙트 레시피(gsap-effects, css-marker-patterns). **기본 방침: 씬당 rule 2~4개 조합**(블루프린트보다 빠르고 코드 적음).

켄번즈 상당: `viewport-change`(단일 `.world` 래퍼 translate+scale 가상 카메라), `multi-phase-camera`(pull-back/focus/push + 마이크로 드리프트), `coordinate-target-zoom`. music-to-video 워크플로우가 사용자 이미지에 "beat-cut / ken-burns"를 명시 언급 (`hyperframes/SKILL.md:146`).

### 3.3 씬 블루프린트 15종 (`blueprints-index.md`)

시간코딩된 샷 템플릿(골든 클립 50개 역공학): kinetic-type-beats(6롤 워크호스), typewriter-reveal, spatial-pan-stations, constellation-hub, grid-card-assemble, logo-assemble-lockup, cursor-ui-demo, device-surface-showcase, dataviz-countup, titlecard-reveal, comparison-split, overwhelm-surround, ticker-takeover, video-text-pivot, cta-morph-press. **롤→블루프린트 소프트 메뉴**가 스토리보드 frame `type` enum(hook/pain_point/product_intro/feature_showcase/benefit_highlight/social_proof/cta/branding)과 1:1 매핑 — 우리 씬 타입 분류의 참고 축.

### 3.4 전환 시스템 (`transitions/`)

- **문법 규칙**(overview.md, 비협상): 모든 멀티씬에 전환 필수 / 모든 씬에 엔트런스 필수(`fromTo`) / **exit 애니 금지**(마지막 씬 제외) — "전환이 곧 exit", 나가는·들어오는 씬이 **같은 시각 T**에 동시 애니.
- 선택 체계: 에너지(calm/medium/high)→주 전환+지속·이즈, 무드 9종→전환 타입, 내러티브 위치 6종(오프닝/관련포인트간/토픽전환/클라이맥스/윈드다운/아웃트로), 블러 강도표, 프리셋 6종(snappy 0.2s ~ luxe 0.7s). **비디오 전체에 2-3종만 골라 반복**이 원칙.
- CSS 카탈로그 ~40종(catalog.md 라우팅: push/radial/3d/scale/dissolve/cover/light/distortion/mechanical/grid/other/blur/destruction) + WebGL 셰이더는 `@hyperframes/shader-transitions` 패키지(HyperShader.init에 `{time, shader, duration}` 배열; shader 생략 시 CSS 크로스페이드; html2canvas 캡처 호환 CSS 규칙 6개).
- **기계 주입 계약**(TRANSITION-REGISTRY.md): PLV의 결정론 인젝터가 JSON 레지스트리(crossfade/blur-crossfade/push-slide/zoom-through/squeeze, 각각 `gsap_template` + `__OLD__/__NEW__/__T__/__DUR__/__DX__/__DY__` 토큰)를 읽어 ① from 슬롯 duration 연장(마지막 프레임 홀드) ② to 슬롯 start 당김(겹침 창) ③ 트랙 0/1 핑퐁 재배정 ④ 템플릿을 메인 타임라인에 스탬프. 기본값 파생: 고에너지→zoom-through, 그 외→blur-crossfade(배경색 충돌 마스킹). **→ 우리 컴파일러의 전환 주입기를 이 설계 그대로 복제 가능 — 이 파일이 사실상 레퍼런스 구현 명세.**

### 3.5 keyframes 스킬 (`hyperframes-keyframes/SKILL.md`)

포즈 계약(가시 상태·피사체 동일성·마지막 프레임도 애니의 일부·rest 리셋 금지) + 런타임별 seek-safe 규칙 + 채널 가이드(컴포지터 채널 선호: x/y/z, scale, rotation, opacity, clip-path, CSS vars, 셰이더 유니폼 / 레이아웃 채널 회피) + 메커니즘 선택표(FLIP/path/stroke-draw/morph/mask/stagger/텍스트 분할/3D) + **진단 CLI**: `npx hyperframes keyframes . [--json|--runtime all|--selector --shot|--layout strip|--ghost --angle]`, `snapshot --at`. 실패 모드→수정 표 포함. → 컴파일러가 뽑은 씬의 모션 검증 자동화에 직결.

---

## 4. Registry 블록/컴포넌트 — 컴포넌트 카탈로그 배포 구조

### 4.1 두 아이템 타입 (`hyperframes-registry/SKILL.md`)

- **블록** = 독립 서브컴포지션(자체 dimensions/duration/타임라인) → `compositions/<name>.html` 설치, 호스트에서 `data-composition-src`로 와이어링(+ `data-composition-id` 일치, start/duration/track/width/height). 타임라인 조율 불필요 — 런타임이 자동 seek. CSS로 화면 일부 배치 가능(`style="position:absolute; right:0; width:40%"`).
- **컴포넌트** = 크기 없는 스니펫 → `compositions/components/<name>.html` 설치 후 HTML/CSS/JS를 호스트에 수동 머지(타임라인 콜 노출 시 추가).
- `hyperframes.json`이 registry URL + 설치 경로(paths.blocks/components/assets) 설정 — 커스텀 레이아웃 가능.

### 4.2 현재 카탈로그 (`references/discovery.md`)

블록 97종: 셰이더 전환 14, 전환 갤러리 13, Liquid Glass(WebGPU) 7, VFX 6, 쇼케이스 6, 지도+데이터비주얼 8(us-map 4종/spain/world/data-chart/flowchart), 소셜 오버레이 7(instagram/tiktok/yt/x/reddit/spotify/macos), 브랜딩 2, 코드 스니펫 24(VS Code 12 + Apple Terminal 12 테마), 코드 애니메이션 9(code-typing/diff/morph/highlight/scroll/snippet-flight + GPU 3종). 컴포넌트 6종(grain-overlay, shimmer-sweep, morph-text, grid-pixelate-wipe, parallax-zoom/unzoom). + 캡션 스타일 15종(§2.5).

### 4.3 "시각화 슬라이드 20종"을 블록으로 배포 가능한가 — **가능, 계약 확인됨**

- `registry-item.json` 스키마: name/type/title/description/tags/dimensions(블록)/duration(블록)/files(path,target,type)/registryDependencies (`discovery.md:23-36`).
- 기여 워크플로우(contributing.md): Clarify→Scaffold(`registry/blocks/<name>/` + registry-item.json)→Build(2-3자 ID 접두사 강제 — 서브컴 충돌 방지)→Validate(lint 0에러+validate 0콘솔에러)→Preview(render/snapshot/publish)→Ship(registry.json 등록+카탈로그 페이지 생성+PR).
- 핵심: **registry는 `hyperframes.json`의 URL 하나로 가리키는 raw GitHub 디렉토리 구조**(`registry.json` + `<type-dir>/<name>/registry-item.json`)이므로, 자체 사설 레지스트리(우리 repo)를 세워 `hyperframes add`로 설치시키는 구조가 그대로 성립. 데이터 주입은 블록의 `data-composition-variables` 선언 + 호스트 `data-variable-values`로 슬라이드별 파라미터화(§1.5) — data-chart 계열 블록이 이미 이 패턴.

---

## 5. CLI 워크플로우 (hyperframes-cli)

### 5.1 dev loop (`SKILL.md:11-27`)

init(템플릿 9종: blank/warm-grain/play-mode/swiss-grid/vignelli/decision-tree/kinetic-type/product-promo/nyt-graph; `--resolution` 6프리셋; `--video/--audio` 주면 Whisper 자동 전사) → 저작 → lint → validate → inspect → preview → (사용자 승인) → render → feedback. `capture <URL>`은 사이트를 스크린샷 씬+에셋으로 스캐폴드.

### 5.2 프리뷰 서버 = Studio (`references/preview-render.md`)

- `npx hyperframes preview`(기본 포트 3002): **파일 변경 핫리로드**, 브라우저에 **Studio 자동 오픈 — 풀 타임라인 에디터**로 사용자가 재생·시킹·직접 편집 가능("review surface, not just a viewer"). 프로젝트 URL 형식 `http://localhost:<port>/#project/<name>`.
- **에이전트↔Studio 브리지**: `preview --context --json --context-fields selection[,lint]` — 서버를 새로 띄우지 않고 실행 중 Studio 세션에서 **사용자가 클릭한 요소**의 source file, composition path, 현재 타임라인 시간, `data-hf-id`/selector, bbox, 텍스트, 썸네일 URL을 반환. `--context-detail full`이면 computed/inline styles·data-attributes까지. 에러 코드: preview-not-running / ambiguous-preview-server / preview-port-mismatch / no-selection / selection-unavailable. **→ "씬 편집 대시보드"의 원형이 이미 존재: Studio(타임라인+선택) + selection API(에이전트가 '이거 고쳐'를 기계적으로 앵커). 우리 대시보드는 이 위에 씬 매니페스트 레이어를 얹는 형태가 최단 경로.**
- `play`(포트 3003): 에디터 없는 `<hyperframes-player>` 웹컴포넌트 경량 플레이어(임베드/공유용, playback-rate 0.1~5 클램프).
- 둘 다 `--browser-path/--user-data-dir/--remote-debugging-port`로 격리 프로필 + CDP 어태치 지원(Playwright 등 외부 자동화 연결 가능).
- Storyboard 뷰가 모든 Studio 세션에 기본 탑재 + `GET /api/projects/<id>/storyboard` (`hyperframes-core/references/storyboard-format.md:5`).

### 5.3 render (`references/preview-render.md:96-155`)

`--quality draft|standard|high`, `--fps 24/30/60`, `--format mp4|webm(투명)|mov|gif|png-sequence`, `--resolution`(정수배 슈퍼샘플), `--crf`/`--video-bitrate`, `--hdr/--sdr`, `--workers`(워커당 크롬 ~256MB), `--docker`(바이트 동일 재현), `--gpu`(NVENC 등), `--browser-timeout`, `--strict/--strict-all/--strict-variables`, `--variables/--variables-file`, `-c`로 특정 서브컴포지션 단독 렌더. 기본 출력 `renders/<project>_<ts>.mp4`. 클라우드는 `lambda deploy/render/progress/destroy`. 에이전트 관례: render는 사용자 게이트(자동 렌더 금지), 렌더 후 파일 존재+크기+ffprobe 검증, `feedback --rating` 1회.

### 5.4 검증 명령 계약

§1.8 참조. `--json`이 render/preview/play 서버모드 제외 전 명령 지원(`_meta` 엔벨로프), `doctor --json`은 항상 exit 0(payload `.ok`로 게이트), 비TTY 자동 감지(init은 `--example` 필수).

---

## 6. 결론 — auto_kairos scene_specs.json → HyperFrames 컴파일러 매핑

### 6.1 아키텍처 판정

컴파일 타깃 = **모듈형 오케스트레이터**(§1.4): 씬 1개 = `compositions/<scene-id>.html` 서브컴포지션 1개, `index.html`은 슬롯 배치 + 내레이션/BGM `<audio>` + 전환 스탬프만. 이유: 씬 격리 저작·재컴파일(단일 씬만 `render -c`로 프리뷰 가능), CSS 자동 스코핑, 자막을 별도 트랙의 캡션 서브컴/컴포넌트로 독립.

### 6.2 매핑 표 (HyperFrames 측은 전부 파일 근거 확정; auto_kairos 측 필드명은 해당 스펙 파일 재확인 필요)

| 씬 매니페스트 개념 | HyperFrames 타깃 | 근거 |
|---|---|---|
| 씬 duration = 오디오(TTS) 길이 | `audio_meta.voices[i].duration_s` → 슬롯 `data-duration`(+테일 패딩), `data-start`는 누적합 또는 상대참조(`prev + 0`), 루트 `data-duration` = `total_duration_s`+아웃트로. **루트 duration은 컴파일 타임 고정이므로 컴파일러가 최종 수치로 직접 저작** | `audio.mjs` 출력 스키마; `data-attributes.md:13` |
| 내레이션 오디오 | 라인별 wav를 호스트 루트 직계 `<audio data-start data-track-index=10>`(씬별) 또는 concat 1트랙 | `variables-and-media.md:48-88` |
| 자막 모드 A(전체 카라오케) | 단어 타임스탬프(`voices[].words`) → 캡션 서브컴포지션(상위 트랙) — 기성 15종 블록 or authoring.md 계약으로 자체 생성. per-word 강조·marker 5종 지원 확정 | `captions/authoring.md`, `motion.md` |
| 자막 모드 B(키문구만/번인) | 씬 서브컴 내부 텍스트 클립으로 컴파일(kinetic-type-beats 계열) — "모든 단어 임베드는 대부분 잘못"이 공식 입장(embedded-captions의 anchor 기본) | `blueprints-index.md`; embedded-captions 스킬 설명 |
| 켄번즈(이미지 팬줌) | `viewport-change`(.world 래퍼 translate+scale) / `multi-phase-camera` rule을 이미지 클립 위에 스탬프; music-to-video가 동일 개념을 "ken-burns"로 명명 | `rules-index.md:31-33`; `hyperframes/SKILL.md:146` |
| 전환 enum | TRANSITION-REGISTRY.md의 **결정론 인젝터 설계 복제**: 전환명→gsap_template, from연장+to당김+트랙핑퐁+메인타임라인 스탬프. Tier-B 5종(crossfade/blur-crossfade/push-slide 4방향/zoom-through/squeeze)이 즉시 사용 가능한 검증된 최소셋, 확장은 catalog ~40종+셰이더 14블록. auto_kairos enum이 이 5종+방향으로 사상되면 1:1, 초과분은 catalog에서 템플릿 추가 | `transitions/TRANSITION-REGISTRY.md` |
| reveal enum(요소 등장) | rule 라이브러리로 사상: fade/slide→gsap 기본 fromTo, pop→`spring-pop-entrance`, typewriter→`discrete-text-sequence`/`gsap-effects`, count-up→`counting-dynamic-scale`, draw→`svg-path-draw`, stagger-grid→`grid-card-assemble` 등. "exit 금지, 전환이 exit" 규칙 준수 필수 | `rules-index.md`; `transitions/overview.md:17-24` |
| 디자인 토큰 | ① `frame.md`(YAML frontmatter=규범값: colors/typography/spacing/components — 프리셋 13종 시드 가능) ② 런타임 파라미터는 `data-composition-variables`(color/enum 타입) + 씬별 `data-variable-values` | `design-spec.md`; `variables-and-media.md` |
| BGM/SFX | `audio_request.bgm{mode,query}` + `lines[].sfx[names]` → 엔진이 회수/생성/스킵, 볼륨 관례(BGM 0.8, SFX 0.35), 더킹은 타임라인 `volume` 트윈 | `bgm.md`, `sfx.md` |
| 씬별 QA | 컴파일러가 `*.motion.json` 사이드카 자동 생성(appearsBy/before/staysInFrame/keepsMoving) → `inspect` + `snapshot --at 씬중간점들` + `grep '<video|<audio' compositions/`(공식 블라인드스팟 수동 체크) | `lint-validate-inspect.md` |
| 대시보드 | Studio(preview, 핫리로드+타임라인 시킹+직접 편집) + `preview --context --json`(선택 요소 앵커) + Storyboard API(`GET /api/projects/<id>/storyboard`) 위에 매니페스트 편집→재컴파일 루프 | `preview-render.md`; `storyboard-format.md` |

### 6.3 컴파일러가 반드시 지켜야 할 하드 룰(렌더에서만 터지는 것들)

1. 서브컴은 style/script/markup 전부 `<template>` 안, 루트 스타일은 `#root`만, 호스트 id=내부 id=`__timelines` 키 3중 일치 (§1.4).
2. `<video>/<audio>`는 index.html 루트 직계만 — 씬 파일에 절대 넣지 않기.
3. 루트 `data-duration`은 최종 수치로 직접 씀(변수/스크립트로 불가).
4. 씬 내부 id는 씬id 접두사(중복 id → video/img blank).
5. 풀스크린 배경은 루트가 아닌 full-bleed 자식에(루트 background는 렌더에서 검게 드롭될 수 있음).
6. `fromTo`만(엔트런스), exit 금지, repeat 유한, 허용 프로퍼티만.
7. 한국어 폰트 `.woff2` 동봉 + `@font-face`(자동 임베드는 내장 라틴 세트만).
8. 전사/자막용 Whisper는 `--model small --language ko`(기본 small.en은 번역 사고).

### 6.4 확인된 갭(부족한 부분)

- **한국어 TTS 로컬 폴백 없음**: Kokoro 언어 세트에 ko 부재 — HeyGen(비영어 `--lang` 지원)·ElevenLabs 크리덴셜 필수이거나 외부 TTS(예: 자체 엔진)를 audio_meta.json 스키마로 어댑트해 주입해야 함.
- **CJK 폰트 자동 임베드 없음** — 폰트 번들링을 컴파일러 책임으로.
- lint가 못 잡는 함정 4종(§6.3의 1,2,5 + 미디어-인-서브컴) → snapshot 눈검사가 유일 게이트이므로 컴파일러 자체 정적 검사기를 추가하는 게 안전.
- 루트 duration 고정 → "씬 길이 재조정" 편집은 항상 재컴파일(대시보드 UX에 반영).
- 셰이더 전환은 html2canvas 캡처 제약 6종(CSS var 금지 등)이 씬 저작 규칙을 오염시키므로 v1은 CSS 전환(Tier-B 5종)만 권장.
- auto_kairos 측 reveal/전환 enum의 실제 값 목록은 본 조사 범위(스킬팩)에 없음 — scene_specs.json 스펙 파일과 대조해 사상표의 좌변을 채워야 함.

### 6.5 재사용 가능 자산 요약

- 그대로 가져다 쓰는 것: `audio.mjs` 엔진(계약 파일로 호출), 캡션 15블록·전환 5템플릿·rule 40종·블루프린트 15종, `motion.json`/inspect/snapshot 게이트, Studio+selection API, frame-preset 13종.
- 우리가 만드는 것: scene_specs.json → (오디오 요청 어댑터 + 씬 HTML 생성기 + 전환 인젝터 + 캡션 빌더 + 폰트 번들러 + motion.json 생성기) → 모듈형 프로젝트. 전환 인젝터는 TRANSITION-REGISTRY.md가 알고리즘 명세까지 제공하므로 구현 리스크 최소.
