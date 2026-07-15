# Design Direction — 브리프→방향 고정 판단 로직

Direction Freeze에서 프리셋·free 씬의 화면 build·무드 상승을 결정할 때 읽는 판단 트리. 결과는 먼저 `direction/frame.md`(프리셋, 무드 아크, chrome, 타이포 규칙), `direction/copy.md`, `direction/STORYBOARD.md`로 고정한다. `scene_specs.json`은 이 결정을 조립하는 얇은 manifest일 뿐, 화면을 설계하는 출발점이 아니다.

수치 근거와 구현 문법은 `docs/motion-design-guide.md`(이하 MDG)가 원본이다. 이 문서의 manifest 지시는 기존 계약 enum 안에서만 표현한다 — 새 필드를 만들지 않는다.

---

## 1. 프리셋 선택 트리

브리프에서 아래 신호를 위에서부터 순서대로 검사하고, 첫 매치에서 멈춘다. 선택 결과와 이유를 `frame.md`에 기록한 뒤 씬 저작을 시작한다.

```text
브리프에 명시 브랜드/스타일 지시가 있다
└─ 예 → 해당 프리셋 고정. 이후 질문 금지.

주제가 개발자 도구 / 인프라 / 기술 SaaS / "엔지니어링" 톤?
├─ 코드/터미널/해커뉴스식 빠른 릴 톤 → neon-terminal
├─ 다크·프리미엄·제품 대시보드 중심 → linear
│   └─ 데모 실화면(스크린샷/영상)이 주인공이고 자막이 프레임을 가리면 안 됨 → linear-demo
└─ 미니멀·문서·코드 중심·흑백 선호 → vercel

주제가 금융 / 결제 / B2B 성장 / 가격·수치 스토리? → stripe

주제가 교육 / 강의 / 문서·위키 / 온보딩 / 따뜻한 톤? → notion

물리적 제품·단일 오브젝트가 주인공 (제품 사진/렌더 보유)? → apple

낙관적 과학/교육 설명, 밝은 유튜브 네이티브 애니메이션 문법? → nebula-pop

저널리즘/다큐/취재/지도형 설명? → pressroom

라이브 업데이트/속보/스포츠 인접/하단 자막 뉴스 패키지? → broadcast-news

통계·리서치·차트·출처 신뢰가 주인공? → data-journal

브랜드 인트로/타이틀 히트/트레일러형 런칭? → cinematic-trailer

흑백 캠페인/강한 한 단어/누아르 임팩트? → mono-impact

랭킹/연말결산/소셜 지표 카드/리캡? → wrapped-bold

한국 예능 자막/리액션/엔터테인먼트 편집? → k-variety

한국 뉴스/선거/카운트업 정보 패널? → k-broadcast

그 외 (뉴스·일반 설명·불명) →
├─ 무드가 dramatic/suspense/urgent 지배적 → linear (다크가 긴장 수용력이 큼)
└─ informative/contemplative 지배적 → vercel (중립 캔버스)
```

보조 규칙:

- 생성 이미지(`visual_kind: generate_image`)를 많이 쓰는 프로젝트는 다크 프리셋(linear)이 안전 — 이미지 가장자리 블렌딩이 밝은 캔버스보다 관대하다.
- 시청 환경이 모바일 피드(쇼츠)면 대비가 가장 큰 조합 우선: linear 또는 vercel. 파스텔(notion)은 소형 화면에서 위계가 뭉개진다.
- 프리셋별 대비 계약은 `docs/design-presets.md` 표를 따른다. 커스텀 색 요청은 런타임 `contrast >= 3` 또는 central-edge 검증 통과분만 수용.

## 2. free 씬 모션 문법

ReelForge의 기본 씬 관용구는 `free`다. 모든 씬은 먼저 `layout: "free"`와 프로젝트 상대 경로의 `sourceHtml`로 저작한 **풀블리드 모션 그래픽**으로 설계한다. 타이포·이미지·제품·그래픽 중 하나의 지배 오브젝트와 시간차 build가 화면의 문법이다.

