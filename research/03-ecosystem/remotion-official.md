# Remotion 공식 생태계 해부 — AI 영상 스킬 + 브라우저 편집 UI 설계 재료

- 조사일: 2026-07-07
- 클론 위치: `/tmp/claude-1000/-home-seunghyeong/ce8cbf1e-1e75-4f17-bf49-55b322c34874/scratchpad/refs/` (skills, remotion sparse: player/captions/transitions/studio, template-tiktok)
- 원칙: 클론한 소스와 공식 문서에서 직접 확인한 것만 기재.

---

## ① 공식 스킬팩(remotion-dev/skills)이 가르치는 것

- 구조: 스킬 1개(`skills/remotion/SKILL.md`, 364줄) + **rules/ 37개 규칙 파일**의 2단 로딩 구조. SKILL.md 본문은 핵심 계약만 담고, 주제별 세부는 "~할 때 rules/X.md를 로드하라"로 지연 로딩시킨다. (근거: `refs/skills/skills/remotion/SKILL.md`, `rules/` 디렉토리 목록)
- SKILL.md 본문이 직접 가르치는 핵심 계약:
  - 스캐폴드: `npx create-video@latest --yes --blank --no-tailwind my-video`
  - 애니메이션은 반드시 `useCurrentFrame()` + `interpolate()` (물리 필요할 때만 `spring()`), `Easing.bezier()`로 타이밍.
  - **CSS transition/animation 금지, Tailwind 애니메이션 클래스 금지** — "렌더가 깨진다"고 명시 (결정론 렌더 규칙).
  - **Studio 편집 친화 코딩 규칙**: "Studio에서 편집 가능하게 하려면 `interpolate()`를 style prop 안에 인라인으로 두고, `transform` 문자열 조합 대신 개별 CSS 속성(`scale`, `translate`, `rotate`)을 써라" (SKILL.md 28행). 즉 공식 팩 자체가 "에이전트가 쓴 코드를 사람이 GUI로 만질 수 있는 형태"를 강제한다.
  - 에셋: `public/` + `staticFile()`, `<Img>`, `@remotion/media`의 `<Video>`/`<Audio>`.
  - 시퀀싱: `<Sequence from durationInFrames layout="none">`.
  - 검증 루프: `npx remotion studio`로 프리뷰, `npx remotion still [id] --scale=0.25 --frame=30`으로 **1프레임 렌더 새니티체크** (사소한 수정은 생략 허용).
- rules/ 37개 전체 목록 (파일명 = 주제):
  - 구성/타이밍: `compositions`, `sequencing`, `timing`, `trimming`, `calculate-metadata`, `parameters`(zod), `video-layout`
  - 캡션: `subtitles`(허브), `transcribe-captions`(whisper.cpp), `display-captions`(TikTok 페이지), `import-srt-captions`
  - 미디어: `videos`, `audio`, `images`, `gifs`, `transparent-videos`, `get-audio-duration`, `get-video-duration`, `get-video-dimensions`(Mediabunny 사용), `ffmpeg`, `silence-detection`
  - 그래픽/모션: `text-animations`, `transitions`, `effects`(60+ 이펙트 함수 목록), `light-leaks`, `html-in-canvas`, `3d`, `lottie`, `maplibre`, `audio-visualization`
  - 폰트/측정: `google-fonts`, `local-fonts`, `measuring-text`, `measuring-dom-nodes`, `tailwind`
  - 오디오 생성: `voiceover`(ElevenLabs TTS), `sfx`
- 눈여겨볼 패턴: 규칙 파일마다 "패키지 미설치면 `npx remotion add @remotion/...`를 패키지매니저별로 이렇게" 식의 **에이전트 실행 가능한 명령을 lockfile 감지 조건과 함께** 적어둔다 (예: `rules/parameters.md`의 npm/bun/yarn/pnpm 분기).

## ② Player 임베드 계약 — 프리뷰/시킹/변수주입

