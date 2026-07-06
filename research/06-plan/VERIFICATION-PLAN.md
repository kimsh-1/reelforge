# VERIFICATION-PLAN v1.2 (T1 감사 반영) — 확인 과정 전체 카탈로그

작성: 2026-07-07 · 기준: MASTER-PLAN v1, `08-audit/RESOLUTION.md` C1~C16. 원칙: **모든 검증은 supervisor `vf gate` CLI가 실행하고 리포트 파일도 그 CLI만 생성한다. codex/worker의 직접 리포트 작성은 금지한다.** "돌아간다"는 말은 증거가 아니다.

> 07-features/ 기능 전수 추출 결과 중 고아 하드게이트 CID(`quality-gates-C09`, `quality-gates-C10`, `quality-gates-C11`, `rendering-C04`, `audio-tts-C11`, `misc-C14`)는 이 문서 L0/P0에 등재한다. [D7]

## L0 — 정적 검증 (매 파일 Write 시, `vf write`/pre-commit/CI가 강제)

| ID | 검사 | 도구/증거 | 실패 시 |
|---|---|---|---|
| L0-1 | `scene_specs`/`render-manifest`/`audio_meta`/`versions` JSON Schema, `additionalProperties=false` | `vf gate L0-1` + ajv/jsonschema CLI. P0에서는 `scene_specs`와 `render-manifest` 최소형부터 필수. [C2][C9] | `vf write` 반려, pre-commit/CI 실패 |
| L0-2 | 컴포지션 HTML — hyperframes lint + 함정 4종(template 운송·id 3중일치·미디어 루트직계·루트 배경) | `vf gate L0-2` + `hyperframes lint --json` + 자체 검사기. hooks는 보조 알림일 뿐 신뢰 경계가 아니다. [C2] | Write/commit/render 차단 |
| L0-3 | design-tokens — 색 HEX 유효성·자막 전경/배경 대비 4.5:1 이상 | `vf gate L0-3` + deck-tokens 대비 검증기 이식 | Write/commit 차단 |
| L0-4 | `narration_tts` 한국어 전처리 규칙(숫자·기호·단위 한글화, 의미 보존 diff) | `vf gate L0-4` + korean-tts-lint. P1 전에는 경고+리포트, **P1 이후 실패로 승격**하고 whitelist 예외만 허용. [C15] | P1 이후 Write/commit 차단 |
| L0-5 | 씬 `duration` 필드 부재 확인(오디오 권위 원칙 보호) | `vf gate L0-5`; L0-1 스키마와 별도 네거티브 fixture를 둔다. P0 최소형 필수. [C9] | Write/commit 차단 |
| L0-6 | 에셋 경로 존재·상대경로 규약(`./assets/`)·content-addressed immutable store·삭제 방지 snapshot diff | `vf gate L0-6`; pre/post asset manifest diff, selected 포인터만 변경 허용. [C12] | Write/commit/render 차단 |
| L0-7 | CJK 폰트 계약 — `.woff2` 임베드 하드룰 + 기대 텍스트 전체 글리프 커버리지 | `vf gate L0-7`; font subset/coverage 검사, 누락 glyph는 실패. `opus-gates.md` 15행 수용. [C7] | compile/render 차단 |
| L0-8 | CID 기반 경로·입력 보안: path traversal, reserved name, 외부 경로, 확장자/type/size/readability, partial file cleanup | `vf gate L0-8`; `quality-gates-C10`, `misc-C14`, `audio-tts-C22`, `pipeline-C10`, `export-integration-C04` fixture. [C12][D7] | Write/import/render 차단 |
| L0-9 | CID 기반 라이선스·provenance 하드필터: source trust, commercial/video usage, attribution, public/private vault 정책 | `vf gate L0-9`; `quality-gates-C09`, `assets-images-C17`, `scene-schema-C12`, `scene-schema-C26` fixture. [D7] | asset 선택/render/export 차단 |
| L0-10 | 렌더 도구체인 프리플라이트 스키마: doctor JSON, ffmpeg/ffprobe, browser, chrome-headless-shell, package/catalog 상태 | `vf gate L0-10`; `quality-gates-C11`, `rendering-C04`, `SG-004` fixture. P0a의 환경 게이트가 같은 계약을 사용한다. [C14][D7] | pipeline 시작 차단 |
| L0-11 | 오디오 산출 하드게이트: 무음 트랙 검출, 클리핑(피크 0dBFS 초과), 지원 codec/샘플레이트 확인 | `vf gate L0-11`; `audio-tts-C11` — RMS/피크 ffmpeg 분석, TTS 산출·최종 mux 양쪽에 적용 | asset 채택/render 차단 |

