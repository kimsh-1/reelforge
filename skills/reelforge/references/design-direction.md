# Design Direction — 브리프→디자인 판단 로직

scene_specs를 쓰는 에이전트가 브리프를 받고 **프리셋·모션 강도·씬별 reveal/mood/emphasis**를 결정할 때 읽는 판단 트리. 수치 근거와 구현 문법은 `docs/motion-design-guide.md`(이하 MDG)가 원본이다. 이 문서의 모든 지시는 기존 계약 enum 안에서만 표현한다 — 새 필드를 만들지 않는다.

---

## 1. 프리셋 선택 트리

브리프에서 아래 신호를 위에서부터 순서대로 검사하고, 첫 매치에서 멈춘다.

```text
브리프에 명시 브랜드/스타일 지시가 있다
└─ 예 → 해당 프리셋 고정. 이후 질문 금지.

주제가 개발자 도구 / 인프라 / 기술 SaaS / "엔지니어링" 톤?
├─ 다크·프리미엄·제품 대시보드 중심 → linear
│   └─ 데모 실화면(스크린샷/영상)이 주인공이고 자막이 프레임을 가리면 안 됨 → linear-demo
└─ 미니멀·문서·코드 중심·흑백 선호 → vercel

주제가 금융 / 결제 / B2B 성장 / 가격·수치 스토리? → stripe

주제가 교육 / 강의 / 문서·위키 / 온보딩 / 따뜻한 톤? → notion

물리적 제품·단일 오브젝트가 주인공 (제품 사진/렌더 보유)? → apple

그 외 (뉴스·일반 설명·불명) →
├─ 무드가 dramatic/suspense/urgent 지배적 → linear (다크가 긴장 수용력이 큼)
└─ informative/contemplative 지배적 → vercel (중립 캔버스)
```

보조 규칙:

- 생성 이미지(`visual_kind: generate_image`)를 많이 쓰는 프로젝트는 다크 프리셋(linear)이 안전 — 이미지 가장자리 블렌딩이 밝은 캔버스보다 관대하다.
- 시청 환경이 모바일 피드(쇼츠)면 대비가 가장 큰 조합 우선: linear 또는 vercel. 파스텔(notion)은 소형 화면에서 위계가 뭉개진다.
- 프리셋별 대비 계약은 `docs/design-presets.md` 표를 따른다. 커스텀 색 요청은 4.5:1 검증 통과분만 수용.

## 2. 모션 강도 3단 — 선택 기준과 번역표

강도는 스펙 필드가 아니다. **reveal·transition·mood 조합으로 표현**한다. (원형: IBM Carbon의 productive/expressive 2모드 — MDG §A-3)

### 2-1. 강도 결정

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

무드 오버라이드: 프로젝트 지배 무드가 `somber`면 점수 무관 차분으로 강등. `triumphant`/`urgent`가 클라이맥스에 있으면 해당 씬만 한 단계 승격 가능.

### 2-2. 강도→enum 번역표

| 항목 | 차분 | 표준 | 쇼케이스 |
|---|---|---|---|
| 주 reveal 팔레트 | `fade_in`, `stagger` | `stagger`, `cascade`, `count_up`, `build_up` | `split_reveal`, `stagger_then_flash`, `count_up`, `zoom_in`, `spotlight`, `dramatic_pause` |
| 전환 | `fade`(0.25s) 위주, `cut` 소량 | `cut` 위주 + 챕터 경계 `crossfade` 1회 | `cut` + 방향성 `slide_left`/`wipe_left`(0.2s), `crossfade`는 최대 1회 |
| 30초 씬 수 | 5–6 | 6–8 | 8–10 (상한 12 — MDG §C-1) |
| 카운트업 | 사용 자제 | statistic 씬에 1회 | 클라이맥스 statistic + 차트 값 라벨까지 |
| 글로우 | 없음 | 클라이맥스 씬 1곳 | 씬당 1광원 허용 (2광원은 금지 — MDG §D) |
| 타이포 패턴(MDG §E) | T2, T3 | T1, T2, T8 | T1, T5, T6, T7, T8 |
| 무드 선택 경향 | `somber`/`contemplative`/`informative` | `informative` 중심 + 클라이맥스 1곳 격상 | `dramatic`/`urgent`/`triumphant` 적극 (오디오 길이는 불변 — 시각 페이싱만) |

