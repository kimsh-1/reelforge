# 유튜브 상위 채널 영상 디자인 아이덴티티 — 프리셋 재료 증류

> 조사일: 2026-07-07. 목적: ReelForge `design-tokens.json` 프리셋 재료.
> 신뢰도 표기 — **[실측]** 소스 코드/공식 문서/브랜드 자료에서 확인한 값, **[준실측]** 팔레트 아카이브·브레이크다운 기사에서 수집, **[추정]** 스크린샷 관찰 기반 근사값. 추정 HEX는 프리셋 제작 시 실프레임 스포이드 검증 필요.
> 스키마 매핑 기준: `/home/seunghyeong/reelforge/schemas/design-tokens.schema.json` — `colors`(자유 키 HEX 맵) / `moods`(7종 고정: dramatic·urgent·somber·informative·contemplative·suspense·triumphant, 각 accent+speed+glow) / `subtitle`(폰트·스트로크·키워드색·배경) / `fonts`(body·headline·value·subtitle·mono 5롤).

---

## 1. Kurzgesagt — In a Nutshell

**아이덴티티 요약**: 플랫 벡터 일러스트 + 초고채도 네온 팔레트 + 우주 배경. Illustrator 드로잉 → After Effects 패스 애니메이션. 그림자 대신 색면 레이어링, 라운드 셰이프.

### (a) 팔레트

| 토큰 후보 | HEX | 신뢰도 | 비고 |
|---|---|---|---|
| bgSpace | `#0a0e3f` | 추정 | 딥 스페이스 네이비(씬마다 변주) |
| blueDeep | `#0025bf` | 준실측 | 팔레트 아카이브 수집값 |
| blueBright | `#008cf7` | 준실측 | |
| cyan | `#00d8fc` | 준실측 | 글로우/별빛 |
| violet | `#6500d7` | 준실측 | 우주 그라데이션 축 |
| pink | `#ff3fa7` | 준실측 | 생명체·강조 |
| yellow | `#fad53c` | 준실측 | 태양·하이라이트 |
| birdWhite | `#f4f0e8` | 추정 | 새 캐릭터·전경 오브젝트 |

특징: 보색 대비(파랑↔주황·핑크)를 한 씬에 공존시키되 전부 같은 채도 밴드로 묶음. 배경은 어둡고 오브젝트는 밝음 → 다크 캔버스 + 네온 오브젝트 구도.

### (b) 타이포
- 채널 서체: **Montserrat** 계열 지오메트릭 산스 [준실측]. 타이틀 700~800, 본문 500. 자간 넉넉(+2~4%), 전부 대문자 타이틀 흔함.
- 등장: 페이드+살짝 스케일업(0.95→1.0), 오브젝트 애니메이션에 종속(글자가 주인공이 아님).

### (c) 모션 시그니처
- 컷 속도: 중간(내레이션 문장 단위, 3~6초/씬). 씬 전환은 하드컷보다 **오브젝트 모핑/카메라 팬** 연속 이동.
- 패스 애니메이션·루프 expression·타임 리맵 [준실측, Skillshare 공식 강좌]. 위글 없는 깔끔한 ease-in-out.
- 폭발·빛 이펙트는 플랫 셰이프 프레임바이프레임(스타일라이즈드).

### (d) 배경/텍스처
- 노이즈·그레인 거의 없음. 순수 벡터 플랫. 깊이는 색 명도 단계로만 표현(배경 어둡게 3~4단).
- 별·파티클 = 단순 도트/원.

### design-tokens 번역 노트
- `moods.dramatic.accent=#ff3fa7`, `urgent=#fad53c`, `informative=#008cf7`, `contemplative=#6500d7`, glow는 `0 0 24px` 수준의 네온 블룸이 잘 어울림. speed는 전반 normal.
- subtitle: 스트로크 없이 반투명 다크 박스(`rgba(10,14,63,0.85)`) + 흰 글자 + keywordColor 노랑.