### 저작·엔진 경계

- `sourceHtml`은 `layout`이 `free`일 때 필수이고, `sourceHtml`이 있으면 layout은 `free`여야 한다. authored 파일은 전체 HTML 문서이며, `<body><template>` 안에 `<style>`과 `data-composition-id`를 가진 루트 요소 하나를 둔다.
- 스크립트는 그 id의 `window.__timelines["<id>"]`에 등록하는 `gsap.timeline({ paused: true })` 하나만 동기적으로 만들고 `tl.seek(0)`으로 끝낸다. id는 씬마다 유일해야 하며 `free-<sceneId>`를 권장한다.
- 컴파일러는 fragment를 `build/blocks/free/<sceneId>.html`로 transport inline·runtime-ready 주입 후 복사하고, 생성 씬 wrapper의 track 3 sub-composition으로 mount한다. 타이밍·자막·전환·`--rf-*` 토큰 주입·ken burns·render-lint는 엔진 소유다.
- `sourceHtml` 누락은 `free-missing-source`, 파일 부재는 `free-missing`, `data-composition-id` 부재는 `free-invalid` compile warning을 내고 모두 `headline_only`로 degrade한다. 이 warning은 저작 실패로 보고 fragment를 고친다.
- render-lint는 모든 composition HTML에서 `fetch()`·non-paused timeline·`Math.random()`·`Date.now()`·`performance.now()`를 금지한다. wall-clock 의존은 deterministic seek render를 깨므로 쓰지 않는다.

### 화면·모션 규칙

- 패널·카드·슬라이드 chrome 없이 배경을 프레임 전체에 연속시킨다. kinetic typography는 viewport 규모로 쓰고, 주 피사체는 viewport의 최소 30%를 점유한다.
- build 순서가 곧 위계다. 한 단계에 새 요소 하나만 추가하고, 이전 요소는 dim한다. 동시 입장으로 중요도를 평준화하지 않는다.
- 진입 tween은 원칙적으로 `<= 0.5s`, easing은 `power2.out`·`power3.out`·`expo.out`를 쓴다. 긴 reveal은 읽을 시간을 실제로 늘릴 때만 허용한다.
- 리빙 모션은 CSS keyframes, `infinite alternate`, `calc(var(--rf-scene-start, 0s) + 1.2s)` 지연을 쓴다. filter/opacity만 움직여 GSAP transform과 충돌하지 않게 한다.
- 색은 fallback을 둔 `var(--rf-*)`만 소비한다: `--rf-text`, `--rf-muted-text`, `--rf-accent`, `--rf-bg`, `--rf-surface-2`, `--rf-surface-3`, `--rf-hairline`, `--rf-hairline-strong`, `--rf-ink-subtle`, `--rf-ink-tertiary`, `--rf-accent-alt`, `--rf-on-accent`, `--rf-success`.
- **de-slide 하드 룰:** 한 프레임이라도 프레젠테이션 슬라이드로 읽히면 review 실패다. 정보 패널을 늘어놓아 해결하지 말고, 하나의 지배 오브젝트와 시간차 build로 재설계한다.

## 3. 무드 상승과 모션 강도 3단

강도는 스펙 필드가 아니다. Direction Freeze에서 정한 **무드 아크**를 fragment의 화면 build와 manifest의 `reveal`·`transition`·`mood`·`emphasis` 조합으로 번역한다. `frame.md`에는 기본 강도, 클라이맥스 씬, hot accent와 희소한 `--rf-success`의 착지 지점을 기록한다. (원형: IBM Carbon의 productive/expressive 2모드 — MDG §A-3)

### 3-1. 강도 결정

아래 점수를 합산한다. 각 항목 해당 시 +1.

| 신호 | +1 조건 |
|---|---|
| 포맷 | 쇼츠/피드용 (vs 사내 보고·문서 임베드) |
| 목적 | 홍보·쇼케이스·런칭 (vs 정보 전달·교육) |
| BGM | 비트 있는 BGM 사용 |
| 카피 밀도 | 씬 평균 헤드라인 ≤ 14자 (여백이 모션을 받아줌) |
| 브랜드 톤 | "개쩌는/임팩트/힙한" 계열 형용사가 브리프에 존재 |

