# WORKERS — 워커 배정·토큰 최적화·불신 프로토콜

작성: 2026-07-07 · MASTER-PLAN.md의 실행 체계 문서.
대원칙(사용자 지시): 오케스트레이션=fable, 생산·테스트=codex 주력, 판단=opus, 모든 산출물 불신 → 물리 게이트, hooks·스웜으로 사용량 최적화.

## 1. 토큰 경제 원칙 (fable 컨텍스트 보호가 최우선)

1. **fable은 원문을 읽지 않는다** — 파일 계약(스키마·매니페스트·게이트 리포트)과 워커 요약만 소비. 소스 코드·긴 문서는 서브에이전트가 직접 읽고 ≤10줄 요약 반환 (ArcReel "메인 컨텍스트에 소설 원문 미탑재" 패턴, 02/arcreel.md §4).
2. **판단을 LLM에서 스크립트로 강등** — 결정론 검사(스키마 검증·해시 비교·bbox·오디오 길이 정합)는 전부 Python/Node 게이트 스크립트. LLM 판정은 "스크립트로 못 재는 것"(스타일·의미)만 남기고 opus 3표 다수결로 한정 (deck-factory 5.4 프로토콜).
3. **재실행은 파일 존재 기반 스킵** — 출력 존재=완료로 간주하되 게이트 리포트가 동반될 때만. 전체 재실행 금지, 씬/모듈 스코프 재실행만.
4. **캐시 윈도우 관리** — fable 장기 세션은 5분 캐시 안에서 워커 회수 폴링을 배치화. 짧은 폴링 남발 금지, 배치 완료 통지 대기.

## 2. 워커 역할 매트릭스

| 워커 | 담당 | 금지 |
|---|---|---|
| **fable (메인)** | Phase 게이트 판단, 계약 심사, 브리프→작업 분해, 토론 오케스트레이션, 최종 통합 | 대량 코드 작성, 원문 정독, 단순 반복 작업 |
| **codex (주력 생산)** | 컴파일러·파이프라인·스튜디오 구현, 씬 컴포넌트 8종 양산, 수리 분산, **기능별 구현 테스트·세세한 사용 테스트 전담**, 적대 리뷰(cross) | 설계 결정, 게이트 기준 변경 |
| **opus** | 의미·시각 판정(스냅샷 프레임 3표 다수결), 설계 리뷰·적대 감사, 씬 연출 품질 채점 | 구현, 대량 생산 |
| **sonnet** | doctor 스크립트, 렌더 스모크, 문서 초안 | 판정, 핵심 구현 |

Phase별 주력: P0 PoC=fable+codex 1기 / P1 계약=fable 설계+opus 리뷰 / P2 컴파일러=codex 스웜+opus 판정 / P3 파이프라인=codex+sonnet 스모크 / P4 스튜디오=codex+fable UX 심사 / P5 게이트=codex 구현+opus 캘리브레이션 / P6 패키징=codex+sonnet.

## 3. codex 스웜 운용 (codex-spawn 재사용)

- 동시성: 일반 구현·테스트 **15** / 렌더·GPU 포함 작업 **4~6** (OOM·Chromium 경합, deck-factory P4 교훈). TTS 배치는 4 (audio.mjs 무제한 병렬 폭주 확인 — RESOLUTION A6).
- 격리: 작업별 디렉토리 또는 git worktree — **반드시 ext4**(~/ 아래). /mnt/d(NTFS)에서 worktree·병렬 렌더 금지(심링크·exec bit·case 충돌·I/O 병목, RESOLUTION C11). pnpm store·브라우저 캐시는 공유, worker별 temp/output 분리. 공유 파일 동시 수정 금지 — 파일 단위로 쪼개지는 작업만 스웜化.
- Phase 브리프는 의존 그래프(owner files/inputs/outputs/blocked_by/acceptance) 선작성 — contract→core→…→gates 웨이브 진행, 웨이브 간 머지 게이트. 스웜 15는 독립 컴포넌트 웨이브에만 (RESOLUTION C13).
- 회수: 구조화 출력(JSON 결과 파일) → fable은 결과 파일만 읽음. stdout 정독 금지.
- 실패분만 재시도 (resume 계약), 2회 실패 시 fable 에스컬레이션.

## 4. 강제 계층 (v1.2 — T1 감사 반영: **Claude hooks는 신뢰 경계가 아니다**)

