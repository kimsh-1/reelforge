# 방송급 모션그래픽 패키지 문법 리서치 — broadcast-news

> 리서치일: 2026-07-07 · 도구: WebSearch (firecrawl 크레딧 소진으로 폴백) + unpkg 소스 검증(FT o-colors)
> 목적: 뉴스·다큐·스포츠·데이터저널리즘의 화면 문법을 ReelForge 프리셋 재료로 증류.
> 신뢰도 표기: `[검증]` = 1차 소스/코드에서 직접 확인, `[보도]` = 업계 매체 보도, `[관찰]` = 커뮤니티 문서·화면 관찰 기반 근사치.

---

## 1. 글로벌 뉴스 리브랜딩 — BBC / CNN / Bloomberg

### 1.1 도메인 문법 표

| 요소 | BBC News (2019~ Reith 체계) | CNN (2023 리프레시 + 2024 선거 패키지) | Bloomberg TV (2021 리디자인) |
|---|---|---|---|
| 핵심 색 | 뉴스 레드 `#BB1919` (웹/뉴스) · 딥레드 `#B80000` (마스터브랜드) `[관찰]` — 흑·백·적 3색 체계 | CNN 레드 `#CC0000` + 다크 차콜/네이비 그라운드, 2023부터 그라디언트 도입 `[보도]` | 흑백 타이포 우선 + 터미널 계열 액센트(앰버/오렌지, 상승 그린·하락 레드) `[관찰]` |
| 타이포 | BBC Reith(Dalton Maag 커스텀, Sans/Serif/Condensed, 4웨이트+이탤릭) — 화면 가독성 전용 설계. L3에서 Serif=헤드라인, Sans=보조정보 혼용 `[보도]` | CNN Sans(전용 그로테스크). 2023 리프레시에서 볼드 의존을 버리고 **씬 웨이트 + 네거티브 스페이스**로 전환 `[보도]` | Bloomberg 전용 산세리프, 숫자는 tabular figures 고정 — 시세 갱신 시 폭 흔들림 금지 `[관찰]` |
| 로워서드 | 2019 개편에서 화이트 → **블랙 오버레이 + 프로그램별 컬러 팁** 반전. 2단 구조(헤드라인 큰 줄 + 컨텍스트 작은 줄) `[보도]` | 쇼 타이틀을 세그먼트 타이틀 옆 **보조 탭**으로 강등, 라운드 코너, 정보 위계 = 세그먼트 > 쇼 `[보도]` | 흑색 바에 백색 타이포, 시장 데이터 스트립이 로워서드와 한 몸으로 결합 `[관찰]` |
| 티커 | 하단 크롤 + BREAKING 시 적색 밴드로 전환(색 = 상태 신호) `[관찰]` | 2023년 스크롤 티커 폐지 → **정적 "플리퍼"**(항목이 통째로 교체되는 방식, 2013년 이후 첫 변경) `[보도]` | 시세 티커가 아이덴티티 그 자체 — 속도 일정, 상승/하락 색 코딩, 구분자 점 `[관찰]` |
| 그리드/레이아웃 | GEL 기반 모듈러 그리드, 본문 타입 15–18px 스케일 기준(TV는 배율 확대) `[검증: bbc.github.io/gel]` | HD 전제 재설계 — 여백을 정보만큼 취급, 요소 수 감축 `[보도]` | 터미널의 밀도를 계승하되 "정보 클러터 청소"가 리디자인 목표. 차트·데이터 레이어가 오프닝 타이틀에서 도시 풍경과 인터랙트 `[보도]` |
| 모션 시그니처 | 로고 셰도우라인 디바이스 + 3D 모션 배경 스위트(BBC Sport 계열) `[보도]` | 평시 = 절제된 페이드/슬라이드. 선거 패키지(2024, Two Fresh Creative)만 **3D 글래시·메탈릭**으로 등급 상승 — "평시 절제, 이벤트 과시" 이원 체계 `[보도]` | 플랫 디자인 + **3D 큐브 회전**으로 장면 전환, 쇼 로고 글자가 3D 트랜지션 오브젝트가 됨 `[보도]` |