- **0–1점 → 차분(calm)**: 보고·교육·somber 주제. 기본값 아님 — 명확한 근거 있을 때만.
- **2–3점 → 표준(standard)**: 대부분의 설명 영상. 기본값.
- **4–5점 → 쇼케이스(showcase)**: 30초 홍보 릴. MDG 전체 문법을 최대로 적용.

무드 오버라이드: 프로젝트 지배 무드가 `somber`면 점수 무관 차분으로 강등. `triumphant`/`urgent`가 클라이맥스에 있으면 해당 씬만 한 단계 승격 가능. 상승은 모든 씬의 에너지를 올리는 일이 아니라, 시작의 hook과 1–2개 클라이맥스에 대비를 집중하는 일이다.

### 3-2. 강도→화면 build 번역표

| 항목 | 차분 | 표준 | 쇼케이스 |
|---|---|---|---|
| 주 reveal 팔레트 | `fade_in`, `stagger` | `stagger`, `cascade`, `count_up`, `build_up` | `split_reveal`, `stagger_then_flash`, `count_up`, `zoom_in`, `spotlight`, `dramatic_pause` |
| 전환 | `fade`(0.25s) 위주, `cut` 소량 | `cut` 위주 + 챕터 경계 `crossfade` 1회 | `cut` + 방향성 `slide_left`/`wipe_left`(0.2s), `crossfade`는 최대 1회 |
| 30초 씬 수 | 5–6 | 6–8 | 8–10 (상한 12 — MDG §C-1) |
| 카운트업 | 사용 자제 | 실제 수치가 주인공인 씬에 1회 | 클라이맥스 수치와 값 라벨까지 |
| 글로우 | 없음 | 클라이맥스 씬 1곳 | 씬당 1광원 허용 (2광원은 금지 — MDG §D) |
| 타이포 패턴(MDG §E) | T2, T3 | T1, T2, T8 | T1, T5, T6, T7, T8 |
| 무드 선택 경향 | `somber`/`contemplative`/`informative` | `informative` 중심 + 클라이맥스 1곳 격상 | `dramatic`/`urgent`/`triumphant` 적극 (오디오 길이는 불변 — 시각 페이싱만) |

주의: 쇼케이스라도 `typewriter`(T4)는 개발자/터미널 소재 전용, `parallel`은 실제 대조 관계 외 금지. 강도가 높다 = 더 많이 움직인다가 아니라 **더 대담한 소수의 모션**이다 (MDG §F-12: 동시 경쟁 모션 금지).

## 4. 카피 길이 ↔ 모션 밀도 트레이드

읽기 속도가 모션 예산을 결정한다 (근거: Netflix 20 CPS·최소 0.83s — MDG §C-3).

**규칙 A — 씬의 시간 예산 분배.** 씬 길이는 narration_tts에서 파생되므로 조절 불가. 그 안에서:

```text
필요 읽기 시간 = 0.5s + 헤드라인 글자수/12 (+ 화면의 추가 읽기 단위당 +0.4s)
모션 예산 = 씬 길이 − 필요 읽기 시간
```

- 모션 예산 < 0.8s → reveal을 `fade_in`으로 강등하고 Develop 모션 생략. **카피가 길면 모션을 포기한다. 둘 다 가지려는 씬이 가장 먼저 망가진다.**
- 모션 예산 ≥ 1.5s → 표준 3단 레시피(MDG §B) 풀 적용 가능.
- 모션 예산 ≥ 2.5s → `dramatic_pause`, `spotlight` 등 시간 소모형 reveal 허용.

**규칙 B — 글자수 상한과 분할.** 헤드라인 > 20자이거나 화면에 독립적으로 읽어야 할 단위가 5개를 넘으면 씬 분할을 먼저 검토한다(카피 축약 > 씬 분할 > 모션 강등 순). 헤드라인 42자 초과는 무조건 재작성 요구.