codex는 Claude Code 훅을 타지 않고, PostToolUse는 이미 쓰인 뒤라 차단이 아니다 (RESOLUTION C2). 신뢰 경계는 아래 3층:

| 층 | 메커니즘 | 담당 검사 |
|---|---|---|
| **1. `vf` CLI (필수 경로)** | `vf write`(스키마 검증 후 원자 쓰기 — schema-guard·render-lint·korean-tts-lint 내장), `vf gate`(supervisor gate runner — 게이트 리포트 유일 생성자: Merkle 입력해시·evidence 해시·스크립트 해시·commit·exit code) | L0 전체 + 게이트 리포트 provenance |
| **2. pre-commit + CI** | 스키마·lint·골든 회귀·네거티브 픽스처, 에셋 immutable 디렉토리 스냅샷 diff(삭제 검출 — asset-guard의 실효 구현) | 커밋 단위 회귀 |
| **3. Claude hooks (보조)** | skeptic-hook: 완료 선언 시 게이트 리포트 **재해시 대조 + pass===true + freshness** 검증 후 아니면 거부 메시지. fable 세션 알림용 | fable 오케스트레이션 규율 |

게이트 리포트는 codex가 직접 Write 금지 — `vf gate`만 생성, fable이 독립 재해시로 대조 (RESOLUTION C1).

## 5. 불신 프로토콜 (모든 내용 믿지 않는다)

1. **Phase 완료 = 게이트 통과 실증만** — "완료" 텍스트·코드 존재·테스트 통과 선언은 무효. 게이트 스크립트가 생성한 리포트 파일(입력 해시 포함)만 인정.
2. **codex 적대 교차검증** — 구현 codex와 리뷰 codex를 분리 스폰, 리뷰는 "깨뜨릴 방법"을 찾는 프롬프트로. gn-skill-pack에서 실증된 패턴(opus 적대검증 28결함).
3. **opus 시각 3표** — 렌더 프레임 스냅샷을 opus 3기가 독립 판정, 2/3 다수결. 판정 근거 필수(스크린샷 좌표·구체 결함).
4. **리서치 불신** — 본 조사 19건도 구현 시점에 재검증: 각 설계 결정의 근거 파일경로를 codex가 실소스에서 재확인 후 착수 (버전 드리프트 대비 — vendor 0.7.26 vs npm 0.7.37).
5. **복귀 시 재감사** — 세션 복귀마다 "돌아간다"는 주장부터 의심, E2E 스모크 1회 선행 (suspicion-reaudit 프로토콜).

## 6. codex 맞춤화 (실사용·테스트 주체 = codex)

레포 자체를 codex가 헤드리스로 굴리기 좋게 설계한다:

1. **AGENTS.md** — 레포 루트 + 패키지별. 실행법·게이트 명령·함정을 codex 관점으로 기술 (claude-code-video-toolkit의 Codex 브리징 패턴, 02/claude-code-video-toolkit.md).
2. **모듈별 독립 CLI** — 컴파일러/게이트/TTS/컴포넌트 각각 `--json` 출력 지원 단일 명령으로 실행·검증 가능. 브라우저 수동 확인 없이 codex가 판정할 수 있는 형태 (스냅샷 PNG 산출 → 파일 존재+해시로 1차 판정).
3. **결정론 fixture** — 골든 scene_specs·골든 렌더 해시·오디오 mock을 레포에 동봉. codex 테스트가 네트워크·API 키 없이 도는 no-credential 경로 확보 (TTS mock, 이미지 placeholder).
4. **진행 표준화** — 장시간 명령은 stderr JSON Lines 진행 계약 (claude-code-video-toolkit `--progress json` 차용).
5. **작업 단위 문서** — 각 Phase를 codex 1스폰이 소화 가능한 브리프 파일(T4-4a식)로 분해, WORKERS 실행계획에 등재.
6. **사용 테스트 시나리오** — `tests/scenarios/*.md`에 "브리프 X → 기대 산출물·게이트 결과" 명세, codex가 시나리오 단위로 E2E 실행·리포트.

## 7. 사용량 배분 요약

- fable: 세션당 오케스트레이션·게이트 판단 위주 (전체의 ~10%). 한도 소진 시 무조건 정지·계정 전환 (opus 폴백 금지 — 기존 규칙).
- codex: 구현·테스트 대량 (~70%). 스폰 수로 처리량 제어.
- opus: 판정·감사 (~15%), 3표 배치로 묶어 호출 최소화.
- sonnet: 스모크·문서 (~5%).
