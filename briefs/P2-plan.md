# P2 브리프 의존 그래프 (컴파일러) — fable 작성

웨이브 규칙(RESOLUTION C13): contract→core→transitions/subtitles/motion→components→gates. 웨이브 간 머지 게이트.

| 브리프 | 내용 | blocked_by | owner |
|---|---|---|---|
| P2-00 | 컴파일러 코어: specs+meta+tokens→씬 서브컴포지션+index, ceil 양자화, 마운트 강제 lint, 블록 인터페이스 계약 | — | src/compiler/**, docs/compiler.md |
| P2-01 | 전환 인젝터 (outgoing만 연장, 엣지 모델) | P2-00 | src/compiler/transitions.mjs |
| P2-02 | 자막 렌더 2모드 (카라오케 워드싱크·키워드) | P2-00 | src/compiler/subtitles.mjs |
| P2-03 | 켄번즈 최소형 + BGM 더킹 keyframe | P2-00 | src/compiler/motion.mjs, audio |
| P2-04a~h | 씬 블록 8종 (bar/pie/line/list/numbered/statistic/compare/quote) | P2-00 | blocks/<type>/** (블록당 1워커) |
| P2-G | L1-1 골든 DOM diff·L1-2 전환 매트릭스·L1-9 블록 스냅샷·오디오 비의존 L2 렌더 게이트 | 전부 | src/gates/**, fixtures |
| P2-R | 적대 리뷰 | 전부 | reports/P2-review.md |
- [ ] P2 결함: vf write repo-루트 경로 가드가 repo 밖 사용자 프로젝트 컴파일을 차단 — 가드 기준을 repo루트가 아니라 (프로젝트루트+빌드루트)로 재정의 필요 (발견: one-block 재현 중)