**규칙 C — 진입 시간은 읽기 시간이 아니다.** 마스크 리빌·스태거 중인 텍스트는 못 읽는다. 카피가 긴 씬일수록 진입 패턴을 짧은 것(T2 0.4s)으로 바꿔 정지 노출을 확보한다.

**규칙 D — 나레이션과 화면 텍스트 불일치 금지.** 화면 텍스트는 나레이션의 압축(키워드·숫자)이어야 하며, 나레이션 전문을 헤드라인에 넣지 않는다. 전문이 필요하면 `subtitleMode`가 담당한다.

## 5. Direction Freeze → Scene Swarm 조립 절차

1. 프리셋 결정 (§1)과 기본 강도 (§3-1)를 프로젝트당 1회 결정하고 `frame.md`에 고정한다. 씬 단위 승격은 클라이맥스 1–2곳만 둔다.
2. `copy.md`에서 화면 카피를 먼저 다듬고, `STORYBOARD.md`에 각 씬의 intent·scene idiom·transition semantic·duration target을 적는다. 오디오 메타데이터가 실제 타이밍 권한을 가진다.
3. pilot인 s01 훅 검사: 첫 씬이 1.8초 안에 가장 강한 시각을 내놓는가. 기본은 viewport-scale kinetic type·이미지·오브젝트 build다. 로고·인사 오프닝이면 재설계한다 (MDG §C-1, §F-13).
4. 각 씬은 `scenes-src/<sceneId>-free.html` 하나를 저작한다. §4의 모션 예산과 §3-2의 reveal을 화면 build에 반영하고, manifest에는 조립에 필요한 `layout:"free"`, `sourceHtml`, `mood`, `reveal`, `emphasis`만 정합시킨다.
5. 마지막 씬이 훅의 약속을 회수하는 payoff인지 검사한다.
6. 전환은 기본 `cut`, 챕터 경계만 모션 전환. 같은 시각 문법 또는 같은 reveal 3연속을 피한다.
7. 렌더 전 MDG 부록 체크리스트를 통과하고, render-lint와 strip QC에서 실패한 씬만 storyboard intent를 기준으로 다시 저작한다.

## 6. 빠른 참조 — 무드→모션 성격

| mood | 이징 성격 (MDG §A-2) | 어울리는 reveal | 피할 것 |
|---|---|---|---|
| `dramatic` | expo 계열, 긴 정착 | `dramatic_pause`, `split_reveal`, `spotlight` | back/bounce |
| `urgent` | power3–4, 짧은 duration, 비트 싱크 | `stagger_then_flash`, `zoom_in`, T6 | 긴 crossfade |
| `somber` | sine/power1, 저속 | `fade_in`, T3 blur-in | 팝·펀치 전부 |
| `informative` | power2–3.out 표준 | `stagger`, `cascade`, `build_up` | 과장 오버슛 |
| `contemplative` | power2, 여백 긴 | `fade_in`, `typewriter`(소재 맞을 때) | 빠른 컷 연쇄 |
| `suspense` | inOut 계열, 지연 배치 | `dramatic_pause`, `split_reveal` | 조기 정보 공개 |
| `triumphant` | expo.out + back.out 펀치 | `count_up`, `stagger_then_flash` | 밋밋한 fade |

---

## Appendix — 선택형 data blocks (기본값 아님)

8개 legacy data-block layout(`bar`, `pie`, `line`, `list`, `numbered`, `statistic`, `compare`, `quote`)은 **실제 정량 데이터가 씬의 주인공일 때만** 사용할 수 있는 선택형 라이브러리다. 기본은 영상당 block 씬 0개다. 일반 설명·주장·제품·이미지·브랜드 씬은 block을 선택하지 않고 free fragment로 저작한다. block도 풀블리드이며 card chrome의 예외가 아니다.

