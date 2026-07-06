I now have a complete picture. Here is my analysis.

---

# auto_kairos 분석 — AI 스킬 목록 & 파이프라인 오케스트레이션

분석 대상 루트: `/tmp/.../scratchpad/auto_kairos`
핵심 근거 파일: `auto_agent/data/pipeline.json`, `auto_agent/data/agents.json`, `auto_agent/orchestrator/runner.py`, `auto_agent/data/skills/agents/*/SKILL.md`, `auto_agent/tools/{subtitle_sync,whisper,remotion_bridge,image_generate,fal_queue}.py`, `auto_agent/modules/image_batch_module.py`, `CLAUDE.md`, `README.md`.

## 0. "19개 스킬" 정정 (중요)

`README.md:149`가 "AI 에이전트 스킬 (19개)"라고 적었지만 **stale한 숫자**입니다. 실제 `auto_agent/data/skills/agents/`에는 **34개 에이전트 SKILL.md 디렉토리**가 존재하고, `auto_agent/data/skills/shared/`에 **14개 공유 스킬**이 있습니다. `agents.json`은 이 중 23개를 정식 subagent로 등록(+ `internal_agents`에 character-planner). 아래 목록은 실제 파일 기준입니다.

---

## 1. 스킬 전체 목록

### 1-A. 에이전트 스킬 (`auto_agent/data/skills/agents/`, 34개) — LLM(Claude CLI subagent)

이름 · 모델 · 역할 · 입력 → 출력 (모델은 `agents.json` 기준, 없으면 SKILL.md):

| 스킬 | 모델 | 역할 · 입력 → 출력 |
|---|---|---|
| **config-inspector** | sonnet | 파이프라인 시작 전 config(voice_id/art_style/env) 교차검증·자동보정. `project_config` → `config_check.json` |
| **brief-interviewer-auto** | sonnet | LLM 자가 Q&A로 기획 DNA 확정. `project_config` → `editorial_brief.v1.json`, `editorial_brief.json` |
| **brief-interviewer** | sonnet | (인터랙티브판) 주제 분석 → `editorial_brief.json` |
| **brief-reviewer** | sonnet | brief 래칫 리뷰(5대 DNA 100점 채점+REVISE). `editorial_brief.v{N}.json` → `brief_review_feedback.v{N}.json` |
| **brief-deepener** | sonnet | brief 단계적 심화(v1→v2→v3, 잠금필드 유지) |
| **skeleton-researcher** | sonnet | vault wiki/claims만 읽어 타임라인/인물/챕터 골격 구조화 (vault reader) |
| **research-strategist** | opus | brief+skeleton → outline 설계. → `outline.json`, `research_queries.json`, `hook_strategy.json` |
| **research-orchestrator** | (opus) | 심층 리서치 전담 — Explorer 병렬 배포→탐색 종료 |
| **flesh-researcher** | sonnet | outline 챕터별 세부 팩트 병렬 수집 → `chapter_facts/` |
| **draft-writer** | sonnet | outline+chapter_facts → 초고 + WHY/HOW 질문. → `draft.md`, `research_questions.json` |
| **targeted-researcher** | sonnet | `research_questions.json` → 정밀 웹리서치 → `targeted_claims.json` |
| **fact-retriever** | (sidecar) | script-director가 글쓰며 호출 — wiki/manifests/raw에서 evidence-backed claim 반환(환각 차단) |
| **script-director** | opus | **핵심** — 원고작성+씬분할+시각연출+모션. → `final_manuscript.md`, `scene_specs.json`, `claims_ledger.jsonl` |
| **data-mapper** | sonnet | 씬 데이터필드(items/values/unit/source/chartConfig) 리서치 매핑 → `scene_specs.json` |
| **script-reviewer** | sonnet | 원고+연출 검수(시청자+전문가 2관점) + 래칫 게이트 → `review_feedback.json` |
| **fact-verifier** | sonnet | 주장 교차검증 + 비문검사 → `factcheck_report.json` |
| **fact-fixer** | sonnet | factcheck 권고 자동패치+비문수정 → `final_manuscript.md`, `scene_specs.json`, `fact_fix_log.json` |
| **character-planner** | (internal) | scene_specs+원고에서 반복 캐릭터 추출 → `character_plan.json`(외모/variant) |
| **assembly-director** | opus | **핵심** — TTS/이미지/자막/매니페스트 조립. → `audio/`, `subtitles/`, `manifest.json`, `assembly_report.json` |
| **release-manager** | sonnet | 업로드 패키지(제목4종·더보기·해시태그·썸네일 스펙). → `upload_info.json` |
| **upload-info-generator** | module | 렌더 완료 후 YouTube 업로드 정보 자동 생성 |
| **multiformat-director** | sonnet | 본편→숏폼/블로그/카드뉴스/스레드 4포맷 병렬(서브에이전트 4개 감독) |
| **multi-contents-director** | sonnet | 롱폼 기반 멀티포맷 + SNS 스케줄 + 플랫폼 최적화 |
| **shorts-maker** | (sub) | scene_specs→60초 세로 숏폼 |
| **blog-writer** | (sub) | scene_specs+research→SEO 블로그 |
| **card-news-maker** | (sub) | scene_specs→카드뉴스 캐러셀 10장 |
| **thread-writer** | (sub) | 핵심 인사이트→5~7 포스트 시리즈(Threads/X) |
| **threads-publisher** | sonnet | 세모지 Threads 콘텐츠 기획+작성(운영) |
| **trend-analyst** | opus | Stage 0 — 채널데이터+시장트렌드 교차 → 주제 기획안 |
| **performance-analyst** | sonnet | Stage 4 — 영상 성과+시장동향 분석, Stage 0 피드백 |
| **series-planner** | opus | 장편 시리즈 기획(`series_plan.json`) |
| **series-reviewer** | opus | 시리즈 편 간 일관성 검토 |
| **content-planner** | opus | 파이프라인 외부 기획안(`editorial_brief.json`) 작성 |
| **style-manager** | sonnet | 아트스타일 JSON 단일소스 관리(신규추가/TS프리셋 동기화/검증) |