주의: 쇼케이스라도 `typewriter`(T4)는 개발자/터미널 소재 전용, `parallel`은 compare 계열 외 금지. 강도가 높다 = 더 많이 움직인다가 아니라 **더 대담한 소수의 모션**이다 (MDG §F-12: 동시 경쟁 모션 금지).

## 3. 카피 길이 ↔ 모션 밀도 트레이드

읽기 속도가 모션 예산을 결정한다 (근거: Netflix 20 CPS·최소 0.83s — MDG §C-3).

**규칙 A — 씬의 시간 예산 분배.** 씬 길이는 narration_tts에서 파생되므로 조절 불가. 그 안에서:

```text
필요 읽기 시간 = 0.5s + 헤드라인 글자수/12 (+ items 있으면 항목당 +0.4s)
모션 예산 = 씬 길이 − 필요 읽기 시간
```

- 모션 예산 < 0.8s → reveal을 `fade_in`으로 강등하고 Develop 모션 생략. **카피가 길면 모션을 포기한다. 둘 다 가지려는 씬이 가장 먼저 망가진다.**
- 모션 예산 ≥ 1.5s → 표준 3단 레시피(MDG §B) 풀 적용 가능.
- 모션 예산 ≥ 2.5s → `dramatic_pause`, `spotlight` 등 시간 소모형 reveal 허용.

**규칙 B — 글자수 상한과 분할.** 헤드라인 > 20자이거나 items > 5개면 씬 분할을 먼저 검토한다(카피 축약 > 씬 분할 > 모션 강등 순). 헤드라인 42자 초과는 무조건 재작성 요구.

**규칙 C — 진입 시간은 읽기 시간이 아니다.** 마스크 리빌·스태거 중인 텍스트는 못 읽는다. 카피가 긴 씬일수록 진입 패턴을 짧은 것(T2 0.4s)으로 바꿔 정지 노출을 확보한다.

**규칙 D — 나레이션과 화면 텍스트 불일치 금지.** 화면 텍스트는 나레이션의 압축(키워드·숫자)이어야 하며, 나레이션 전문을 헤드라인에 넣지 않는다. 전문이 필요하면 `subtitleMode`가 담당한다.

## 4. 씬별 조립 절차 (에이전트 실행 순서)

1. 프리셋 결정 (§1) — 프로젝트당 1회.
2. 강도 결정 (§2-1) — 프로젝트당 1회, 씬 단위 승격은 클라이맥스 1–2곳만.
3. s01 훅 검사: 첫 씬이 1.8초 안에 가장 강한 시각(최대 숫자→`statistic`+`count_up`, 대담한 주장→`quote`/`headline_only`+`split_reveal`)을 내놓는가. 로고·인사 오프닝이면 재설계 (MDG §C-1, §F-13).
4. 마지막 씬 페이오프 검사: 훅의 약속을 회수하는 결론 씬인가.
5. 각 씬: 규칙 A로 모션 예산 계산 → §2-2 팔레트에서 reveal 선택 → mood·emphasis를 layout과 정합시킴 (`statistic`+`number`, `compare`+`contrast`, `numbered`+`sequence`, `quote`+`quote`/`person` 등 — scene-authoring.md 표 준수).
6. 전환 배치: 기본 `cut`, 챕터 경계만 모션 전환. 같은 layout 3연속·같은 reveal 3연속 금지.
7. 렌더 전 MDG 부록 체크리스트 통과 확인.

## 5. 빠른 참조 — 무드→모션 성격

| mood | 이징 성격 (MDG §A-2) | 어울리는 reveal | 피할 것 |
|---|---|---|---|
| `dramatic` | expo 계열, 긴 정착 | `dramatic_pause`, `split_reveal`, `spotlight` | back/bounce |
| `urgent` | power3–4, 짧은 duration, 비트 싱크 | `stagger_then_flash`, `zoom_in`, T6 | 긴 crossfade |
| `somber` | sine/power1, 저속 | `fade_in`, T3 blur-in | 팝·펀치 전부 |
| `informative` | power2–3.out 표준 | `stagger`, `cascade`, `build_up` | 과장 오버슛 |
| `contemplative` | power2, 여백 긴 | `fade_in`, `typewriter`(소재 맞을 때) | 빠른 컷 연쇄 |
| `suspense` | inOut 계열, 지연 배치 | `dramatic_pause`, `split_reveal` | 조기 정보 공개 |
| `triumphant` | expo.out + back.out 펀치 | `count_up`, `stagger_then_flash` | 밋밋한 fade |
