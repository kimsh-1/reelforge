# video-skill-research — 읽기 순서 인덱스

새 독립 영상 스킬(hyperframes 베이스, auto_kairos 개념 이식) 설계를 위한 조사 자료.
총 19개 소스(레포 16 + 생태계 스윕 3) 해부. 각 문서는 파일경로:라인 근거 포함, 확인된 사실만 수록.

## 읽기 순서 (토론 에이전트용)

1. **`04-context/goal-and-constraints.md`** ← 반드시 먼저. 목표·확정 방향·미결정 7항.
2. **`05-hyperframes-base/`** ← 우리 베이스 스택.
   - `skill-pack.md` — 스킬팩 9종 계약 (컴포지션·미디어·애니메이션·registry·CLI)
   - `engine-internals.md` — 엔진 내부 (렌더 파이프라인·프리뷰 서버·부분 렌더·대시보드 통합 지점)
3. **`01-auto-kairos/`** ← 개념 원본 (semoji-ai/auto_kairos, 4개 축).
   - `config-schema.md` — 설정 5계층 (env→DB config→아트스타일 프리셋→씬 매니페스트→보이스). "세세 설정"의 레퍼런스 스키마
   - `dashboard-edit-loop.md` — "띄워서 수정"의 3분리 구조 (무렌더 WYSIWYG 프리뷰 / 계약 JSON 패치 / 씬 단위 무거운 재생성)
   - `pipeline-skills.md` — 34 에이전트 스킬 + 파이프라인 스텝 계약 + 재시도/재개/게이트
   - `remotion-contract.md` — 렌더러가 소비하는 매니페스트 스키마 전체 + 포팅 체크리스트 10항
4. **`02-similar-projects/`** ← 경쟁/유사 프로젝트 11종.
   - `moneyprinterturbo.md` (96k★) — stop_at 부분 파이프라인, combined/final 2단계 렌더, 자막 정밀 툴킷
   - `openmontage.md` (34k★) — 3직교축 잠금, shot_language enum 어휘, sample 프리뷰 스테이지, read-only 승인 보드
   - `narratoai.md` (10k★) — OST 3값 편집 프리미티브, 2패스 스토리보드, 스프레드시트 모달 편집기
   - `shortgpt.md` (7.7k★) — 선언적 JSON 편집 스텝 + z-order, 재개 가능 step-machine
   - `arcreel.md` (3.2k★) — Script Review Gate 하드게이트, 콘텐츠/비주얼 2단계 분리, 참조이미지 스태킹 일관성
   - `revideo.md` (3.9k★) — 커스텀 엘리먼트 프리뷰 플레이어, 시그널 variables, 부분/병렬 렌더 API
   - `story-flicks.md` (2.4k★) — word-boundary TTS→SRT 타이밍, story.json 재합성 훅
   - `claude-code-video-toolkit.md` (1.7k★) — 스킬 이중구조(지식 N + 실행 1), 오디오 앵커드 타임라인, registry 단일 진실원
   - `short-video-maker.md` (1.2k★) — MCP 2-tool 패턴(제출/폴링), TTS→STT 재정렬 자막
   - `fontagent.md` — mood→폰트 자동 선택 (auto_kairos 자매 레포)
5. **`03-ecosystem/`** ← 렌더/편집 레이어 지형.
   - `remotion-official.md` — 공식 스킬팩, Player 임베드 계약, Studio zod 비주얼 편집
   - `renderer-editor-landscape.md` — OpenCut/FFCreator/editly/motion-canvas/CapCut 드래프트 등 비교
   - `community-sweep.md` — 레딧/HN/awesome 추가 발굴 + 사용자 불만(기능 기획 직결)
6. **`04-context/deck-factory-contracts-excerpt.md`** — deck-factory 쪽 인터페이스 계약 원문 발췌.

## 교차 공통 패턴 (13기 분석에서 반복 확인된 것)