> `agents.json`의 `summary`는 이를 "**8 에이전트 × 6 모듈**" 아키텍처로 압축 설명 (핵심 7 에이전트: trend-analyst, script-director, assembly-director, release-manager, multiformat-director, performance-analyst, kairos-admin-agent). 나머지는 이들의 하위 분할.

### 1-B. 공유 스킬 (`auto_agent/data/skills/shared/`, 14개) — 프롬프트 조각(토큰 절약용 참조)

`brief-dna.md`, `channel-metrics.md`, `image-generation.md`, `image-prompt-rules.md`, `korean-tts-rules.md`, `market-analysis.md`, `motion-presets.md`, `remotion-design-system.md`, `research-format.md`, `search-tools.md`, `trend-bridge-planning.md`, `writing-style.md`, `writing-style-iromism.md`, `writing-style-semoji.md`. (에이전트 SKILL.md의 `skills:` 필드에서 참조, runner가 `_load_shared_skill()`로 주입)

### 1-C. 순수 Python 모듈("도구", type=module) — CLI 담당

`agents.json.modules`: `preflight`, `tts_generator`, `subtitle_sync`, `image_batch_module`, `data_validator`, `manifest_builder`, `video_assembler`. 실제 구현은 `auto_agent/modules/*.py` (skeleton_from_vault, fresh_collector, vault_lookup, wiki_compiler, chapter_projection, brief_deepener, scene_enricher 등)와 `auto_agent/tools/*.py`.

### 1-D. Claude Code 슬래시 스킬 (오케스트레이션 진입점, 대화형)

- `.claude/skills/auto-kairos.md` — `/auto-kairos [주제]`: 인터뷰→프로젝트 생성→`auto-agent run` 호출
- `skills/kairos-research/SKILL.md` — `/kairos-research [slug]`: Stage 1 실행
- `skills/kairos-write/SKILL.md` — `/kairos-write`: Stage 2
- `skills/kairos-product/SKILL.md` — `/kairos-product`: Stage 3
- 기타 `.claude/skills/`: `solutioner.md`, `v4/`, `fontagent/`

