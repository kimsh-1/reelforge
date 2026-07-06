## rendering
| CID | 통합 기능명 | 통합 설명(1-2줄) | 출처(repo:원id, 전부) | 채택 | Phase | 검증방법(통합 1줄) |
|---|---|---|---|---|---|---|
| rendering-C01 | 렌더 매니페스트/변수 계약 | 씬 변수 기본값, 렌더 오버라이드, 배치 rows, 컴포지션 변형, 출력 메타데이터를 하나의 JSON 계약으로 고정한다. | hyperframes-engine:HFE-011, hyperframes-engine:HFE-012, remotion-skills:RSK-002, remotion-skills:RSK-007, OpenMontage:OM-037 | P0 계약 핵심 | P1 | 매니페스트 fixture로 변수 병합, batch rows, variant, outName/codec 검증 |
| rendering-C02 | 브라우저 HTML 렌더 실행기 | Playwright/Puppeteer 기반으로 HTML 씬을 headless 브라우저에서 캡처하고 비디오 렌더 파이프라인에 연결한다. | html-video:HV-027, revideo:RV-006 | P0 렌더 핵심 | P3 | 동일 HTML fixture를 headless 렌더해 프레임 해시와 MP4 생성 검증 |
| rendering-C03 | 렌더 런타임 라우터 | manifest의 runtime을 기준으로 hyperframes/ffmpeg/legacy engine을 명시 라우팅하고, 혼합 엔진 결과는 안전하게 concat한다. | OpenMontage:OM-043, html-video:HV-021, html-video:HV-024 | P0 런타임 선택 | P3 | runtime별 plan 스냅샷과 혼합 엔진 concat 재인코딩 조건 검증 |
| rendering-C04 | 렌더 환경 doctor | Node, ffmpeg, Chromium, npx/npm, 사용자 FFmpeg 경로를 사전 점검하고 실패를 하드게이트로 노출한다. | OpenMontage:OM-050, html-video:HV-037, NarratoAI:NAR-011 | P0 환경 하드게이트 | P5 | 누락/오경로 fixture로 doctor JSON과 차단 메시지 검증 |
| rendering-C05 | 렌더 차단 정책/시각 게이트 | layout inspect, strict block policy, transition 인접성, slideshow/HtmlInCanvas 제약을 렌더 전 하드게이트로 묶는다. | hyperframes-engine:HFE-063, hyperframes-engine:HFE-083, remotion-skills:RSK-021, hyperframes-engine:HFE-015, remotion-skills:RSK-068 | P0 물리 하드게이트 | P5 | `hyperframes layout --json --strict`와 timeline lint fixture로 차단 여부 검증 |
| rendering-C06 | 결정론 타이밍/프레임 기준 | local frame, fps 변환, timecode parse/format, 극단 playbackRate 보정을 통일해 타임라인 오차를 막는다. | remotion-skills:RSK-017, revideo:RV-050, opencut-classic:OCC-004, revideo:RV-024 | P0 타이밍 정확성 | P2 | 24/30/60fps, local/global frame, playbackRate fixture의 timestamp 오차 검증 |
| rendering-C07 | 렌더 진행률/상태 계약 | heartbeat, progress, ETA, task state를 JSON 이벤트로 표준화해 CLI와 대시보드가 같은 상태 모델을 쓴다. | revideo:RV-008, ShortGPT:SG-057, motion-canvas:MC-021, claude-code-video-toolkit:CVT-027, story-flicks:SF-013 | P0 진행계약 필수 | P1 | fake render로 progress/ETA/state 이벤트 순서와 schema 검증 |
| rendering-C08 | 렌더 생명주기 중단/실패 처리 | abort, complete, failed, browserError를 서버 리소스 정리와 promise resolve/reject에 일관되게 연결한다. | revideo:RV-009, motion-canvas:MC-014 | P0 중단복구 핵심 | P3 | 실패/abort 주입 후 browser/server close와 상태 복귀 검증 |
| rendering-C09 | 부분 재렌더/정적 프레임 최적화 | props 변경 시 stale 요청을 취소하고 정적 프레임 dedup으로 브라우저 씬 편집의 부분 재렌더 비용을 줄인다. | hyperframes-engine:HFE-021, remotion-skills:RSK-008 | P0 부분렌더 핵심 | P4 | 빠른 변수 변경과 정적 구간 fixture로 취소/재사용 프레임 수 검증 |
| rendering-C10 | 비-HeyGen 워드 싱크 보완 | ElevenLabs/Kokoro 등 wav 기반 TTS도 transcribe chain을 거쳐 word timestamp 자막을 만든다. | hyperframes-engine:HFE-096 | P0 자막싱크 핵심 | P3 | wav fixture에서 words JSON 생성과 자막 타이밍 정렬 검증 |
| rendering-C11 | 호환 H.264 출력 프로파일 | yuv420p, H.264 high profile, level, faststart 등 배포 호환 MP4 기본값을 표준화한다. | Pilipili-AutoVideo:PLP-058, short-video-maker:SVM-042 | P1 배포호환 필수 | P6 | ffprobe로 pixel format/profile/faststart와 render 인자 검증 |
| rendering-C12 | FFmpeg 경로/미디어 처리 안정화 | concat path escaping, 필요한 경우만 재인코딩, 원본 비디오 프레임 추출, 원격 URL 로컬화를 통합한다. | MoneyPrinterTurbo:MPT-050, remotion-skills:RSK-049, revideo:RV-031, ShortGPT:SG-074 | P1 ffmpeg 안정성 | P3 | 공백/따옴표/Windows path, remote media, trim/frame fixture 검증 |
| rendering-C13 | 리소스 준비/첫 프레임 안정화 | async asset promise 소비, sequence premount, 외부 blocking resource 무력화, 기본 배경 fill로 빈/튐 프레임을 막는다. | motion-canvas:MC-009, remotion-skills:RSK-014, html-video:HV-034, template-tiktok:TTK-030 | P1 첫프레임 안정 | P3 | 지연 이미지/외부 CSS/빈 배경 fixture의 첫 프레임 픽셀 검증 |
| rendering-C14 | CLI 실행환경 부트스트랩 | `.env` 자동 로딩과 렌더 프로젝트 번들 스크립트로 재현 가능한 실행 환경을 만든다. | hyperframes-engine:HFE-002, template-tiktok:TTK-011 | P1 패키징 기본 | P6 | env fixture와 CI build smoke test로 주입값/번들 산출물 검증 |
| rendering-C15 | 렌더 활동/토스트 패널 | decision log, events.jsonl, loading/success/error feedback을 대시보드 활동 UI로 노출한다. | OpenMontage:OM-084, story-flicks:SF-069 | P1 운영추적 필요 | P4 | events fixture로 running/done/error row와 toast 상태 검증 |
| rendering-C16 | 렌더 오류/디버그 패널 | console error, stack, source frame, detached node를 보여줘 렌더 누락과 브라우저 오류를 검수한다. | revideo:RV-053, revideo:RV-058 | P1 QA검수 필요 | P4 | Playwright로 error panel 필드와 detached node 표시 검증 |
| rendering-C17 | 씬 파라미터/키프레임 모델 | inspectable signal, effect param path, interpolation, dynamic effect controls를 통합해 편집 UI와 manifest patch를 연결한다. | revideo:RV-057, react-video-editor:RVE-059, opencut-classic:OCC-057, opencut-classic:OCC-058 | P1 씬편집 핵심 | P4 | param schema별 control 렌더와 시간별 animated value resolve 검증 |
| rendering-C18 | 오디오 gain 자동화 | dB clamp와 keyframe gain curve를 지원해 TTS/BGM/효과음 볼륨을 결정론적으로 렌더한다. | opencut-classic:OCC-043 | P1 음량제어 필요 | P2 | keyframe gain curve fixture로 dB→linear 변환 검증 |
| rendering-C19 | Registry 블록 설치 | dependency topological install과 include snippet 생성으로 재사용 가능한 HyperFrames 블록을 씬 컴파일에 연결한다. | hyperframes-engine:HFE-038 | P1 블록재사용 핵심 | P6 | registry fixture로 install 순서와 include snippet 검증 |
| rendering-C20 | 스튜디오 백업 저널 | 파일 변경 전 백업을 보관해 브라우저 편집과 자동 패치 실패 시 복구 경로를 제공한다. | hyperframes-engine:HFE-051 | P1 복구 기본 | P4 | 파일당 보존 개수, restore 후보, journal metadata 검증 |
| rendering-C21 | 렌더 결과 저장/임시파일 정리 | 브라우저 저장 fallback, WAV/MP3/MP4 임시파일 제거, 만료 삭제 예약을 산출물 관리로 묶는다. | remotion-packages:RMT-050, short-video-maker:SVM-044, revideo:RV-069 | P1 산출물 위생 | P6 | save 실패 fallback과 fake timer cleanup unlink 검증 |
| rendering-C22 | 참조 이미지 품질 정책 | FRAME/ARRAY 역할별 압축 정책을 분리해 핵심 프레임은 품질을 보존하고 보조 참조만 축소한다. | ArcReel:ARC-038 | P1 품질보존 필요 | P3 | 역할별 이미지 압축 fixture로 해상도/재인코딩 조건 검증 |
| rendering-C23 | 전환/시각효과 라이브러리 | fade/slide/3D flip/shader transition/mask feather 등 표현 효과를 확장 기능으로 제공한다. | MoneyPrinterTurbo:MPT-049, hyperframes-engine:HFE-017, react-video-editor:RVE-060, remotion-packages:RMT-016, opencut-classic:OCC-016 | P2 표현 확장 | P2 | transition progress별 Playwright/WebGL 픽셀 스냅샷 검증 |
| rendering-C24 | 런타임 어댑터 표면 | GSAP, Anime.js, Lottie, Three, D3, Maps 등 외부 런타임을 HyperFrames 씬에서 초기화한다. | hyperframes-engine:HFE-029 | P2 어댑터 확장 | P2 | adapter별 smoke scene 렌더와 초기화 오류 검증 |
| rendering-C25 | 차트 렌더 프리미티브 | bar/pie/line 차트의 축, hatch, sweep, dots, grid 등을 데이터 영상용 렌더 primitive로 제공한다. | auto_kairos-frontend:AKF-042 | P2 데이터영상 확장 | P2 | chart fixture별 픽셀 스냅샷과 음수 축 렌더 검증 |
| rendering-C26 | 브랜드 토큰 코드 생성 | brand JSON을 렌더 런타임에서 쓰는 CSS 변수/TS 토큰으로 컴파일한다. | claude-code-video-toolkit:CVT-035 | P2 브랜드 확장 | P2 | brand fixture로 CSS 변수/타입 산출물과 누락 토큰 검증 |
| rendering-C27 | 키프레임 편집 안전/생산성 | keyframe 삭제 시 WYSIWYG 값을 보존하고 clipboard handler로 elements/keyframes 복사를 분리한다. | opencut-classic:OCC-059, opencut-classic:OCC-066 | P2 편집생산성 확장 | P4 | 삭제 전후 sampled value와 paste offset/curve patch 검증 |
| rendering-C28 | GPU 비용 추정 | provider/tool별 시간당 비용과 예상 처리 시간을 progress event로 노출한다. | claude-code-video-toolkit:CVT-029 | P2 비용가시성 확장 | P4 | provider table fixture로 cost event와 예상 시간 계산 검증 |
| rendering-C29 | 분석 모델 fallback/프레임 분석 병렬화 | Gemini fallback과 keyframe 분석 concurrency는 렌더보다 비전 분석 파이프라인 성격이 강하다. | Pilipili-AutoVideo:PLP-012, NarratoAI:NAR-072 | HOLD 분석도메인 우선 | P3 | 분석 pipeline 쪽에서 fallback 순서와 semaphore 한도 검증 |
| rendering-C30 | 범용 스튜디오 UI 위젯 | 모바일 breakpoint, overflow table, auto-hide controls는 렌더 도메인보다 편집 UI 공통 컴포넌트에 가깝다. | OpenCut:OC-028, OpenCut:OC-055, remotion-packages:RMT-033 | HOLD UI도메인 우선 | P4 | editing-ui 패키지에서 responsive/table/control DOM 검증 |
| rendering-C31 | 모노레포 앱 자동 발견 | `apps/*` 자동 발견은 렌더 기능이 아니라 저장소 운영/빌드 인프라 기능이다. | OpenCut:OC-008 | HOLD 인프라도메인 우선 | P6 | workspace query가 앱 목록을 찾는지 packaging 도메인에서 검증 |
| rendering-C32 | 최근 사용 자산 정렬 | asset timestamp 갱신과 최신순 정렬은 렌더가 아니라 자산 UX/라이브러리 기능이다. | ShortGPT:SG-060 | HOLD 자산도메인 우선 | P4 | assets 도메인에서 access timestamp와 sort order 검증 |
| rendering-C33 | Remotion 전용 렌더 진단 | props/cwd/timeout/stdout/stderr 진단은 유용하지만 HyperFrames 우선 구조에서는 legacy adapter 내부로 제한한다. | OpenMontage:OM-047 | HOLD Remotion 종속 | P3 | legacy adapter fixture에서 timeout/stderr 진단만 격리 검증 |

### 도메인 오분류 의심
PLP-012, NAR-072, OC-028, OC-055, RMT-033, OC-008, SG-060

### 이 도메인 설계 조언
1. 렌더 도메인의 중심은 “씬 매니페스트 계약 → 브라우저 렌더 → 하드게이트 → 산출물” 흐름으로 고정하고, UI 편의 기능은 studio/editing-ui로 밀어내라.
2. 진행률, 실패, 부분 재렌더, 자막 word sync는 처음부터 JSON 이벤트/manifest 필드로 계약화해야 나중에 대시보드와 CLI가 갈라지지 않는다.
3. Remotion/ffmpeg 사례는 그대로 채택하지 말고 HyperFrames adapter 패턴으로 흡수하되, 타이밍·환경·레이아웃 gate는 P0로 먼저 잠가라.