분석 완료. 아래는 확인된 사실만으로 구성한 구조화 보고입니다.

---

# claude-code-video-toolkit 해부 보고

(클론 경로: `.../scratchpad/refs/claude-code-video-toolkit`, registry version 0.17.0)

## 핵심 발견: 스킬 패키징이 "이중 구조"다

이 프로젝트는 스킬을 **두 계층으로 완전히 분리**해서 운영한다. 우리 설계에 가장 중요한 부분.

- **계층 A — 도메인 지식 스킬 (내부용):** `.claude/skills/*/SKILL.md` 12개. 각각이 하나의 "능력 백과"(remotion, ffmpeg, elevenlabs, acestep, ltx2, moviepy, qwen-edit, ideogram4, playwright-recording, runpod, frontend-design, remotion-official). 툴 실행법이 아니라 **프롬프트 패턴·파라미터·베스트프랙티스** 지식이 담김.
- **계층 B — 배포용 단일 스킬:** `skills/openclaw-video-toolkit/SKILL.md` 하나. 이게 실제 "영상 만들기" 워크플로우 전체를 담은 오케스트레이터 스킬(OpenClaw 배포판). 계층 A의 지식을 참조하며 end-to-end 파이프라인을 지시.

즉 **"얇은 실행 스킬 1개 + 두꺼운 지식 스킬 N개"** 패턴. 우리도 참고할 만함.

---

## 1. Claude Code 스킬/에이전트 패키징 구조

근거 파일: `skills/openclaw-video-toolkit/SKILL.md`, `.claude/skills/*/SKILL.md`, `.claude/commands/*.md`, `_internal/toolkit-registry.json`, `CLAUDE.md`, `AGENTS.md`, `scripts/migrate_to_codex.py`

**SKILL.md 프론트매터 스키마 (2종 확인)**

배포 스킬(`skills/openclaw-video-toolkit/SKILL.md` L1-11)은 OS/바이너리 의존성을 선언:
```yaml
---
name: video_toolkit
description: Create professional videos autonomously ...
metadata:
  openclaw:
    emoji: "🎬"
    skillKey: "video-toolkit"
    os: ["darwin", "linux"]
    requires:
      bins: ["node", "python3", "ffmpeg", "npm"]
---
```
도메인 스킬은 단순 `name` + `description`(트리거 키워드를 description에 나열, 예: acestep SKILL.md의 "Triggers include background music, soundtrack, jingle...")만 사용.

**4계층 조직:**
1. **SKILL.md** = 능력 단위(12개 도메인 + 1개 배포 오케스트레이터). 큰 스킬은 `SKILL.md` + 보조 `reference.md`/`prompting.md`/`examples.md`/`parameters.md`로 분할(예: `qwen-edit/`, `ideogram4/`, `remotion/`, `ffmpeg/`, `elevenlabs/`).
2. **commands** = `.claude/commands/*.md` 14개. 가이드형 워크플로우(`/video`, `/scene-review`, `/generate-voiceover`, `/design`, `/record-demo`, `/publish`, `/brand`, `/setup` 등). 스킬이 "지식", 커맨드가 "대화형 절차".
3. **registry** = `_internal/toolkit-registry.json` — skills/commands/tools/templates/transitions/components/brands/cloudProviders/examples의 경로·상태(stable/beta)·프리셋·env를 담은 **머신리더블 단일 진실원**. CLAUDE.md는 "구조화 데이터는 registry를 봐라"고 명시적으로 위임(L37-38).
4. **CLAUDE.md** = 30KB 오케스트레이션·지식 문서(워크플로우/타이밍규칙/패턴). registry가 못 담는 "판단 지식".

**훅(hooks):** 확인 안 됨. `.claude/settings.json`은 `{}` (빈 객체, 1줄). 훅 기반 자동화는 없음.

**멀티 런타임 브리징:** `AGENTS.md` + `scripts/migrate_to_codex.py`가 동일 스킬을 Codex(`~/.codex/skills/`)로 이식("25 entries = 11 skills + 13 command wrappers + 1 overview"). GitHub Actions(`.github/workflows/sync-remotion-skills.yml`)가 상류 remotion-dev/skills를 주간 자동 동기화 PR로 유지(`docs/remotion-skills-sync.md`).

---

## 2. 렌더러

근거: `CLAUDE.md` L9-15, `skills/openclaw-video-toolkit/SKILL.md` L15, `templates/*/remotion.config.ts`, `.claude/skills/remotion*/`

**주 렌더러 = Remotion (React 기반, HTML/브라우저 렌더링).** `npm run render` → `out/*.mp4`. Studio 프리뷰는 `npm run studio`(localhost:3000, 핫리로드). 4개 템플릿 중 3개가 Remotion 프로젝트(`sprint-review`, `sprint-review-v2`, `product-demo`, `ai-engineering-review`).

