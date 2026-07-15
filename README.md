<p align="center">한국어 | <a href="README-en.md">English</a> | <a href="README-ja.md">日本語</a></p>

<p align="center"><img src="docs/assets/hero.gif" alt="ReelForge demo highlights" width="720"></p>

<p align="center"><strong>ReelForge는 브리프 한 줄을 풀블리드 모션그래픽 영상으로 바꾸는 키리스 AI 영상 생성 루프입니다.</strong></p>

산출물은 슬라이드가 아니라 영상입니다.
키네틱 타이포그래피, 무드 기반 컬러 시스템, 상시 리빙 모션이 기본 언어이고,
모든 씬은 에이전트(또는 사람)가 직접 저작하는 HTML 모션그래픽 프래그먼트입니다.

## [loop] 코어 루프 (v6)

```
브리프 한 줄
  → 1. 디렉션 동결      느낌을 먼저 계약으로: frame(팔레트·타이포·무드 아크) + 카피 + 스토리보드
  → 2. 씬 스웜          씬당 워커 1명이 free HTML 프래그먼트를 직접 저작 (병렬)
  → 3. 조립·검증        얇은 매니페스트 → 컴파일 → 결정론 린트 (wall-clock·비결정 코드 차단)
  → 4. 렌더             헤드리스 Chrome 결정론 렌더 (멀티워커·GPU 옵션)
  → 5. 스트립 QC        1fps 전수 스트립 기계검사 + 시청자 심사 → 실패 씬만 국소 재저작
```

설계 원칙: 데이터 계약이 아니라 디렉션(느낌)이 먼저다.
씬은 자동 생성되는 레이아웃이 아니라 저작물이며, 엔진은 타이밍·자막·전환·토큰·검증만 소유합니다.
전체 설계와 v5에서 무엇을 왜 버렸는지는 [docs/v6-architecture.md](docs/v6-architecture.md)에 있습니다.

## [quick-start] Quick Start

에이전트 경로(권장): Claude Code에서 이 레포를 열고 `skills/reelforge/SKILL.md`를 스킬로 등록한 뒤,
"ReelForge로 30초 브랜드 인트로 만들어줘"처럼 요청합니다.
스킬이 디렉션 동결부터 스트립 QC까지 위 루프를 그대로 태웁니다.

로컬 스모크(파이프라인 확인용):

```bash
cd <repo>
npm ci
./node_modules/.bin/hyperframes doctor

PROJECT_DIR="tmp/smoke-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$PROJECT_DIR"
cp fixtures/golden-specs/minimal-3scene/scene_specs.json "$PROJECT_DIR/scene_specs.json"

node bin/vf pipeline run "$PROJECT_DIR" --profile mock
node bin/vf studio "$PROJECT_DIR" --port 4317
```

최종 영상은 `$PROJECT_DIR/out/main.mp4`에 생성됩니다.

## [features] 주요 기능

### free 씬 — 모션그래픽 저작 단위
씬 하나가 곧 저작된 HTML 프래그먼트입니다(`layout: "free"` + `sourceHtml`).
GSAP paused 타임라인과 CSS 리빙 루프로 결정론 seek 렌더에 안전하고,
프리셋 토큰(`--rf-*`)만으로 색을 소비해 어떤 프리셋으로도 같은 씬이 다시 렌더됩니다.

### 디자인 프리셋 17종
linear, vercel, stripe, apple부터 다크 하입(dark-hype), 한국 방송/버라이어티 톤까지.
surface 사다리, hairline, 무드별 액센트·글로우, 자막 토큰을 프리셋 하나로 통제하고
대비 하한이 컴파일 단계에서 강제됩니다. 카탈로그는 [docs/design-presets.md](docs/design-presets.md).

### 결정론 렌더와 검증
렌더는 seek 기반 결정론이라 같은 입력이면 같은 픽셀이 나옵니다.
render-lint가 fetch, Math.random, Date.now, performance.now, 비일시정지 타임라인을 거부하고
1fps 스트립 기계검사(공백·저대비·모션 동결)가 QC 루프의 바닥을 깝니다.

### 오디오 권위 타이밍
씬 길이의 유일한 권위는 오디오 메타데이터입니다.
나레이션이 있으면 TTS가, 음악 중심이면 비트그리드나 무음 mock이 씬 경계를 결정합니다.
기본 스택은 mock TTS, 로컬 Chrome/ffmpeg으로 API 키 없이 재현됩니다.

### Studio 편집 루프
`vf studio`로 씬 미리보기와 수정 영향 범위(E1 표현, E2 대사, E3 구조)를 안내받으며 다듬습니다.

### 부록 — 데이터 블록 8종 (옵션)
정량 데이터 1개 씬이 정말 필요할 때만 쓰는 선택지입니다(bar, pie, line, list,
numbered, statistic, compare, quote — 풀블리드 렌더). 기본값은 블록 0개이며,
본문 씬을 블록으로 시작하지 않습니다.

## [demos] 데모

| 데모 | 용도 | 릴리스 |
|---|---|---|
| D1 Usage | 사용 흐름 튜토리얼 | [d1-usage.mp4](https://github.com/kimsh-1/reelforge/releases/download/v0.1.0/reelforge-d1-usage.mp4) |
| D2 Engine | 컴파일·결정론·게이트 소개 | [d2-engine.mp4](https://github.com/kimsh-1/reelforge/releases/download/v0.1.0/reelforge-d2-engine.mp4) |
| D3 Intro | 브랜드/제품 인트로 | [d3-intro.mp4](https://github.com/kimsh-1/reelforge/releases/download/v0.1.0/reelforge-d3-intro.mp4) |

현행 릴리스는 v5 파이프라인 산출물입니다. v6 루프로 뽑은 데모가 준비되는 대로 교체됩니다.

## [reference] 설정 레퍼런스

CLI 옵션과 설정은 [docs/usage.md](docs/usage.md), Studio 세부는 [docs/studio.md](docs/studio.md),
파이프라인 재개/dirty guard는 [docs/pipeline.md](docs/pipeline.md), 컴파일러 계약(블록·free 인터페이스)은
[docs/compiler.md](docs/compiler.md)를 봅니다.

## [validation] 프로젝트가 어떻게 검증됐나

P0~P3 실증 결과, 게이트 세부, 아키텍처 기록은 [docs/build-journey.md](docs/build-journey.md)에 있습니다.

## [license-disclaimer] 라이선스와 면책

코드는 Apache-2.0입니다. 폰트, 음원, 이미지, TTS 산출물은 각자 라이선스와 서비스 조건을 따르며,
공개 배포 또는 상업 사용 전에는 프로젝트별 provenance를 확인해야 합니다.