## L1 — 단위/모듈 검증 (모듈별 `vf gate <id> --json`, codex는 실행만 가능)

| ID | 대상 | 검사 | 픽스처 |
|---|---|---|---|
| L1-1 | 컴파일러 | 골든 scene_specs 3종 + 프로퍼티/퍼즈 spec → 산출 HTML이 골든과 구조 동일(DOM diff), 무작위 입력은 스키마와 안정 ID 규칙 유지 | `fixtures/golden-specs/`, generated specs |
| L1-2 | 컴파일러 전환 인젝터 | edge `transitions[]{from,to,type,duration}` 기준으로 outgoing 연장, incoming/audio/caption start 불변, duration·트랙 조합 매트릭스 검증 | 전환 registry별 matrix |
| L1-3 | 자막 빌더 | `words[]` 단조증가, `endSec <= audioDurationSec`, 카라오케/키워드 2모드 산출 | mock/fixture `audio_meta` |
| L1-4 | TTS 어댑터 | no-credential mock에서 `audio_request -> audio_meta` 계약 왕복. 실 provider 호출은 P3 실 TTS 스모크로 분리. [C8][C16] | no-credential mock |
| L1-5 | 오디오 실측 | ffprobe 길이 = manifest `audioDurationSec` ±10ms, sample rate/codec decode 가능 | 샘플 mp3/wav 3종 |
| L1-6 | 버전 관리 | 재생성 시 `gen_NN` 증가·기존 파일 불변·selected 포인터 전환 | 시나리오 테스트 |
| L1-7 | 재개(resume) | 중단 후 재실행 시 완료 스텝 스킵·미완만 실행, 실패 산출물 정리 | `pipeline_state` fixture |
| L1-8 | BGM 더킹 | 나레이션 구간 BGM 레벨 감쇠 실측(ffmpeg loudnorm/RMS 분석), 컴파일러 volume keyframe 산출 확인 | 합성 샘플 |
| L1-9 | 씬 컴포넌트 8종 | 각 블록이 variables 주입으로 데이터 바인딩·스냅샷 PNG 산출, data-hf-id 안정성 유지 | 블록별 fixture |

## L2 — 렌더 물리 검증 (`vf gate`가 프레임/오디오 증거를 생성)