---

## 2. 파이프라인 Phase 1~4 실행 흐름 (계약 = 입출력 파일)

근거: `auto_agent/data/pipeline.json` (phases 배열). **type=agent = Claude CLI subagent(`claude` 바이너리, stdin 주입), type=module = 순수 Python CLI**. runner가 `_run_agent_step` vs `_run_module_step`로 분기.

```
[Phase 0: Preflight] execution=sequential
 step_0   environment_check   (module preflight)  검증만: ELEVENLABS/FAL key, node>=18, ffmpeg, remotion CLI
 step_0c  config_inspect      (AGENT config-inspector, blocking)  project_config → config_check.json
 step_0b  editorial_interview (AGENT brief-interviewer-auto, blocking, max_attempts=2)
                              project_config → editorial_brief.v1.json + editorial_brief.json
 step_0d  brief_ratchet_v1    (AGENT brief-reviewer, non-blocking, skip_resume)
                              editorial_brief.v1.json → brief_review_feedback.v1.json

[Stage 1: 리서치] execution=sequential  (Phase 1~4 = research-redesign spec)
 step_1a           skeleton_research   (MODULE skeleton_from_vault)  brief+config → skeleton.json
 step_1_strategy   research_strategy   (AGENT research-strategist)   brief+skeleton → outline.json/research_queries.json/hook_strategy.json
 step_1_fresh      fresh_collector     (MODULE, non-blocking) [Phase 1]  brief → research/fresh_collector_summary.json
                                        (wiki/news/crossref/openlibrary 4 lane 병렬, tier_hint 부여)
 step_1_vault_lookup vault_lookup      (MODULE, non-blocking) [Phase 2]  NAS 02-research → research/vault_lookup.json
 step_1d_wiki_compile wiki_compile     (MODULE, non-blocking) [Phase 3]  raw+manifests → research/wiki/{overview,claims,entities,timeline,index}.md
 step_1_ingest     source_ingest       (MODULE, LEGACY, ENABLE_LEGACY_INGEST=1로만)
 step_1b           chapter_projection  (MODULE)  outline+ingest_status → chapter_facts/
 step_1c           brief_deepen_v2     (MODULE brief_deepener, non-blocking)  → editorial_brief.v2.json

[Stage 2: 원고+연출] execution=sequential
 step_2_draft         (AGENT draft-writer)      outline+chapter_facts → draft.md + research_questions.json
 step_2_target        (AGENT targeted-researcher) research_questions → targeted_claims.json
 step_2_target_register (MODULE)  targeted_claims → research/manifests/_targeted/sources.jsonl
 step_2_target_deepen (MODULE brief_deepener)   → editorial_brief.v3.json
 step_2_manuscript    (AGENT script-director)   draft+targeted_claims+wiki → final_manuscript.md + claims_ledger.jsonl
 step_2               (AGENT script-director)   manuscript+art_style → scene_specs.json   ← 파이프라인 핵심 산출물
 step_2_consistency   (AGENT script-director)   scene_specs → scene_specs.json (내러티브 보정)
 step_2_vault_sync    (module vault_sync)       프로젝트 wiki/claims → NAS push [Phase 4]
 step_2_data          (AGENT data-mapper)       scene_specs+claims → scene_specs.json (데이터)
 step_2b              (AGENT fact-verifier, non-blocking)  → factcheck_report.json
 step_2c              (AGENT fact-fixer, non-blocking)     → final_manuscript.md + scene_specs.json + fact_fix_log.json
 step_2d              (MODULE scene_enricher, blocking)    scene_specs → scene_specs.json + enrichment_queue.json
                       ★ 여기서 모든 이미지 검색·선택 완결. 검토큐 미처리 시 Stage 3 진입 불가.

[Stage 3: 에셋조립+렌더링] execution=agent_orchestrated
 step_3b  assembly   (AGENT assembly-director, max_attempts=2)
                     scene_specs+art_style+images/ → audio/scene_NNN.mp3, subtitles/scene_NNN.srt,
                                                     remotion/public/manifest.json, assembly_report.json
                     ※ 렌더링은 여기서 안 함 — 대시보드에서 수동 렌더
 step_3c  upload_info (AGENT release-manager, non-blocking)  → upload_info.json
```

