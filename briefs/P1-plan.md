# P1 브리프 의존 그래프 (fable 작성, 2026-07-07)

| 브리프 | 내용 | blocked_by | owner files |
|---|---|---|---|
| P1-00 | 계약 스키마 5종 정본 (JSON Schema) + contracts.md | — | schemas/*, docs/contracts.md |
| P1-01 | vf write 본품(ajv 검증+원자 쓰기) + vf gate L0-1/5/6 등록 | P1-00 | bin/vf, src/gates/* |
| P1-02 | 네거티브 픽스처 스위트 (규칙당 반드시 실패하는 입력) | P1-00 | fixtures/negative/* |
| P1-03 | 골든 픽스처 (valid specs 3종·audio_meta·tokens 프리셋 2종) | P1-00 | fixtures/golden-specs/* |
| P1-04 | deck-factory 어댑터 명세+구현 (motion-manifest export) | P1-00 | src/pipeline/deck-adapter.mjs, docs/deck-adapter.md |
| P1-05 | U-3 오조작 1차 (스키마 레벨 20종 → 전부 명확한 반려 확인) | P1-01,02 | tests/scenarios/u3-schema.md, reports/ |
| P1-R | 리뷰 codex 교차검증 (전 산출물 적대 리뷰) | 전부 | reports/P1-review.md |

P1 종료 조건 (VERIFICATION-PLAN): L0 전체 + 네거티브 픽스처 스위트 + U-3 1차. 게이트 리포트는 vf gate만 생성.
