## pipeline

| CID | 통합 기능명 | 통합 설명(1-2줄) | 출처(repo:원id, 전부) | 채택 | Phase | 검증방법(통합 1줄) |
|---|---|---|---|---|---|---|
| pipeline-C01 | 단계형 파이프라인 JSON 계약·부분 실행 | 씬/단계 manifest를 고정하고 `from/only/force/dry-run`으로 부분 재실행한다. 부분 재렌더의 최상위 계약이다. | ShortGPT:SG-002, auto_kairos-pipeline:AKP-001, auto_kairos-pipeline:AKP-006 | P0 부분렌더 핵심 | P1/P3 | manifest schema fixture와 `from/only/force` 실행, 중단 후 재개 스냅샷을 검증 |
| pipeline-C02 | 체크포인트 기반 재개·스킵 캐시 | 완료/실패/스킵/결과를 원자적으로 저장하고 재시작 시 복원한다. 이미 처리한 입력은 캐시로 건너뛴다. | OpenMontage:OM-014, VideoAgent:VA-037, auto_kairos-pipeline:AKP-005, fontagent:FA-043 | P0 재개 필수 | P3 | crash/restart 후 checkpoint history와 completed/failed/skipped/results 복원을 검증 |
| pipeline-C03 | 외부 작업 ID·멱등 재시도 계약 | provider job id, idempotency key, retry payload를 즉시 보존해 재개 시 원 provider와 원 설정을 유지한다. | ArcReel:ARC-040, ArcReel:ARC-049, OpenMontage:OM-003, remotion-packages:RMT-047 | P0 재개정확성 핵심 | P1/P3 | submit 직후 ID 지속화, provider lock resume, retry payload snapshot 동등성을 검증 |
| pipeline-C04 | 결정론 렌더 런타임·프레임 resolve | render runtime/family를 잠그고 tick별 localTime/effect/mask/text state를 렌더 직전 resolve한다. | OpenMontage:OM-025, motion-canvas:MC-020, opencut-classic:OCC-019, revideo:RV-007 | P0 결정론 핵심 | P2/P5 | 동일 tick resolved state snapshot, URL bootstrap 인자, frame/end 순서 보존을 검증 |
| pipeline-C05 | fail-loud 산출물 검증·자동화 게이트 | 시각 산출물 병합, 비전 JSON, 자동화 가능성 프로필에서 누락/중복/blocked 상태를 조용히 통과시키지 않는다. | ArcReel:ARC-013, NarratoAI:NAR-071, fontagent:FA-038 | P0 하드게이트 필수 | P1/P5 | 누락·중복·dangling ID·blocked profile fixture가 빌드 실패로 이어지는지 검증 |
| pipeline-C06 | 작업 큐·워커 소유권·취소 상태머신 | 영속 큐, capacity limit, lease, orphan recovery, cancel cascade, timeout/cancel 분기를 통합한다. | ArcReel:ARC-044, ArcReel:ARC-045, ArcReel:ARC-047, MoneyPrinterTurbo:MPT-022, claude-code-video-toolkit:CVT-028, remotion-packages:RMT-049, short-video-maker:SVM-009, short-video-maker:SVM-011, story-flicks:SF-076 | P1 영속큐 필요 | P3/P4 | FIFO, 동시성 제한, lease 갱신/회수, cancel cascade, timeout 분기 테스트 |
| pipeline-C07 | 진행률·상태·SSE 대시보드 계약 | 장시간 생성 단계와 렌더 단계를 상태/progress/SSE로 노출하고 산출물 존재로 상태를 복구한다. | ArcReel:ARC-085, MoneyPrinterTurbo:MPT-005, NarratoAI:NAR-013, NarratoAI:NAR-108, auto_kairos-pipeline:AKP-096, auto_kairos-pipeline:AKP-097, remotion-packages:RMT-048, short-video-maker:SVM-010 | P1 대시보드 필수 | P4 | progress 단조 증가, SSE initial snapshot, artifact-derived recovery, UI 상태 문구 검증 |
| pipeline-C08 | 외부 호출 재시도·백오프·프롬프트 복구 | LLM, 이미지 검색, 비전 배치, 안전 필터, 빈 프레임 생성 실패에 capped retry/backoff를 둔다. | MoneyPrinterTurbo:MPT-013, NarratoAI:NAR-109, Pilipili-AutoVideo:PLP-041, ShortGPT:SG-013, ShortGPT:SG-065, VideoAgent:VA-029, auto_kairos-pipeline:AKP-032, html-video:HV-062, short-video-maker:SVM-029 | P1 외부불안정 대응 | P3/P5 | retryable/non-retryable matrix, backoff 한도, 로그 기록, safe prompt fallback 검증 |
| pipeline-C09 | 렌더 실패 fallback·저메모리 모드 | ffmpeg/hardware encoder/프레임 추출/OOM 실패를 분류하고 호환 명령이나 저메모리 경로로 낮춘다. | MoneyPrinterTurbo:MPT-051, NarratoAI:NAR-025, NarratoAI:NAR-070, claude-code-video-toolkit:CVT-040, hyperframes-engine:HFE-016 | P1 렌더복원 필요 | P3/P6 | 오류 문자열 fixture별 fallback command/path와 low-memory render 성공을 검증 |
| pipeline-C10 | 에셋 고정화·위생·경로 샌드박스 | 원격 이미지를 로컬 freeze하고 손상 이미지를 sanitize하며 project 밖 경로와 임시 파일을 통제한다. | MoneyPrinterTurbo:MPT-042, OpenMontage:OM-082, remotion-packages:RMT-061, revideo:RV-013, story-flicks:SF-037 | P1 재렌더안정 핵심 | P3/P4/P6 | remote asset freeze, corrupt image sanitize, path traversal deny, temp cleanup 검증 |
| pipeline-C11 | 전역 런타임 설정·프로젝트 루트 | typed config, shared projects root, compatibility date, settings cache로 실행 환경의 재현성을 관리한다. | OpenCut:OC-007, OpenMontage:OM-016, OpenMontage:OM-091, story-flicks:SF-019 | P1 재현성 노브 | P1/P6 | config default/load, shared root 일관성, compatibility date, cached settings 검증 |
| pipeline-C12 | 구조화 실행 로그·비용 회계 | CLI JSON/NDJSON, run DB, api_call_id 지속화로 자동화와 비용 집계를 감사 가능하게 한다. | ArcReel:ARC-041, auto_kairos-pipeline:AKP-101, html-video:HV-036 | P1 운영감사 필요 | P3/P6 | NDJSON schema, run start/finish/fail history, resume 후 비용 정산 검증 |
| pipeline-C13 | 브라우저 스튜디오 편집 일관성·리플레이 | controlled UI state, prop 저장 직렬화, 실행 리플레이, slide seek, 결과 목록/삭제를 묶는다. | OpenCut:OC-030, OpenMontage:OM-087, motion-canvas:MC-030, remotion-packages:RMT-059, short-video-maker:SVM-047 | P1 스튜디오일관성 | P4 | prop save 순서, controlled state, timeline replay/seek, list/delete API 검증 |
| pipeline-C14 | 한국어 TTS 발음·오디오 정규화 큐 | pronunciation guide와 overlay cue를 스크립트 계약에 넣고 TTS 입력 오디오를 sample rate/mono로 정규화한다. | OpenMontage:OM-032, VideoAgent:VA-012 | P1 한국어TTS 필요 | P1/P3 | pronunciation schema와 resampled mono/samplerate fixture를 검증 |
| pipeline-C15 | 배치 생성 enqueue·pending dedup | pending 단위만 enqueue하고 실제 병렬성, retry, callback, dedup은 백엔드 큐가 책임진다. | ArcReel:ARC-090, auto_kairos-pipeline:AKP-072 | P1 씬배치 필요 | P3/P4 | pending-only enqueue, duplicate 방지, retry callback, 성공 요약 검증 |
| pipeline-C16 | 에이전트 레지스트리·LLM 오케스트레이션 | 기능을 독립 agent로 등록하고 LLM이 선택한다. 런타임 파이프라인보다는 authoring 확장에 적합하다. | Director:DIR-001, Director:DIR-003 | P2 확장후순위 | P2 | registry selection fixture와 모호성 확인 정책 테스트 |
| pipeline-C17 | 장문 원고·콘텐츠 분할 파이프라인 | 원문을 장문 해설/문단 구조로 재작성한다. scene manifest 이전의 스크립트 확장 기능이다. | VideoAgent:VA-028, story-flicks:SF-012 | P2 원고확장 후순위 | P2 | section/paragraph count와 scene compile 입력 schema 검증 |
| pipeline-C18 | 원격 Worker 라우팅·배포 계약 | React server entry, custom domain, worker routing을 배포 설정으로 고정한다. | OpenCut:OC-015 | P2 배포후순위 | P6 | deploy dry-run으로 route/domain/server-entry 설정 검증 |
| pipeline-C19 | 효과 배열·GL 옵션 체인 | Video/Image/HTML 레이어에 stackable effects 배열을 적용하고 WebGL 옵션을 명시한다. | remotion-skills:RSK-066 | P2 효과확장 후순위 | P2/P5 | effect array 순서, GL 옵션, 렌더 snapshot 검증 |
| pipeline-C20 | 멀티 워커 렌더·프레임 슬라이싱 | 브라우저 워커별 프레임 구간을 나누고 경계 중복/누락 없이 결과를 병합한다. | revideo:RV-003, revideo:RV-005 | P2 성능후순위 | P3/P6 | 1/2/4 worker 출력 duration·frame count·경계 timecode 동등성 검증 |

### 도메인 오분류 의심

VideoAgent:VA-013, VideoAgent:VA-056

### 이 도메인 설계 조언

P0는 “다시 실행할 수 있음”이 아니라 “같은 scene manifest에서 같은 프레임을 재현하고, 실패 지점만 다시 만들 수 있음”으로 정의해야 한다.

파이프라인 상태는 DB, checkpoint 파일, 산출물 파일 중 하나에만 의존하지 말고 세 값을 대조해 복구하되, 최종 판정 규칙은 schema로 고정해야 한다.

스튜디오 편집은 즉시 UI 반영과 영속 저장을 분리하고, 저장 큐·부분 재렌더 큐·하드게이트 결과를 같은 job/event 모델로 보여주는 편이 낫다.