### 1.2 뉴스 문법 핵심 증류
- **색은 상태다**: 평시 팔레트와 BREAKING/LIVE 팔레트를 분리. 적색은 "지금 중요함" 신호로 아껴 쓴다.
- **로워서드는 2티어**: 큰 줄(무엇) + 작은 줄(맥락/누구). 쇼 브랜딩은 3순위 탭으로.
- **티커의 현대형은 플리퍼**: 무한 크롤보다 항목 단위 교체(hold 4–6s → flip 0.3s)가 가독·리듬 모두 우위.
- **숫자는 tabular**: 갱신되는 숫자는 반드시 고정폭 숫자로 — 카운트업 시 레이아웃 떨림 방지.

---

## 2. 다큐 스타일 — 넷플릭스 다큐 타이틀·인포그래픽

| 요소 | 문법 | 대표 사례 |
|---|---|---|
| 스탯 타이포 | 화면을 가득 채우는 초대형 컨덴스드/세리프 숫자, 고대비(백/흑 + 단일 강조색), 통계가 곧 타이틀 카드 | *13th* — 볼드 타이포 통계·역사 이벤트 강조, 긴박감을 대비로 생성 `[보도]` |
| 개념 시각화 | 토킹헤드 사이를 **UI 스타일 모션그래픽**(다이어그램·노드·인터페이스 은유)으로 절단 | *The Social Dilemma* — 인터뷰+아카이브+스타일라이즈드 그래픽 혼합 `[보도]` |
| 타이틀 시퀀스 | 크레딧이 스토리텔링의 시작 — 도시/현장 위에 타이포 주석 오버레이 후 크레딧으로 전이 | *Abstract* `[보도]` |
| 키네틱 타이포 | 글자가 의미·리듬에 따라 진입 방향/스타일/색 변화. 단어 단위 등장, 문장 단위 아님 | 장르 공통 `[보도]` |
| 모션 톤 | 뉴스보다 느리다: 등장 0.6–1.2s, 롱 홀드, ease 완만(expo 대신 sine/quad). 카메라식 드리프트(스케일 1.00→1.04) 상시 | 장르 공통 `[관찰]` |
| 인포그래픽 마감 | 종이/필름 텍스처 또는 완전 플랫 중 택일, 차트에도 서사 — 선이 "그려지는" draw-on, 영역이 "차오르는" fill | 장르 공통 `[관찰]` |

**증류**: 다큐 문법 = "느린 확신". 큰 숫자 + 느린 드리프트 + 한 가지 강조색. 정보 밀도는 낮추고 체류 시간을 늘린다.

---

## 3. 스포츠 하이라이트 패키지 — 임팩트 컷·스코어보드 모션

### 3.1 스코어버그 2026 지형 `[보도: Sports Video Group 2026-06, keepthescore 2026]`

| 네트워크 | 형태 | 특징 |
|---|---|---|
| Fox ("Fox Box" 계보, 1994~) | 반투명 필 | 투명도가 시그니처이자 최다 민원 — 경기 화면과 스코어가 섞임 |
| CBS ("Eyebar") | **상단 풀폭 바** + 불투명 배경 | 다운/거리·타임아웃·공격권을 압축 수납, 2025년 스코어 폰트 확대 |
| NBC (SNF) | 미니멀 필 | 요소 축소 + 여백 확대 = 프라임타임 프레스티지 톤 |
| ESPN | 프로퍼티별 상이 | 의도된 파편화 — 시청층별 튜닝 |
| 스트리밍(Prime/Netflix/Peacock) | 독자 룩 | 베팅·판타지 데이터는 **확장형 요소**로 숨김 |

공통 트렌드: **더 깨끗한 타입 + 부가 데이터는 접이식**. 가독성 = 대비·자간·위계·모션·절제의 합.

