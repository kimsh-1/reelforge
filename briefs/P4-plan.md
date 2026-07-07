# P4 브리프 의존 그래프 (스튜디오) — fable 작성

결정(RESOLUTION A3·A-정오표): hyperframes Studio 서버 재사용 대신 **자체 경량 서버**(node http, 빌드리스) — P3까지 만든 vf 인프라(write/compile/pipeline/versions)를 API로 노출하는 편이 사설 Studio API 의존보다 단순·안전. 컴포지션 프리뷰는 same-origin iframe + `window.__timelines[id]` 직접 시킹(렌더 없는 스크럽).

| 브리프 | 내용 | blocked_by | owner |
|---|---|---|---|
| P4-00 | 서버 코어: `vf studio <proj>` — 정적 패널 서빙 + REST(프로젝트/specs GET·PATCH(백업+dirty+vf write 경유)/compile/render-scene 트리거) + SSE(빌드 갱신 1회 이벤트) + 편집 영향 클래스 판정(E1/E2/E3) | — | src/studio/server/**, bin/vf |
| P4-01 | 패널 UI: 씬 카드 그리드+씬 상세 폼(JSON Schema→자동 생성, 바닐라 ES modules)+영향 배지+iframe 프리뷰(시킹 스크럽)+파형 오버레이 스텁 | P4-00 | src/studio/panel/** |
| P4-02 | 편집 루프 배선: 저장→클래스 판정→씬/전체 재컴파일→SSE→프리뷰 갱신, E2는 재TTS 유도(pipeline 부분 실행), 낙관적 락(versions editLock) | P4-00,01 | src/studio/loop/** |
| P4-G | L3-3(E1 루프)·L3-4(E2 루프)·L3-11(동시편집)·U-2(폼 필드 전수 순회 — codex가 API로 조작) 게이트화 | 전부 | src/gates, tests/scenarios |
| P4-R | 적대 리뷰 (경합·우회·XSS/경로·프리뷰 정합) | 전부 | reports/P4-review.md |