**보조 렌더러 = Python/moviepy.** `templates/concept-explainer-short`는 **Remotion이 아니라 moviepy** — 9:16 쇼츠용, `scenes.json`에서 전체 파생(`CLAUDE.md` L84-85, `.claude/skills/moviepy/SKILL.md`). 오디오 앵커드 절대 타임라인에 적합하다고 명시.

**FFmpeg**은 렌더러가 아니라 **에셋 전처리/후처리 유틸**(`.claude/skills/ffmpeg/`, redub/addmusic/dewatermark 등).

미디어 컴포넌트 규칙: 반드시 `<OffthreadVideo>`/`<Audio>`(remotion 패키지) 사용, 생 HTML `<video>` 금지 — 프레임 정확 렌더 때문(`CLAUDE.md` L571).

---

## 3. 파이프라인 단계와 파일 계약

근거: `CLAUDE.md` L386-418, `skills/openclaw-video-toolkit/SKILL.md` Step1-7, `templates/concept-explainer-short/`, `.claude/commands/video.md`

**프로젝트 상태 계약 = `project.json`** (머신리더블). 프로젝트는 7단계 phase 머신을 통과하고 이 파일에 phase/scenes/assets/session history를 기록해 **멀티세션 재개**를 지원:
```
planning → assets → review → audio → editing → rendering → complete
```

**파이프라인 단계 (배포 SKILL.md 기준):**
1. 프로젝트 생성: `cp -r templates/product-demo projects/NAME` + `npm install`
2. 설정 계약: `src/config/demo-config.ts` (scenes 배열: title/problem/solution/demo/feature/stats/cta, 각 `durationSeconds` + `content`)
3. 스크립트 계약: `VOICEOVER-SCRIPT.md` (Scene별 워드버짓 `(durationSeconds-2)*2.5`)
4. 에셋 생성: 음악→씬별 VO(씬당 1개 mp3, 단일파일 금지)→이미지→비디오클립→토킹헤드, 각각 `public/audio/scenes/NN.mp3`, `public/images/`, `public/videos/`
5. **타이밍 싱크(계약 정합):** `ffprobe`로 실제 오디오 길이 측정 → `demo-config.ts`의 durationSeconds를 `ceil(actual+2)`로 갱신. 전용 툴 `tools/sync_timing.py --apply`
6. 스틸 프레임 리뷰(§4 참조)
7. 렌더: `npm run render` → `out/ProductDemo.mp4`

**concept-explainer-short의 파일 계약(더 깔끔한 예):** `scenes.json`(씬별 narration+visual asset) → `gen_vo.py`(TTS) → `gen_captions.py`(whisper 워드타이밍을 스크립트에 force-align) → `build.py`(오디오 앵커드 컴포지트). `vo_durations.json`도 중간 계약으로 존재(`examples/sky-blue-short/`). **"각 단계가 계약 파일을 남기고 사람이 수정·재실행"** — 우리 card-shorts 철학과 동일.

**브랜드 계약:** `brands/NAME/brand.json`(색·폰트) + `voice.json`(TTS 설정). registry로 조회.

---

## 4. 에이전트가 영상을 "보고" 검수하는 루프

근거: `skills/openclaw-video-toolkit/SKILL.md` L502-510 (Step 6), `.claude/commands/scene-review.md`, `.claude/skills/remotion-official/SKILL.md` L208

**두 종류의 검수 루프가 있으나, 완전 자율 프레임-비전 루프는 부분적이다.**

**(a) 스틸 프레임 추출 검수 (에이전트 주도, 배포 SKILL.md Step 6):**
```bash
npx remotion still src/index.ts ProductDemo --frame=100 --output=/tmp/review-scene1.png
npx remotion still src/index.ts ProductDemo --frame=400 --output=/tmp/review-scene2.png
```
체크 항목 명시: "text truncation, animation timing, narrator PiP positioning, background contrast". 즉 **프레임을 PNG로 뽑아 에이전트가 읽고 검수**하는 패턴은 존재. `remotion still --scale=0.25 --frame=30`로 저비용 썸네일 추출도 지원(remotion-official SKILL.md L208). 다만 "PNG를 다시 Read해서 판정→수정→재추출"의 반복 루프가 자동 게이트로 강제되진 않음 — 체크리스트 수준.

**(b) 인터랙티브 씬 리뷰 (사람 주도, `/scene-review` 커맨드):** Remotion Studio를 띄우고 씬별로 `[1]Approve [2]Adjust [3]Refine [4]Flag [5]Skip` 루프. Refine 선택 시 **`frontend-design` 스킬을 호출**해 컴포넌트를 고치고 핫리로드로 재확인. 결과를 `project.json`의 `reviewStatus`/`reviewIssues`에 기록. "Remotion Studio is truth"라는 원칙(scene-review.md L305) — **사람의 눈을 진실원으로 삼음**. 자율 비전 판정이 아님.