- **타이밍의 진실 원천 = 오디오 길이** (auto_kairos ffprobe→durationFrames, story-flicks SRT 역산, claude-code-video-toolkit 오디오 앵커드, short-video-maker TTS→STT). 씬 duration을 추정하지 말고 실측.
- **진실 원천 = 계약 JSON 1개 + 렌더러는 재읽기만** (scene_specs.json / story.json / edit_decisions / project.json). 편집 UI는 이 파일을 패치.
- **프리뷰와 최종 렌더가 같은 렌더 경로 공유** → 부분 재렌더 문제가 런타임 재실행으로 환원 (auto_kairos @remotion/player, revideo <revideo-player>).
- **무거운 재생성만 씬 스코프 서브프로세스로 격리** (TTS 재생성·씬 재연출·이미지 재롤).
- **버전 증가 + selected 포인터, 파괴적 삭제 금지** (auto_kairos gen_02, ArcReel version_manager).
- **단계별 하드게이트 + 재개는 파일 존재 기반** (출력 파일 존재=스킵, pipeline_state.json).
- **콘텐츠(원문·구조)와 비주얼(연출) 생성 분리** — 재생성 시 드리프트 차단 (ArcReel 2단계, NarratoAI 2패스).

## 계획 문서 (조사 완료 후 작성)

7. **`06-plan/MASTER-PLAN.md`** — 레포 설계 **v1 확정**: 5계층 아키텍처, 매니페스트 2계층 스키마, Phase P0~P6, 구 미결정 8항 결정 완료(§4), 실행 시퀀스 T1 적대감사→T2 PoC→T3+ Phase 루프(§5)
8. **`06-plan/WORKERS.md`** — 워커 배정(fable 오케스트레이션/codex 생산·테스트/opus 판정), hooks 5종, 불신 프로토콜, codex 맞춤화 6항
9. **`06-plan/VERIFICATION-PLAN.md`** — 확인 과정 38종 카탈로그 (L0 정적→L4 사용테스트), 게이트 리포트 파일 계약, Phase별 종료 조건
10. **`07-features/`** — 기능 전수 추출: 레포별 24파일(코덱스 24기, 원소스 직독, **1,870 기능행**) + `_rows.jsonl`(통합 파싱) + `_merged/`(도메인 12종 중복 클러스터링+최종 채택 판정) → 최종 산출 `FEATURE-MATRIX.md`
11. **`09-free-stack/`** — 무료 키리스 스택 실측 확정: `FREE-STACK.md`(정본 확정표) + tts-korean-free(edge-tts 워드 타임스탬프 실측 ✓)·audio-assets-free(BGM 시드 70곡·SFX 21)·visual-fonts-paid-catalog(키리스 스톡 체인·OFL 폰트·유료 카탈로그 10종). 원칙: 키리스 기본, 유료는 어댑터+추천만
12. **`08-audit/`** — T1 적대감사: opus 3렌즈(아키텍처·계약·게이트) + codex 3렌즈(구현가능성·운용성·기능판정) = **결함 90건(치명 30)**. `RESOLUTION.md`가 전 결함 수용/기각 결정 기록(89 수용/1 기각) — **v1.2 개정의 정본 근거**. 핵심 결정: 2티어 렌더(부분 재렌더=프리뷰 등급), 편집 영향 클래스 E1~E3, 컴포지션 read-only, hyperframes 0.7.26 핀, hooks 신뢰경계 격하→vf CLI, P0 4분할(P0a~P0d)

## 상태

- [x] 01-auto-kairos 4건
- [x] 02-similar-projects 12건 (fontagent·html-video 포함 전량 완료)
- [x] 03-ecosystem 3건 (remotion-official·renderer-editor-landscape·community-sweep)
- [x] 05-hyperframes-base 2건 (skill-pack·engine-internals)
- [x] 06-plan 2건 (MASTER-PLAN·WORKERS)