| ID | 검사 | 방법 | 판정 |
|---|---|---|---|
| L2-1 | 프레임 결정론 | **자산 동결 후** 동일 canonical input을 2회 렌더하고 프레임 해시 배열 비교. `seedRandomFromFrame`은 렌더단에서만 켜며 자산 생성은 게이트 밖이다. [C4] | 스크립트 100% 일치 |
| L2-2 | 씬 단독 프리뷰/재렌더 정합 | 전환 오버랩 제외 본문 프레임 해시 불변 + 전환 프레임은 transition edge 명세로 재산출한 기대값과 대조하는 이원화 게이트. [C5] | 스크립트 |
| L2-3 | 자막 오버플로/잘림 | 초입/중간/말미만 보지 않고 조밀 그리드 + 랜덤 시드 프레임에서 자막 bbox가 safe-zone 내인지 검사. [C6] | 픽셀/DOM bbox 검사 |
| L2-4 | 원치 않는 텍스트·기대 텍스트 OCR | 생성 이미지 영역 마스크 후 기대 텍스트 whitelist 차감, 잔여 OCR 0건. 동시에 기대 headline/자막 한글이 실제 검출되는 양성 대조로 두부(tofu)를 잡는다. [C6][C7] | OCR+마스크 스크립트 |
| L2-5 | 배경 HEX 정합 | 이미지·씬 배경 픽셀을 조밀 그리드와 랜덤 시드 프레임에서 샘플링해 tokens HEX와 비교. [C6] | 픽셀 검사 |
| L2-6 | 오디오-비디오 총길이 | 컨테이너 duration = Σ(확정 씬 오디오 프레임)+전환 보정 ±1프레임. P3부터 실 audio_meta도 재통과. [C8][C9] | ffprobe 스크립트 |
| L2-7 | 모션 어서션 | `*.motion.json` 사이드카 4종(엔트런스 타이밍·최종 상태·가시성·금지 CSS animation)을 검증 | hyperframes 검증기 |
| L2-8 | 시각 품질 판정 | 골든 라벨 앵커셋(합격/불합격)을 매 배치 재채점하고 IRR 임계 미달 시 판정 무효. 입력/출력은 scene/frame 단위 JSON이며 실패 row만 재판정 가능. 랜덤 시드 프레임 포함. [C3][C6] | LLM 판정은 스크립트 불가 영역만 |
| L2-9 | 워드싱크 정확도 | 정답 transcript가 있는 fixture audio로 카라오케 하이라이트 프레임과 word timestamp를 비교해 whisper 오차를 분리. whisper 모델 버전은 고정한다. [C8][C16] | 스크립트, 허용오차 ≤100ms |

## L3 — E2E 시나리오 (`tests/scenarios/*.md`, supervisor가 시나리오 단위 실행)

| ID | 시나리오 | 통과 기준 |
|---|---|---|
| L3-1 | 브리프 1줄 → 60초 본편 완주(no-credential mock 경로) | no-credential 필수 게이트 통과 + final/ 산출. 워드싱크는 정답 transcript fixture 사용. [C16] |
| L3-2 | **실 TTS 스모크(P3 게이트)**: **무료 기본 TTS**(09-free-stack 실측 선정, 후보 edge-tts ko-KR)로 실제 1~3문장 생성 [F2] | 실제 `audio_meta`(워드 타임스탬프), L2-6/L2-9 재통과. 유료 어댑터(HeyGen/ElevenLabs)는 키 존재 시에만 옵션 검증 — 기본 경로 게이트 아님. [C8][F1] |
| L3-3 | 편집 루프(E1): 스튜디오에서 씬 2 headline 수정 → 저장 → 씬 2만 재컴파일·씬 프리뷰 렌더 → 프리뷰 갱신 | L2-2 + SSE 리로드 1회 |
| L3-4 | 편집 루프(E2): 씬 3 narration 수정 → TTS 재생성 → duration 변화 → 전체 재컴파일·최종 전체 재렌더 | L1-3·L2-6 재통과 |
| L3-5 | 이미지 재롤: 씬 1 이미지 재생성 → `gen_02` 버전 증가·selected 전환·기존 보존 | L1-6 + L0-6 snapshot diff |
| L3-6 | 중단-재개: 파이프라인 kill → 재실행 → 완료분 스킵 완주 | L1-7 + 최종 산출 동일성(L2-1) |
| L3-7 | 멀티포맷: 동일 specs → 16:9 + 9:16 + 1:1 3종 렌더 | 각 해상도 L2 통과 |
| L3-8 | deck-factory 연계: `motion-manifest.json` 산출 → deck-factory 스키마 검증 통과 | deck-contracts 검증기 |
| L3-9 | 스키마 위반 입력 방어: 필드 오타·잘못된 enum·duration 필드 주입 → 명확한 반려 | L0 반려 메시지 검사 |
| L3-10 | 대량: 씬 20개 브리프 → codex 병렬 생산 경로 완주(동시성 4~6) | 완주 + supervisor 게이트 리포트 |
| L3-11 | **동시편집 E2E(P4)**: 두 편집자가 같은 scene_specs를 패치하고 렌더 중 편집을 시도 | 낙관적 락 버전 토큰, lost update 방지, 렌더 중 편집 큐잉/거부 계약 검증. [C10] |
| L3-12 | **장영상 메모리(P5)**: 3분+·고해상도·20씬 이상 최종 렌더 | 완주, peak RSS 리포트, OOM/timeout 없음. [C10] |
| L3-13 | **교차환경 해시(P6)**: WSL 로컬과 Lambda 렌더 비교 | 자산·seed·폰트·타임존 고정 후 canonical frame/body hash 일치. [C10] |

