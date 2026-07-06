# AUDIT-RESOLUTION — T1 적대감사 90건에 대한 설계 결정

작성: 2026-07-07 · fable 판정. 감사 6건(opus-architecture/contracts/gates, codex-implementability/operability/feature-gaps) 전 결함에 대한 수용/기각 기록. v1.2 개정의 근거.

## A. 아키텍처 재정의 (opus-arch 1~6, codex-impl 1·3·5, 전부 수용)

**A1. 2티어 렌더 모델 (구 "부분 재렌더" 약속 철회·재정의)**
- 프리뷰 티어: 씬 단독 `--composition` 렌더 + Studio iframe = **무음·전환/BGM 없는 초안 등급**임을 계약에 명시. 오디오는 파형 오버레이로 근사 표시.
- 확정 티어: **최종본은 항상 메인 전체 재렌더 1회.** "부분 재렌더=최종품질" 문구 전면 삭제.
- 근거: 전환은 인접 씬+메인 타임라인 걸침, BGM은 루트 오디오, 루트 duration은 컴파일타임 고정, 헤드리스 프리뷰는 오디오 재생 불가.

**A2. 편집 영향 클래스 3종 (UI에 배지 표시)**
- E1 씬-로컬(스타일·이미지 교체·문구 중 길이 불변 확정분): 씬 재컴파일+씬 프리뷰 렌더.
- E2 전역-시프트(narration 수정→TTS 길이 변화, 씬 duration 변화): **전체 재컴파일**(전 씬 재타이밍—컴파일은 싸다)+최종은 전체 재렌더. "나레이션 편집=씬 로컬" UX 약속 철회.
- E3 구조 변경(재정렬·삽입·삭제): 전역 재컴파일 클래스, 인접 전환 재주입.

**A3. 단일 편집면·단일 방향**
- 컴포지션 HTML = **read-only 빌드 산출물** 계약. 모든 편집 = scene_specs 패치 → 재컴파일 단일 경로.
- Studio 파일쓰기 라우트(PUT /files, file-mutations, gsap-mutations)는 대시보드 프록시에서 차단(read-only 화이트리스트). preview는 헤드리스 API 모드 기동(Studio UI 편집면 차단).
- **data-hv-text 이식 폐기** (결정론 프레임캡처에서 전제 불성립). 안정키는 data-hf-id 단일. content-graph 패키지 이식도 HOLD로 강등(우리 IR=scene_specs).

**A4. hyperframes 버전 핀 + 어댑터 격리**
- 0.7.26 고정(package.json exact + lockfile + auto-update off). npx 최신 사용 금지.
- Studio API 호출은 어댑터 모듈 1파일로 격리 + 재사용 라우트 전부 계약 스냅샷 테스트(응답 스키마 골든).
- **Studio render API에 variables 주입은 허구**(0.7.26 소스 확인) — 렌더는 항상 "디스크에 data-variable-values 재컴파일 후 렌더" 경로만.

**A5. 전환 모델 수정**
- scene_specs의 씬별 transition 필드 → **엣지 객체 `transitions[]{from,to,type,duration}`**로 이동(소유자 모호 해소).
- 인젝터 알고리즘은 문서(TRANSITION-REGISTRY)가 아니라 **실제 transitions.mjs 기준**: outgoing만 연장, incoming/오디오/캡션 start 불변.

**A6. 오디오·타이밍 보강**
- BGM 더킹은 audio.mjs에 없음(확인) → **컴파일러가 보이스 구간 기반 GSAP volume keyframe 생성**.
- 모든 타이밍은 프레임 인덱스로 양자화 후 초 역산(유리수 fps 드리프트 방지). 총길이 프레임 오차 게이트 추가.
- TTS 동시성: audio.mjs가 전 라인 Promise.all(폭주 확인) → 배치 분할 래퍼로 동시성 제한(기본 4).
- 한국어: provider별 voice_id 필수 설정 + 크리덴셜 프리플라이트. **키 부재 시 명시적 중단**(무음 진행 금지) — 자동완주 정지 조건에 추가.

**A7. SSE 루프 방지**: 재컴파일 산출은 워처 제외 디렉토리에 원자 스왑, 명시적 리로드 이벤트 1회만.

## B. 계약 수정 (opus-contracts 1~15 전부 수용, 기각 0)