패키지: `@remotion/player` (근거: `refs/remotion/packages/player/src/Player.tsx`, `player-methods.ts`, `event-emitter.ts`, 문서 https://www.remotion.dev/docs/player/player)

- 최소 계약: `<Player component={Comp} inputProps={...} durationInFrames fps compositionWidth compositionHeight />`. `component` 대신 `lazyComponent`(dynamic import)도 가능. `schema?: ZodObject`도 prop으로 받는다 (`PlayerProps` 타입, Player.tsx 49~106행).
- **변수 주입(핵심)**: `inputProps`는 일반 React prop이라 **새 객체를 내려주면 즉시 리렌더** — 폴링/리로드 없이 실시간 반영. 문서도 "Updates to inputProps trigger live re-renders"로 확인. → "폼/채팅으로 값 바꾸면 프리뷰가 즉시 갱신"의 공식 메커니즘.
- 임퍼러티브 API (`PlayerRef`, player-methods.ts 전문 확인):
  - `play() / pause() / toggle() / seekTo(frame) / getCurrentFrame() / isPlaying()`
  - `pauseAndReturnToPlayStart()`, `requestFullscreen()/exitFullscreen()/isFullscreen()`
  - `setVolume()/getVolume()/mute()/unmute()/isMuted()`, `getScale()`, `getContainerNode()`
- 이벤트 (event-emitter.ts의 `PlayerStateEventMap`): `play, pause, ended, seeked, timeupdate`(~250ms 스로틀), `frameupdate`(매 프레임), `ratechange, scalechange, volumechange, fullscreenchange, mutechange, waiting, resume, error`. `ref.addEventListener('frameupdate', cb)` 형태.
- 편집 UI에 유용한 부가 prop: `inFrame`/`outFrame`(구간 루프), `initialFrame`, `loop`, `autoPlay`, `controls`, `playbackRate`, `renderPoster`/`renderLoading`, `renderCustomControls`·`renderPlayPauseButton` 등 **컨트롤 전체 커스텀 렌더 슬롯**, `overflowVisible`, `bufferStateDelayInMilliseconds`.
- 같은 패키지에서 `<Thumbnail>`도 export — 특정 프레임 1장을 정지 프리뷰로 렌더 (index.ts 32행). 씬 리스트 썸네일에 그대로 쓸 수 있다.

## ③ Studio의 zod 스키마 기반 비주얼 편집 ("띄워서 수정"의 공식 구현)

근거: `refs/remotion/packages/studio/src/`(api/, visual-controls/), `rules/parameters.md`, 문서 https://www.remotion.dev/docs/schemas · https://www.remotion.dev/docs/visual-editing · https://www.remotion.dev/docs/studio/visual-control

- 선언 방법: 컴포넌트 옆에 `z.object({...})` 스키마를 정의하고 `<Composition schema={...} defaultProps={...}>`로 연결. **최상위는 반드시 z.object** (React props가 객체이므로). 타입은 `z.infer`로 공유.
- Studio 동작: 스키마가 있으면 우측 사이드바(Cmd/Ctrl+J → Props 탭)에 **타입별 GUI 컨트롤 자동 생성**. 지원 확인된 타입: `z.object/string/number/boolean/date/array/enum`, 2-멤버 union(null/undefined 포함형), `optional/nullable`, 제약 `.min()/.max()/.step()`, `staticFile()` 에셋 선택. 특수 타입은 `@remotion/zod-types`의 **`zColor()`(컬러피커), `zTextarea()`, `zMatrix()`**.
- **코드로 저장**: 사이드바의 저장(💾) 버튼이 편집된 값을 **소스코드의 defaultProps로 되써준다**. 조건: defaultProps가 `<Composition>`에 인라인되어 있어야 함(정적 분석 기반). GUI 모드 외에 JSON 직접 편집 모드도 있음. 프로그래매틱 API는 `saveDefaultProps({compositionId, defaultProps})` (`studio/src/api/save-default-props.ts` — Studio 환경 전용, read-only Studio에서 차단, zod 필수; `updateDefaultProps`는 deprecated alias).
- **visualControl() (v4.0.292+, 프리뷰 기능)**: props가 아닌 **코드 속 하드코딩 값**도 `visualControl("key", value, schema?)`로 감싸면 사이드바 컨트롤이 생기고, 역시 저장 버튼으로 코드에 되써진다. 키는 정적 문자열 리터럴이어야 함(정적 분석). 렌더 시엔 그냥 value 반환 (`studio/src/api/visual-control.ts` 확인 — `isRendering`이면 원값 반환).
- 타임라인 쪽 비주얼 편집: 시퀀스 선택 시 offset/scale/rotation/transform-origin/opacity 스타일 컨트롤 + 캔버스 위 피벗 핸들 드래그 (visual-editing 문서). SKILL.md의 "interpolate 인라인 + 개별 transform 속성" 규칙이 바로 이 기능의 전제조건.
- Studio의 나머지 프로그래매틱 API (`studio/src/index.ts` export 목록): `play/pause/toggle/seek`, `goToComposition`, `reevaluateComposition`, `focusDefaultPropsPath`(사이드바에서 특정 prop 경로로 포커스 이동), `writeStaticFile/renameStaticFile/deleteStaticFile/getStaticFiles/watchStaticFile/watchPublicFolder`, `restartStudio`. → Studio는 "코드↔GUI 양방향 + 파일시스템 API"를 가진 편집기다.
- 한계(문서 명시): 비주얼 편집이 바꾸는 건 defaultProps뿐. 렌더 시 주입되는 inputProps는 Render 다이얼로그나 `calculateMetadata()`로 덮어쓴다.

### calculateMetadata (동적 메타데이터)

근거: `rules/calculate-metadata.md`, SKILL.md 179~216행

- `<Composition calculateMetadata={fn}>`으로 렌더 직전에 비동기로 `durationInFrames / width / height / fps / props / defaultOutName / defaultCodec`을 결정·덮어쓰기 (모두 optional).
- 대표 패턴: props의 videoSrc 길이를 재서 duration 산출, 영상 원본 해상도로 width/height 매칭, 여러 클립 길이 합산, `fetch(props.dataUrl)`로 데이터 주입(props 변환). `abortSignal`이 제공되어 **Studio에서 props를 편집하면 이전 요청이 취소**된다 — 편집 UI와 동적 메타데이터가 맞물리는 지점.

## ④ captions / transitions 패키지 계약

### @remotion/captions (근거: `refs/remotion/packages/captions/src/`)

- 소스 6파일짜리 작은 순수 유틸 패키지. 공개 계약(index.ts):
  - `Caption` 타입: `{ text, startMs, endMs, timestampMs: number|null, confidence: number|null }` — **생태계 공통 자막 교환 포맷**. 공식 스킬팩도 "모든 캡션은 이 JSON으로 처리하라"고 강제(`rules/subtitles.md`).
  - `createTikTokStyleCaptions({captions, combineTokensWithinMilliseconds})` → `{pages: TikTokPage[]}`. 페이지마다 `startMs`와 단어 `tokens[{text, fromMs, toMs}]` — 단어 하이라이트용. `combineTokensWithinMilliseconds`가 페이지당 단어 수를 결정(1200ms≈여러 단어, 200ms≈단어별).
  - `parseSrt()/serializeSrt()` — SRT 왕복.
  - `ensureMaxCharactersPerLine`은 internals로만 노출.
- 파이프라인 관례(스킬팩 + template-tiktok에서 일치 확인): 캡션은 컴포지션 밖에서 whisper.cpp(`@remotion/install-whisper-cpp`의 `transcribe()` + `toCaptions()`)로 뽑아 `public/영상명.json`으로 저장 → 컴포넌트에서 `fetch(staticFile(...))` + `useDelayRender()`로 로드 → 페이지를 `<Sequence from durationInFrames>`로 매핑.

### @remotion/transitions (근거: `refs/remotion/packages/transitions/src/`)

- `<TransitionSeries>` 하나로 씬 배열을 선언: `.Sequence`(씬) / `.Transition`(두 씬 겹침 전환) / `.Overlay`(컷 지점 위 이펙트, 길이 안 줄임).
- `.Transition`은 `presentation` + `timing` 2요소 계약. presentation 18종 소스 확인: `fade, slide, wipe, flip, clock-wipe, iris, dissolve, cross-zoom, crosswarp, dreamy-zoom, film-burn, linear-blur, ripple, swap, zoom-blur, zoom-in-out, book-flip, none` (+`html-in-canvas-presentation`). timing은 `linearTiming({durationInFrames})` / `springTiming({config})`, 둘 다 `getDurationInFrames({fps})` 제공.
- **길이 산술 규칙**: 전환은 씬을 겹치므로 총 길이 = 씬 합 − 전환 합. 오버레이는 총 길이 불변. `durationInFrames` 계산과 `calculateMetadata`를 잇는 데 필요한 핵심 산술 (`rules/transitions.md`에 계산 예제까지 있음).

### template-tiktok 관례 (근거: `refs/template-tiktok/src/`)

- 구조: `Root.tsx`(Composition 선언) + `CaptionedVideo/`(index·SubtitlePage·Page·NoCaptionFile) — **"컴포지션 1개 = 폴더 1개, 캡션 로직은 별도 컴포넌트"** 관례.
- `Root.tsx`: `schema={captionedVideoSchema}`(zod, `{src: z.string()}`) + `calculateMetadata`(getVideoMetadata로 fps 30 기준 duration 산출) + `defaultProps={{src: staticFile("sample-video.mp4")}}` — ②③의 계약을 전부 실사용.
- 캡션 파일 규약: `video.mp4` → `video.json` (확장자 치환으로 페어링). `watchStaticFile()`로 json 변경 감시 → 자막 재로드 (Studio에서 핫리로드). 캡션 없으면 `<NoCaptionFile>` 안내 오버레이.
- 전사는 `sub.mjs` 스크립트로 컴포지션 밖에서 일괄 실행 (README: `node sub.mjs [경로]`).

## ⑤ 우리 스킬에 훔칠 것 Top 5

1. **"허브 SKILL.md + 지연 로딩 rules/ 37개" 컨텍스트 구조** — 본문엔 불변 계약(결정론 규칙·금지사항·검증 루프)만, 세부는 주제별 파일로. 규칙 파일마다 lockfile 감지 → 설치 명령까지 에이전트가 그대로 실행 가능하게. 우리 영상 스킬 문서 구조로 직행 가능.
2. **zod 스키마 = 편집 UI의 단일 소스** — 씬/컷의 모든 파라미터를 z.object로 선언하면 (a) 타입 검증, (b) Studio식 GUI 자동 생성, (c) `saveDefaultProps`식 코드 되쓰기, (d) 렌더 시 inputProps 오버라이드가 전부 한 스키마에서 나온다. `zColor/zTextarea/zMatrix`처럼 **도메인 타입 → 전용 위젯** 매핑 아이디어 포함. "세세 설정 가능"의 뼈대.
3. **Player의 inputProps 실시간 주입 + PlayerRef/이벤트 계약** — 브라우저 편집 UI는 `<Player>` 임베드 + 폼 상태를 inputProps로 흘리는 것만으로 성립. `seekTo/frameupdate`로 타임라인 스크럽, `inFrame/outFrame`으로 구간 루프 프리뷰, `<Thumbnail>`로 씬 썸네일. 렌더 슬롯(renderCustomControls 등)으로 컨트롤 완전 교체 가능.
4. **Caption 공통 포맷 + 페이지화 함수의 분리** — `{text, startMs, endMs, timestampMs, confidence}` 하나로 전사(whisper)·SRT·표시(TikTok 페이지·단어 하이라이트)를 전부 연결하고, "몇 단어씩 보여줄지"는 `combineTokensWithinMilliseconds` 파라미터 하나로 환원. 전사는 렌더 밖 스크립트, 표시는 컴포넌트 — 이 경계도 그대로 채용.
5. **calculateMetadata + 전환 길이 산술로 '길이 자동 결정'** — 에이전트가 duration을 손으로 맞추게 하지 말고, 소스 미디어 길이·씬 합·(전환 겹침 차감)을 비동기 함수 하나가 계산해 fps/width/height/props까지 확정하는 패턴. `abortSignal`로 편집 중 재계산 취소까지. 추가 보너스: `visualControl()`처럼 **하드코딩 상수도 GUI로 노출 후 코드에 되쓰는** 발상, SKILL.md의 "interpolate 인라인 + 개별 transform 속성" 같은 **GUI 편집 가능성을 보장하는 코드 스타일 규칙**.

---

### 근거 경로/URL 색인

- 스킬팩: `refs/skills/skills/remotion/SKILL.md`, `refs/skills/skills/remotion/rules/*.md` (37개)
- Player: `refs/remotion/packages/player/src/{Player.tsx, player-methods.ts, event-emitter.ts, index.ts}`
- Captions: `refs/remotion/packages/captions/src/{index.ts, caption.ts, create-tiktok-style-captions.ts, parse-srt.ts}`
- Transitions: `refs/remotion/packages/transitions/src/{TransitionSeries.tsx, presentations/, timings/}`
- Studio: `refs/remotion/packages/studio/src/{index.ts, api/save-default-props.ts, api/visual-control.ts, visual-controls/}`
- 템플릿: `refs/template-tiktok/src/{Root.tsx, CaptionedVideo/index.tsx}`, `refs/template-tiktok/README.md`
- 문서: https://www.remotion.dev/docs/schemas · https://www.remotion.dev/docs/visual-editing · https://www.remotion.dev/docs/studio/visual-control · https://www.remotion.dev/docs/player/player
