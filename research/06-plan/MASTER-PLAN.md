# MASTER-PLAN — video-factory

작성: 2026-07-07 · 상태: **v1.2** (T1 적대감사 90건 반영 — 결정 기록은 08-audit/RESOLUTION.md, 이하 [A1]식 참조)
근거: /mnt/d/video-skill-research/ 조사 25건 + 기능 매트릭스 376클러스터 + 감사 6건.

## 0. 이름 (확정)

**video-factory** · 레포 kimsh-1/video-factory (private). 위치: 코드·worktree는 **ext4**(~/video-factory) — /mnt/d(NTFS)는 산출물 미러만 [C11]. P0 통과 시 T3에서 git init+gh 생성.

## 1. 목표·포지셔닝

브리프 한 줄(또는 대본)을 받아 **세세하게 설정 가능한** 나레이션 영상(가로·세로·정사각)을 생성하고, **브라우저에 띄워 씬 단위로 수정 → 프리뷰 → 확정 재렌더**하는 독립 스킬.

- 렌더 베이스: **hyperframes 0.7.26 고정** (lockfile pin + auto-update off, Studio API는 어댑터 1파일로 격리 + 계약 스냅샷 테스트) [A4].
- 단독 동작 + deck-factory 옵셔널 플러그인(motion-manifest.json 소비/산출 — durationFrames 굽기·tokensRef 어댑터로 정합 [B4]).
- 직접 유사체 html-video는 이름만 hyperframes(실체 Playwright 녹화·비결정론) — 차별화 공백지 확정. 단 **data-hv-text·content-graph 이식은 폐기/HOLD** [A3]: 결정론 프레임캡처에서 "재렌더 없는 텍스트 편집" 전제가 불성립.

## 2. 렌더·편집 모델 (v1.2 핵심 재정의)

### 2.0 2티어 렌더 + 편집 영향 클래스 [A1][A2]

| 티어 | 산출 | 용도 |
|---|---|---|
| 프리뷰 | 씬 단독 `--composition` 렌더 (**무음·전환/BGM 없음 명시**) + Studio iframe(무음 시각 확인, 파형 오버레이) | 편집 루프의 빠른 확인 |
| 확정 | **메인 전체 재렌더 1회** — 최종품질은 이 경로만 | export/final |

편집은 3클래스로 분류, UI에 배지 표시:
- **E1 씬-로컬** (스타일·이미지 교체): 씬 재컴파일+씬 프리뷰.
- **E2 전역-시프트** (narration 수정→TTS 길이 변화): sourceHash 변경 감지→해당 씬만 재TTS→**전체 재컴파일**(전 씬 재타이밍 — 컴파일은 초 단위라 싸다)→확정은 전체 재렌더. "나레이션 편집=씬 로컬" 약속 없음.
- **E3 구조 변경** (재정렬·삽입·삭제): 전역 재컴파일 + 인접 전환 재주입.

### 2.1 L0 — 계약 (5종) [B1~B9]

1. **scene_specs.json** (저작층·진실원천): 씬 배열 + **씬간 엣지 `transitions[]{from,to,type,duration}`** [A5]. 씬 필드: sceneNumber, sceneId(안정키), narration, narration_tts, layout, mood, reveal, emphasis, headline, items[], values[], visual_kind, imageAsset{prompt,placement}(선택 결과는 image-manifest 참조 [B8]), kenBurns, subtitleMode, ost(null 예약), overrides(0~100% 좌표·byFormat·닫힌 스키마). step1(콘텐츠)→step2(비주얼) 2단계 생성, extra=forbid.
2. **audio_meta.json** (오디오 진실원천 [B1]): 씬별 audioPath, audioDurationSec, words[], **sourceHash**(narration_tts SHA256). 무효화 규칙: sourceHash 불변→투과, 변경→해당 씬만 재TTS·재whisper.
3. **design-tokens.json**: 3단 오버라이드(프리셋→프로젝트→씬). 자막 16필드·moods 7종(**mood.speed는 애니메이션 이징 전용 — 오디오 길이 불변** [B9])·폰트(.woff2 동봉 하드룰 [C7]). render-manifest 내 사본은 read-only 컴파일 스냅샷 [B5].
4. **versions.json** [B2]: 리소스별 gen_NN 인덱스 + **selected 포인터(단일 상태원천)**. scene_specs에 dirty/editLock 마커, 저장 전 자동 백업.
5. **render-manifest.json** (컴파일 산출·사람이 안 만짐): meta{resolution,fps,videoTheme,토큰 스냅샷}, scenes[]{audioPath, audioDurationSec, **durationFrames(패딩 반영 확정값 — deck-factory가 소비)**, subtitles[]{text,startSec,endSec,words[]}, vizAnimation{itemSyncPoints[]}, imagePath, kenBurns}. 포맷별 N개 파생(formatOverrides) [B7]. 타이밍은 전부 프레임 양자화 후 초 역산 [A6].