- B1. **audio_meta.json을 L0 승격**: words[]+audioDurationSec+sourceHash(narration_tts SHA256) 영속. 무효화 규칙: sourceHash 불변→투과, 변경→해당 씬만 재TTS·재whisper.
- B2. **versions.json = L0 4번째 스키마**: resource별 gen_NN 인덱스+selected 포인터(단일 상태원천). pipeline_state는 selected 경유 참조. scene_specs에 editLock/dirty 마커+저장 전 자동 백업.
- B3. 게이트 입력해시: 게이트별 입력집합 스키마 명시(inputSet[] 열거, 정렬 직렬화 SHA256).
- B4. render-manifest에 vizAnimation.itemSyncPoints 추가(words에서 파생), **확정 durationFrames 굽기**(deck-factory motion-manifest가 이를 소비, 재계산 금지). tokensRef는 design-tokens→deck-tokens 어댑터 경유.
- B5. meta.designTokens/subtitleConfig = 컴파일 산출 read-only 스냅샷 명시. 편집은 design-tokens.json만.
- B6. overrides: 0~100% 해상도 독립 좌표+byFormat 서브키, 닫힌 스키마(additionalProperties 금지, ost는 null 기본 명시 선언).
- B7. 멀티포맷: 포맷별 render-manifest N개 파생+formatOverrides 규칙.
- B8. 이미지 선택 진실원천 = image-manifest selected 단일(scene_specs.imageAsset은 prompt/placement만). deep-merge 규칙 명문화.
- B9. mood.speed는 이징 전용 격하(오디오 길이 불변).

## C. 게이트·운용 수정 (opus-gates + codex-operability 전부 수용)

- C1. **게이트 리포트는 supervisor gate runner CLI만 생성**(codex 직접 작성 금지). 리포트 필드: canonical input Merkle hash, evidence hash, gate script hash, git commit, command, exit code. skeptic-hook은 (i) 해시 재산출 대조 (ii) pass===true 강제 (iii) freshness(산출물보다 최신) 검증.
- C2. **Claude Code hooks는 신뢰 경계가 아님**(codex는 hook 안 탐) → 필수 경로 = repo `gate` CLI + pre-commit + CI. hooks는 fable 세션 보조 알림으로 격하. 사전 차단이 필요한 검사는 `vf write` 래퍼(검증 후 원자 쓰기).
- C3. opus 판정 캘리브레이션: 골든 라벨 스냅샷셋(합격/불합격 앵커) 고정, 매 배치 앵커 재채점+IRR 임계, 판정 입출력은 scene/frame 단위 JSON(실패 row만 재판정).
- C4. 결정론 게이트 범위 한정: 자산 동결+seedRandomFromFrame on 조건의 렌더단만. 자산 생성은 게이트 밖.
- C5. L2-2 이원화: 전환 오버랩 제외 본문 해시 불변 + 전환 프레임은 명세 재산출값 대조.
- C6. 스냅샷 오버피팅 방지: 랜덤 시드 프레임 추가+자막/OCR/HEX는 조밀 그리드 스캔. OCR은 마스크+기대 텍스트 화이트리스트 차감+**양성 대조**(기대 한글이 실제 렌더됐는지) — 폰트 두부 검출.
- C7. 폰트: .woff2 임베드 컴파일러 하드룰+글리프 커버리지 게이트+폰트 제거 환경 스모크.
- C8. 실 TTS 스모크 P3부터 게이트화. L2-9는 정답 transcript 있는 fixture 오디오로(whisper 오차 분리), whisper 모델 버전 고정.
- C9. Phase 매핑 수정: P2={오디오 비의존 L2(1,2,3,4,5,7)}, L2-6/8/9→P3. U-3 오조작을 P1·P3로 앞당김. P1에 검증기 네거티브 픽스처 스위트. P0에 L0-1/L0-5 최소형.
- C10. 신규 게이트: 3분+ 장영상 메모리(피크 RSS), 교차환경(WSL↔Lambda) 해시 P6, 동시편집 E2E(낙관적 락+렌더 중 편집 큐잉/거부).
- C11. worktree는 ext4(~/work 등)로 강제 — /mnt/d(NTFS)에서 git worktree·병렬 렌더 금지. 산출물만 /mnt/d 복사. pnpm store·브라우저 캐시 공유, worker별 temp 분리.
- C12. 에셋 삭제 방지: content-addressed immutable 디렉토리+스냅샷 diff 게이트(훅 의존 금지).
- C13. P2 브리프는 의존 그래프 선작성(owner files/inputs/outputs/blocked_by/acceptance) — contract→core→transitions→components→gates 웨이브, 웨이브 간 머지 게이트. 스웜 15는 컴포넌트 웨이브에만.
- C14. P0용 fixture·gate runner를 T2에서 먼저 만들고 T3 레포로 그대로 이관(임시 수기 판정 금지).
- C15. L0-4 한국어 TTS lint는 P1 이후 실패로 승격.
- C16. no-credential 프로파일: 필수/면제 게이트 목록 명시. 워드싱크는 정답 transcript fixture로.

