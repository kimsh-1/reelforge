# intro-v6 — Direction Freeze (frame)

목적: ReelForge 브랜드 인트로 ~31s. 시청자 반응 목표 = "무조건 써봐야 해".
프리셋: **dark-hype** (`fixtures/presets/dark-hype.json`) — 씬 프래그먼트는 색을 전부
`var(--rf-*)`로만 소비한다. 블록 0개, 전 씬 layout:"free".

## 무드 에스컬레이션 (씬별 mood → 액센트)

s01 urgent(마젠타 — 통증·취소선) → s02 dramatic(라벤더 글로우 — 플립) →
s03 informative(라벤더 — 속도) → s04 dramatic(라벤더 — 타이포 환경) →
s05 urgent(마젠타 — 컨셉 스트로브) → s06 suspense(시안 — 거대 0 두 개) →
s07 contemplative(라벤더 저글로우 — 메타 고백) → s08 triumphant(**그린, 유일한 착지**).

그린은 s08 전까지 절대 등장 금지(희소성). 취소선·강조는 씬 mood의 --rf-accent로.

## 타이포 / 크롬

- 히어로: Pretendard 800, 뷰포트 지배(화면 높이 15~30%), 트래킹 -0.03em, keep-all.
- 보조/모노: 시스템 mono 스택, uppercase 킥커, --rf-ink-subtle.
- 상시 크롬(전 씬 공통, 프래그먼트가 직접 그림): 좌상단 mono 킥커 `REELFORGE / <sceneId>`
  + 우하단 hairline 1px 러닝 라인. 과하지 않게 — 크롬이 히어로와 싸우면 뺀다.
- 리빙 모션: 씬당 1개 이상, filter/opacity 브리딩, 진입 후 1.2s부터.

## 에너지 규칙

- 진입 0.4s 내 구조 완성, 카운트/디코드류는 1.2s 내 완주.
- 씬 내내 무언가 미세하게 살아있을 것(1fps 스트립에서 인접 프레임 차이가 보여야 함).
- de-slide 하드룰: 카드 프레임·패널·불릿 골격 금지. 화면 전체가 무대다.