### 3.2 임팩트 컷·모션 문법 `[관찰]`
- **스팅어 트랜지션**: 0.4–0.8s, 로고/컬러 와이프가 화면을 쓸고 지나가며 컷 은폐. 방향성 일관(항상 같은 쪽에서).
- **스코어 변경 모션**: 숫자 플립(0.25–0.35s) 또는 카운트업 + 득점 팀 컬러 펄스(1회, 0.5s 감쇠). 버그 전체가 흔들리지 않음 — 변한 셀만 움직인다.
- **속도 대비**: 하이라이트는 in 빠르고(0.2–0.3s, ease-out expo/back) hold 짧고(1.5–3s) out 더 빠름(0.15–0.2s). 뉴스의 절반 템포.
- **팀 컬러 시스템**: 패키지 중립색(흑/백/금속) + 팀 컬러 2슬롯 주입 — 프리셋 관점에서 "액센트 2개를 외부 주입받는 구조"가 핵심.

---

## 4. 데이터 저널리즘 비주얼 — FT / Economist / NYT

### 4.1 팔레트 실측

**FT Origami o-colors** `[검증: unpkg @financial-times/o-colors 소스에서 직접 추출]`

| 이름 | HEX | 용도 |
|---|---|---|
| paper | `#FFF1E5` | 캔버스(시그니처 핑크지) |
| slate | `#262A33` | 다크 그라운드/본문 대체 |
| claret | `#990F3D` | 브랜드 강조·부정 계열 |
| oxford | `#0F5499` | 차트 주 시리즈(블루) |
| teal | `#0D7680` | 차트 주 시리즈·링크 |
| wheat | `#F2DFCE` | 패널 틴트 |
| sky | `#CCE6FF` | 보조 시리즈 |
| mandarin | `#FF8833` | 보조 강조 |
| lemon | `#FFEC1A` | 하이라이트 |
| velvet | `#593380` / candy `#FF7FAA` / jade `#00994D` / wasabi `#96CC28` / crimson `#CC0000` / mint `#C0EFD8` | 확장 시리즈 |

타이포: Financier Display(제목 세리프) + Metric(차트/UI 산세리프) `[관찰]`.

**The Economist** `[보도: 공식 CHARTstyleguide PDF + 재현 아티클 다수]`

| 항목 | 값 |
|---|---|
| Econ 레드(태그바·주 데이터) | `#E3120B` |
| 블랙(타이틀·축·라벨) | `#0C0C0C`~`#0D0D0D` |
| 오프화이트 배경 | `#F5F4F0` (웹 차트는 `#E9EDF0` 계열 블루그레이도 사용) |
| 웹 차트 시리즈 | `#006BA2`(블루) `#3EBCD2`(시안) `#379A8B`(틸그린) `#EBB434`(옐로) `#B4BA39`(올리브) `#9A607F`(모브) `#DB444B`(레드) `#D1B07C`(골드) |
| 원칙 | "one chart, one message" — 주인공 시리즈만 풀컬러(레드), 나머지는 그레이/30–50% 불투명도 |

**NYT** `[관찰]`: NYT Franklin(산세리프 라벨) + Cheltenham/Georgia(제목). 차트는 극도로 절제 — 연회색 그리드(`#E2E2E2` 근사), 축선 최소, **범례 대신 직접 라벨**, 시리즈색은 저채도(스틸블루/더스티레드), 주석(annotation)이 차트의 절반.

### 4.2 세 매체 공통 차트 문법 (우리 블록에 직결)
1. **타이틀 = 결론 문장**: "GDP 성장률"이 아니라 "한국이 성장을 주도한다". 좌상단 정렬, 볼드.
2. **Y축 선 제거**: 가로 그리드라인만 얇게(1px, 저대비), 라벨은 그리드라인 위 우측(Economist) 또는 좌측 상단 정렬.
3. **범례 폐지 → 직접 라벨**: 선/막대 끝에 시리즈명 직결. 영상에서는 특히 필수(범례 읽을 시간 없음).
4. **강조의 산수**: 강조 1개 = 풀컬러, 비교군 전부 = 단일 그레이 또는 본색 30–50%.
5. **출처 라인**: 좌하단 소형 캡션 "Source: …" — 신뢰의 마감재.
6. **애니메이션**(FT 소셜 영상 문법 `[보도: GIJN, John Burn-Murdoch]`): 축·그리드 먼저(0.3s) → 데이터 draw/grow(0.8–1.2s, 시리즈당 스태거 0.15s) → 강조 컬러 점화 + 주석 등장(마지막). "차트가 말하는 순서 = 시청자가 읽는 순서".

