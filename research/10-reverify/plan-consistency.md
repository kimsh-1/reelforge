# plan-consistency — video-factory 계획 문서 4+1종 상호 정합 전수 검사

검사일: 2026-07-07 · 검사자: fable 서브에이전트 (fresh-context)
대상: 06-plan/MASTER-PLAN.md(v1.2, 95행) · 06-plan/WORKERS.md(68행) · 06-plan/VERIFICATION-PLAN.md(v1.2, 96행) · 08-audit/RESOLUTION.md(101행) · 09-free-stack/FREE-STACK.md(36행)

**총계: 불일치 19건 — 치명 3 · 중대 6 · 경미 10.**
핵심 패턴: **무료 스택 전환(F)이 MASTER에는 반영됐으나 VERIFICATION-PLAN의 P0a/P0c/운영규칙 9에 유료 크리덴셜 전제가 3곳 잔존** — VERIFICATION 내부 자기모순 상태.

---

## 1. 치명 (CRITICAL) — 게이트 실행 시 즉시 충돌

### X1. VERIFICATION P0c "credential profile에서" — 규칙 8(키리스 표준)과 자기모순
- 위치: VERIFICATION-PLAN.md:88 — `P0c | 오디오/자막: 한국어 실 TTS 1문장(credential profile에서), ...`
- 충돌: 같은 문서 규칙 8(:92) "**P0a~P0d ... 키 없이 완주 가능해야 한다**" + RESOLUTION F4 "P0c는 무료 기본 경로 기준으로 재정의" + MASTER §3 P0c(크리덴셜 언급 없음).
- 심각도: **치명** — P0c 게이트 러너가 어느 프로파일로 돌아야 하는지 문서가 서로 반대를 지시. P0 통과 판정 자체가 갈림.
- 수정문안: `한국어 실 TTS 1문장(표준 프로파일 — edge-tts 무료 기본, 403/차단 시 로컬 TTS+faster-whisper 폴백 [F2][F4])`

### X2. VERIFICATION 운영규칙 9 "실 credential 프로파일 = P3 blocking gate" — F 전환 전 유물
- 위치: VERIFICATION-PLAN.md:93 — `**실 credential 프로파일**: P3부터 실 TTS 스모크가 blocking gate다. provider별 voice_id, API key, 잔여 credit, rate limit ... 키 부재 시 무음 진행 없이 명시 실패한다. [C8]`
- 충돌: (a) 규칙 8(:92) — paid-adapter 프로파일은 "키 존재 시에만 ... **기본 게이트에 포함 금지**". (b) L3-2(:55) — 실 TTS 스모크는 **무료 기본 TTS**로 실행, 유료는 옵션. (c) RESOLUTION F2 — A6의 "키 부재 시 명시적 중단" **삭제**. 규칙 9는 삭제된 A6 원문을 그대로 유지 중이며, "실 credential 프로파일"이라는 규칙 8에 없는 제3의 프로파일명을 만들어 blocking으로 승격시킴.
- 심각도: **치명** — 이대로면 P3 종료가 API 키 없이는 불가능해져 F1~F4 전체가 무효화됨.
- 수정문안: 규칙 9 전체를 다음으로 교체 — `**paid-adapter 프로파일 상세**(규칙 8의 옵션 프로파일 보충): 유료 키 존재 시에만 실행. provider별 voice_id, 잔여 credit, rate limit, 모델/whisper 버전 고정을 리포트에 남긴다. blocking 아님 — 실 TTS 스모크(L3-2)의 blocking 경로는 무료 기본 TTS다. [C8][F1][F2]`

### X3. VERIFICATION P0a에 "크리덴셜 상태 프리플라이트" 잔존
- 위치: VERIFICATION-PLAN.md:86 — `P0a | 환경/렌더: doctor --json, browser ensure, ffmpeg/ffprobe, chrome-headless-shell, WSL 공유 라이브러리, 크리덴셜 상태 프리플라이트 → ...`
- 충돌: RESOLUTION E P0a(:85)와 MASTER §3 P0a(:72) 모두 크리덴셜 프리플라이트 없음. F2가 크리덴셜 정지 조건 자체를 삭제. P0a 정의가 세 문서 중 VERIFICATION만 다름 (임무 검사항목 2의 P0a 삼중 대조 실패 지점).
- 심각도: **치명(경계)** — P0a에 키 검사가 들어가면 키리스 환경에서 첫 게이트부터 실패하거나, "무엇을 검사하는 게이트인가"가 문서마다 다른 상태.
- 수정문안: "크리덴셜 상태 프리플라이트" 삭제. 유료 어댑터 키 감지가 필요하면 `(옵션) paid-adapter 키 존재 여부 보고 — 부재는 실패 아님`으로 별도 표기.