### 2.2 L2 — 컴파일러

scene_specs+audio_meta+tokens → 씬별 서브컴포지션 + 메인 index.html(마운트 필수 — unmounted는 렌더 불가 [E-P0b]).
- 컴포지션 HTML = **read-only 빌드 산출물** [A3]. 워처 제외 디렉토리에 원자 스왑 [A7].
- 전환 주입: **실제 transitions.mjs 기준 — outgoing만 연장, incoming/오디오/캡션 start 불변** (TRANSITION-REGISTRY 문서와 상충 확인됨) [A5].
- BGM 더킹: 컴파일러가 보이스 구간 기반 volume keyframe 직접 생성 (audio.mjs에 더킹 없음 확인) [A6].
- TTS 배치 래퍼: 동시성 4 제한 (audio.mjs는 무제한 Promise.all — WSL 메모리 폭주 확인) [A6].
- 자막 2모드(워드 카라오케/키워드 — **렌더 구동 최초 검증은 P2**, PoC에선 words 산출만 실증 [E-정오표 1]), 켄번즈(P2 wave-1 최우선), 씬 타입 1차 8종(bar/pie/line/list/numbered/statistic/compare/quote) registry 블록.
- **자체 render-lint 확장** (엔진 lint가 안 잡는 것 실측 확인): 렌더 함정 4종 + **씬 마운트 강제**(엔진은 template wrapper만 검사 — orphan 렌더 성공 실측) + inline script `fetch()` 금지 + `gsap.timeline({paused:true})` 강제.
- 총 프레임 공식 = 엔진과 동일한 **`Math.ceil(duration×fps)`** 로 기대값 계산(P0d ±1프레임 원인 확정 — 소스 대조로 규명).

### 2.3 L1 — 파이프라인