## D. FEATURE-MATRIX 수정 (codex-feature-gaps 전부 수용, 1건 조정)

- D1. **P0 재판정**: PoC-P0는 25개 CID만(feature-gaps #1 목록 채택), 나머지 82개는 P1/P2/P5 강등. `Phase` 열 신설, P0-PoC 매핑 금지 조합 제거.
- D2. 켄번즈 최소형+fade/crossfade 인젝터 P0 승격(shader/3D는 P2). **정오표(2026-07-07)**: crossfade는 P0d에서 실증 완료 ✓, 켄번즈 최소형은 P0 실행에 미포함됐으므로 **P2 wave-1 골든 픽스처(L1-9)의 최우선 항목**으로 이관 — P0 재개봉 없음.
- D3. 부분 재렌더 중복 10개 CID → canonical 계약 1개(stable sceneId+composition path+asset signature) 병합, 소유자 scene-schema. 단 A1 결정에 따라 "프리뷰 등급" 명시.
- D4. `--composition` 씬 렌더 어드레싱 계약(sceneId→파일→명령→출력 해시) P0 신설. 렌더 함정 4종 lint CID 신설.
- D5. KO text physical gate 1개로 병합(폰트 번들+glyph+wrap+bbox), P0 fixture+P5 회귀 양쪽 연결.
- D6. MP4 프로필(H.264 yuv420p+AAC+faststart+ffprobe 검증) P0/P2 승격.
- D7. 고아 게이트 CID(path traversal·라이선스·ffmpeg 프리플라이트)를 VERIFICATION-PLAN 게이트 목록에 CID 기반으로 등재.
- D8. 중복 클러스터 소유자 1개 지정(나머지 consumer 강등), 오분류 의심 ID 재배정, P0에 owner 없는 CID 금지.
- D9. **조정**: feature-gaps #10의 data-hv-text/content-graph P0 추가 제안은 **기각** — A3 결정(전제 불성립·HOLD)이 우선.

## E. P0 PoC 재구성 (codex-impl 6·11, opus-arch 6 수용)

P0를 4게이트로 분할, 각각 독립 산출물·독립 실패 판정:
- **P0a 환경/렌더**: doctor --json, browser ensure, ffmpeg/ffprobe, chrome-headless-shell, WSL 공유 라이브러리 → 정적 1씬 5초 MP4(yuv420p+faststart) 관통.
- **P0b 서브컴포지션**: 씬 3개를 index.html에 마운트(data-composition-src), 씬 단독 `--composition` 프리뷰 렌더 + **unmounted scene 네거티브 테스트** + 씬 재렌더분이 전체 재렌더와 본문 프레임 일치.
- **P0c 오디오/자막**: 한국어 실 TTS 1문장(크리덴셜 프리플라이트)+word timestamps+CJK .woff2 임베드 렌더+OCR 양성 대조 + TTS 20라인 동시성 스트레스.
- **P0d 편집 루프**: 씬2 narration 수정 → sourceHash 변경 감지 → 해당 씬 재TTS → 전체 재컴파일(후속 씬 시프트) → 전환/BGM 정합 유지 검증 + Studio iframe 프리뷰 + SSE 리로드 1회 확인.
- 어느 하나라도 실패 시 해당 축 설계 회귀. 전부 통과 시에만 T3 레포 생성.

## F. 무료 스택 전환 (2026-07-07 사용자 지시 — A6 일부 개정)

- **F1. API 키 기본 경로 배제.** 모든 기능은 키리스·무료 경로가 기본(default). 유료 프로바이더(HeyGen/ElevenLabs/FAL/Pexels 등)는 **어댑터 슬롯 + 추천 카탈로그**로만 존재 — 코드에 통합 지점은 두되 키 없으면 존재감 없이 무료 경로로 동작, 사용자가 원할 때 "이 부분은 유료 X로 업그레이드 가능" 추천만.
- **F2. 한국어 TTS 기본 = 무료 키리스 후보 실측 후 선정** (1순위 후보 edge-tts: ko-KR 보이스+word boundary 타임스탬프+무키, MoneyPrinterTurbo/ShortGPT/NarratoAI 실전 검증됨). A6의 "키 부재 시 명시적 중단" 및 자동완주 정지 조건 (c) **삭제** — 무료 경로가 기본이므로 크리덴셜 정지 불필요.
- **F3. 이미지 = 기존 보유 codex-imagegen 경로** (추가 API 키 없음, 사용자 기존 인프라). BGM/SFX = 번들 CC0 라이브러리 + 로컬 생성(MusicGen 등) 실측 후 선정. 전사·정렬 = **faster-whisper**(기설치 1.2.1, 실측 채택 — 초안의 whisper.cpp 표기 정정, plan-consistency 검사 반영).
- **F4. 09-free-stack/ 조사로 기능별 [무료 기본 | 유료 추천 옵션] 2열 카탈로그 확정** — VERIFICATION-PLAN의 "실 TTS 스모크"(C8)와 P0c는 무료 기본 경로 기준으로 재정의, no-credential 프로파일(C16)이 사실상 표준 프로파일로 승격.

## A-정오표 (2026-07-07 hyperframes 소스 대조 REFUTED 9건 — 10-reverify/hyperframes-claims.md)

1. A3의 "preview 헤드리스 API 모드" 전제 기각 — 그런 플래그 없음(--no-open은 브라우저 자동열기만). 채택: **createStudioApi(adapter) 직접 호스팅**(1순위) 또는 리버스 프록시. 차단 기준은 studio-routes-whitelist.md 전 라우트 표(쓰기 3종만으론 불충분, preview 라우트도 파일 재작성함).
2. "씬 마운트 필수" 명제 기각 — 마운트 검사는 template wrapper 전용, orphan 렌더 가능. 마운트 강제는 우리 컴파일러 lint 소관.
3. compositions/는 SSE 워처 제외 아님 — 빌드 디렉토리 분리+명시 제외 필수(A7 강화).
4. 엔진 lint는 fetch() 금지·paused timeline 강제를 안 함 — 자체 render-lint 룰로 추가.
5. **P0d ±1프레임 원인 확정**: 전환 아님 — 총 프레임 = `Math.ceil(duration×fps)` 올림 규칙. 컴파일러·게이트 기대값 공식을 동일 규칙으로 통일.

## E-정오표 (2026-07-07 PoC 증거 적대감사 — 10-reverify/poc-evidence-audit.md)

P0 4게이트 판정 유지(위조 0건, 핵심 주장 전량 재실측 확인). 단 아래 5건을 T3 이관·P2에 반영:
1. **워드싱크 렌더는 아직 미검증** — P0c 자막은 스펙대로 정적 표시였고 words[]가 렌더를 구동한 적 없음. 카라오케/키워드 렌더 최초 검증 지점은 P2(L1-3)+L2-9임을 명시. "자막-음성 정렬 실증"이라는 표현 사용 금지(현재까지 실증된 것: words 산출·단조성·오디오 길이 정합).
2. P0b negative 체크가 항상-참 조건(exitCode!==null)이었음 — T3 게이트 러너 이관 시 "orphan 렌더 결과의 명시 기대값" 체크로 교체. 실측 사실(마운트 강제 없음)은 유효.
3. P0a 결정론 프리체크 기록 부실(6바이트) — 감사자 독립 재렌더로 바이트 결정론 자체는 실증됨. T3부터 게이트 리포트에 렌더 명령·2회 실행 로그 필수.
4. P0d SSE 이벤트의 인과 미증명(터치 파일이 아닌 서버 자체 재작성 유래 정황) — P4에서 오리진 태깅으로 재검증.
5. P0c의 OCR/스트레스 스크립트가 레포에 없어 재현 불가 — T3 이관 시 전 게이트 스크립트 포함 의무.

## 기각 목록

- feature-gaps #10 (data-hv-text/content-graph P0 추가) — A3와 상충, 기각.
- 그 외 기각 없음. 감사 90건 중 89건 수용.
