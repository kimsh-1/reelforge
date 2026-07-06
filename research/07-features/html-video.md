| ID | 기능명 | 설명(1-2줄) | 근거(파일:라인) | 채택제안 | 검증방법 |
|---|---|---|---|---|---|
| HV-001 | 엔진 어댑터 계약 | 엔진별 `validate/render/preview/renderToHtml`을 같은 인터페이스로 묶는다. HyperFrames와 Remotion 같은 렌더러를 교체 가능하게 만든다. | `packages/core/src/types/index.ts:133` | P1 - 코어 확장성 | `tests/engine-adapter-contract.test.ts` |
| HV-002 | 렌더 설정 노브 | 포맷, 해상도, FPS, duration mode, alpha, quality, audio를 공통 렌더 계약으로 정의한다. | `packages/core/src/types/index.ts:62` | P0 - 렌더 계약 핵심 | `tests/render-config-schema.test.ts` |
| HV-003 | 출력 capability 선언 | 엔진별 지원 포맷, aspect, FPS, duration, alpha, audio를 메타데이터로 노출한다. UI와 품질 게이트가 사전 차단 가능하다. | `packages/core/src/types/index.ts:162` | P1 - 사전 검증 | `tests/output-capabilities.test.ts` |
| HV-004 | 템플릿 메타데이터 계약 | 템플릿에 입력 스키마, 출력 제약, 라이선스, provenance, 성능 힌트, preview 정보를 붙인다. | `packages/core/src/types/index.ts:235` | P1 - 템플릿 운영 | `tests/template-metadata-schema.test.ts` |
| HV-005 | 3계층 provenance | 템플릿 출처를 라이선스, 생성 근거, 사용자 제공 여부로 나눠 추적한다. 상업 사용 판단에 유용하다. | `packages/core/src/types/index.ts:206` | P1 - 라이선스 추적 | `tests/provenance-policy.test.ts` |
| HV-006 | 브리지/네이티브 템플릿 참조 | HTML 브리지 템플릿과 엔진 네이티브 템플릿을 한 프로젝트 안에서 참조한다. 씬별 엔진 override 기반이 된다. | `packages/core/src/types/index.ts:273` | P2 - 엔진 혼합 | `tests/template-ref-resolution.test.ts` |
| HV-007 | 프로젝트 프레임 레코드 | 씬별 HTML 경로, duration, poster, preview MP4, native template, data snapshot을 저장한다. | `packages/core/src/types/index.ts:333` | P0 - 부분 재렌더 핵심 | `tests/frame-record-schema.test.ts` |
| HV-008 | 프로젝트 사운드트랙 모델 | 음악/나레이션 asset, 볼륨, prompt/text, frame별 narration, fade 설정을 프로젝트에 보존한다. | `packages/core/src/types/index.ts:377` | P1 - 오디오 코어 | `tests/soundtrack-schema.test.ts` |
| HV-009 | 콘텐츠 그래프 IR | 영상 내용을 entity/data/text 노드와 sequence/dependency 엣지로 구조화한다. 씬 매니페스트 JSON의 좋은 선행 모델이다. | `packages/content-graph/src/index.ts:11` | P0 - 매니페스트 기반 | `tests/content-graph-schema.test.ts` |
| HV-010 | 그래프 검증 코드 | 빈 그래프, 중복 ID, 알 수 없는 엣지, self edge, dependency cycle을 명시적 에러 코드로 잡는다. | `packages/content-graph/src/index.ts:131` | P0 - 하드게이트 필수 | `tests/content-graph-validation.test.ts` |
| HV-011 | 결정론적 씬 정렬 | dependency는 hard constraint, sequence는 soft constraint로 처리하고 node order로 tie-break한다. | `packages/content-graph/src/index.ts:201` | P0 - 결정론 핵심 | `tests/toposort-determinism.test.ts` |
| HV-012 | 총 duration 계산 | 노드별 duration 합산과 기본 duration fallback을 제공한다. 나레이션 길이와 씬 길이 동기화에 쓸 수 있다. | `packages/content-graph/src/index.ts:334` | P1 - 타이밍 기반 | `tests/graph-duration.test.ts` |
| HV-013 | 콘텐츠 주소 기반 에셋 저장 | 파일 내용을 SHA1로 해시해 중복 저장을 피하고 안정적인 asset ID를 만든다. | `packages/core/src/asset-store.ts:32` | P1 - 캐시 기본 | `tests/asset-dedupe.test.ts` |
| HV-014 | MIME 기반 asset typing | 이미지, 텍스트, JSON, 오디오, 비디오 MIME을 asset type으로 매핑한다. | `packages/core/src/asset-store.ts:41` | P1 - 에셋 분류 | `tests/asset-type-detection.test.ts` |
| HV-015 | 파일/인라인/버퍼 asset 통합 | 업로드 파일, 인라인 텍스트, 생성 오디오 버퍼를 같은 저장소와 메타데이터로 관리한다. | `packages/core/src/asset-store.ts:66` | P1 - 입력 통합 | `tests/asset-store-roundtrip.test.ts` |
| HV-016 | 템플릿 레지스트리 검색 | aspect, 라이선스, engine, intent, 태그 기반으로 템플릿을 필터링하고 점수화한다. | `packages/core/src/registry.ts:90` | P2 - 템플릿 탐색 | `tests/template-search.test.ts` |
| HV-017 | content graph 저장 시 frame 보존 | 그래프 재작성 때 `preserveFrames` 옵션으로 기존 프레임 HTML과 duration을 유지한다. | `packages/core/src/project.ts:219` | P1 - 재개/부분수정 | `tests/preserve-frames.test.ts` |
| HV-018 | 안전한 frame HTML 기록 | node ID와 topo order를 검증하고 안전한 파일명으로 frame HTML을 저장한다. | `packages/core/src/project.ts:275` | P0 - 씬 파일 계약 | `tests/write-frame-html.test.ts` |
| HV-019 | 멀티프레임 export | 각 프레임을 별도 MP4로 렌더한 뒤 ffmpeg concat으로 최종 영상을 만든다. 부분 재렌더 구조와 맞다. | `packages/core/src/project.ts:379` | P0 - 렌더 파이프라인 | `tests/export-multiframe.test.ts` |
| HV-020 | 프레임 duration 강제 | 그래프 duration과 frame duration을 맞추고 누락 시 명확히 실패한다. | `packages/core/src/project.ts:403` | P0 - 타이밍 하드게이트 | `tests/frame-duration-required.test.ts` |
| HV-021 | 혼합 엔진 concat 처리 | 프레임별 엔진이 다르면 stream copy 대신 재인코딩 concat을 선택한다. | `packages/core/src/project.ts:386` | P2 - 엔진 혼합 | `tests/mixed-engine-concat.test.ts` |
| HV-022 | export 이력 제한 | export 결과를 최신 20개만 보존해 프로젝트 메타데이터가 무한 증가하지 않게 한다. | `packages/core/src/project.ts:925` | P2 - 운영 안정성 | `tests/export-history-cap.test.ts` |
| HV-023 | ffmpeg 오디오 mux | 음악과 나레이션 볼륨, fade-out, amix, AAC 인코딩, shortest 처리를 한 번에 수행한다. | `packages/core/src/project.ts:823` | P1 - 오디오 코어 | `tests/audio-mux.test.ts` |
| HV-024 | Remotion enhancement 토글 | HTML 프레임을 Remotion 네이티브 템플릿으로 강화하거나 원복할 수 있다. 실패 시 원본 유지가 가능하다. | `packages/core/src/project.ts:515` | P2 - 품질 확장 | `tests/frame-enhance-rollback.test.ts` |
| HV-025 | HyperFrames capability 선언 | HTML/CSS/GSAP, MP4/WebM/PNG sequence, alpha, multi-audio, subtitle burn-in/sidecar 지원을 선언한다. | `packages/adapter-hyperframes/src/capabilities.ts:7` | P1 - 엔진 설명 | `tests/hyperframes-capabilities.test.ts` |
| HV-026 | HyperFrames 입력 검증 | 엔진 불일치, source entry 누락, 파일 없음, 해상도 sanity warning을 렌더 전 검증한다. | `packages/adapter-hyperframes/src/validate.ts:9` | P1 - 사전 차단 | `tests/hyperframes-validate.test.ts` |
| HV-027 | Chromium 녹화 렌더 | Playwright Chromium에서 HTML을 녹화하고 ffmpeg로 MP4를 생성한다. | `packages/adapter-hyperframes/src/render.ts:33` | P0 - HTML→비디오 핵심 | `tests/render-fixture-playwright.test.ts` |
| HV-028 | CSS/SMIL freeze 후 시작 | 페이지 로드 전 애니메이션을 일시정지하고 준비 완료 후 `__hvUnfreeze`로 시작한다. | `packages/adapter-hyperframes/src/render.ts:85` | P0 - 결정론 시작점 | `tests/animation-freeze.test.ts` |
| HV-029 | 폰트 로딩 하드 대기 | stylesheet load, `fonts.load`, `fonts.ready`, rAF settle을 거쳐 폰트 미로딩 캡처를 줄인다. | `packages/adapter-hyperframes/src/render.ts:130` | P0 - 품질 하드게이트 | `tests/font-ready-gate.test.ts` |
| HV-030 | 애니메이션 길이 프로브 | CSS/GSAP 애니메이션 길이를 읽어 무한 루프를 제외하고 duration을 보정한다. | `packages/adapter-hyperframes/src/render.ts:229` | P1 - 자동 duration | `tests/animation-duration-probe.test.ts` |
| HV-031 | lead-in trim과 tpad | 녹화 lead-in을 잘라내고 부족한 끝부분은 tpad로 채워 정확한 duration을 보장한다. | `packages/adapter-hyperframes/src/render.ts:335` | P0 - 길이 결정론 | `tests/exact-duration-render.test.ts` |
| HV-032 | HTML 소스 인라인화 | 다중 composition 파일을 인라인하고 seed registry, script 재실행, cleanup을 주입한다. | `packages/adapter-hyperframes/src/render.ts:413` | P1 - 재현성 강화 | `tests/prepare-source-html.test.ts` |
| HV-033 | Remotion HTML time driver | iframe `srcdoc`의 CSS Animation과 GSAP timeline을 Remotion frame 시간에 맞춰 seek한다. | `packages/adapter-remotion/src/bridge/HtmlFrameDriver.tsx:68` | P2 - 프레임정밀 확장 | `tests/remotion-time-driver.test.tsx` |
| HV-034 | 외부 blocking resource 무력화 | 외부 stylesheet link를 print media로 바꿔 렌더 지연과 네트워크 불안정을 줄인다. | `packages/adapter-remotion/src/render.ts:78` | P1 - 렌더 안정성 | `packages/adapter-remotion/test/neutralize-resources.test.mjs` |
| HV-035 | Remotion bundle cache | template entry별 bundle 결과를 캐시해 반복 렌더 속도를 개선한다. | `packages/adapter-remotion/src/render.ts:50` | P2 - 성능 최적화 | `tests/remotion-bundle-cache.test.ts` |
| HV-036 | CLI JSON/NDJSON 출력 | CLI 성공, 실패, progress를 JSON/NDJSON으로 출력해 자동화 파이프라인이 읽기 쉽다. | `packages/cli/src/output.ts:13` | P1 - 자동화 친화 | `tests/cli-json-output.test.ts` |
| HV-037 | doctor 환경 점검 | Node 버전, ffmpeg, Chromium, 엔진, 템플릿 스캔 상태를 한 번에 점검한다. | `packages/cli/src/commands/doctor.ts:35` | P1 - 설치 게이트 | `tests/doctor-command.test.ts` |
| HV-038 | API 키 로컬 설정 | MiniMax 등 미디어 API 키를 config/env 우선순위로 읽고 상태 출력 시 마스킹한다. | `packages/cli/src/media-config.ts:46` | P1 - TTS 운영 | `tests/media-config.test.ts` |
| HV-039 | URL/GitHub 소스 수집 | URL, 기사, GitHub repo를 마크다운으로 추출하고 timeout, redirect, 길이 제한을 둔다. | `packages/cli/src/fetch-source.ts:90` | P1 - 소스 기반 생성 | `tests/fetch-source.test.ts` |
| HV-040 | SSRF URL 차단 | localhost, private IP, file URL 등을 막아 외부 URL 수집의 기본 보안을 확보한다. | `packages/cli/src/fetch-source.ts:47` | P1 - 보안 기본 | `tests/ssrf-guard.test.ts` |
| HV-041 | detached task event replay | long-running 작업 이벤트에 seq를 붙이고 `sinceSeq`부터 replay/live tail을 제공한다. | `packages/cli/src/task-registry.ts:57` | P2 - 재개 UX | `tests/task-registry-replay.test.ts` |
| HV-042 | raw preview HTML API | 전체 preview HTML을 GET/PUT하고 완전한 HTML 문서인지 검증한다. | `packages/cli/src/studio-server.ts:233` | P1 - 편집 백엔드 | `tests/raw-preview-api.test.ts` |
| HV-043 | frame별 HTML 편집 API | active frame의 HTML만 읽고 쓸 수 있어 부분 재렌더와 씬 단위 편집에 적합하다. | `packages/cli/src/studio-server.ts:265` | P0 - 씬 편집 핵심 | `tests/frame-html-api.test.ts` |
| HV-044 | SSE export 진행률 | export를 SSE로 스트리밍하고 progress, done, error 이벤트를 분리한다. | `packages/cli/src/studio-server.ts:362` | P1 - 대시보드 필수 | `tests/export-sse.test.ts` |
| HV-045 | 음악/나레이션 생성 API | 음악과 나레이션을 별도 payload로 생성하고 asset 저장 및 soundtrack persistence까지 처리한다. | `packages/cli/src/studio-server.ts:411` | P1 - 오디오 생성 | `tests/generate-audio-api.test.ts` |
| HV-046 | frame별 나레이션 초안 | 전체 또는 프레임별 narration draft를 agent에게 만들게 하고 같은 언어 유지 조건을 준다. | `packages/cli/src/studio-server.ts:515` | P1 - 한국어 자막 기반 | `tests/draft-narration.test.ts` |
| HV-047 | 나레이션 길이 기반 duration 맞춤 | frame별 narration text를 기준으로 graph/frame duration을 재계산한다. | `packages/cli/src/studio-server.ts:1251` | P1 - 워드싱크 전단계 | `tests/fit-durations.test.ts` |
| HV-048 | agent 런타임 선택 | 사용 가능한 agent, 모델, 로그인, 테스트 상태를 API로 감지하고 프로젝트에 선택값을 저장한다. | `packages/cli/src/studio-server.ts:635` | P2 - 생성기 교체 | `tests/agent-selection-api.test.ts` |
| HV-049 | 첨부 텍스트 인라인화 | 작은 텍스트 첨부는 대화 context에 바로 포함하고 큰 파일은 asset reference로 남긴다. | `packages/cli/src/studio-server.ts:760` | P1 - 자료 기반 생성 | `tests/attachment-inline.test.ts` |
| HV-050 | 소스 asset carry-over | 이전 턴의 텍스트/데이터 asset을 이후 프롬프트에도 계속 포함한다. | `packages/cli/src/studio-server.ts:897` | P1 - 반복 편집 맥락 | `tests/source-carryover.test.ts` |
| HV-051 | 프롬프트 감사 로그 | 생성 직전 prompt와 이전 prompt를 `.last-prompt.md`로 저장한다. 품질 회귀 분석에 유용하다. | `packages/cli/src/studio-server.ts:921` | P1 - 디버깅 필수 | `tests/prompt-audit-log.test.ts` |
| HV-052 | 생성 상태 폴링 | 프로젝트별 generating 상태를 노출해 새로고침 후에도 작업 중 UI를 복구한다. | `packages/cli/src/studio-server.ts:955` | P1 - 재개 UX | `tests/generating-status.test.ts` |
| HV-053 | 대화 phase 감지 | 콘텐츠, 스타일, 형식, 확인, 생성, 반복수정 phase를 marker와 자연어로 판별한다. | `packages/cli/src/studio-server.ts:1816` | P1 - 생성 UX | `tests/conversation-phase.test.ts` |
| HV-054 | 형식 답변 rescue | 사용자가 자유문으로 “세로/30초/5장면”처럼 답해도 aspect, duration, frame count로 파싱한다. | `packages/cli/src/studio-server.ts:2264` | P2 - 입력 관용성 | `packages/cli/test/parse-format-reply.test.ts` |
| HV-055 | post-generation edit menu | 생성 후 스타일, 내용, 길이, export 의도를 분기해 재생성 또는 편집 흐름으로 보낸다. | `packages/cli/src/studio-server.ts:1923` | P1 - 반복 편집 | `tests/post-generation-routing.test.ts` |
| HV-056 | 소스 자료 우선 프롬프트 | 첨부/URL 자료가 있으면 불필요한 콘텐츠 질문을 건너뛰고 자료 기반 생성을 유도한다. | `packages/cli/src/studio-server.ts:2003` | P1 - 자료 충실도 | `tests/source-material-phase.test.ts` |
| HV-057 | 디자인 스펙 블록 분리 | 사용자 입력에서 디자인 스펙 성격의 블록을 분리해 생성 prompt에 별도로 넣는다. | `packages/cli/src/studio-server.ts:2371` | P1 - 스타일 제어 | `tests/design-spec-block.test.ts` |
| HV-058 | tolerant graph JSON repair | graph JSON이 코드펜스나 앞뒤 텍스트에 섞여도 JSON 부분을 찾아 파싱한다. | `packages/cli/src/studio-server.ts:2413` | P1 - LLM 출력 복구 | `tests/tolerant-graph-parse.test.ts` |
| HV-059 | 형식 입력 카드 | aspect, per-frame seconds, frame count, Remotion enhance를 form field로 수집한다. | `packages/cli/src/studio-server.ts:2628` | P1 - 설정 노브 UI | `tests/format-card-contract.test.ts` |
| HV-060 | 엄격한 멀티프레임 출력 계약 | `json#content-graph`와 `html#nodeId` 블록을 요구해 그래프와 씬 HTML을 분리 수집한다. | `packages/cli/src/studio-server.ts:2831` | P0 - 매니페스트 생성 | `tests/multiframe-output-contract.test.ts` |
| HV-061 | graph-first split generation | 먼저 content graph를 만들고 각 node별 HTML을 별도 호출로 생성한다. 긴 영상 생성 안정성이 높다. | `packages/cli/src/studio-server.ts:3097` | P0 - 씬 생성 핵심 | `tests/split-generation.test.ts` |
| HV-062 | 빈 프레임 재시도 | 프레임 HTML 생성 응답이 비면 더 짧은 prompt로 1회 재시도한다. | `packages/cli/src/studio-server.ts:3395` | P1 - 실패 복구 | `tests/empty-frame-retry.test.ts` |
| HV-063 | restyle 시 graph 재사용 | 스타일 변경만 요청하면 기존 content graph를 재사용해 내용 구조가 흔들리지 않게 한다. | `packages/cli/src/studio-server.ts:3197` | P1 - 반복 안정성 | `tests/restyle-reuses-graph.test.ts` |
| HV-064 | 브라우저 스튜디오 레이아웃 | 프로젝트 사이드바, 채팅, preview stage, frame strip, soundtrack, text pane을 한 화면에 둔다. | `packages/project-studio/public/app.js:745` | P1 - 대시보드 골격 | `tests/studio-layout.spec.ts` |
| HV-065 | frame strip 포커스 편집 | 프레임 썸네일을 클릭해 active frame을 바꾸고 해당 frame만 편집 대상으로 삼는다. | `packages/project-studio/public/app.js:2150` | P0 - 부분 편집 핵심 | `tests/frame-strip-focus.spec.ts` |
| HV-066 | preview 내 텍스트 직접 편집 | `data-hv-text` 요소를 hover/click/contenteditable로 수정하고 frame HTML에 반영한다. | `packages/project-studio/public/app.js:1968` | P0 - 씬 편집 핵심 | `tests/inline-text-edit.spec.ts` |
| HV-067 | 우측 텍스트 필드 autosave | active frame HTML에서 `data-hv-text`를 추출해 textarea로 편집하고 debounce 저장한다. | `packages/project-studio/public/app.js:2304` | P0 - 한국어 교정 필수 | `tests/text-fields-autosave.spec.ts` |
| HV-068 | aspect-aware preview scaler | iframe/video preview를 aspect ratio에 맞춰 스케일링한다. 세로/가로 영상 편집 품질에 중요하다. | `packages/project-studio/public/app.js:1869` | P1 - 편집 정확도 | `tests/preview-scaler.spec.ts` |
| HV-069 | graph modal 다운로드 | 현재 content graph를 모달에서 보고 JSON으로 다운로드할 수 있다. | `packages/project-studio/public/app.js:2246` | P2 - 디버깅 편의 | `tests/graph-modal.spec.ts` |
| HV-070 | 사운드트랙 편집 패널 | 음악 preset, voice, frame별 narration, duration fit, clear, preview를 UI에서 제어한다. | `packages/project-studio/public/app.js:909` | P1 - 오디오 UX | `tests/soundtrack-panel.spec.ts` |
| HV-071 | 드래그/붙여넣기 첨부 | 파일 input뿐 아니라 drag/drop/paste로 첨부를 추가한다. 자료 기반 영상 제작 UX에 유용하다. | `packages/project-studio/public/app.js:1232` | P1 - 입력 UX | `tests/attachments.spec.ts` |
| HV-072 | 카드형 대화 프로토콜 | `hv-options`, `hv-form`, `hv-confirm`을 파싱해 agent 응답을 구조화된 UI 카드로 표시한다. | `packages/project-studio/public/app.js:1679` | P1 - 생성 흐름 UI | `tests/chat-card-protocol.spec.ts` |
| HV-073 | assistant HTML sanitize | Markdown을 DOMPurify로 sanitize하고 코드블록/불필요 prose를 접어 UI 오염을 줄인다. | `packages/project-studio/public/app.js:1624` | P1 - UI 안전성 | `tests/assistant-sanitize.spec.ts` |
| HV-074 | 템플릿 갤러리/미리보기 | 템플릿 카드, iframe/poster preview, metadata, provenance, 적용 confirm을 제공한다. | `packages/project-studio/public/app.js:2626` | P2 - 템플릿 선택 | `tests/template-gallery.spec.ts` |
| HV-075 | CJK 파일명 보존 | multipart 업로드에서 깨진 latin1 filename을 UTF-8로 복원한다. 한국어 파일명 처리에 중요하다. | `packages/cli/src/studio-server.ts:1639` | P1 - 한국어 UX | `packages/cli/test/decode-upload-filename.test.ts` |
| HV-076 | 안전한 정적 파일 서빙 | asset/template 파일 경로를 제한하고 preview 응답에 no-store 헤더를 붙인다. | `packages/cli/src/studio-server.ts:1305` | P1 - 보안/캐시 | `tests/static-serving.test.ts` |
| HV-077 | 다중 agent 런타임 | child process, HTTP, ACP agent를 같은 invoke interface로 실행한다. | `packages/runtime/src/types.ts:7` | P2 - 생성기 확장 | `tests/runtime-agent-contract.test.ts` |
| HV-078 | UTF-8 스트림 디코딩 | child process stdout/stderr를 `StringDecoder`로 처리해 한국어 분할 깨짐을 막는다. | `packages/runtime/src/spawn.ts:89` | P1 - 한국어 필수 | `packages/runtime/test/spawn-utf8.test.ts` |
| HV-079 | ACP handshake와 권한 응답 | ACP initialize, session, prompt, timeout, permission request 자동 선택을 구현한다. | `packages/runtime/src/acp-client.ts:101` | P2 - agent 호환 | `tests/acp-client.test.ts` |
| HV-080 | smoke E2E 테스트 | 프로젝트 생성, asset 추가, template 적용, preview, render, multi-frame graph까지 CLI로 검증한다. | `packages/cli/src/smoke.ts:37` | P1 - 회귀 게이트 | `pnpm smoke` |