**결론:** 프레임 추출 인프라(`remotion still`)와 검수 체크리스트는 있지만, **"에이전트가 자동으로 프레임을 보고 점수 매겨 반려하는 하드게이트"는 없다.** 우리 card-shorts/deck-factory의 grader·G1~G12 하드게이트가 이 프로젝트 대비 명확한 차별점(우위).

---

## 5. 훔칠 만한 독창 기능 Top 5

근거 파일경로 포함.

**1) `--progress json` 표준 계약 + `yieldMs` 폴링 루프** (`skills/openclaw-video-toolkit/SKILL.md` L28-65, L562-609)
모든 장시간 클라우드 GPU 툴이 stderr에 JSON Lines(`{"stage":"item","pct":..,"msg":..}`)를 뱉고, 에이전트는 `bash background:true`를 금지하고 `exec + yieldMs:10000 + process poll` 루프로 **실시간 진행상황을 사용자에게 중계**. 스테이지 어휘 표준화(submit/queue/processing/waiting/complete/error/item/cost). "background로 던지고 monitor 약속하지 마라 — 네 런은 응답 끝나면 종료된다"는 경고가 명시적. 장시간 배치의 UX 해법으로 바로 차용 가능.

**2) 오디오 앵커드 타임라인 (드리프트 원천 차단)** (`CLAUDE.md` L517-551)
"길이를 추정하지 말고, 오디오를 먼저 생성→실측 타임스탬프에 비주얼을 앵커링". `build.py` 상단에 실측 타임라인 주석블록을 진실원으로 두고 모든 `start=`가 그것을 참조 → "드리프트가 물리적으로 불가능". `sync_timing.py`(사후 교정)와 앵커링(사전 예방)의 트레이드오프 표까지 정리. TTS 길이 편차 문제의 정공법.

**3) 툴 선택 결정 매트릭스 (겹치는 생성기 라우팅)** (`CLAUDE.md` L189-224)
"FLUX.2 vs Ideogram 4"를 **"베이크된 텍스트가 필요한가"** 단일 축으로 라우팅: 텍스트-free 배경은 FLUX→Remotion이 텍스트 오버레이(편집·애니 가능), 텍스트가 곧 디자인이면 Ideogram(픽셀퍼펙트 정적 PNG). "need→use" 표로 명문화. 우리 image-prompt/카드 렌더 분기에 그대로 적용 가능한 사고틀.

**4) 이중 Remotion 스킬 + 상류 자동싱크** (`docs/remotion-skills-sync.md`, `.github/workflows/sync-remotion-skills.yml`)
프레임워크 코어 지식(`remotion-official`, 상류 remotion-dev/skills에서 주간 GitHub Actions로 자동 PR 싱크)과 프로젝트 관례(`remotion`, 자체 관리)를 **분리**해서, 코어 문서가 낡는 문제를 구조적으로 해결. 외부 도구 지식을 스킬로 벤더링할 때의 유지보수 패턴.

**5) 스타일 드리프트 가드레일 (체인 비디오)** (`skills/openclaw-video-toolkit/SKILL.md` L408-416, `tools/chain_video.py`)
LTX-2가 프레임 N의 마지막 프레임을 N+1의 입력으로 체이닝하는데, "~30% 학습데이터 오염(anime)으로 5-10씬 내 스타일 드리프트" 문제를 인지하고 → ①씬별 `--prompts-file`(단일 제네릭 프롬프트 금지) ②`--negative-prompt`로 원치않는 스타일 배제 ③씬마다 강한 스타일 앵커 삽입, 3중 방어. 반복 생성물의 일관성 유지 레시피.

---

### 추가로 우리 설계에 시사하는 점 (사실 기반 정리)
- **툴 = Python CLI 20종** (`tools/`), 모두 `--help`/`--json` 지원, **반드시 toolkit 루트에서 실행**(상대경로 의존) — 스킬 문서가 이 함정을 CRITICAL로 반복 경고(`CLAUDE.md` L117, SKILL.md L17-26).
- **registry.json을 단일 진실원**으로 두고 CLAUDE.md는 판단지식만 — 문서/데이터 분리가 명확.
- **우리 대비 없는 것:** 자율 비전 하드게이트, 결정론적 조립/채점 스웜, 컨텍스트 격리. 이 프로젝트는 사람-인-루프(Remotion Studio 승인) 의존도가 높다. 우리의 grader/게이트/스웜이 상대적 강점.