---

## 2. 중대 (MAJOR) — 반영 누락·정의 불일치

### X4. 전사 엔진: RESOLUTION F3 "whisper.cpp" vs MASTER·FREE-STACK "faster-whisper"
- 위치: RESOLUTION.md:95 `전사 = whisper.cpp(이미 로컬)` ↔ MASTER-PLAN.md:82 `전사=faster-whisper` ↔ FREE-STACK.md:10 `faster-whisper 1.2.1 (기설치, ... 실측 ✓)`
- 판정: FREE-STACK이 정본(실측 완료)이므로 faster-whisper가 확정. RESOLUTION F3은 실측 전 후보 기록으로 남았으나 개정 표시 없음.
- 수정문안: RESOLUTION F3에 `→ 실측 후 faster-whisper 1.2.1 확정(FREE-STACK 정본)` 각주 추가.

### X5. 고아 CID `audio-tts-C11` 등재 약속 미이행 [D7 위반]
- 위치: VERIFICATION-PLAN.md:5 헤더가 등재를 약속한 6개 CID 중 `audio-tts-C11`이 L0/P0 어느 행에도 없음. L0-8(:18)의 `audio-tts-C22`는 별개 CID(경로 보안)로 올바른 배정 — C11 대체가 아님.
- 근거: FEATURE-MATRIX.md:174 — audio-tts-C11 = 미디어·스크립트·오디오 하드게이트(duplicate audio, missing asset, black/silent/clipping, codec, 출력명). codex-feature-gaps #8이 지목한 바로 그 고아 게이트가 여전히 고아.
- 수정문안: L0에 신규 행 추가 — `L0-11 | 미디어 하드게이트: 오디오 probe(무음/클리핑/중복/codec), 출력명 검증 | vf gate L0-11; audio-tts-C11 fixture. [D7] | render/publish 차단` (또는 L1-5 오디오 실측 행에 audio-tts-C11 fixture 명시 흡수).

### X6. B9(mood.speed 이징 전용 격하) — 어느 문서에도 미반영
- 위치: RESOLUTION.md:49 `B9. mood.speed는 이징 전용 격하(오디오 길이 불변)` — MASTER §2.1/§2.2, VERIFICATION L0/L1 전체에서 `mood.speed` 언급 0건 (grep 확인).
- 심각도: 중대 — "오디오 길이 불변" 불변식이 계약·게이트 어디에도 안 걸려 있어, 구현자가 speed로 오디오를 늘리면 잡을 게이트가 없음.
- 수정문안: MASTER §2.1-3(design-tokens) 또는 §2.1-1에 `mood.speed=이징 전용(오디오 길이 불변) [B9]` 추가 + VERIFICATION L1-3 또는 L2-6 검사 조건에 "mood.speed 변경이 audioDurationSec에 영향 없음" 명시.

### X7. D2(켄번즈 최소형 + fade/crossfade 인젝터 P0 승격) — P0a~P0d 정의에 부재
- 위치: RESOLUTION.md:74 `D2. 켄번즈 최소형+fade/crossfade 인젝터 P0 승격` ↔ MASTER §3 P0(:72), RESOLUTION E(:84~89), VERIFICATION P0 표(:85~89) 세 곳 모두 켄번즈·전환 인젝터 언급 없음 (P0d의 "전환/BGM 정합 유지"는 편집 후 정합 검증이지 인젝터 최소 구현 승격이 아님).
- 수정문안: P0b에 `+ fade/crossfade 인젝터 최소형·켄번즈 최소형 1씬 [D2]` 추가하거나, D2를 "P0 승격 철회→P2"로 명시 개정.