**Stage 4(성과분석)는 pipeline.json에 없음** — `performance-analyst`/`trend-analyst`/`kairos-admin`은 볼트 기반 **독립 실행 운영 에이전트**(launchd 스케줄, `CLAUDE.md §11`).

**Claude Code vs CLI 담당 정리:**
- **대화형 Claude Code (슬래시 스킬)**: 사용자 인터뷰, 프로젝트 생성, 대시보드 기동, `auto-agent run` 호출 = 최상위 오케스트레이션.
- **CLI(runner.py)**: 파이프라인 실행 엔진. 그 안에서 창의/판단 스텝은 `claude` 바이너리를 subagent로 스폰(type=agent), 결정론적 수집·변환·조립은 Python(type=module).

---

## 3. Orchestrator 재시도 / 체크포인트 / 재개 로직

근거: `auto_agent/orchestrator/runner.py`

**재개(Resume)** — `_run_agent_step` (L3948~4002):
- 출력파일이 이미 존재하면 스킵. 단 `skip_resume:true`(래칫 루프)나 `--force`면 무시.
- 검증 수준: 디렉토리 출력은 내부 파일 존재까지, 패턴경로(`{NNN}`)는 glob 매치, 일반파일은 존재+**최소 50B**+JSON이면 `scenes` 빈배열 아님까지 확인해야 스킵.
- in-place 출력(입력==출력, 예 scene_specs 반복 수정)은 resume 스킵 안 함.
- 프로세스 재시작 시 `pipeline_state.json`에서 `completed_steps` 복원 (L844~857, `_finish`가 L5578에 저장).

**재시도(Retry)** — `_execute_step` (L3335~3378) + `_get_step_max_attempts` (L5138):
- 스텝별 max_attempts: assembly-director=2, tts/voice_generation=3, video_assembly=2, 일반 LLM/single_call=2, 순수 모듈=1(재시도 없음). step 정의의 `max_attempts` 필드가 최우선.
- `_is_retryable_error` (L5169): API키/파일없음/검증실패/JSON파싱오류/unknown step = **비재시도**(구조적). 연속 타임아웃도 중단.
- 대기시간 `_compute_retry_wait` (L5273): 타임아웃=즉시 재시도, rate-limit="resets 8pm(Asia/Seoul)" 메시지 파싱(`_extract_rate_limit_wait_seconds` L5237)해 reset 시각까지 대기, 그 외 지수백오프 `15×3^attempt`.

**체크포인트** — `_check_checkpoint` (L5530): phase 종료 시 `pipeline.checkpoints.points`의 `after_step`이 완료됐으면 인터랙티브 검토 안내 출력.

**타임아웃**: research 1200s, script 600+분×180, assembly 600+씬×60 (`_get_agent_timeout` L5113, agents.json 기준). 에이전트 호출은 **stdin 주입**(`-p` 플래그 미사용).

**청크 병렬**: `_run_chunked_parallel`(L1942) — 챕터 단위로 scene_specs 분할해 병렬 실행, 챕터별 재시도 2회(L2039).

**게이트웨이 감시**: `agents.json.gateway` — haiku 모델이 2초 폴링으로 timeout/repetition/token_explosion/no_progress/error_loop 감지, warning→restart→shrink_restart→skip_notify 4단계 복구.

---

## 4. TTS → Whisper 자막동기화 → 씬 타이밍 (오디오 길이가 duration 결정)

핵심 원리: **TTS mp3의 실제 오디오 길이가 씬 duration을 결정** (원고 글자수 추정 아님).

