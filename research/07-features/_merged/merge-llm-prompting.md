## llm-prompting
| CID | 통합 기능명 | 통합 설명(1-2줄) | 출처(repo:원id, 전부) | 채택 | Phase | 검증방법(통합 1줄) |
|---|---|---|---|---|---|---|
| llm-prompting-C01 | 씬 매니페스트 엄격 계약 | LLM이 생성하는 scene/script 모델에 금지 필드 차단과 합법 duration enum을 적용해 렌더 전 오염을 막는다. | ArcReel:ARC-001, ArcReel:ARC-006 | P0 계약핵심 | P1 계약스키마 | 깨진 필드·불법 duration 샘플이 manifest validator에서 실패하는 계약 테스트. |
| llm-prompting-C02 | 구조화 프롬프트 빌더 | 이미지/영상/샷/디자인/문체 요구사항을 고정 순서 필드로 조립해 LLM 입력 드리프트를 줄인다. | ArcReel:ARC-050, MoneyPrinterTurbo:MPT-008, OpenMontage:OM-071, auto_kairos-pipeline:AKP-024, html-video:HV-057 | P0 프롬프트계약 | P2 컴파일러 | 동일 입력이 안정적 YAML/프롬프트 IR로 직렬화되고 style/design 블록이 분리되는 스냅샷 테스트. |
| llm-prompting-C03 | LLM JSON 추출·수리 게이트 | fence, 앞뒤 설명, trailing comma, 깨진 key 같은 흔한 LLM JSON 오류를 추출·수리한 뒤 계약 검증으로 넘긴다. | MoneyPrinterTurbo:MPT-016, NarratoAI:NAR-075, NarratoAI:NAR-110, ShortGPT:SG-067 | P0 출력복원필수 | P5 게이트 | 오염 응답 corpus를 repair→schema validate까지 통과/실패 기대값으로 검증. |
| llm-prompting-C04 | 한국어 기본 생성 정책 | 요청 모델의 기본 언어를 `ko`로 두고 TTS/자막/스크립트 컴파일 경로가 한국어 우선 설정을 상속한다. | fontagent:FA-013 | P0 한국어기본값 | P1 계약스키마 | language 생략 요청이 ko manifest와 한국어 TTS/subtitle config로 컴파일되는 테스트. |
| llm-prompting-C05 | 입력 소스·스크립트 노브 계약 | 첨부/URL 자료, 수동 script, 검색 terms, subject를 분리해 질문 생략·자료 기반 생성을 결정한다. | html-video:HV-056, story-flicks:SF-009 | P1 입력충실도 | P1 계약스키마 | 자료 유무별로 prompt phase와 manifest input fields가 달라지는 계약 테스트. |
| llm-prompting-C06 | 프롬프트 레지스트리·템플릿 로더 | YAML 템플릿, 버전별 prompt registry, 제한된 skill reference 로딩으로 프롬프트를 코드 밖에서 재사용한다. | NarratoAI:NAR-078, ShortGPT:SG-066, auto_kairos-pipeline:AKP-025 | P1 운영관리 | P2 컴파일러 | 템플릿 로드, 버전 중복 거부, reference 길이 제한을 fixture로 검증. |
| llm-prompting-C07 | 사용자 텍스트 태그 이스케이프 | 사용자 입력의 `<...>` 등 prompt tag 충돌 문자를 중화해 내부 태그 블록과 섞이지 않게 한다. | ArcReel:ARC-070 | P1 프롬프트주입방지 | P5 게이트 | 태그 유사 문자열이 prompt 구조를 깨지 않고 literal text로 유지되는 테스트. |
| llm-prompting-C08 | 에이전트 자산 upsert 화이트리스트 | Agent가 asset을 쓰거나 병합할 때 허용 필드만 받고 dropped/merged 진단을 남겨 manifest 오염을 막는다. | ArcReel:ARC-024 | P1 쓰기안전 | P5 게이트 | 허용/금지 필드 혼합 payload에서 저장 결과와 diagnostics를 검증. |
| llm-prompting-C09 | 낭독용 스크립트 후처리 | LLM 출력의 markdown 기호·링크 문법을 제거해 TTS와 자막에 들어갈 순수 대본을 만든다. | MoneyPrinterTurbo:MPT-012 | P1 TTS안정 | P2 컴파일러 | markdown/link 포함 대본이 한국어 TTS 입력용 plain text로 정규화되는 테스트. |
| llm-prompting-C10 | 툴콜 루프·재개 컨텍스트 | LLM tool_calls 실행 결과를 context에 되먹이고 reasoning/agent context를 저장해 수정 후 재실행하며 최종 요약을 만든다. | Director:DIR-005, Director:DIR-006, Director:DIR-009 | P1 재개실행필요 | P3 파이프라인 | tool call 반복, edited_context 재주입, 최종 summary 생성까지 세션 테스트. |
| llm-prompting-C11 | 엔진별 프롬프트 압축 | Kling 등 모델별 길이 제한에 맞춰 구조를 보존하면서 프롬프트를 압축한다. | Director:DIR-034 | P1 모델한계대응 | P2 컴파일러 | 긴 prompt가 엔진 제한 이하로 줄고 필수 구조 키가 보존되는 테스트. |
| llm-prompting-C12 | 스튜디오 프롬프트 초안 보호 | 리뷰/참조 편집 중 서버 refresh나 refs 재정렬이 있어도 미저장 prompt 초안과 reference 매핑을 보존한다. | ArcReel:ARC-072, ArcReel:ARC-086, ArcReel:ARC-087 | P1 편집보호 | P4 스튜디오 | dirty draft, reference add/delete/reorder, save/refresh 시나리오의 상태 보존 UI 테스트. |
| llm-prompting-C13 | 부분 실패 artifact 보존 | LLM 배치 분석이 일부 실패해도 실패 summary를 artifact에 남겨 전체 파이프라인과 부분 재렌더를 계속 가능하게 한다. | NarratoAI:NAR-073 | P1 부분재렌더기반 | P5 게이트 | 배치 일부 실패 fixture에서 artifact가 실패 항목을 포함하고 job이 복구 경로로 진행되는 테스트. |
| llm-prompting-C14 | MCP 도구 노출·상태 계약 | 영상 생성 스킬을 MCP tools/list·tools/call·status 형태로 노출하고 structuredContent/text JSON을 함께 반환한다. | fontagent:FA-065, fontagent:FA-066, short-video-maker:SVM-007 | P1 툴노출필요 | P6 패키징 | stdio roundtrip, tools/list schema, ready/processing/failed status 매핑 통합 테스트. |
| llm-prompting-C15 | LLM/에이전트 런타임 어댑터 | OpenAI 호환, Azure, Gemini, Qwen, Ollama, LiteLLM, child/HTTP/ACP agent를 공통 invoke 인터페이스로 감싼다. | MoneyPrinterTurbo:MPT-009, ShortGPT:SG-064, html-video:HV-048, html-video:HV-077, html-video:HV-079 | P2 생성기확장 | P3 파이프라인 | provider fallback, runtime selection 저장, ACP permission/timeout mock 호출 테스트. |
| llm-prompting-C16 | 장르별 프롬프트 프리셋 | 뉴스 원고, 멀티스피커 대화, 데이터 시각화 배경처럼 특정 장르의 prompt 규칙을 별도 프리셋으로 둔다. | VideoAgent:VA-030, VideoAgent:VA-060, auto_kairos-pipeline:AKP-071 | P2 장르확장 | P2 컴파일러 | 각 preset이 필수 필드·금지 요소·문체 규칙을 반영하는 golden prompt 테스트. |
| llm-prompting-C17 | 스킬 플러그인 발견·이식 | 역할/스킬을 자동 발견하고 기존 skill registry를 Codex wrapper로 이식하며 lockfile별 설치 규칙을 적용한다. | VideoAgent:VA-002, claude-code-video-toolkit:CVT-054, remotion-skills:RSK-011 | P2 패키징편의 | P6 패키징 | mock skill tree, migration dry-run, lockfile별 install command 선택 테스트. |
| llm-prompting-C18 | 운영 telemetry 이벤트 | skill invoked/completed 같은 CLI 이벤트를 best-effort로 보내되 실패해도 사용자 작업을 막지 않는다. | hyperframes-engine:HFE-107 | HOLD 운영후순위 | P6 패키징 | 성공/실패 전송 모두 exit 0과 event payload 모양만 검증. |
| llm-prompting-C19 | 개발 프록시 설정 | Vite dev server가 `/api`, `/mcp`를 백엔드로 프록시해 로컬 studio 개발을 단순화한다. | short-video-maker:SVM-064 | HOLD 도메인아님 | P4 스튜디오 | vite config에서 proxy target/path rewrite가 기대값인지 정적 테스트. |

### 도메인 오분류 의심
ARC-072, ARC-086, ARC-087, FA-065, FA-066, HV-048, HV-077, HV-079, HFE-107, RSK-011, SVM-007, SVM-064, VA-002, CVT-054

### 이 도메인 설계 조언
LLM은 최종 HTML을 직접 쓰지 말고, JSON 씬 매니페스트 계약만 생성하게 한 뒤 compiler가 HyperFrames HTML로 결정론 변환해야 한다.  
프롬프트는 자유문자열이 아니라 versioned Prompt IR/YAML, source block, style block, engine compressor의 순서로 관리하는 편이 안정적이다.  
JSON repair는 허용하되 최종 권위는 schema validator와 물리 하드게이트에 두고, 스튜디오 편집은 manifest patch와 dirty draft 보호를 기본값으로 둬야 한다.