### X8. E1 정의 불일치 → L3-3 시나리오와 어긋남
- 위치: MASTER-PLAN.md:28 `E1 씬-로컬 (스타일·이미지 교체)` ↔ RESOLUTION.md:13 `E1 씬-로컬(스타일·이미지 교체·**문구 중 길이 불변 확정분**)` ↔ VERIFICATION L3-3(:56) "씬 2 **headline 수정** → 씬 2만 재컴파일"(= E1 취급).
- 판정: MASTER가 RESOLUTION의 "길이 불변 문구" 항을 누락 → MASTER 정의대로면 headline 수정은 E1이 아니어서 L3-3 시나리오가 근거를 잃음.
- 수정문안: MASTER E1을 `(스타일·이미지 교체·길이 불변 문구 — headline 등)`로 보정.

### X9. Phase 종료 조건이 양 문서에서 불일치 (P2·P3·P4)
- 위치: MASTER-PLAN.md:74 `P2 ... 종료=오디오 비의존 L2만 [C9]` ↔ VERIFICATION 규칙 7(:91) `P2={오디오 비의존 L2(1,2,3,4,5,7)+**L1-1/2/9**}`. MASTER:75 P3에 L1-3~8·L3-1/5/6 없음(규칙 7엔 있음). MASTER:76 P4에 U-2 없음(규칙 7엔 있음).
- 판정: MASTER "종료=...만"이라는 배타 표현이 규칙 7의 상위집합과 직접 충돌 (P3·P4는 요약 수준 누락).
- 수정문안: MASTER §3의 종료 조건을 `종료 조건은 VERIFICATION 규칙 7이 정본 — P2={오디오 비의존 L2(1~5,7)+L1-1/2/9}` 식으로 참조 위임하거나 목록을 일치시킴.

---

## 3. 경미 (MINOR) — 표기 부패·요약 누락

### X10. VERIFICATION 헤더 "기준: MASTER-PLAN v1"
- 위치: VERIFICATION-PLAN.md:3 — 자신은 v1.2인데 기준 문서를 v1로 지목. → `기준: MASTER-PLAN v1.2`로 수정.

### X11. edge-tts 확정 상태 표기 혼재 (MASTER 내부 + L3-2)
- 위치: MASTER-PLAN.md:53 `1순위 **후보** edge-tts(..., 09-free-stack 실측 후 확정)` 및 VERIFICATION-PLAN.md:55 `(09-free-stack 실측 선정, **후보** edge-tts ko-KR)` ↔ MASTER:82 확정 11 `TTS=edge-tts(... 실측 ✓)` + FREE-STACK(실측 완료 확정표).
- 판정: 실측이 끝나 확정됐는데 §2.3과 L3-2는 아직 "후보/실측 후 확정" 시제. → 두 곳 모두 `edge-tts 확정(FREE-STACK 정본)`으로 갱신.

### X12. 조사 건수 25 vs 19
- 위치: MASTER-PLAN.md:4 `조사 25건` ↔ WORKERS.md:49 `본 조사 19건도 구현 시점에 재검증`. 하나로 통일 필요(후속 조사 증가분이면 WORKERS를 25로).

### X13. MASTER P0d에 "전환/BGM 정합 유지" 누락
- 위치: MASTER-PLAN.md:72 P0d ↔ RESOLUTION E(:88)·VERIFICATION P0d(:89)는 포함. MASTER P0d에 `+전환/BGM 정합 유지` 추가.

### X14. 게이트 리포트 필수 필드 요약에서 `profile`·`pass` 누락
- 위치: WORKERS.md:38, MASTER-PLAN.md:65 — `Merkle 입력해시·evidence 해시·스크립트 해시·commit·exit code`만 나열 ↔ VERIFICATION 규칙 1(:77)의 13필드(특히 F 이후 중요해진 `profile`, 그리고 skeptic-hook이 강제하는 `pass`).
- 수정문안: 두 요약에 `·profile·pass` 추가 (요약임을 감안해도 이 둘은 신뢰 경계 핵심 필드).

### X15. WORKERS 대원칙의 "hooks…으로 사용량 최적화" 구 서술 잔존
- 위치: WORKERS.md:4 `hooks·스웜으로 사용량 최적화` — §4(:32~) "hooks는 신뢰 경계가 아니다"와 뉘앙스 충돌. 사용자 지시 인용이므로 삭제 대신 `(hooks는 fable 보조 알림 한정 — §4)` 괄호 주석 권장.