- free fragment로 같은 데이터 순간을 더 명확하게 만들 수 없을 때만 block을 고려한다. `bar`/`pie`/`line`/`statistic`에는 `values`+`unit`이 필요하다.
- bare title card에는 `headline_only`이 schema-valid다. eight-block golden fixture(`fixtures/golden-specs/full-8types/`)는 compile smoke path이지 영상 저작 모델이 아니다.
- 선택 시에만 scene-authoring.md의 mapping을 따른다: `statistic`+`number`, `compare`+`contrast`, `numbered`+`sequence`. `emphasis`와 시각 장치는 데이터의 실제 관계에 맞춰야 한다.
- 같은 block layout 3연속은 금지한다. 2연속이면 분할 방향·값 처리 등 시각 변형을 교차한다. 가능한 경우 free scene과 교차해 deck 리듬을 만들지 않는다.

### 판정 실패 패턴 — opus 3심 실측 (v5~v8 데모 루프에서 축적)

상용 합격선(5축 평균 4.0)을 막았던 반복 결함. 저작·검수 시 이 목록으로 먼저 자가 검사한다. block 관련 행은 이 Appendix의 선택형 block을 쓸 때만 적용하며, 어느 경우에도 de-slide 규칙을 완화하지 않는다.

| # | 패턴 | 규칙 |
|---|---|---|
| 1 | **공백 데이터 영역** — `compare`/`statistic`에서 값 대형 렌더가 빠지면 "텅 빈 유리판"으로 즉시 감점(출하 차단급) | 모든 값 중심 데이터 블록은 values(숫자·문자열 무관)를 화면의 대형 초점으로 렌더. 값이 없으면 items 라벨을 대형으로. 죽은 공간 70% 이상인 화면은 저작 단계에서 반려 |
| 2 | **다크온다크 저대비** — 다크 프리셋에서 중간 회색 텍스트는 판독 불가 판정 | 본문·제목은 배경 토큰과 쌍인 고대비 텍스트 토큰만 사용. 런타임 `contrast < 3`이고 central-edge도 실패하는 조합은 render-lint 대상 |
| 3 | **차트 축 오토스케일** — 소수·음수 눈금(35.4/-5.4sec)은 데이터 정직성 감점 | Y축은 nice ticks(1/2/5×10ⁿ, 음수 데이터 없으면 0 시작). 데이터라벨과 축라벨 이중 표기 충돌 금지 |
| 4 | **보조 패널 공백/복붙** — 빈 패널, 본문 문구 복제 패널 모두 "자기복제" 감점 | 보조 정보 영역은 본문과 다른 실데이터로만 채우고, 채울 게 없으면 렌더하지 않는다 |
| 5 | **unit 처리 양극단** — raw 연결("0zero")도, 전면 삭제(맥락 없는 "13")도 감점 | 표시용 단위(%·sec·원 등)만 노출, 의미태그는 숨기되 항목 라벨을 수치 옆에 유지 |
| 6 | **시맨틱 오용** — 순차 단계에 순위형 시각(감소 바), 서열 없는 데이터에 "순위" 라벨 | emphasis·시각 장치는 데이터의 실제 관계와 일치시킨다 |
| 7 | **씬 후반 모션 동결** — 단발 GSAP tween은 감속·종료 후 정지 프레임을 남겨 QC 모션 0 | 리빙 모션은 상시 CSS 루프(infinite alternate, 진입 딜레이 ~1.2s)로. GSAP가 만지는 transform과 충돌 없는 속성(filter 등) 활용 |
| 8 | **같은 레이아웃 3연속** — 액센트색만 바꾼 템플릿 클론은 다양성 감점 | 같은 layout 3연속 금지에 더해, 2연속이면 시각 변형(분할 방향·값 처리)을 교차 |

검수 절차 함정 2건: ① QC 리포트를 자르지 말 것(FAIL 목록 truncation으로 결함 2건이 3라운드 은폐된 사례). ② block 수정 검증은 **해당 block을 쓰는 모든 데모**의 프레임을 직접 열어 확인 — 한 데모만 검증한 수술이 다른 데모에서 실패한 사례 2회.