---

## 5. 공통 모션 수치 레퍼런스 `[보도+관찰 종합]`

| 항목 | 수치 | 비고 |
|---|---|---|
| 로워서드 in | 0.3–0.5s, ease-out(quart/expo) | 슬라이드+페이드 병행 |
| 로워서드 hold | 단순 3–5s / 복합 5–10s | "두 번 읽을 시간" 룰 |
| 로워서드 out | in의 60–70% 시간, ease-in | 나갈 땐 더 빠르게 |
| 등장 타이밍 | 발화 시작 후 1–2s에 in | |
| 티커 플리퍼 | hold 4–6s → 교체 0.3s | 크롤 방식이면 1080p 기준 ~100–140px/s |
| 스팅어(스포츠) | 0.4–0.8s | 뉴스 범퍼는 0.8–1.2s |
| 숫자 플립/카운트업 | 0.25–0.35s(플립) / 0.8–1.5s(카운트업) | tabular figures 필수 |
| 차트 빌드 | 그리드 0.3s → 데이터 0.8–1.2s(스태거 0.1–0.15s) → 주석 | |
| 다큐 등장 | 0.6–1.2s, sine/quad ease + 상시 드리프트(scale 1.00→1.04) | |
| 세이프 에어리어 | 액션 세이프 93%, 타이틀 세이프 90%(하단 여백 넉넉히) | 로워서드·티커 기준선 |

---

## 6. 차트 블록 스타일링 권고 — bar / line / pie (+statistic·compare)

우리 블록 8종(bar, line, pie, statistic, compare, list, numbered, quote) 중 차트 4종에 방송급 마감을 적용하는 규칙. 블록은 이미 `--rf-*` 토큰(`--rf-text/-accent/-surface/-panel/-muted-text/-shadow`)을 소비하므로 프리셋은 토큰 세트로 주입한다.

### 공통 (전 차트)
- **그리드**: 세로 그리드 제거, 가로만 1px, `color-mix(muted 20~28%, transparent)` — 현행 `--bar-grid` 28% 유지 가능하나 data-journal에선 20%로 낮춤. 축선(axis line)은 baseline 1개만.
- **라벨**: 범례 금지 → 직접 라벨. 값 라벨은 tabular-nums(`font-variant-numeric: tabular-nums`) 강제. 카테고리 라벨은 muted, 값 라벨은 text 풀컬러.
- **강조**: `emphasis` 대상 1개만 `--rf-accent` 풀컬러, 나머지는 muted 40% 톤 — "Economist 산수"를 블록 기본값으로.
- **타이틀**: 결론 문장형 카피 권장(파이프라인 카피 단계에서), 좌상단 정렬 + 태그바(액센트색 4×28px 정도의 좌측 짧은 바 — Economist 레드바 문법).
- **출처**: `source` 변수는 좌하단 11–13px muted로 상시 렌더(빈 값이면 숨김) — 신뢰 마감재.
- **빌드 순서**: 그리드/축(0.3s) → 막대·선 grow/draw(0.8–1.2s, 스태거 0.12s) → 값 라벨 카운트업 → 강조 펄스 1회.

### bar
- 가로 막대 기준: 트랙(track)은 유지하되 대비 18% 이하로 은은하게. 막대 끝 값 라벨은 막대 밖 우측(막대 안 삽입은 폭 짧을 때 깨짐).
- 강조 막대만 액센트, 나머지 단일 그레이 — 무지개 막대 금지.
- 성장 애니메이션은 scaleX(transform-origin left), width 트윈 금지(리플로우).