### X16. design-tokens JSON Schema가 L0-1 대상에서 빠짐
- 위치: VERIFICATION-PLAN.md:11 L0-1은 4스키마(scene_specs/render-manifest/audio_meta/versions)만 검증 ↔ MASTER §2.1 "계약 5종". L0-3(:13)은 HEX·대비만 검사, design-tokens의 구조 스키마(additionalProperties=false) 게이트 부재.
- 수정문안: L0-1 대상에 `design-tokens` 추가 또는 L0-3에 스키마 검증 명시.

### X17. RESOLUTION E P0c "(크리덴셜 프리플라이트)" — 같은 문서 F4와 상충, 개정 표시 없음
- 위치: RESOLUTION.md:87 ↔ RESOLUTION.md:96 F4 "P0c는 무료 기본 경로 기준으로 재정의". 결정 로그 특성상 원문 유지가 원칙이면 E-P0c에 `(→ F4로 개정)` 인라인 마커 추가.

### X18. RESOLUTION A6 "키 부재 시 명시적 중단" — F2 삭제 반영 마커 없음
- 위치: RESOLUTION.md:35 ↔ RESOLUTION.md:94 F2 "삭제". X17과 동일 처리: A6 해당 문장에 `(→ F2로 삭제)` 마커.

### X19. D4 `--composition` 어드레싱 계약(sceneId→파일→명령→출력 해시) P0 명세 부재
- 위치: RESOLUTION.md:75 D4 "P0 신설" ↔ VERIFICATION P0b(:87)는 "씬 단독 --composition 프리뷰 렌더"만 언급, 어드레싱 4단 계약은 미기재. P0b 증거 열에 `sceneId→composition path→명령→출력 해시 어드레싱 계약 [D4]` 추가 권장.

---

## 4. 전수 대조 체크리스트 (RESOLUTION → 문서 반영)