소스: [Midlibrary Kurzgesagt](https://midlibrary.io/styles/kurzgesagt), [팔레트 아카이브](https://aquaproductions.tumblr.com/post/734943789572145152/color-palettes-kurzgesagt-submitted-by), [arts.ink 분석](https://artsatmichigan.umich.edu/ink/2019/09/27/simple-bright-beautiful-the-work-of-kurzgesagt/), [Skillshare 공식 강좌](https://www.skillshare.com/en/classes/motion-graphics-with-kurzgesagt-part-1/631970755), [WordSCR 폰트](https://wordscr.com/what-font-does-kurzgesagt-use/)

---

## 2. Vox

**아이덴티티 요약**: "신문이 움직인다". 화이트/크림 지면 + 노랑 형광펜 하이라이트 + 콜라주 컷아웃 + 세리프·고딕 혼용 에디토리얼 타이포.

### (a) 팔레트

| 토큰 후보 | HEX | 신뢰도 | 비고 |
|---|---|---|---|
| highlightYellow | `#ffd800` | 추정 | 시그니처 형광펜(#ffd400~#fff200 밴드) |
| paperWhite | `#f7f5f0` | 추정 | 지면 배경 |
| inkBlack | `#1a1a1a` | 추정 | 본문 잉크 |
| accentRed | `#e03c31` | 추정 | 지도 화살표·경고 계열 |
| archiveSepia | `#c9b48a` | 추정 | 아카이브 사진 틴트 |

### (b) 타이포
- 웹 브랜드: **Balto**(고딕 산스, Franklin/Trade Gothic 계보) + **Harriet / Harriet Display**(세리프) [실측, Fonts In Use/Typ.io]. 영상 타이틀도 같은 계열 — 컨덴스드 볼드 고딕 + 세리프 이탤릭 혼용.
- 등장 방식: **형광펜 와이프**(글자 위 노랑 박스가 좌→우로 그려짐), 타자기식 단어 단위 팝, 밑줄 드로우온.
- 굵기 대비 극단적: 타이틀 800 vs 캡션 400 이탤릭.

### (c) 모션 시그니처
- 내레이션 싱크 강박: 모든 모션이 문장 강세에 맞춰 발화 순간 등장 [준실측].
- 컷 속도 중간~빠름(2~5초). 전환은 모션 블러 줌·화이트 플래시·지면 슬라이드.
- 콜라주 컷아웃(사진 오려낸 흰 테두리)이 지면 위에서 미세하게 부유(2~3px 랜덤 워크).

### (d) 배경/텍스처
- 종이 질감 미세 노이즈 + 지면 그리드. 아카이브 자료엔 세피아 틴트+스크래치.
- 지도: 플랫 톤다운 베이스에 노랑/빨강 라인 드로우온.

### design-tokens 번역 노트
- `moods.informative.accent=#ffd800`(형광펜), `urgent=#e03c31`, glow 없음(플랫 에디토리얼 — glow는 `none` 계열 문자열).
- subtitle: keywordColor를 검정 글자+노랑 배경 박스 반전으로 쓰는 게 시그니처 → `keywordColor=#1a1a1a` + 하이라이트 박스 연출(렌더러 확장 포인트).

소스: [PremiumBeat: VOX 모션그래픽 5 브레이크다운](https://www.premiumbeat.com/blog/replicating-vox-motion-graphic/), [Kapwing: Vox식 영상 만들기](https://www.kapwing.com/resources/how-to-make-informational-videos-like-vox/), [Fonts In Use — Vox](https://fontsinuse.com/uses/6828/vox-website), [Typ.io — Balto/Harriet](https://typ.io/s/nr1p)

---

## 3. Johnny Harris

**아이덴티티 요약**: 저널리즘 다큐. GEOlayers 지도 줌 + 필름 번/라이트 리크/그레인 텍스처 + 키프레임식(비연속) 사진 애니메이션 + 핸드헬드 감성.

### (a) 팔레트

| 토큰 후보 | HEX | 신뢰도 | 비고 |
|---|---|---|---|
| paperCream | `#e8e0d0` | 추정 | 종이/지도 베이스 |
| inkNavy | `#1e2a3a` | 추정 | 잉크·라벨 |
| signalRed | `#d92b2b` | 추정 | 지도 경로·강조 라인 |
| vintageOrange | `#e8823c` | 추정 | 필름 번 계열 |
| shadowBrown | `#3a2f28` | 추정 | 그레인 섀도 |

팔레트보다 **텍스처가 아이덴티티의 본체** — 색은 러시(현장 촬영) 그레이딩 따라 흔들리고, 지도·그래픽 레이어의 종이+빨강 라벨만 일정.

### (b) 타이포
- 타자기/모노 세리프 감성 라벨(아카이브 서류 느낌) + 컨덴스드 산스 타이틀 [추정]. 대문자+넓은 자간의 "서류 스탬프" 룩.
- 등장: 타자기 타이핑, 스탬프 찍힘(스케일 1.2→1.0 + 미세 회전), 지도 라벨은 라인 드로우와 함께.

### (c) 모션 시그니처
- **키프레임식 사진 애니메이션** [실측, Motion Array]: Ken Burns식 연속 이동이 아니라 정지→퍽 이동→정지의 스텝 모션.
- GEOlayers 지도 줌인/아웃·회전·라인 드로잉 [실측, aescripts].
- 핸드헬드 흔들림을 그래픽에도 입힘(포지션 위글). 컷 속도 빠름(1.5~4초), 줌 인 컷(같은 화면 확대 점프컷) 다용.

### (d) 배경/텍스처
- 텍스처 오버레이 상시: 필름 번·라이트 리크·노이즈&그레인 [실측, Motion Array]. 종이 스캔 질감, 비네트.
- 옛 사진·지도 위에 현대 그래픽을 얹는 시대 혼합 콜라주.

### design-tokens 번역 노트
- `moods.suspense.accent=#d92b2b`, `somber` 계열이 강한 채널 — somber accent는 `#3a2f28` 브라운. speed: urgent=fast(줌 점프컷), contemplative=slow.
- glow 대신 그레인 — glow 필드에 `grain` 시맨틱 문자열 쓰는 관례 도입 검토(스키마 glow는 자유 문자열).

소스: [Motion Array — Johnny Harris식 다큐 편집 3팁](https://motionarray.com/learn/premiere-pro/edit-documentary-in-premiere-pro/), [aescripts — How Johnny Harris Makes Maps](https://aescripts.com/learn/post/how-johnny-harris-makes-maps), [PremiumBeat — Johnny Harris 지도 제작기](https://www.premiumbeat.com/blog/making-maps-for-johnny-harris/)

---

## 4. 3Blue1Brown

**아이덴티티 요약**: 수학 시각화의 정본. 순흑 배경 + manim 고정 팔레트(파랑·노랑·초록·빨강 파스텔 톤) + Computer Modern 세리프. 아래 HEX는 전부 소스 코드 실측.

### (a) 팔레트 — **[실측]** manim 소스(3b1b/manim, ManimCommunity)

| 토큰 | HEX | 용도 |
|---|---|---|
| background | `#000000` | 3b1b 본인 custom_config.yml 실측(구버전은 GREY_E `#222222`) |
| BLUE_C | `#58C4DD` | 주인공 파랑(브랜드 "Blue") |
| BLUE_D | `#29ABCA` / BLUE_E `#236B8E` | 진한 파랑 단계 |
| YELLOW_C | `#F7D96F` | 강조·주석(구 manimlib YELLOW는 `#FFFF00`) |
| GREEN_C | `#83C167` | 보조 개념 |
| RED_C | `#FC6255` | 반례·경고 |
| TEAL_C | `#5CD0B3` | 보조 |
| GOLD_C | `#F0AC5F` | "Brown" 축(로고의 갈색 눈동자 계열) |
| GREY_A | `#DDDDDD` | 기본 스트로크(default_stroke_color 실측) |
| GREY_B | `#BBBBBB` | 축·라이트 오브젝트(DEFAULT_LIGHT_COLOR 실측) |

각 색상 A(밝음)~E(어두움) 5단 램프 체계 자체가 훔칠 가치가 있는 구조 — 우리 colorMap도 `blue_a`~`blue_e`식 램프 키 관례 검토.

### (b) 타이포 — [실측]
- 폰트: **CMU Serif**(Computer Modern, LaTeX 기본) — 3b1b custom_config.yml `text.font: "CMU Serif"` 실측. 수식은 LaTeX 그대로.
- 등장: **Write 애니메이션**(획 순서 드로우온) — 글자가 "써진다". 페이드 대신 스트로크 드로잉이 시그니처.

### (c) 모션 시그니처
- 컷이 거의 없음 — 하나의 연속 캔버스에서 오브젝트가 **변환(Transform)** 됨. 카메라 줌/팬으로 씬 이동.
- 모든 모션이 smooth ease(manim smooth 함수). 속도 느긋(개념 하나에 10~30초).
- 강조 = 색 변경 + Indicate(스케일 펄스) + 노랑 언더라인/박스 드로우온.

### (d) 배경/텍스처
- 텍스처 제로. 순흑 위 벡터만. 깊이는 3D 캔버스 회전으로.
- 글로우 없음(순수 플랫), 단 스트로크 4px 두께 기본값 실측.

### design-tokens 번역 노트
- 7무드 매핑이 가장 자연스러운 채널: dramatic=`#FC6255`, informative=`#58C4DD`, contemplative=`#236B8E`, triumphant=`#F7D96F`, somber=`#444444`(GREY_D). 전부 speed=slow~normal, glow 없음.
- subtitle: 검정 배경이라 배경박스 불필요 — `backgroundColor=transparent`, 흰 글자 + keywordColor `#F7D96F`.

소스: [3b1b/manim color.py](https://github.com/3b1b/manim/blob/master/manimlib/utils/color.py), [3b1b/videos custom_config.yml](https://github.com/3b1b/videos/blob/master/custom_config.yml), [ManimCE manim_colors](https://docs.manim.community/en/stable/reference/manim.utils.color.manim_colors.html) — HEX는 리포지토리 raw 파일에서 직접 확인.

---

## 5. MKBHD

**아이덴티티 요약**: 매트 블랙 스튜디오 + 레드 단일 액센트 + 초고해상도(RED 8K) 슬로우 스무스 b-roll. "제품이 어둠 속에서 빛난다".

### (a) 팔레트 — [준실측, 브랜드 팔레트 아카이브]

| 토큰 후보 | HEX | 비고 |
|---|---|---|
| matteBlack | `#1A1A1A` | 메인 배경(순흑 아님 — 매트) |
| pureBlack | `#000000` | 그림자 폴오프 |
| accentRed | `#FF0000` | 유일 액센트(로고·모션 라인) |
| silver | `#5A5A5A` | 세컨더리 |
| offWhite | `#EEEEEE` | 텍스트 |

### (b) 타이포
- 지오메트릭/그로테스크 산스(SF Pro·Helvetica Now 계열 룩) [추정]. 얇은 웨이트(300~500) + 넓은 여백, 소문자 혼용.
- 등장: 미니멀 페이드+트래킹 확장(자간이 살짝 벌어지며 등장). 텍스트 양 극소.

### (c) 모션 시그니처
- 컷 속도 느림(4~8초). **60fps 슬로우 돌리/슬라이더** b-roll이 본체 [준실측, RED 8K 리그 실측 기사].
- 매트 블랙 배경에서 제품만 키 라이트 — 리빌은 조명 페이드인.
- 레드 라인/언더스코어가 유일한 그래픽 모션(좌→우 드로우).

### (d) 배경/텍스처
- 그레인 없음, 초저노이즈 클린. 배경은 완전 아웃포커스 스튜디오(보케 원). 반사 있는 블랙 테이블.

### design-tokens 번역 노트
- moods 전체 accent를 `#FF0000` 하나로 고정하고 speed만 변주하는 "단색 프리셋"의 표본. glow: 부드러운 레드 언더글로우(`0 0 40px rgba(255,0,0,0.35)`).
- subtitle: 박스 없음, 얇은 흰 글자 + 미세 섀도.

소스: [ColorsWall MKBHD 팔레트](https://colorswall.com/palette/109547), [The Color Palette Studio — MKBHD](https://thecolorpalettestudio.com/blogs/palette-of-the-day/mkbhd), [Brandfetch — mkbhd.com](https://brandfetch.com/mkbhd.com), [MKBHD 8K RED 리그 기사](https://technology.youtubers.club/2018/02/the-mkbhd-8k-red-camera-setup-tour.html?m=1)

---

## 6. Veritasium

**아이덴티티 요약**: "과학 저널리즘 시네마". 실사 시네마틱 + 필요할 때만 정밀 시뮬레이션 그래픽(After Effects·Unreal·DaVinci Fusion). 로고는 주기율표 원소 패러디(파랑 그라데이션 박스 + 42.0) [실측, 상표 등록 자료].

### (a) 팔레트

| 토큰 후보 | HEX | 신뢰도 | 비고 |
|---|---|---|---|
| veBlue | `#2a6df4` | 추정 | 로고 파랑 그라데이션 중심값 |
| veBlueDeep | `#0b2d6b` | 추정 | 그라데이션 하단 |
| black | `#000000` | 실측 | 로고 배경 |
| white | `#FFFFFF` | 실측 | 로고 타이포 |
| simOrange | `#ff9f1c` | 추정 | 시뮬레이션 그래픽 열/에너지 표현 |

그래픽 씬은 다크 배경 + 데이터 색(파랑/주황 보색)이 기본. 실사 씬은 자연광 시네마틱이라 팔레트 고정 없음.

### (b) 타이포
- 클린 산스(Helvetica/Inter 계열 룩) 흰색, 다크 씬 위 [추정]. 로고 워드마크는 세리프 없는 대문자+이탤릭 i.
- 등장: 심플 페이드. 타이포 유희 없음 — 신뢰감 우선.

### (c) 모션 시그니처
- 훅 우선 구조(첫 10초 질문/시연) [준실측]. 컷 속도 중간, 인터뷰·시연·그래픽 3원 교차.
- 그래픽은 수백 트랙 JS expression 연동의 정밀 시뮬레이션 [준실측, 제작자 Jonny Hyman 포트폴리오] — "장식 아니라 물리적으로 맞는 모션"이 시그니처.
- 오버레이 화살표·수치 콜아웃이 실사 위에 직접 얹힘.

### (d) 배경/텍스처
- 그래픽 씬: 다크 그라데이션(순흑보다 `#0a0f1e`대 네이비). 미세 블룸 글로우 허용. 실사: 필름 룩 그레이딩이지만 그레인 오버레이는 절제.

### design-tokens 번역 노트
- informative=`#2a6df4`, dramatic=`#ff9f1c`, glow는 은은한 블루 블룸. speed 전반 normal.
- subtitle: 다크 반투명 박스 + 흰 글자(다큐 표준형).

소스: [Wikipedia — Derek Muller](https://en.wikipedia.org/wiki/Derek_Muller), [Justia 상표(로고 기술)](https://trademarks.justia.com/868/20/veritasium-an-element-of-truth-i-42-86820449.html), [Jonny Hyman 비주얼 포트폴리오](https://jonnyhyman.com/visuals), [ivantello.art — Veritasium 애니메이션](https://ivantello.art/projects/veritasium-animations)

---

## 7. Fireship

**아이덴티티 요약**: "100초 코드 밈 폭주". 순흑/에디터 다크 배경 + 화염 그라데이션(노랑→주황→핑크) + 코드 신택스 네온 + 초고속 컷.

### (a) 팔레트

| 토큰 후보 | HEX | 신뢰도 | 비고 |
|---|---|---|---|
| black | `#000000` | 준실측 | 영상 기본 배경(브레이크다운 기사 "black background") |
| editorDark | `#1e293b` | 추정 | 코드 패널(VS Code 다크 계열) |
| flameYellow | `#ffbe0b` | 추정 | 브랜드 화염 그라데이션 상단 |
| flameOrange | `#ff6d00` | 추정 | 그라데이션 중단 |
| flamePink | `#ff3d81` | 추정 | 그라데이션 하단 |
| synCyan | `#4dd0e1` | 추정 | 신택스 하이라이트 |
| synPurple | `#c792ea` | 추정 | 신택스 키워드 |
| synGreen | `#c3e88d` | 추정 | 신택스 문자열 |

### (b) 타이포
- 코드 = 모노스페이스(Fira Code/JetBrains Mono 계열 룩, 리거처 사용) [추정]. 타이틀 = 두꺼운 산스 + 그라데이션 필.
- 등장: 단어 단위 즉시 팝(트랜지션 거의 0프레임), 코드 타이핑 스트림, 붉은 화살표/서클 낙서 오버레이.

### (c) 모션 시그니처
- **컷 속도 극단** [준실측]: 1~2초/컷, 밈 이미지 플래시 인서트(0.5초). 스무스 이징보다 스냅 컷.
- 줌 펀치인(같은 프레임 1.0→1.15 즉시), 요소가 화면 밖에서 슬램 인.
- 신택스 컬러 자체가 모션 강조 수단(해당 코드 줄만 밝게, 나머지 딤).

### (d) 배경/텍스처
- 순흑 or 에디터 패널. 네온 글로우(텍스트 섀도 블룸) 적극 사용. 그레인 없음.

### design-tokens 번역 노트
- urgent=`#ff6d00`+fast, dramatic=`#ff3d81`, informative=`#4dd0e1`, 전 무드 speed=fast 쏠림이 정체성. glow `0 0 18px` 네온.
- mono 폰트 롤이 주인공인 유일한 채널 — `fonts.mono`를 headline급으로 쓰는 프리셋.

소스: [Grokipedia — Fireship](https://grokipedia.com/page/fireship-youtube-channel), [De Programmatica Ipsum — Fireship](https://deprogrammaticaipsum.com/fireship/), [Wisp — Fireship식 콘텐츠 제작](https://www.wisp.blog/blog/how-to-create-video-content-like-fireship-hyperplexed-and-juxtoposed), [fireship.io](https://fireship.io/courses/vscode-tricks/)

---

## 교차 관찰 — 프리셋 설계에 먹일 원칙

1. **액센트는 1~2색이 상한**: MKBHD(빨강 1), Vox(노랑 1+빨강 보조), 3B1B(노랑 강조 고정). 무드별 accent를 다 다르게 쓰는 채널은 없음 — 우리 moods 7종은 "같은 색의 명도/채도 변주 + 예외 1색" 전략이 실채널에 부합.
2. **glow와 grain은 배타적**: 네온 계열(Kurzgesagt·Fireship)은 glow, 저널리즘 계열(Johnny Harris·Vox)은 grain/texture, 미니멀(3B1B·MKBHD)은 둘 다 없음. glow 필드 문자열 관례를 `none | soft-bloom | neon | grain` 4값으로 잡으면 7채널 전부 표현 가능.
3. **다크 배경은 순흑이 아니라 #1A1A~#222**(MKBHD·3B1B 구버전). 순흑은 Fireship·3B1B 현행뿐.
4. **자막/타이포 등장 방식이 채널 지문**: 형광펜 와이프(Vox), 획 드로우온(3B1B), 타자기+스탬프(Harris), 즉시 팝(Fireship). subtitle 토큰 너머의 "등장 애니메이션 프리셋" 축이 스키마에 없음 — moods.speed로 일부 흡수 가능하나 별도 필드 후보.

---

## ReelForge 프리셋 후보 3종 (토큰 초안)

스키마 필수 필드 전부 포함한 초안. 폰트 파일 경로는 무료 스택(09-free-stack OFL 카탈로그) 기준 플레이스홀더 — 빌드 시 실경로 치환.

### P1. `nebula-pop` — Kurzgesagt 계열 (밝은 과학·낙관 설명체)

```json
{
  "version": "0.1.0",
  "presetId": "nebula-pop",
  "colors": {
    "background": "#0a0e3f",
    "surface": "#141b5c",
    "primary": "#008cf7",
    "secondary": "#6500d7",
    "accent": "#ff3fa7",
    "highlight": "#fad53c",
    "cyan": "#00d8fc",
    "textMain": "#f4f0e8"
  },
  "moods": {
    "dramatic":      { "accent": "#ff3fa7", "speed": "normal", "glow": "0 0 24px rgba(255,63,167,0.5)" },
    "urgent":        { "accent": "#fad53c", "speed": "fast",   "glow": "0 0 24px rgba(250,213,60,0.5)" },
    "somber":        { "accent": "#236b8e", "speed": "slow",   "glow": "none" },
    "informative":   { "accent": "#008cf7", "speed": "normal", "glow": "0 0 18px rgba(0,140,247,0.4)" },
    "contemplative": { "accent": "#6500d7", "speed": "slow",   "glow": "0 0 18px rgba(101,0,215,0.4)" },
    "suspense":      { "accent": "#00d8fc", "speed": "slow",   "glow": "0 0 12px rgba(0,216,252,0.35)" },
    "triumphant":    { "accent": "#fad53c", "speed": "normal", "glow": "0 0 32px rgba(250,213,60,0.6)" }
  },
  "subtitle": {
    "fontFamily": "Montserrat", "fontSize": 42, "fontWeight": 700,
    "color": "#f4f0e8", "strokeColor": "transparent", "strokeWidth": 0,
    "keywordColor": "#fad53c", "keywordStrokeColor": "transparent",
    "backgroundColor": "rgba(10,14,63,0.85)", "borderRadius": 12,
    "boxShadow": "none", "bottomOffset": 96, "maxWidth": 880,
    "lineHeight": 1.35, "maxCharsPerLine": 18, "visible": true
  },
  "fonts": {
    "body":     { "family": "Pretendard",  "files": [{ "path": "fonts/Pretendard-Medium.woff2",  "weight": 500 }] },
    "headline": { "family": "Montserrat",  "files": [{ "path": "fonts/Montserrat-ExtraBold.woff2", "weight": 800 }] },
    "value":    { "family": "Montserrat",  "files": [{ "path": "fonts/Montserrat-Bold.woff2",    "weight": 700 }] },
    "subtitle": { "family": "Pretendard",  "files": [{ "path": "fonts/Pretendard-Bold.woff2",    "weight": 700 }] },
    "mono":     { "family": "JetBrains Mono", "files": [{ "path": "fonts/JetBrainsMono-Regular.woff2", "weight": 400 }] }
  }
}
```
모션 노트(토큰 외): 하드컷 대신 팬/모핑 전환, ease-in-out, 텍스처 금지, 오브젝트-우선 타이포.

### P2. `pressroom` — Vox+Johnny Harris 계열 (저널리즘·시사 해설체)

```json
{
  "version": "0.1.0",
  "presetId": "pressroom",
  "colors": {
    "background": "#f7f5f0",
    "surface": "#e8e0d0",
    "ink": "#1a1a1a",
    "inkNavy": "#1e2a3a",
    "highlight": "#ffd800",
    "signal": "#d92b2b",
    "sepia": "#c9b48a"
  },
  "moods": {
    "dramatic":      { "accent": "#d92b2b", "speed": "fast",   "glow": "grain" },
    "urgent":        { "accent": "#d92b2b", "speed": "fast",   "glow": "grain" },
    "somber":        { "accent": "#3a2f28", "speed": "slow",   "glow": "grain" },
    "informative":   { "accent": "#ffd800", "speed": "normal", "glow": "none" },
    "contemplative": { "accent": "#1e2a3a", "speed": "slow",   "glow": "grain" },
    "suspense":      { "accent": "#1e2a3a", "speed": "normal", "glow": "grain" },
    "triumphant":    { "accent": "#ffd800", "speed": "normal", "glow": "none" }
  },
  "subtitle": {
    "fontFamily": "Noto Serif KR", "fontSize": 40, "fontWeight": 600,
    "color": "#1a1a1a", "strokeColor": "transparent", "strokeWidth": 0,
    "keywordColor": "#1a1a1a", "keywordStrokeColor": "transparent",
    "backgroundColor": "rgba(247,245,240,0.92)", "borderRadius": 2,
    "boxShadow": "0 2px 0 #1a1a1a", "bottomOffset": 88, "maxWidth": 900,
    "lineHeight": 1.4, "maxCharsPerLine": 20, "visible": true
  },
  "fonts": {
    "body":     { "family": "Noto Serif KR", "files": [{ "path": "fonts/NotoSerifKR-Medium.woff2", "weight": 500 }] },
    "headline": { "family": "Archivo",       "files": [{ "path": "fonts/Archivo-Black.woff2",     "weight": 900 }] },
    "value":    { "family": "Archivo",       "files": [{ "path": "fonts/Archivo-Bold.woff2",      "weight": 700 }] },
    "subtitle": { "family": "Noto Serif KR", "files": [{ "path": "fonts/NotoSerifKR-SemiBold.woff2", "weight": 600 }] },
    "mono":     { "family": "Nanum Gothic Coding", "files": [{ "path": "fonts/NanumGothicCoding.woff2", "weight": 400 }] }
  }
}
```
모션 노트: 키워드는 노랑 하이라이트 박스 와이프(keywordColor 반전 연출), 사진은 스텝 키프레임 이동, 그레인+종이 텍스처 오버레이, 줌 점프컷 허용.

### P3. `neon-terminal` — Fireship+3B1B 다크 계열 (테크·속보·개발체)

```json
{
  "version": "0.1.0",
  "presetId": "neon-terminal",
  "colors": {
    "background": "#000000",
    "surface": "#1e293b",
    "primary": "#58c4dd",
    "accent": "#ff6d00",
    "hot": "#ff3d81",
    "highlight": "#f7d96f",
    "synGreen": "#c3e88d",
    "synPurple": "#c792ea",
    "textMain": "#dddddd"
  },
  "moods": {
    "dramatic":      { "accent": "#ff3d81", "speed": "fast",   "glow": "0 0 18px rgba(255,61,129,0.55)" },
    "urgent":        { "accent": "#ff6d00", "speed": "fast",   "glow": "0 0 18px rgba(255,109,0,0.55)" },
    "somber":        { "accent": "#444444", "speed": "slow",   "glow": "none" },
    "informative":   { "accent": "#58c4dd", "speed": "normal", "glow": "0 0 14px rgba(88,196,221,0.45)" },
    "contemplative": { "accent": "#236b8e", "speed": "slow",   "glow": "none" },
    "suspense":      { "accent": "#c792ea", "speed": "normal", "glow": "0 0 14px rgba(199,146,234,0.4)" },
    "triumphant":    { "accent": "#f7d96f", "speed": "fast",   "glow": "0 0 22px rgba(247,217,111,0.55)" }
  },
  "subtitle": {
    "fontFamily": "Pretendard", "fontSize": 44, "fontWeight": 800,
    "color": "#ffffff", "strokeColor": "#000000", "strokeWidth": 3,
    "keywordColor": "#f7d96f", "keywordStrokeColor": "#000000",
    "backgroundColor": "transparent", "borderRadius": 0,
    "boxShadow": "none", "bottomOffset": 104, "maxWidth": 860,
    "lineHeight": 1.3, "maxCharsPerLine": 16, "visible": true
  },
  "fonts": {
    "body":     { "family": "Pretendard",     "files": [{ "path": "fonts/Pretendard-Medium.woff2", "weight": 500 }] },
    "headline": { "family": "Pretendard",     "files": [{ "path": "fonts/Pretendard-Black.woff2",  "weight": 900 }] },
    "value":    { "family": "JetBrains Mono", "files": [{ "path": "fonts/JetBrainsMono-Bold.woff2", "weight": 700 }] },
    "subtitle": { "family": "Pretendard",     "files": [{ "path": "fonts/Pretendard-ExtraBold.woff2", "weight": 800 }] },
    "mono":     { "family": "JetBrains Mono", "files": [{ "path": "fonts/JetBrainsMono-Regular.woff2", "weight": 400 }] }
  }
}
```
모션 노트: 컷 1~2초 스냅, 0프레임 팝 등장, 펀치인 줌(1.0→1.15), 강조 줄만 밝게+나머지 딤, 수식/코드 요소는 드로우온(3B1B Write 차용).

---

## 미해결/후속

- 추정 HEX 검증: 각 채널 대표 프레임 3장 스포이드 샘플링(yt-dlp 프레임 추출)으로 팔레트 표 보정 — firecrawl 크레딧 소진(402)으로 이번 회차 이미지 수집 생략.
- "타이포 등장 방식" 축(형광펜 와이프/드로우온/타자기/즉시팝)이 현 스키마에 없음 — moods.speed로는 손실 압축. 스키마 확장 논의 항목.
- Vox Balto·Harriet, Kurzgesagt Montserrat 외 채널 폰트는 룩 기반 추정 — 상용 폰트 대체는 09-free-stack OFL 카탈로그에서 매칭.
