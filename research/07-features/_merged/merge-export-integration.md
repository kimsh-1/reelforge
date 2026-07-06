## export-integration
| CID | 통합 기능명 | 통합 설명(1-2줄) | 출처(repo:원id, 전부) | 채택 | Phase | 검증방법(통합 1줄) |
|---|---|---|---|---|---|---|
| export-integration-C01 | 결정론 프레임/범위 렌더 루프 | tick/frame/range 기준으로 HTML 씬을 고정 출력하고, 구간 렌더·concat·abort를 지원하는 핵심 렌더 파이프라인. | html-video:HV-019, motion-canvas:MC-012, opencut-classic:OCC-024, revideo:RV-016 | P0 결정론 렌더 핵심 | P3 | 동일 manifest를 tick/range별 렌더해 frame count/hash/concat 결과와 abort 복구 상태를 검증 |
| export-integration-C02 | 오디오 마스터 리미터 게이트 | export 전 peak/headroom을 검사하고 compressor/gain/clamp로 clipping을 차단하는 물리 하드게이트. | opencut-classic:OCC-045 | P0 물리게이트 핵심 | P5 | 과피크 오디오 fixture를 통과시켜 최종 peak, clipping 부재, clamp 적용을 검증 |
| export-integration-C03 | Export 작업 API·실시간 상태 스트림 | REST/Socket/SSE/XHR로 업로드·렌더 작업 시작, 진행률, 완료, 실패, 라이브러리 갱신, 다운로드 상태를 대시보드에 전달. | Director:DIR-013, Director:DIR-018, OpenMontage:OM-080, html-video:HV-044, react-video-editor:RVE-033, react-video-editor:RVE-042, revideo:RV-068 | P1 대시보드 작업 필수 | P4 | 업로드→렌더→다운로드 흐름에서 progress/done/error/library 이벤트와 URL cleanup을 통합 검증 |
| export-integration-C04 | 안전한 업로드 파일명·저장 경로 | path traversal 제거, CJK 파일명 복원, UUID/presigned 경로 발급으로 브라우저 업로드를 안전하게 수용. | MoneyPrinterTurbo:MPT-027, html-video:HV-075, react-video-editor:RVE-041 | P1 업로드 보안 필수 | P4 | `../`, latin1 깨짐, 한국어 파일명, presigned 만료 fixture로 저장 경로와 표시명을 검증 |
| export-integration-C05 | 로컬 에셋 재사용·씬 배치 | 업로드/지정 소재를 로컬 소스로 재사용하고 signature dedupe, 세션 유지, background/fullscreen/overlay 자동 배치를 manifest에 반영. | MoneyPrinterTurbo:MPT-029, MoneyPrinterTurbo:MPT-030, NarratoAI:NAR-091, auto_kairos-pipeline:AKP-091 | P1 씬 에셋 핵심 | P4 | 동일 파일 재업로드, 문안만 변경한 재생성, overlay 유무별 manifest placement를 검증 |
| export-integration-C06 | 안정적 그래프 재사용 Restyle | 스타일만 바뀌는 편집에서 content graph를 유지해 씬 구조 흔들림 없이 부분 재렌더 캐시를 재사용. | html-video:HV-063 | P1 부분재렌더 안정성 | P2/P4 | restyle 전후 graph id/content hash는 유지되고 style diff만 발생하는지 검증 |
| export-integration-C07 | 렌더 품질·성능 관측 | span, p50/p95/max, upload counter, WASM sub-span 등 렌더 성능 지표를 수집해 게이트와 회귀 분석에 사용. | opencut-classic:OCC-023 | P1 품질관측 필요 | P5 | 60프레임 이상 렌더 fixture에서 통계 flush, p95 산출, WASM sub-span 기록을 검증 |
| export-integration-C08 | 한국어 TTS·더빙 어댑터 | 영어·약어 한국어 발음 치환과 외부 더빙 엔진 polling/download/upload를 분리해 음성 파이프라인을 확장. | Director:DIR-057, auto_kairos-pipeline:AKP-046 | P1 한국어음성 필요 | P3 | 약어 발음 fixture와 mock dubbing job으로 TTS 전처리, polling, 산출물 연결을 검증 |
| export-integration-C09 | Export 산출물 수명주기 | 임시 파일 삭제와 export history cap으로 산출물·메타데이터가 무한 증가하지 않도록 관리. | Director:DIR-037, html-video:HV-022 | P2 운영안정성 후순위 | P6 | 여러 export 후 최신 N개만 남고 temp 파일이 성공/실패 경로 모두에서 정리되는지 검증 |
| export-integration-C10 | 효과 패스 레지스트리 | 효과 인스턴스와 렌더 pass 생성을 분리해 정적 pass와 동적 buildPasses를 compiler/exporter가 처리. | opencut-classic:OCC-012 | P2 효과확장 후순위 | P2 | effect manifest를 pass graph로 변환하고 정적/동적 pass 순서를 검증 |
| export-integration-C11 | 브라우저 WebCodecs/WASM MP4 Exporter | canvas frame을 브라우저에서 WebCodecs/WASM으로 MP4 blob으로 인코딩하는 경량 로컬 렌더 옵션. | revideo:RV-021 | P2 경량렌더 옵션 | P3 | browser capability matrix에서 동일 frame sequence의 MP4 생성 smoke test 수행 |
| export-integration-C12 | 레퍼런스 영상 수집·분석 | playlist URL, 업로드 영상, 대조 영상을 수집하고 background 분석 상태를 polling해 레퍼런스 기반 생성을 지원. | Director:DIR-017, Pilipili-AutoVideo:PLP-011, Pilipili-AutoVideo:PLP-031 | P2 레퍼런스 확장 | P3 | playlist 분해, MIME 업로드, timeout, processing/completed/failed 상태 전이를 검증 |
| export-integration-C13 | 배포 메타데이터·플랫폼 업로드 | 완성 영상의 YouTube 제목/설명/파일명과 TikTok·Instagram·YouTube cross-post를 다루는 패키징 확장. | MoneyPrinterTurbo:MPT-021, ShortGPT:SG-071 | P2 패키징 후순위 | P6 | metadata JSON/schema, safe filename, synthetic media flag, mock upload 호출을 검증 |
| export-integration-C14 | 웹 배포·서버 헬스체크 | SSR 배포 설정과 `/health` readiness probe는 export 자체보다 운영 배포 계층에 가까움. | OpenCut:OC-014, short-video-maker:SVM-049 | HOLD 도메인밖 운영 | P6 | 배포 대상으로 채택 시 SSR build와 `/health` 200 JSON만 별도 운영 테스트 |

### 도메인 오분류 의심
OC-014, SVM-049, DIR-057, AKP-046, PLP-011, PLP-031

### 이 도메인 설계 조언
Export API는 REST로 작업을 만들고 SSE로 진행률·완료·실패를 흘리며, Socket은 스튜디오 라이브 이벤트로 제한하는 편이 단순하다.  
부분 재렌더의 캐시 키는 scene graph id, tick range, asset signature, style diff로 고정해야 한다.  
패키징·소셜 업로드보다 frame determinism, audio peak, 파일명 보안, 한국어 TTS fixture를 먼저 하드게이트로 묶어라.