| 항목 | 반영처 | 판정 |
|---|---|---|
| A1 2티어 렌더 | MASTER §2.0 | ✅ |
| A2 편집 3클래스 | MASTER §2.0 | ⚠️ E1 문구항 누락 (X8) |
| A3 단일 편집면·data-hv-text 폐기 | MASTER §1·§2.2·§2.4·확정7 | ✅ |
| A4 0.7.26 핀·variables 허구 | MASTER §1·§2.4·확정9 | ✅ |
| A5 전환 엣지 객체 | MASTER §2.1-1·§2.2, VERIF L1-2 | ✅ |
| A6 더킹·양자화·동시성4 | MASTER §2.1-5·§2.2, WORKERS §3 | ✅ (중단 조항은 F2 삭제 — X18 마커만) |
| A7 SSE 원자 스왑 | MASTER §2.2 | ✅ |
| B1 audio_meta L0 | MASTER §2.1-2, VERIF L0-1 | ✅ |
| B2 versions.json | MASTER §2.1-4, VERIF L1-6 | ✅ |
| B3 inputSet 해시 스키마 | VERIF 규칙1 | ✅ |
| B4 itemSyncPoints·durationFrames·tokensRef | MASTER §1·§2.1-5 | ✅ |
| B5 read-only 스냅샷 | MASTER §2.1-3 | ✅ |
| B6 overrides 닫힌 스키마 | MASTER §2.1-1 | ✅ |
| B7 멀티포맷 파생 | MASTER §2.1-5, VERIF L3-7 | ✅ |
| B8 image-manifest selected | MASTER §2.1-1·§2.3 | ✅ |
| B9 mood.speed 이징 격하 | — | ❌ 미반영 (X6) |
| C1 게이트 리포트 provenance | MASTER §2.5, WORKERS §4, VERIF 규칙1·2 | ✅ (요약 필드 누락 X14) |
| C2 hooks 격하·vf write | MASTER §2.5, WORKERS §4, VERIF 규칙3·L0-2 | ✅ (X15 잔재) |
| C3 opus IRR 앵커 | MASTER §2.5, VERIF L2-8·규칙4·5·U-4 | ✅ |
| C4 결정론 범위 한정 | MASTER §2.5, VERIF L2-1 | ✅ |
| C5 L2-2 이원화 | MASTER §2.5, VERIF L2-2·P0b | ✅ |
| C6 오버피팅 방지·OCR 양성 | VERIF L2-3/4/5·규칙4 | ✅ |
| C7 폰트 3종 게이트 | MASTER §2.1-3, VERIF L0-7·P0c | ✅ |
| C8 실 TTS 스모크 | MASTER §3 P3, VERIF L3-2 | ⚠️ 규칙 9가 F 미반영 (X2) |
| C9 Phase 매핑 수정 | MASTER §3, VERIF 규칙7·U-3 | ⚠️ P2 목록 불일치 (X9) |
| C10 장영상·교차환경·동시편집 | MASTER §3, VERIF L3-11/12/13 | ✅ |
| C11 ext4 강제 | MASTER §0·확정10, WORKERS §3, VERIF 규칙10 | ✅ |
| C12 에셋 immutable | MASTER §2.3, VERIF L0-6/8·규칙12 | ✅ |
| C13 P2 의존 그래프·웨이브 | MASTER §3 P2, WORKERS §3, VERIF 규칙11 | ✅ |
| C14 P0 fixture T2→T3 이관 | MASTER §3·§5, VERIF 규칙6 | ✅ |
| C15 L0-4 P1 승격 | VERIF L0-4 | ✅ |
| C16 no-credential 프로파일 | VERIF 규칙8·L1-4·L2-9·L3-1 | ✅ (F4로 표준 승격 반영) |
| D1 P0 25 CID 재판정 | FEATURE-MATRIX 소관 (본 검사 범위 외) | — |
| D2 켄번즈·fade P0 승격 | — | ❌ P0 정의 미반영 (X7) |
| D3 부분 재렌더 canonical 병합 | MASTER A1 반영으로 간접 | ✅ |
| D4 --composition 어드레싱 P0 | VERIF P0b | ⚠️ 계약 4단 미명시 (X19) |
| D5 KO text 물리 게이트 병합 | VERIF P0c·L0-7 | ✅ |
| D6 MP4 프로필 P0 | VERIF P0a (yuv420p·faststart) | ✅ |
| D7 고아 CID 등재 | VERIF 헤더·L0-8/9/10 | ⚠️ audio-tts-C11 누락 (X5) |
| D8 소유자 단일화 | FEATURE-MATRIX 소관 (범위 외) | — |
| D9 feature-gaps#10 기각 | MASTER §1·확정7, RESOLUTION 기각목록 | ✅ |
| E P0 4분할 | MASTER §3, VERIF P0 표 | ⚠️ P0a/P0c 크리덴셜 잔존 (X1·X3), P0d MASTER 누락 (X13) |
| F1 키리스 기본 | MASTER 확정11, FREE-STACK, VERIF 규칙8 | ✅ |
| F2 크리덴셜 중단 삭제 | MASTER §2.3·§5 | ❌ VERIF 규칙9 미반영 (X2) |
| F3 이미지·BGM·전사 | MASTER 확정11, FREE-STACK | ⚠️ whisper.cpp↔faster-whisper (X4) |
| F4 P0c·프로파일 재정의 | VERIF 규칙8 ✅ / P0c 본문 ❌ | ⚠️ (X1) |

## 5. 검사항목 4·5 판정 (불일치 외 확인 결과)

- **WORKERS vf CLI ↔ VERIFICATION 운영규칙**: `vf write`(검증 후 원자 쓰기, 실패 파일 미잔존)·`vf gate`(유일 생성자)·skeptic-hook(재해시+pass+freshness ⊂ 규칙 2의 5단계) — 구조 일치. 필드 요약 누락만 X14.
- **FREE-STACK ↔ VERIFICATION 프로파일**: 표준(키리스)·paid-adapter·오프라인 CI 면제 3구조 일치. FREE-STACK:35 "paid-adapter 프로파일로 별도 검증" = 규칙 8과 동일 명명 ✅. 유일한 파괴 요소는 규칙 9의 제3 프로파일명 (X2).
- **"부분 재렌더" 옛 약속 잔존**: MASTER·WORKERS·VERIFICATION 본문에서 잔존 0건 — A1 철회가 깨끗하게 반영됨.
- **HeyGen 기본 잔존**: 0건 — 모든 언급이 "어댑터 슬롯/추천/키 존재 시" 한정으로 일관.