1. **TTS 생성** (`auto_agent/scripts/generate_tts.py`, `tools/elevenlabs.py`): assembly-director가 씬 mood/motion → speed/stability/style 파라미터 결정(SKILL.md 표 L217~237) → `audio/scene_NNN.mp3`. 한글 전처리는 `tools/korean_tts_preprocessor.py` + `narration_tts` 필드.

2. **Whisper 분석** (`auto_agent/tools/whisper.py:analyze_audio` L34): OpenAI `whisper-1`, `word_timestamps` → `{"words":[{word,start,end}], "duration": float}` 반환. (문서상 "WhisperX + Gemini"로도 표기 — `pipeline_timing.md`)

3. **자막 동기화** (`auto_agent/tools/subtitle_sync.py`):
   - `generate_subtitles` (L476): `audio_duration = whisper_result["duration"]`, `words = whisper_result["words"]`.
   - `smart_split_text`로 라인 분할(자연 pause·조사경계, 아트스타일별 max_chars 25~30자) → `match_to_timestamps` (L362)가 각 라인을 whisper 단어 타임스탬프에 fuzzy 매칭. 매칭 실패 시 글자수 비례 배분(`dur = len(line)/total_chars * audio_duration`). 마지막 엔트리 end는 audio_duration으로 클램프(L455).
   - 출력: `subtitles/scene_NNN.srt` + 단어별 `scene_NNN_words.json` 사이드카.

4. **씬 duration 산출** (`auto_agent/tools/remotion_bridge.py` L185~245):
   - `_get_audio_duration()` = **ffprobe로 mp3 실제 길이 측정**. 오디오 없으면 최소 5.0초 강제(0초 렌더 방지).
   - manifest 각 씬에 `"audioDurationSec": round(audio_duration,3)` 기록 → Remotion이 이 값 × fps로 `durationInFrames` 계산.
   - assembly-director Phase D(SKILL.md L506): `durationFrames = TTS 오디오 프레임 + 여유(15프레임)`, motion entrance 비율을 씬 길이에 맞춰 조정(짧은 씬<5초 entrance 25%로 축소).
   - Phase C TTS 검수(L482): 오디오가 예상 대비 ±30% 벗어나면 speed 조정 재생성, 총길이 목표 ±20% 초과 시 전체 speed 미세조정.

즉 **흐름: 원고 narration → TTS mp3 → ffprobe 길이 + whisper 단어 타임스탬프 → 씬 durationFrames = 오디오 길이 기반**. 자막은 word-level alignment로 오디오에 스냅.

---

## 5. 이미지 생성(FAL) 흐름 & 캐릭터 일관성

**엔드포인트** (`auto_agent/tools/image_generate.py` L58~60): `fal-ai/nano-banana-2`(생성), `fal-ai/nano-banana-2/edit`(편집·캐릭터). ("nano-banana-2" — art_style.json이 정의명 semoji/lego/quirky_cartoon 등 스타일 스펙 주입). 배치 큐는 `tools/fal_queue.py` (`fal_client.subscribe`, `run_batch`, max_retries=2).

**흐름** (assembly-director SKILL Phase B + `modules/image_batch_module.py`):
1. **B-1 캐릭터 우선 생성**: `character_plan.json`(pre-step 훅이 scene_specs에서 자동 생성) → `image_batch_module.run_batch`가 **CharacterLibrary(NAS) 재사용 검색** 후 없으면 FAL `/edit`로 생성 → `images/characters/{id}.png`, 라이브러리 자동 등록(타 프로젝트 재활용).
2. **B-2 씬 이미지 배치**: `python3 -m auto_agent.modules.image_batch_module` **한 번**으로 전 씬 병렬(20씬 3~5분 vs 개별 20~40분). `visual_kind`(v5) 단일 진입점: `generate_image`→FAL 생성, `search_image`→선택 URL 다운로드, `video`→videoAsset 라우팅, `map/chart/none`→Remotion 직접 렌더.
3. **버전 관리**: 재생성은 `scene_NNN_gen_02.png`처럼 **버전 증가, 기존 파일 절대 삭제 금지**. `image_assets.json`의 `selected` 필드만 전환(`image_assets.add_version`/`has_generated_version`).