### line
- 선 두께: 주인공 4–5px, 비교선 2px/muted. draw-on(stroke-dashoffset) 후 끝점에 도트 + 직접 라벨.
- 마지막 값 콜아웃(끝점 옆 굵은 숫자)이 방송 문법의 핵심 — statistic 블록과 시각 언어 통일.
- 영역 채움은 액센트 8–12% 틴트 그라디언트까지만.

### pie
- 방송에선 도넛형(내경 60–65%)이 표준 — 중앙 홀에 핵심 수치(statistic 문법 재사용).
- 조각 3–5개로 제한, 강조 1조각 액센트 + 나머지 muted 단계톤, 강조 조각만 2–3% 외측 오프셋.
- 라벨은 외부 리더라인 대신 조각 옆 직접 배치, 퍼센트는 tabular.

### statistic / compare
- statistic: 다큐 문법 이식 — 초대형 숫자(화면 높이 30%+) + 카운트업 0.8–1.5s + 단위는 숫자의 40% 크기 muted.
- compare: 스코어버그 문법 이식 — 좌우 2셀 + 중앙 구분선, 변경/우세 측만 컬러 펄스, 두 값 모두 tabular 고정폭.

---

## 7. 프리셋 후보 2종

### 7-A. `broadcast-news` — 뉴스 스튜디오 톤
```json
{
  "name": "broadcast-news",
  "tokens": {
    "--rf-surface": "#0B0E14",
    "--rf-panel": "#151A24",
    "--rf-text": "#FFFFFF",
    "--rf-muted-text": "#9AA3B2",
    "--rf-accent": "#D21F26",
    "--rf-accent-alt": "#F5C518",
    "--rf-live": "#E3120B",
    "--rf-shadow": "rgba(0,0,0,0.55)",
    "--rf-grid": "rgba(154,163,178,0.22)"
  },
  "type": { "family": "Pretendard", "display-weight": 800, "body-weight": 500,
            "numeric": "tabular-nums", "tracking-display": "-0.02em" },
  "motion": { "in": "0.4s cubic-bezier(0.16,1,0.3,1)", "hold": "4s",
              "out": "0.25s ease-in", "stagger": "0.1s",
              "flip": "0.3s", "countup": "1.0s" },
  "grammar": ["로워서드 2티어(헤드라인+컨텍스트 탭)", "BREAKING 시 --rf-live 밴드 전환",
              "티커=플리퍼(hold 5s/flip 0.3s)", "액센트는 상태 신호로만"]
}
```
근거: BBC 블랙 L3 반전 + 적색=상태 문법, CNN 씬웨이트·여백·플리퍼, Bloomberg tabular 숫자 규율.

### 7-B. `data-journal` — FT/Economist 데이터 저널 톤
```json
{
  "name": "data-journal",
  "tokens": {
    "--rf-surface": "#FFF1E5",
    "--rf-panel": "#F2DFCE",
    "--rf-text": "#0C0C0C",
    "--rf-muted-text": "#66605C",
    "--rf-accent": "#E3120B",
    "--rf-series": ["#006BA2", "#0D7680", "#3EBCD2", "#EBB434", "#9A607F"],
    "--rf-negative": "#990F3D",
    "--rf-positive": "#00994D",
    "--rf-shadow": "none",
    "--rf-grid": "rgba(12,12,12,0.14)"
  },
  "type": { "family": "Pretendard", "display-weight": 700, "body-weight": 400,
            "numeric": "tabular-nums", "title": "결론 문장형 + 좌측 액센트 태그바(4x28px)" },
  "motion": { "in": "0.5s ease-out", "chart-build": "grid 0.3s → draw 1.0s(stagger 0.12s) → annotate",
              "hold": "5s+", "drift": "scale 1.00→1.03" },
  "grammar": ["one chart, one message — 강조 1개 풀컬러/나머지 muted 40%",
              "Y축선 제거·가로 그리드만", "범례 금지·직접 라벨",
              "출처 캡션 좌하단 상시", "섀도 금지(완전 플랫)"]
}
```
근거: FT paper 캔버스+o-colors 실측, Economist 레드 태그바·단일강조·그리드 문법, NYT 직접 라벨·주석 우선. 다크 변형이 필요하면 surface `#262A33`(FT slate) / grid `rgba(255,255,255,0.14)`로 스왑.