brief.json → script.md → scene_specs(step1→step2) → audio/*.mp3+audio_meta.json → images/*+image-manifest.json(selected 단일 소유 [B8]) → compile → render → gate-report.
- 재개: 출력 존재+게이트 리포트 동반 시 스킵, **selected 포인터 기준** [B2]. 재생성=gen_NN 증가, 삭제 금지(content-addressed immutable 디렉토리 [C12]).
- 한국어 TTS: **무료 키리스 경로가 기본** [F1~F2] — 1순위 후보 edge-tts(ko-KR+word boundary, 09-free-stack 실측 후 확정). Kokoro는 한국어 없음. 유료(HeyGen/ElevenLabs)는 어댑터 슬롯+추천 카탈로그로만(키 없으면 무료 경로로 무감 동작).

### 2.4 L3 — 스튜디오

- 백엔드 (v1.3 정정 [소스 대조 REFUTED 반영]): preview에 헤드리스/UI 억제 플래그 **없음** — 채택 경로는 **`createStudioApi(adapter)` 직접 호스팅**(1순위, 자체 서버에 필요한 라우트만 마운트) 또는 리버스 프록시 차단(2순위). 차단/허용 기준은 `10-reverify/studio-routes-whitelist.md` 전 라우트 표 — 파일쓰기 3종만으로 불충분하고 **preview 라우트조차 서버가 파일을 재작성하므로 read-only가 아님**.
- **렌더 트리거에 variables 주입 불가 확인**(0.7.26) — 렌더는 항상 "디스크 재컴파일 후 렌더" [A4]. compositions/는 SSE 워처 제외 목록에 **없음** — 빌드 산출 디렉토리 분리+명시 제외 설정 필수 [A7 강화].
- 편집 패널: 빌드리스 바닐라 JS + scene_specs JSON Schema→**자체 폼 생성기**(Studio 변수 폼은 다른 스키마용이라 재사용 불가 확인) [opus-arch #12].
- 편집 저장: dirty 확인→백업→scene_specs 패치→영향 클래스 판정→E1이면 씬 재컴파일, E2/E3면 전체 재컴파일→SSE 명시 리로드 1회.
- 동시성: 낙관적 락(버전 토큰), 렌더 중 편집은 큐잉/거부 [C10].

### 2.5 게이트 체계 (요약 — 상세는 VERIFICATION-PLAN v1.2)

- 게이트 리포트는 **supervisor gate runner CLI만 생성** — Merkle 입력해시·evidence 해시·스크립트 해시·commit·exit code 포함, fable이 독립 재해시 [C1].
- **Claude hooks는 신뢰 경계 아님**(codex는 훅 안 탐) — 필수 경로는 repo `gate` CLI+pre-commit+CI, 사전 차단은 `vf write` 래퍼 [C2].
- 결정론 게이트는 자산 동결+seed on 렌더단 한정 [C4]. 씬 재렌더 무결성은 전환 오버랩 제외 이원 판정 [C5]. OCR은 기대 텍스트 **양성 대조**(두부 검출) 포함 [C6][C7].
- opus 판정: 골든 라벨셋+IRR 앵커+scene/frame 단위 JSON [C3].

## 3. Phase 계획

- **P0 PoC — 4게이트 분할** [E]: **P0a** 환경/렌더(doctor·browser·ffmpeg·정적 5초 MP4 yuv420p+faststart) → **P0b** 서브컴포지션(마운트+단독 렌더+네거티브+본문 프레임 일치) → **P0c** 오디오/자막(한국어 실 TTS 1문장+words+CJK 임베드+OCR 양성+20라인 스트레스) → **P0d** 편집 루프(narration 수정→sourceHash→씬 재TTS→전체 재컴파일 시프트 정합+iframe+SSE 1회). **각각 독립 실패 판정, 하나라도 실패 시 해당 축 설계 회귀.** P0용 fixture·gate runner를 여기서 만들고 T3로 이관 [C14].
- **P1 계약**: 스키마 5종+검증기+**네거티브 픽스처 스위트**(규칙당 반드시 실패하는 입력) [C9]+U-3 오조작 1차.
- **P2 컴파일러**: 브리프 의존 그래프 선작성, contract→core→transitions→components→gates **웨이브 진행**(스웜은 컴포넌트 웨이브만) [C13]. 종료=오디오 비의존 L2만 [C9].
- **P3 파이프라인**: TTS/이미지/재개/버전. **실 TTS 스모크 게이트화** [C8]+U-3 2차. 종료에 L2-6/8/9 포함.
- **P4 스튜디오**: 프록시+폼 생성기+편집 루프+동시편집 E2E.
- **P5 게이트/QA**: 전 게이트+장영상 3분 메모리 게이트 [C10]+골든 회귀.
- **P6 패키징**: SKILL.md·codex 러너·멀티포맷·deck-factory 연계·교차환경 해시(로컬↔Lambda)·L4 사용테스트.

## 4. 확정 사항 (v1.2 갱신)

1. 이름 video-factory. 2. 씬 타입 8종. 3. OST v2 연기(ost null 예약). 4. 대시보드 빌드리스 바닐라 JS+**자체 폼 생성기**. 5. 지도 스킵(프리렌더 배경만). 6. MCP는 P6 이후. 7. **html-video 이식 폐기/HOLD** [A3] — 차별화 논거로만 사용. 8. deck-factory P4 개정은 P5 통과 후. 9. hyperframes **0.7.26 핀** [A4]. 10. 코드·워크트리 ext4, /mnt/d는 미러 [C11]. 11. **무료 키리스 스택 확정** [F1~F4, 실측 완료 — 09-free-stack/FREE-STACK.md 정본]: TTS=**edge-tts**(워드 타임스탬프 네이티브 실측 ✓, 폴백 로컬TTS+faster-whisper 정렬)·이미지=codex-imagegen+키리스 스톡 폴백(Openverse/Wikimedia)·BGM=번들 시드 70곡(license manifest)·SFX=hyperframes 21·폰트=Pretendard+D2Coding OFL 번들·전사=faster-whisper. 유료는 어댑터 슬롯+추천 카탈로그만(Typecast/ElevenLabs/HeyGen/FAL/Lambda), 코드 기본값에 키 요구 금지.

## 5. 실행 시퀀스 — 자동 완주 조항

> 중간 승인 없이 레포 생성까지 자동 진행. 정지 조건 2가지: (a) P0 게이트 실패로 설계 회귀, (b) fable 한도 소진(정지·계정 전환 요청). 크리덴셜 정지 조건은 무료 스택 전환으로 삭제 [F2]. codex는 아끼지 않는다.

- ~~T0.5 기능 전수 추출~~ ✅ (1,870행→376클러스터) · ~~T1 적대감사~~ ✅ (90건→RESOLUTION.md→v1.2)
- **T2 — P0 PoC**: P0a→P0b→P0c→P0d 순차, codex 구현+supervisor gate runner 판정. 장소: ext4 (~/video-factory-poc).
- **T3 — 레포 생성**: ~/video-factory git init+gh private 생성+research/ 이관+PoC fixture·gate runner 이관+`vf` CLI 골격+pre-commit+AGENTS.md.
- **T4+ — Phase 루프**: fable 브리프 분해(의존 그래프)→codex 웨이브/스웜→gate CLI→리뷰 codex 교차검증→opus 앵커 판정→게이트 리포트 재해시 후 Phase 종료. P6 종료=최종 푸시.

## 6. 워커·토큰

→ WORKERS.md (v1.2: hooks 신뢰경계 격하 반영). 배분: fable ~10% / codex ~70% / opus ~15% / sonnet ~5%.
