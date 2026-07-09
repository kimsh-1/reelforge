# Motion Design Guide — 상용급 30초 쇼케이스 문법

외부 리서치(디자인 시스템 스펙·모션 트렌드·쇼츠 리텐션 데이터·방송 자막 규격)를 ReelForge에 이식 가능한 형태로 증류한 실행 문법이다. 각 규칙은 출처를 병기한다. 표기 규칙: "출처" = 외부 근거, "증류" = 외부 근거를 ReelForge 30초 포맷 스케일로 변환한 본 문서의 판단.

대상 독자: 컴파일러 reveal/transition 구현자, 프리셋 튜너, scene_specs 작성 에이전트. `scene_specs.json` 계약(closed contract)은 바꾸지 않는다 — 이 문서는 기존 enum(`reveal`, `mood`, `emphasis`, `transitions`)의 **구현 품질과 수치**를 규정한다.

---

## A. 이징 카탈로그

### A-1. 3대 원칙 (모든 규칙의 상위)

1. **진입은 감속(ease-out), 퇴장은 가속(ease-in), 이동/교체는 inOut.** ease-in을 진입에 쓰지 않는다 — 반응이 굼떠 보이는 대표 아마추어 신호. (출처: [web.dev — Choosing the right easing](https://developers.google.com/web/fundamentals/design-and-ux/animations/choosing-the-right-easing), [animations.dev — The Easing Blueprint](https://animations.dev/learn/animation-theory/the-easing-blueprint))
2. **퇴장은 진입보다 짧다.** 퇴장 시간 ≈ 진입 시간의 60–70%. 사라지는 것에 시선을 붙잡지 않는다. (출처: [IBM Carbon — Motion](https://carbondesignsystem.com/elements/motion/overview/) exit 곡선 설계 의도, [NN/g — Animation Duration](https://www.nngroup.com/articles/animation-duration/))
3. **이동 거리·크기가 클수록 오래.** duration은 고정값이 아니라 변화량의 함수. (출처: [IBM Carbon — Motion](https://carbondesignsystem.com/elements/motion/overview/))

### A-2. 용도별 곡선 (GSAP ease ↔ cubic-bezier)

| 용도 | GSAP | cubic-bezier | duration(영상 스케일) | 근거 |
|---|---|---|---|---|
| 히어로/헤드라인 진입 (쇼케이스) | `expo.out` | `(0.16, 1, 0.3, 1)` | 0.7–1.0s | 초반 폭발→긴 정착이 "프리미엄 감속"의 표준. [easings.net](https://easings.net/), [GSAP Eases](https://gsap.com/docs/v3/Eases/) |
| 일반 요소 진입 (기본값) | `power3.out` | `(0.215, 0.61, 0.355, 1)`≈cubic | 0.5–0.7s | power2~3.out이 범용 기본. [GSAPify — GSAP Ease](https://gsapify.com/gsap-ease/) |
| 프리미엄 표준 진입 | `power4.out` | `(0.22, 1, 0.36, 1)`(quint) | 0.6–0.9s | expo보다 절제된 럭셔리 감속. [easings.net](https://easings.net/) |
| 작은 요소·자막·라벨 | `power2.out` | `(0.33, 1, 0.68, 1)` | 0.3–0.45s | 작은 변화는 약한 곡선. [web.dev](https://developers.google.com/web/fundamentals/design-and-ux/animations/choosing-the-right-easing) |
| 퇴장 (기본) | `power2.in` | `(0.5, 0, 0.75, 0)`(quart-in 근사) | 0.3–0.45s | 가속 퇴장. [Carbon exit 곡선](https://carbondesignsystem.com/elements/motion/overview/) |
| 퇴장 (쇼케이스, 빨려나감) | `expo.in` | `(0.7, 0, 0.84, 0)` | 0.3–0.4s | 임팩트 있는 이탈. [easings.net](https://easings.net/) |
| 위치 교체·패널 푸시·와이프 | `power4.inOut` | `(0.76, 0, 0.24, 1)` | 0.5–0.8s | Stripe/Linear류 "물리적으로 밀어내는" 전환의 곡선. [Awwwards GSAP 사례군](https://www.awwwards.com/websites/gsap/) |
| 마스크 리빌·디바이더 드로우 | `expo.inOut` | `(0.87, 0, 0.13, 1)` | 0.5–0.7s | 날카로운 개폐감. [easings.net](https://easings.net/) |
| 팝/틱 (체크·뱃지·숫자 정착 펀치) | `back.out(1.4)` | `(0.34, 1.56, 0.64, 1)` | 0.3–0.4s | 오버슛은 소품에만, 1.7 초과 금지(§F). [GSAP Eases](https://gsap.com/docs/v3/Eases/) |
| 배경 드리프트·글로우 맥동·Ken Burns | `sine.inOut` / `power1.inOut` | `(0.37, 0, 0.63, 1)` | 씬 전체(4–30s 루프) | 무한·저강도 모션은 대칭 저차 곡선. [easings.net](https://easings.net/) |
| 카운트업 숫자 | `power4.out` 또는 `expo.out` | 위와 동일 | 씬의 50–60% (1.2–2.4s) | countup 라이브러리 기본 2–3s + easeOut. [CountUp.js](https://www.cssscript.com/customizable-count-updown-animations-pure-javascript-countup-js/) |

### A-3. 참조 스펙 (디자인 시스템 원본 수치)

UI 시스템의 원 수치. **그대로 쓰면 영상에선 너무 빠르다** — 변환 규칙은 A-4.

- **Material Design 3** ([easing & duration tokens](https://m3.material.io/styles/motion/easing-and-duration/tokens-specs)): standard `(0.2, 0, 0, 1)`, emphasized-decelerate `(0.05, 0.7, 0.1, 1)` @400–500ms, emphasized-accelerate `(0.3, 0, 0.8, 0.15)` @200ms. duration 토큰: short 50–200ms / medium 250–400ms / long 450–600ms / extra-long 700–1000ms.
- **IBM Carbon** ([Motion](https://carbondesignsystem.com/elements/motion/overview/)): productive standard `(0.2, 0, 0.38, 0.9)`, entrance `(0, 0, 0.38, 0.9)`, exit `(0.2, 0, 1, 0.9)`; expressive standard `(0.4, 0.14, 0.3, 1)`, entrance `(0, 0, 0.3, 1)`, exit `(0.4, 0.14, 1, 1)`. duration: fast-01 70ms → slow-02 700ms. "productive(기능) vs expressive(감정)" 2모드 구분 자체가 ReelForge 모션 강도 3단(§design-direction)의 원형.
- **Apple HIG** ([Motion](https://developer.apple.com/design/human-interface-guidelines/motion)): 모션은 기본적으로 ease-in-out + 목적 없는 모션 금지 + 정확성보다 지각 일관성.

### A-4. UI→영상 스케일 변환 (증류)

UI 애니메이션 권장치(200–500ms, [animations.dev](https://animations.dev/learn/animation-theory/the-easing-blueprint))는 "사용자 입력에 대한 반응" 기준이다. 영상은 시청자가 조작하지 않으므로 **읽기 속도**가 지배 변수다. 변환 계수:

| UI 기준 | 영상(30s 쇼케이스) 기준 |
|---|---|
| 요소 진입 200–300ms | **0.5–0.9s** (×2.5–3) |
| 요소 퇴장 150–200ms | **0.3–0.5s** |
| 스태거 간격 20–40ms | **60–150ms** |
| 마이크로 인터랙션 100ms | 정착 펀치 **0.25–0.35s** |

곡선(cubic-bezier)은 그대로 이식하고 duration만 스케일한다. 곡선의 성격은 시간과 무관하게 유지된다.

---

## B. 씬 내 3단 모션 레시피 5종 (블록 유형별)

공통 골격 — 모든 씬은 3단으로 산다: **① Enter**(씬 앞 10–15%) → **② Develop**(중반 70–80%: 강조·시선 이동·미세 드리프트로 프레임이 계속 살아있음) → **③ Exit**(마지막 0.3–0.5s: 다음 씬으로 핸드오프). "진입 후 정지 화면"은 §F 금지 목록 1순위다. (근거: 쇼츠는 2–4초마다 시각적 리프레시가 필요 — [OpusClip — Shorts retention](https://www.opus.pro/blog/ideal-youtube-shorts-length-format-retention), [AIR Media-Tech — retention editing](https://air.io/en/youtube-hacks/advanced-retention-editing-cutting-patterns-that-keep-viewers-past-minute-8))

### R1. `statistic` — 카운트업 카타르시스 (reveal: `count_up`, emphasis: `number`)

1. **Enter**: 배경 라디얼 글로우 opacity 0→0.5 + scale 0.9→1 (`expo.out` 0.6s). 라벨(무엇의 숫자인지)이 먼저 blur-in (0.4s) — 맥락 먼저, 숫자는 나중.
2. **Develop**: 숫자 카운트업 (`power4.out`, 씬의 50–60%, tabular-nums 고정폭 필수). 정착 순간 scale 1.04→1.0 펀치(`back.out(2)` 0.3s) + 글로우 opacity 한 번 맥동. 단위·출처는 정착 후 +0.15s에 fade-in — 카타르시스를 나누지 않는다.
3. **Exit**: 숫자만 y -24px + fade (`power2.in` 0.35s), 글로우는 0.2s 먼저 사그라듦.
- 근거: 카운트업 기본 지속 2–3s ([CountUp.js](https://www.cssscript.com/customizable-count-updown-animations-pure-javascript-countup-js/)), 숫자 정착 펀치는 kinetic type의 "settle" 관용구 ([vertex.art — kinetic typography](https://vertex.art/blogs/typography-animation-kinetic-typography)).

### R2. `bar`/`pie`/`line` — 차트 빌드 (reveal: `build_up` 또는 `stagger`)

1. **Enter**: 축·그리드·라벨이 먼저 stagger 0.06s로 깔림 (`power2.out` 0.35s) — 무대 먼저, 데이터 나중.
2. **Develop**: bar는 scaleY 0→1 (`expo.out` 0.8s, transform-origin bottom, stagger 0.12s), line은 stroke-draw(`power3.inOut` 1.2s), pie는 sweep(conic 각도 tween `power3.out` 1.0s). 각 값 라벨은 자기 막대 정착 직후 카운트업. 마지막 60%에서 **승자 강조**: 1등 막대만 액센트 색 + 글로우 상승, 나머지 채도 −40%.
3. **Exit**: 데이터 요소 역-stagger로 fade(0.3s), 축은 마지막에.
- 근거: 순차 리빌이 "스크롤을 보상하는 진행형 공개"의 정석 ([Awwwards — scroll-triggered product reveal](https://www.awwwards.com/inspiration/scroll-triggered-animation-product-reveal-welly)), 강조 대비는 §D 채도 규칙.

### R3. `list`/`numbered` — 캐스케이드 체크 (reveal: `cascade` 또는 `stagger_then_flash`)

1. **Enter**: 항목이 y +24px·blur 6→0·opacity 0→1로 캐스케이드 (`power3.out` 개별 0.5s, stagger 0.09–0.12s). 번호/체크 아이콘은 각 행 정착 +0.1s에 `back.out(1.7)` 0.3s로 틱.
2. **Develop**: 나레이션이 특정 항목을 말할 때 해당 행만 키워드 하이라이트 스윕(background-position 이동, `power2.inOut` 0.4s) 또는 액센트 좌측 바 scaleY. 나머지 행 opacity 0.55로 감쇠 — 한 번에 하나만 뜨겁게.
3. **Exit**: 전체가 짧은 역순 stagger(0.05s)로 y −16px fade.
- 근거: 스태거 캐스케이드는 현대 랜딩의 시그니처 마이크로 애니메이션 ([codefronts — CSS text animations](https://codefronts.com/motion/css-text-animations/)), 항목 5개 초과 시 stagger 총합이 0.6s를 넘지 않게 간격 자동 축소(증류).

### R4. `compare` — 스플릿 대결 (reveal: `split_reveal`, emphasis: `contrast`)

1. **Enter**: 중앙 디바이더가 scaleY 0→1로 그어짐 (`expo.inOut` 0.5s). 좌측 패널 x −40px→0, 우측 +40px→0 (`power3.out` 0.7s, 우측이 0.12s 늦게) — 좌→우 읽기 순서 보존.
2. **Develop**: 대비 비트 — 열세 측 채도 −50%·opacity 0.6으로 다운, 우세 측 액센트 테두리/글로우 업 (`power2.inOut` 0.5s, 나레이션의 결론 타이밍에 맞춤). 수치가 있으면 양측 동시 카운트업 후 우세 측만 펀치.
3. **Exit**: 열세 측이 먼저 fade(0.25s), 우세 측이 0.15s 더 머문 뒤 fade — 마지막 잔상은 항상 승자.
- 근거: Stripe/Linear류 제품 영상의 "물리적 푸시·명확한 승자 프레이밍" 관행 ([advids — digital motion video 분석](https://advids.co/blog/30-digital-motion-video-examples-to-elevate-your-visual-communication)).

### R5. `quote`/`headline_only` — 라인 마스크 리빌 (reveal: `split_reveal`·`fade_in`, emphasis: `quote`)

1. **Enter**: 줄 단위 마스크 리빌 — 각 줄이 overflow:hidden 래퍼 안에서 yPercent 110→0 (`power4.out` 0.7s, 줄 stagger 0.14s). 따옴표 글리프는 첫 줄보다 0.2s 먼저 scale 0.8→1 fade.
2. **Develop**: 따옴표 글리프가 sine.inOut로 미세 드리프트(y ±6px, 4s 루프). 핵심 구절만 액센트 밑줄이 scaleX 0→1 (`power3.inOut` 0.5s, 나레이션 해당 구절 타이밍). 저자·출처는 씬 70% 지점에 fade-in.
3. **Exit**: 전체 blur 0→6px + fade (`power2.in` 0.4s) — 인용은 "여운"으로 끝난다.
- 근거: line-mask rise는 SplitText 계열의 대표 패턴 ([freefrontend — SplitText examples](https://freefrontend.com/split-text-js/)), blur-out 퇴장은 에디토리얼 관용구 ([codefronts](https://codefronts.com/motion/css-text-animations/)).

---

## C. 페이싱 규칙 — 30초의 시간 예산

### C-1. 컷 수와 훅

- **30초 = 씬 7–10개** (평균 씬 3–4s). 근거: 고성과 쇼츠는 2–4초마다 컷/리프레시 ([OpusClip](https://www.opus.pro/blog/ideal-youtube-shorts-length-format-retention), [virvid](https://virvid.ai/blog/ai-shorts-increase-retention-watch-time)). 단 **상한 12컷** — 30초에 20샷 이상 넣은 광고 515편은 회상 81·설득 83으로 기준치 100을 유의미하게 하회 (Mapes & Ross 1989, [Gale — Camera shot length in TV commercials](https://link.gale.com/apps/doc/A13980912/AONE?u=googlescholar&sid=AONE&xid=bd8a2091)). 과잉 컷은 세련이 아니라 손실이다.
- **훅 씬(s01)은 1.3–1.8초 안에 시선을 세워야 한다.** 스와이프 판정 창이 그만큼 짧다 ([OpusClip — hook formulas](https://www.opus.pro/blog/youtube-shorts-hook-formulas)). s01 규칙: 로고·인사·빌드업 금지, 프레임 1부터 가장 강한 시각(최대 숫자, 가장 대담한 문장)이 이미 움직이고 있을 것. 3초 시점까지 "이 영상이 무엇을 주는지"가 선언 완료 ([virvid — first 3 seconds](https://virvid.ai/blog/first-3-seconds-hook-faceless-shorts-2026)).
- **페이오프 대칭**: 마지막 3초는 훅의 약속을 회수하는 씬(결론 숫자·CTA) — 훅과 페이오프를 먼저 쓰고 중간을 채운다 ([OpusClip](https://www.opus.pro/blog/ideal-youtube-shorts-length-format-retention)).
- **리듬 변주**: 균일 3s×10이 아니라 짧은 씬(2–2.5s)과 긴 씬(4–5s, statistic·quote)을 교차. 같은 layout 3연속 금지(증류 — "2–4초 리프레시"는 컷만이 아니라 시각 유형 변화를 포함).

### C-2. 비트 싱크 (BGM 있는 경우)

- 강박(downbeat)에 컷, 스네어/악센트에 텍스트 그래픽 등장을 정렬 ([bitcut — beat sync editing](https://bitcut.app/blog/beat-sync-video-editing), [Silverman Sound — BPM to FPS](https://www.silvermansound.com/bpm-to-fps-calculator)).
- 실용 그리드: 120BPM이면 1박=0.5s, 1마디(4박)=2s → **씬 길이를 마디 정수배(2s/4s)로 양자화**하면 모든 컷이 박에 떨어진다. 크로스페이드는 2박 전에 시작해 다운비트에 완결 ([bitcut](https://bitcut.app/blog/beat-sync-video-editing)).
- 모든 박마다 컷하지 않는다 — 강박만. 매박 컷은 §F 금지.

### C-3. 텍스트 체류 시간 (읽기 속도 계약)

- **성인 기준 최대 20 CPS(자/초), 최소 노출 0.83s(5/6s), 최대 7s** — Netflix Timed Text 규격 ([Netflix Partner Help](https://partnerhelp.netflixstudios.com/hc/en-us/articles/215758617-Timed-Text-Style-Guide-General-Requirements)). 보수적 기준은 BBC 160–180WPM ≈ 15 CPS ([subhero — standards compared](https://subhero.io/blog/subtitle-standards-guide)).
- 증류(한국어 헤드라인): **체류 시간 ≥ 0.5s + 글자수 ÷ 12** (진입 애니메이션 시간은 읽기 시간에 산입하지 않음 — 마스크 리빌 중엔 못 읽는다). 예: 14자 헤드라인 → 최소 1.7s 정지 상태 노출.
- 헤드라인 42자(한국어 ~20자/줄, 2줄) 초과 금지 — Netflix 줄당 42자 상한의 준용 ([Netflix](https://partnerhelp.netflixstudios.com/hc/en-us/articles/215758617-Timed-Text-Style-Guide-General-Requirements)).

### C-4. 전환

- 기본은 **cut(0s)** — 상용 페이싱의 뼈대. 모션 전환(slide/wipe)은 0.2–0.25s(repo 기본과 일치), inOut 곡선.
- crossfade는 30초당 최대 1–2회, 무드 전환(챕터 경계)에만. 0.5s 초과 crossfade는 §F 금지.
- 전환 방향은 서사 방향과 일치: 진행 = slide_left(콘텐츠가 왼쪽으로 밀림), 회상/대비 = fade.

---

## D. 색·글로우·블러 규칙 (linear류 다크 기준)

- **단일 액센트 원칙**: near-black(#010102) 캔버스 + 액센트 1색(#5e6ad2류). 한 씬에 액센트 계열 외 유채색 추가 금지. Linear 스타일의 정의적 특징 ([Medium — The rise of Linear style design](https://medium.com/design-bootcamp/the-rise-of-linear-style-design-origins-trends-and-techniques-4fd96aab7646)). 텍스트 대비는 런타임 `contrast >= 3` 또는 central-edge 검증을 통과해야 한다(`docs/design-presets.md` 참고).
- **글로우는 씬당 1광원**: 글로우는 "지금 봐야 할 곳" 포인터다. 두 개면 포인터가 아니라 장식이고, 장식 글로우는 아마추어 신호.
- **글로우 구현 계약**: box-shadow를 프레임마다 tween하지 않는다. 정적 라디얼 글로우를 pseudo-element/별도 레이어에 렌더하고 **opacity와 scale만** 애니메이트 — 컴포지터 스레드에서 처리되어 렌더 결정성·성능 모두 안전 ([chyshkala — Linear design systems in dark mode](https://chyshkala.com/blog/why-linear-design-systems-break-in-dark-mode-and-how-to-fix-them)).
- **다크에서 그림자 금지, 밝기로 층위**: 다크 캔버스에서 depth는 drop-shadow가 아니라 surface 밝기 사다리 + hairline 보더로 만든다 (Linear 시스템 관행, [Medium](https://medium.com/design-bootcamp/the-rise-of-linear-style-design-origins-trends-and-techniques-4fd96aab7646)).
- **블러 3용법**: ① 진입 blur-in 4–8px→0 (텍스트 포커스 연출), ② 글래스 카드 backdrop-blur 12–24px — 2026 글래스모피즘은 무거운 프로스트가 아니라 "얇은 반투명 다층" ([Senate Media — 2026 animation trends](https://www.senatemedia.co.uk/2026/02/from-vivid-gradients-to-liquid-glass-key-animation-trends-for-2026/), [Midrocket — UI trends 2026](https://midrocket.com/en/guides/ui-design-trends-2026/)), ③ 심도 — 배경 요소 상시 blur로 전경 분리. 본문 텍스트 위 글래스 금지(가독성).
- **그라디언트 메시는 배경 전용·저속 드리프트**: 메시/그라디언트는 콘텐츠 뒤에서 대기 깊이를 만든다. 드리프트는 sine.inOut 20–40s 루프, 텍스트와 명도 경쟁 금지 ([studiomeyer — Web design trends 2026](https://studiomeyer.io/en/blog/webdesign-trends-2026), [Envato — motion design trends](https://elements.envato.com/learn/motion-design-trends)).
- **강조의 문법 = 채도·밝기 차등**: 강조 요소를 밝히는 것보다 **비강조 요소를 죽이는 것**(채도 −40~50%, opacity 0.55–0.65)이 먼저다. 프레임의 총 밝기 예산을 지킨다(증류 — R2/R3/R4 공통 규칙의 일반화).

---

## E. 타이포 진입 패턴 8종 (GSAP 구현 가능 확정분)

모두 SplitText(또는 수동 span 분할) + 표준 tween으로 구현 가능. 공통 상한: **글자 단위 stagger 총합 0.6s 이내**(넘으면 간격 자동 축소), 진입 중 텍스트는 읽기 시간에 미산입(§C-3).

| # | 패턴 | 구현 | 수치 | 용도 |
|---|---|---|---|---|
| T1 | **라인 마스크 라이즈** | 줄 단위 분할, overflow:hidden 래퍼, yPercent 110→0 | `power4.out` 0.7–0.9s, 줄 stagger 0.12–0.15s | 헤드라인 기본값. 가장 상용급으로 읽히는 패턴 ([freefrontend — SplitText](https://freefrontend.com/split-text-js/)) |
| T2 | **글자 스태거 페이드업** | char 분할, y 16–24px + opacity | 개별 0.4s `power2.out`, stagger 0.02–0.03s | 짧은 단어·라벨. 랜딩 시그니처 ([codefronts](https://codefronts.com/motion/css-text-animations/)) |
| T3 | **블러 인** | word 분할, filter blur(8px)→0 + opacity | 0.6–0.8s `power2.out`, word stagger 0.05s | 에디토리얼·quote. 대기감 ([codefronts](https://codefronts.com/motion/css-text-animations/)) |
| T4 | **타입라이터/디코드** | char 순차 표시(steps) 또는 스크램블→정착 | 글자당 0.03–0.05s, 커서 blink 0.5s | 터미널·개발자 톤 전용. 남용 금지 ([GSAPify — ScrambleText 계열](https://gsapify.com/gsap-animations/)) |
| T5 | **클립 와이프** | clip-path inset右 100%→0, 액센트 바가 선단을 리드 | `expo.inOut` 0.5–0.6s | 섹션 라벨·kicker. 날카로운 등장 |
| T6 | **워드 팝 (비트 싱크)** | word 분할, scale 0.9→1 + opacity | `back.out(1.4)` 0.35s, word stagger 0.08s — BGM 박자에 word 정렬 | urgent·리듬 강한 씬 ([bitcut — 악센트에 그래픽 정렬](https://bitcut.app/blog/beat-sync-video-editing)) |
| T7 | **트래킹 정착** | letter-spacing 0.2em→정상 + opacity | `expo.out` 0.8–1.0s, 분할 불필요 | apple·럭셔리 톤. 절제된 프리미엄 |
| T8 | **카운트업 뉴머럴** | tabular-nums 고정폭, textContent snap tween | `power4.out`, 씬의 50–60% | statistic 전용. R1과 결합 ([CountUp.js](https://www.cssscript.com/customizable-count-updown-animations-pure-javascript-countup-js/)) |

reveal enum 매핑: `fade_in`→T2/T3, `typewriter`→T4, `split_reveal`→T1/T5, `count_up`→T8, `stagger`/`cascade`→T2, `zoom_in`→T6 변형, `spotlight`→T7+글로우.

키네틱 타이포 총칙: 움직임이 "무엇을 먼저 읽어야 하는지"를 돕지 않으면 실패다 — 절제가 곧 쇼스토퍼 ([Envato — web design trends: kinetic type](https://elements.envato.com/learn/web-design-trends), [ikagency — kinetic typography 2026](https://www.ikagency.com/graphic-design-typography/kinetic-typography/)).

---

## F. 금지 목록 — 아마추어 티 13종

렌더 전 자가 점검용. 하나라도 걸리면 상용급이 아니다.

1. **진입 후 동결** — 요소가 들어온 뒤 씬 끝까지 정지. 모든 씬은 Develop 단이 있어야 한다(§B). ([AIR Media-Tech — 2–4s 리프레시](https://air.io/en/youtube-hacks/advanced-retention-editing-cutting-patterns-that-keep-viewers-past-minute-8))
2. **균일 이징** — 전 요소 동일 ease·동일 duration, 특히 linear. 진입/퇴장/이동은 곡선이 달라야 한다. ([web.dev](https://developers.google.com/web/fundamentals/design-and-ux/animations/choosing-the-right-easing))
3. **동시 등장** — 씬 요소가 stagger 없이 한 프레임에 전부 등장. 위계 실종.
4. **ease-in 진입** — 굼뜬 시작. 진입은 무조건 감속 계열. ([animations.dev](https://animations.dev/learn/animation-theory/the-easing-blueprint))
5. **과도 바운스** — `back.out(1.7)` 초과, elastic/bounce를 텍스트·차트에 적용. 오버슛은 소품(아이콘·뱃지) 한정. ([GSAPify](https://gsapify.com/gsap-ease/))
6. **과잉 컷** — 30초에 12컷 초과, 매박 컷. 회상·설득 모두 하락. ([Mapes & Ross 1989](https://link.gale.com/apps/doc/A13980912/AONE?u=googlescholar&sid=AONE&xid=bd8a2091))
7. **읽기 속도 위반** — 20 CPS 초과 체류, 0.83s 미만 노출, 진입 애니메이션 시간을 읽기 시간에 산입. ([Netflix](https://partnerhelp.netflixstudios.com/hc/en-us/articles/215758617-Timed-Text-Style-Guide-General-Requirements))
8. **box-shadow/filter 프레임 tween** — 글로우는 사전 렌더 레이어의 opacity/scale로만. ([chyshkala](https://chyshkala.com/blog/why-linear-design-systems-break-in-dark-mode-and-how-to-fix-them))
9. **다중 액센트** — 한 씬에 액센트 유채색 2계열 이상, 무지개 그라디언트 텍스트.
10. **긴 crossfade 남발** — 0.5s 초과 crossfade, 콘텐츠 씬 사이 상시 fade. 기본은 cut.
11. **다크 캔버스 위 drop-shadow** — 층위는 밝기 사다리+헤어라인으로. ([Medium — Linear style](https://medium.com/design-bootcamp/the-rise-of-linear-style-design-origins-trends-and-techniques-4fd96aab7646))
12. **경쟁 모션** — 동시에 3개 이상이 서로 다른 방향으로 움직여 시선 분산. 주 모션 1 + 보조(드리프트) 1까지.
13. **훅 없는 오프닝** — s01이 로고·타이틀 카드·빈 빌드업으로 시작. 판정 창은 1.8초다. ([OpusClip](https://www.opus.pro/blog/youtube-shorts-hook-formulas))

---

## 부록: 검증 체크리스트 (렌더 전)

- [ ] s01 첫 프레임부터 주 시각 요소가 모션 중인가
- [ ] 씬 수 7–10, 최장 씬 ≤5s, 같은 layout 3연속 없음
- [ ] 모든 씬에 Enter/Develop/Exit 3단이 있는가
- [ ] 진입=out 계열, 퇴장=in 계열, 퇴장이 진입보다 짧은가
- [ ] 헤드라인 정지 노출 ≥ 0.5s + 글자수/12
- [ ] 글로우 광원 씬당 ≤1, 액센트 1계열
- [ ] BGM 있으면 컷이 마디 경계에 정렬되는가
- [ ] §F 13종 전부 통과