**확장 후보(차순위)**: `sports-impact`(중립 금속톤 + 팀컬러 2슬롯 주입, in 0.25s/hold 2s), `docu-still`(저채도+롱홀드+드리프트) — 본 문서 3·2절 수치로 즉시 조립 가능.

---

## 8. 출처

- NewscastStudio: [BBC 2019 온에어 개편](https://www.newscaststudio.com/2019/07/17/bbc-news-rebrand-broadcast-design-2019/) · [BBC 2021 리브랜딩](https://www.newscaststudio.com/2021/10/21/bbc-rebranding-2021/) · [CNN 2023 인서트 그래픽](https://www.newscaststudio.com/2023/06/01/cnn-new-graphics-chryons-lower-thirds/) · [CNN 2023-08 업데이트](https://www.newscaststudio.com/2023/08/15/cnn-graphics-update-august-2023/) · [CNN 2024 선거 패키지](https://www.newscaststudio.com/2024/01/17/cnn-new-election-graphics-2024/) · [Bloomberg 2021 리디자인](https://www.newscaststudio.com/2021/05/07/bloomberg-redesign/)
- [It's Nice That — BBC Reith](https://www.itsnicethat.com/news/bbc-reith-typeface-graphic-design-110817) · [Dalton Maag — BBC Reith](https://www.daltonmaag.com/portfolio/custom-fonts/bbc-reith.html) · [BBC GEL Typography](https://bbc.github.io/gel/foundations/typography/)
- [Mark Porter Associates — Bloomberg TV](https://markporter.com/work/bloomberg-television) · [designboom — Quicktake](https://www.designboom.com/design/bloomberg-quicktake-creative-director-disrupting-the-traditional-tv-news-model-04-27-2021/)
- [Sports Video Group — 모던 스코어버그 설계(2026-06)](https://www.sportsvideo.org/2026/06/09/designing-the-modern-scorebug-how-broadcast-graphics-teams-are-rethinking-the-most-important-element-on-screen/) · [keepthescore — 네트워크별 스코어버그 비교(2026)](https://keepthescore.com/blog/posts/score-bugs-in-live-sports-broadcasts/) · [Score bug — Wikipedia](https://en.wikipedia.org/wiki/Score_bug)
- [FT chart-doctor Visual Vocabulary](https://github.com/Financial-Times/chart-doctor/blob/main/visual-vocabulary/README.md) · [GIJN — John Burn-Murdoch 인터뷰](https://gijn.org/stories/data-visualization-storytelling-tips-john-burn-murdoch/) · [@financial-times/o-colors (unpkg 소스 실측)](https://www.npmjs.com/package/@financial-times/o-colors)
- [The Economist CHARTstyleguide PDF](https://sa.ipaa.org.au/wp-content/uploads/2026/02/Economist-CHARTstyleguide_20170505.pdf) · [Economist 스타일 재현(matplotlib)](https://medium.com/data-science/making-economist-style-plots-in-matplotlib-e7de6d679739) · [Economist 스타일 차트 가이드](https://medium.com/@aecharts/how-to-create-the-economist-style-charts-f2052ba6d6d3)
- [Vimeo — 로워서드 가이드](https://vimeo.com/blog/post/what-is-lower-thirds) · [School of Motion — 스포츠 로워서드](https://www.schoolofmotion.com/blog/sports-lower-thirds) · [wasp3d — 스포츠 로워서드 모션](https://wasp3d.com/blogs/sports-lower-thirds-for-broadcasts-design-animation-and-best-practices)
- [Fiveable — 다큐 그래픽스](https://fiveable.me/documentary-production/unit-15) · [Creative Bloq — 키네틱 타이포](https://www.creativebloq.com/typography/examples-kinetic-typography-11121304)
