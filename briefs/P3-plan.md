# P3 브리프 의존 그래프 (파이프라인) — fable 작성

P3 범위(MASTER-PLAN §2.3·§3): TTS 실통합·이미지·재개/버전. LLM 저작 단계(brief→scene_specs)는 P6 스킬 소관.
종료 조건(VERIFICATION-PLAN): L1-3~8 + L2-6/8/9 + 실TTS 스모크(L3-2, edge-tts) + U-3 2차 + L3-1/5/6.

| 브리프 | 내용 | blocked_by | owner |
|---|---|---|---|
| P3-00 | 파이프라인 코어: `vf pipeline run <proj>` 스텝 그래프(tts→images→compile→render→gate), pipeline_state.json 재개, selected 경유 참조, 스텝 훅 계약 | — | src/pipeline/core**, docs/pipeline.md |
| P3-01 | TTS 어댑터: edge-tts 본품(ko-KR, WordBoundary)+MeloTTS 폴백 스위치+faster-whisper 정렬+동시성 4 배치 → audio_meta 계약 | P3-00 인터페이스 | src/pipeline/tts/** |
| P3-02 | 이미지 파이프라인: 프롬프트 컴파일 훅→러너 계약(codex-imagegen 호출 스펙+mock 프로바이더)→OCR/구도 필터 스텁→image-manifest(gen_NN·selected) | P3-00 | src/pipeline/images/** |
| P3-03 | 버전/재개 실장: versions.json 라이프사이클(백업·gen 증가·selected 전환·dirty/editLock) + 중단-재개 | P3-00 | src/pipeline/versions/** |
| P3-G | 게이트: L1-3~7 등록, L3-1(mock 60초 완주)·L3-2(실 edge-tts 스모크)·L3-5(재롤)·L3-6(중단-재개) 시나리오, U-3 2차(파이프라인 레벨) | 전부 | src/gates, tests/scenarios |
| P3-R | 적대 리뷰 | 전부 | reports/P3-review.md |