## L4 — 사용 테스트 (codex가 "사용자 역할"로 수행, Phase 4·6에서)

- U-1: 스킬 문서만 보고 codex가 처음부터 영상 1편 제작(문서 완결성 검증 — 막히는 지점이 곧 문서 결함).
- U-2: 스튜디오를 codex가 API로 조작(폼 필드 전수 순회 — 각 설정 노브 변경→프리뷰 반영 확인).
- U-3: 고의 오조작 20종(빈 narration, 초장문, 이모지, 특수문자 씬 제목, 0바이트 이미지 등). P1에서는 계약/검증기 1차, P3에서는 파이프라인 2차로 앞당겨 실행한다. [C9]
- U-4: 실사용 시나리오 5종(뉴스 해설/제품 소개/교육/발표 보조/쇼츠) 각 1편 — L2-8 앵커 캘리브레이션 통과 후 상업 벤치마크 대비 4/5 이상. [C3]

## 운영 규칙

1. **게이트 리포트 계약**: 리포트는 supervisor `vf gate <gate-id> --profile <profile> --json`만 생성한다. codex/worker가 `reports/` 아래 JSON을 직접 쓰는 행위는 무효다. 필수 필드: `gate`, `profile`, `inputSet[]`, `canonicalInputMerkleHash`, `evidenceHash`, `gateScriptHash`, `gitCommit`, `command`, `exitCode`, `pass`, `startedAt`, `finishedAt`, `evidence[]`. [C1]
2. **skeptic-hook 정의**: 완료 선언 전 (i) 현재 입력에서 canonical Merkle hash 재산출·리포트 값 대조, (ii) evidence 파일 존재와 evidence hash 대조, (iii) gate script hash/git commit 대조, (iv) `pass === true`, (v) 리포트가 대상 산출물보다 최신인 freshness를 모두 검증한다. 하나라도 실패하면 stale/forged report로 차단한다. [C1]
3. **신뢰 경계**: Claude Code hooks는 보조 알림이다. 필수 경로는 repo-local `vf gate`, `vf write`, pre-commit, CI다. 사전 차단이 필요한 쓰기는 `vf write`가 검증 후 원자 스왑하고, 실패 파일은 디스크에 남기지 않는다. [C2]
4. **회귀와 샘플링**: 골든셋(specs+렌더 해시+라벨 앵커)은 매 변경마다 재실행한다. L0·L1은 상시, 오디오 비의존 L2는 PR 단위, L2-6/8/9와 L3는 Phase 게이트다. 스냅샷은 고정 3프레임에 랜덤 시드 프레임과 조밀 그리드를 추가한다. [C3][C6]
5. **LLM 판정 배치화**: L2-8·U-4는 scene/frame 단위 JSON으로 배치하고, 골든 앵커 재채점의 IRR 임계를 먼저 통과해야 한다. 실패 row만 재판정한다. [C3]
6. **P0 PoC 축 게이트**: P0 fixture와 gate runner는 T2에서 먼저 만들고 T3 레포로 그대로 이관한다. 임시 수기 판정은 금지한다. `codex-operability.md` 15행 수용. [C14]