## 이 레포에서 배우지 말 것

1. **Markdown/정규식 기반 LLM 출력 계약 과신**  
   `json#content-graph`, `html#nodeId` 블록을 정규식으로 뽑고 복구 파서를 붙인다. 우리 쪽은 JSON Schema 검증 가능한 씬 매니페스트를 1차 산출물로 강제해야 한다. 근거: `packages/cli/src/studio-server.ts:2831`, `packages/cli/src/studio-server.ts:3034`.

2. **직접 구현한 multipart/HTML 파서 유지**  
   코드 주석에서도 production에서는 `formidable/busboy`로 바꾸라고 되어 있고, 현재는 boundary split 기반이다. 업로드와 HTML 조작은 검증된 파서로 가야 한다. 근거: `packages/cli/src/studio-server.ts:1630`, `packages/cli/src/studio-server.ts:1664`.

3. **한국어 우선이 아닌 i18n/프롬프트 하드코딩**  
   locale은 `en/zh`만 있고, 생성 카드와 UI 문구 일부가 중국어/영어에 고정되어 있다. 한국어 우선 프로젝트라면 locale key, 한국어 control phrase, 한국어 TTS/자막 검증을 처음부터 계약화해야 한다. 근거: `packages/project-studio/public/i18n.js:17`, `packages/cli/src/studio-server.ts:2514`.