**캐릭터 일관성 유지** (`image_generate.py:generate_scene` L485~550, IP-Adapter 방식):
- 씬 생성 시 `characters` 경로 리스트를 `image_urls`(data URI)로 FAL에 참조 주입 → **같은 인물 = 같은 얼굴**.
- 경로 자동 해석: ① 명시 경로 → ② 프로젝트 `images/characters/` glob → ③ `CharacterLibrary.find_for_scene(name, art_style)` NAS 검색 → ④ 없으면 art_style `reference_image`만(인물 복사 금지).
- 프롬프트 규약(L646): "Match this style"만 허용, "MUST copy" 금지 — 얼굴/의상/포즈 복사가 아니라 스타일+캐릭터 정체성만 참조. 2씬 이상 등장 인물만 캐릭터화, 나이/신분 대변화만 별도 variant.
- placement→aspect_ratio 강제(SKILL L415): fullscreen/background=16:9, side=3:4, badge/person=1:1, character=1:1.

---

## 6. QA / 품질 게이트

여러 층위의 게이트가 존재:

1. **brief 래칫** (step_0d, brief-reviewer): 5대 DNA 100점 채점, non-blocking(점수 무관 진행).
2. **원고 래칫 루프** (script-reviewer, `CLAUDE.md §4`): scene_specs 100점 채점 → 90점 미만 시 Edit 모드 수정→재평가, **최대 3라운드, 점수 하락 시 이전 버전 복원**, 미수정 씬 점수 고정.
3. **팩트체크** (step_2b fact-verifier → step_2c fact-fixer, 둘 다 non-blocking): 주장 교차검증 + 비문(grammar_issues) → 자동 패치. `claims_ledger.jsonl` + fact-retriever 사이드카로 evidence span 강제검증(환각 차단).
4. **scene_enricher 검증** (step_2d, blocking): `scene_specs_validator.py` — visual_kind 단일성(mapScene+imageAsset 중복 차단), 검토큐 미완이면 **Stage 3 진입 차단**(파이프라인 정지).
5. **이미지 QA** (assembly-director Phase B-3, LLM 멀티모달): assembly-director가 Read 도구로 이미지 직접 열어 프롬프트매칭/아트스타일/캐릭터 일치 검수. **결과는 `image_assets.json`에 persist**(`get_qa_result`/`set_qa_result`)해 재시작 시 스킵. 미달 씬은 재생성 없이 스토리보드에서 사용자 수동처리(단, cinematic 씬 이미지 없음은 필수 재생성, 최대 2~3회).
6. **TTS 검수** (Phase C): 오디오 길이 편차 ±30%/총길이 ±20% 게이트로 speed 재조정.
7. **runner 훅 게이트** (`_build_default_hooks` L538~): 이미지 삭제 차단(`guard_image_delete`), scene_specs 스키마 검증, 이미지 프롬프트 가드, 캐릭터/이미지 에셋 post-validation. pre-step 훅이 ValueError 시 스텝 실패(차단).
8. **최종 무결성** (Phase E): manifest 씬수/오디오·이미지 경로 검증 → `assembly_report.json`. 렌더링은 대시보드 수동.

---

## 새 영상 스킬 레포 설계 참고 요약

- **계약 파일 기반 단계 분리**가 핵심: 각 스텝이 명시적 입력/출력 JSON을 갖고, 출력 존재 = resume 스킵. 파일이 곧 체크포인트.
- **agent(창의/판단) vs module(결정론)** 이분법으로 스텝 타입 분리. 비용 큰 작업(이미지/TTS/렌더)만 뒤 단계로 격리(step_2d에서 검색 완결→Stage 3는 생성만).
- **오디오 길이가 타이밍의 single source of truth** (ffprobe→durationFrames), 자막은 whisper word-level로 스냅.
- **버전 증가 + selected 포인터** 패턴으로 파괴적 삭제 없이 재생성 관리.
- QA는 **persist되는 게이트**(image_assets.json QA 필드)로 재시작 안전성 확보 + **비차단 래칫 루프**(점수 하락 시 롤백).