| ID | 내용 | 필수 증거 |
|---|---|---|
| P0a | 환경/렌더: `doctor --json`, browser ensure, ffmpeg/ffprobe, chrome-headless-shell, WSL 공유 라이브러리 → 정적 1씬 5초 MP4 관통 (키리스 — 크리덴셜 검사 없음 [F2]) | yuv420p, H.264/AAC, faststart, exit code, toolchain JSON. [C14][D7] |
| P0b | 서브컴포지션: 씬 3개를 index.html에 마운트, 씬 단독 `--composition` 프리뷰 렌더, **unmounted scene 네거티브**, 씬 재렌더분과 전체 재렌더 본문 프레임 일치 | L2-2 body/transition 증거, 네거티브 실패 리포트. [C5][C14] |
| P0c | 오디오/자막: 한국어 실 TTS 1문장(**무료 기본 edge-tts, 키리스** [F2]), word timestamps, CJK `.woff2` 임베드 렌더, **시스템 폰트 제거 환경 스모크**, OCR 양성 대조, **TTS 20라인 동시성 스트레스** | audio_meta(words 단조), font/OCR 증거, concurrency 리포트. [C6][C7][C8][C14] |
| P0d | 편집 루프: 씬2 narration 수정 → sourceHash 변경 감지 → 해당 씬 재TTS → 전체 재컴파일(후속 씬 시프트) → 전환/BGM 정합 유지 + Studio iframe 프리뷰 + SSE 리로드 1회 | sourceHash diff, recompile/render report, SSE event log. [C9][C14] |

7. **Phase 종료 조건 매핑**: P0={P0a~P0d 4게이트, L0-1/L0-5 최소형 포함} · P1={L0 전체+네거티브 픽스처 스위트+U-3 1차} · P2={오디오 비의존 L2(1,2,3,4,5,7)+L1-1/2/9} · P3={L1-3~8+L2-6/8/9+실TTS 스모크+U-3 2차+L3-1/5/6} · P4={L3-3/4+동시편집+U-2} · P5={L3 전체+장영상} · P6={L4+L3-7/8+교차환경}. [C9][C10]
8. **프로파일 재정의 [F1~F4]**: 무료 키리스 스택이 **표준 프로파일**이다 — L0 전체, P0a~P0d, L1 전체, L2 전체(L2-8은 로컬 판정 워커), L3-1/2/3~6/9(L3-2는 무료 기본 TTS로 실행), U-3까지 키 없이 완주 가능해야 한다. 워드싱크의 whisper 오차 분리는 정답 transcript fixture로. **paid-adapter 프로파일**(옵션): 유료 키 존재 시에만 해당 어댑터 계약 왕복+품질 비교 리포트(추천 카탈로그 근거 생성) — 기본 게이트에 포함 금지. 오프라인 CI 한정 면제: 네트워크 자체가 없는 환경에서는 무료 네트워크 TTS(edge-tts류)도 fixture로 대체하고 면제를 리포트에 명시. [C16]
9. **실 TTS 스모크(P3 blocking)는 무료 기본 TTS로 실행한다** [F2] — edge-tts 실합성+audio_meta 실측이 대상이며 API 키를 요구하지 않는다. 네트워크 차단/403 시 로컬 폴백(MeloTTS-Korean+faster-whisper 정렬)으로 동일 게이트를 통과해야 한다(폴백 경로도 blocking). 유료 어댑터 검증은 paid-adapter 프로파일(규칙 8)에서만. faster-whisper 모델 버전 고정을 리포트에 남긴다. [C8]
10. **worktree 운영**: repo/worktree는 ext4(`~/work` 등)에 둔다. `/mnt/d` NTFS에서 git worktree·병렬 렌더를 금지하고 산출물만 복사한다. pnpm store와 browser cache는 공유하되 worker별 temp/output/profile dir는 분리한다. [C11]
11. **P2 브리프 의존 그래프**: P2 작업 전 `briefs/P2-*.md`에 owner files, inputs, outputs, blocked_by, acceptance gate를 선작성한다. 진행 wave는 contract → compiler core → transition registry → components → render gates 순서이며 wave 간 merge gate를 둔다. 스웜 15는 컴포넌트 wave에만 허용한다. [C13]
12. **에셋 삭제 방지**: 에셋은 content-addressed immutable 디렉터리에 저장하고 삭제는 직접 허용하지 않는다. selected 포인터 변경만 허용하며, pre/post snapshot diff gate로 훅 우회를 잡는다. [C12]
