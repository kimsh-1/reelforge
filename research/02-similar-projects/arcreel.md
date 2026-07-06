I have enough concrete evidence across all five lenses. Here is the structured analysis.

---

# ArcReel 해부 보고 — "세세 설정 영상 생성 스킬 + 띄워서 수정 UI" 참고용

클론 위치: `.../scratchpad/refs/ArcReel`
스택: FastAPI(Python 3.12) + React 19 + Claude Agent SDK. 워크플로: 소설 → 전역 캐릭터/단서 추출 → 회차 분할 → JSON 스크립트 → 캐릭터/장면/소품 시트 → 분경(스토리보드) → 영상 → FFmpeg 합성 / CapCut 초안. (`README.en.md:76-90`)

핵심 통찰 하나: **에이전트 런타임 프로필이 통째로 `.claude/` 디렉토리로 물화되어 있다** — `agent_runtime_profile/.claude/skills/*`, `.../agents/*`. content_mode(narration/drama/ad)별로 SKILL 파일이 분기(`SKILL.narration.md` / `SKILL.drama.md` / `SKILL.ad.md`)되고, 프로젝트 생성 시 해당 프로필이 프로젝트로 복사된다. 이게 "스킬로 영상 생성"의 실제 구현 원형이다.

---

## 1. 워크벤치 / UI 구조 — 단계별 검토·수정 UI

**전체 레이아웃 = 좌측 캔버스 + 우측 도킹형 리사이즈 AI 어시스턴트 패널** (`frontend/src/components/layout/StudioLayout.tsx`)
- 우측 패널이 바로 "띄워서 수정 UI"의 원형. `AgentCopilot`(`copilot/AgentCopilot.tsx`) + `AssistantResizeHandle`. 폭은 드래그 리사이즈 + 더블클릭 리셋 + zustand 영속(`setAssistantPanelWidth`/`persistAssistantPanelWidth`, `StudioLayout.tsx:71-137`). 열림/닫힘 토글, 폭 0까지 접힘.

**상단 단계 스테퍼** (`layout/PhaseStepper.tsx`) — 5단계 캡슐: `setup → worldbuilding → scripting → production → completed` (`frontend/src/types/project.ts:67-73`). 현재 단계 accent 하이라이트, 완료 단계 연결선. `current_phase`는 서버 `StatusCalculator`가 read-time 계산(저장 안 함).

**캔버스 라우팅 = 단계별 뷰 전환** (`canvas/StudioCanvasRouter.tsx`) — 네스티드 라우트로 뷰 스위칭:
- 개요: `OverviewCanvas`, 소스: `SourceFilesPage`
- 월드빌딩(로어북): `lorebook/CharactersPage` / `ScenesPage` / `PropsPage` / `ProductsPage` (+ `CharacterCard`/`SceneCard`/`PropCard` 카드 그리드 + `AddCharacterForm`)
- 제작 타임라인: `timeline/TimelineCanvas` — `ShotList` + `ShotDetail`(인라인 상세 편집) + `ImagePromptEditor` / `VideoPromptEditor` / `DialogueListEditor` / `UtteranceListEditor` / `NotesDrawer`
- 그리드 모드: `grid/GridImageToVideoCanvas` + `GridPreviewView`
- 참조영상 모드: `reference/ReferenceVideoCanvas` + `UnitList`/`UnitRail`/`UnitPreviewPanel` + `MentionPicker`/`RefChip`/`RefAvatar`/`ReferencePanel`

**핵심 인간 개입 UI — Script Review Gate** (`canvas/timeline/ScriptReviewGate.tsx`)
- step1 구조화 중간산출물(분할된 세그먼트/씬)을 **웹에서 구조화 카드로 렌더 + 인라인 편집**. narration은 `novel_text` 편집, drama는 `UtteranceListEditor`(대사/보이스오버 순서) + `source_text` 편집. 출연 캐릭터/장면/소품은 read-only pill(`MetaChips`).
- 상단 sticky 상태바: `pending`(Clock) / `confirmed`(CheckCircle) + Save + **Confirm(확정) 버튼**. 확정 전에는 step2(비주얼 생성)로 못 넘어감 = **물리적 하드게이트**.
- dirty 추적(`isDirty` JSON 직렬화 비교), 저장 안 한 편집이 있으면 에이전트가 백그라운드로 step1 고쳐도 사용자 초안 보존(`dirtyRef`, `ScriptReviewGate.tsx:185-242`).

**어시스턴트 ↔ 워크벤치 컨텍스트 브릿지** (`copilot/ContextBanner.tsx`)
- `focusedContext` (type: character/scene/prop/segment + id)를 어시스턴트 입력창 위에 배너로 표시 → 사용자가 특정 카드를 보며 "이거 고쳐줘" 하면 에이전트가 무엇을 가리키는지 안다. (설계 훔칠 포인트: 떠 있는 수정창이 현재 선택한 요소를 자동 참조)

**어시스턴트 내부 렌더링** (`copilot/chat/*`) — `SubagentCard`(서브에이전트 진행), `SkillChip`(스킬 발동 표시), `TaskProgressBlock`, `ThinkingBlock`, `ToolCallWithResult`, `TodoListPanel`, `PendingQuestionWizard`(에이전트의 AskUserQuestion을 위저드로 렌더 — 아래 5번). `task-hud/TaskHud.tsx`가 비동기 생성 큐 실시간 진행(SSE).

**버전 타임머신** (`canvas/timeline/VersionTimeMachine.tsx` + 백엔드 `lib/version_manager.py`) — 재생성마다 `versions/{resource_type}/`에 자동 백업(`versions.json`), 원클릭 롤백.

---

## 2. 캐릭터/장면/소품 일관성 유지 메커니즘

**단일 진실원천**: 캐릭터/장면/소품/제품 정의는 `project.json`에만 저장, 스크립트는 이름만 참조(`SKILL.narration.md:305`). 사용자는 `description`(서사형 문단)만 유지, 최종 프롬프트는 서버 `lib/prompt_builders.py`가 조립 → WebUI와 Skill이 같은 진실원천 사용(`generate-assets/SKILL.md:16-18`).

일관성은 **다층 참조이미지 스태킹**으로 확보(시드 아님, 레퍼런스 이미지 앵커 방식):

**(a) 디자인 시트 = 1차 앵커** (`lib/prompt_builders.py:22-39`)
- 캐릭터: 16:9 4패널 시트(흉상 + 정면/¾측면/후면 A-Pose), 순수 백색 배경. 정방향 anti-crash 가드: `"네 패널 얼굴·헤어·의상·장신구 완전 일치, 이목구비 대칭, 손가락 5개 완전…"` (`_CHARACTER_GUARD`).
- 장면: 메인 ¾ + 우하단 디테일 인서트. 소품: 3뷰(정면/45°/디테일).
- 반전 프롬프트는 backend negative_prompt 파라미터 안 쓰고 **프롬프트 말미에 "画面避免:…" 텍스트로 통일**(`_NEGATIVE_TAIL_ASSET`), CFG 가중 희석 방지 위해 핵심 4항목만.

**(b) 분경 생성 시 자동 참조 주입** (`server/services/generation_tasks.py:401-480`, `generate-storyboard/SKILL.md:36-42`)
- 씬 출연 asset의 `character_sheet` + `scene_sheet` + `prop_sheet` 경로를 dedup 수집(`_collect_sheet_paths`) → `reference_images`로 자동 첨부. **에이전트가 수동 지정 안 함, MCP 툴이 자동 처리.**
- **직전 분경 이미지를 크로스샷 연속성 앵커로 주입** (`lib/storyboard_sequence.py:24-98`): 라벨 `"上一分镜图（镜头衔接参考）"` + 설명 `"구도·색조·장면 연속성 유지용, 새 캐릭터/의상/소품 추가 아님"`. **`segment_break=true`거나 index 0이면 스킵** — 컷 전환 시 앞 프레임 오염 방지.

**(c) 참조영상 모드 = 프롬프트 앵커(@멘션)** (`lib/prompt_builders_reference.py:119-142`, `lib/script_models.py:702-735`)
- shot `text`에 `@[캐릭터]/@[장면]/@[소품]`으로만 참조, **외모·의상·장면 디테일 서술 금지**(그건 참조이미지가 담당). 좋은 예/나쁜 예까지 프롬프트에 명시.
- `references[]` 배열 순서가 `[图N]` 번호를 결정. 각 `@[이름]`은 references에 1회 등록 필수, 등록명은 project.json 3버킷에 존재해야 함.

**(d) 제품 고보존(광고 모드)** (`prompt_builders.py:124-148`, `generation_tasks.py:504-547`)
- `products_in_shot` 비어있지 않으면 제품 참조를 **모든 참조보다 앞에 배치(절대 우선)** + "product sheet 다각도 + 실촬 원본 압쇄" 이원 규칙. 최고우선 고보존 지시 append, 이미지 프롬프트는 제품 외관 복술 불필요.

**(e) 스타일 참조 이미지** — 업로드 시 AI 자동 분석 → 전 이미지 생성에 균일 적용(`README.en.md:134`). `_style_prefix`가 프롬프트 앞에 `风格/描述` 블록 주입.

**(f) 재생성 무효화**: `lib/asset_fingerprints.py` — 미디어 파일 mtime_ns 지문 → URL cache-bust. 회차 재배열 시 `ledger_status=stale`로 구 산출물 무효화(파일은 안 지우고 버전 메커니즘으로 교체).

---

## 3. 분경(스토리보드) 매니페스트 스키마

전부 Pydantic(`lib/script_models.py`, 925줄). content_mode × generation_mode 매트릭스로 5개 최상위 스키마(`generation-modes.md:7-13`). 모두 `extra="forbid"`(자식 모델)로 오타/할루시네이션 필드 차단.

**공용 하위 구조:**
- `ImagePrompt = {scene(정적 화면), composition{shot_type, lighting, ambiance}}` — `ShotType` 9종 enum(Extreme Close-up…Point-of-view), `CameraMotion` 8종 enum.
- `VideoPrompt = {action(물리적 관찰가능 동작만, 내면 동사 금지), camera_motion, ambiance_audio(BGM 금지), dialogue[]}`.
- `GeneratedAssets`(런타임 상태) = `{storyboard_image, storyboard_last_image, grid_id, grid_cell_index, video_clip, video_thumbnail, video_uri, narration_audio, status: pending|storyboard_ready|completed}`.

**Narration** (`NarrationEpisodeScript.segments[]`):
- `NarrationSegment = {segment_id(E{집}S{순번}), duration_seconds(1-60), segment_break, novel_text(원문 축자보존), characters_in_segment[], scenes[], props[], image_prompt, video_prompt, transition_to_next(cut/fade/dissolve, LLM 숨김), note(사용자 메모, LLM 숨김), generated_assets(LLM 숨김)}`.

**Drama** (`DramaEpisodeScript.scenes[]`) — 2단계(ADR 0041):
- `DramaScene`에 `utterances[]`(대사/보이스오버 시간순 판별 유니온: `{kind: dialogue|voiceover, speaker, text}`, 삽입순=幕내 시각) + `source_text`(원문 추적 앵커, 낭독 안 함).
- step1 `DramaSceneContent`(scene_description 자유텍스트 + utterances + source_text) → step2 `DramaSceneVisual`(scene_id + image_prompt + video_prompt만) → `merge_drama_visual_into_scenes()`가 scene_id로 병합. **비주얼 필드만 LLM이 생성, 콘텐츠는 step1 확정분 투과 → Structured Output 드리프트 원천 차단.**

**Ad** (`AdEpisodeScript.shots[]`):
- `AdShot = {shot_id, section(hook/pain_point/product_reveal/selling_point/demo/trust/price_promo/cta 8구간), duration_seconds, voiceover_text(자막·TTS 단일원천), products_in_shot[], …}`.

**Reference Video** (`ReferenceVideoScript.video_units[]`):
- `ReferenceVideoUnit = {unit_id(E{집}U{순번}), shots[](1-4개), references[]({type, name}, 순서=[图N] 번호), duration_seconds(=shots 합계 파생, `_check_duration_consistency` 검증기)}`.
- `Shot = {duration(1-15), text(@[…] 참조 포함)}`.

**동적 duration 하드제약** (`build_episode_script_model`, `script_models.py:800+`): 비디오 모델의 `supported_durations`를 `Literal[...]`로 주입 → response_schema에서 JSON enum/const로 렌더 → **LLM 생성 시점에 잘못된 길이 원천 차단**(늦은 실패 방지). 참조모드는 unit 총합에 제약.

설계 훔칠 점: **집번호/content_mode/총시간/hook 등은 스키마에서 제외하고 런타임(`_add_metadata`)이 주입** — LLM이 집번호 할루시네이션으로 다른 회차 덮어쓰는 사고 방지(docstring에 실제 버그 기록됨).

---

## 4. 에이전트 오케스트레이션 구조

**Orchestration Skill + Focused Subagent** 패턴 (`README.en.md:196-221`, `SKILL.narration.md`).

**메인 에이전트 = 편성 중추** (`manga-workflow` 스킬). 소설 원문을 **절대 메인 컨텍스트에 안 올림** — 서브에이전트가 직접 읽음. dispatch 시 파일 경로 + 핵심 파라미터만 전달, 각 서브에이전트는 단일 태스크 완료 후 요약만 반환(컨텍스트 보호). 루프: `상태검출 → 다음단계 결정 → 서브에이전트 dispatch → 결과 표시 → 사용자 확인 → 반복`.

**상태 검출(파일시스템 기반, `SKILL.narration.md:44-65`)**: `project.json` + Glob으로 순차 검사, 첫 결손 항목이 현재 단계. 9단계(0 setup ~ 8 narration audio). 회차 진행은 **오직 장부(`episodes[]`의 `ledger_status`: planned/consumed/stale/unanchored + `planning_cursor`)로만 판정, 파일명으로 집수 추론 금지.**

**서브에이전트**(`agent_runtime_profile/.claude/agents/`):
- `analyze-assets` — 소설/각본에서 캐릭터·장면·소품 추출→`patch_project`. `source_kind`(novel=추론 / screenplay=작가 명시 캐릭터만 추출, 泛指·군중·空镜 자산화 금지, `analyze-assets.md:41-63`).
- `split-narration-segments` / `normalize-drama-script` / `split-reference-video-units` — step1 전처리(생성모드별 분기).
- `create-episode-script` — `generate_episode_script` MCP 툴로 최종 JSON.
- `generate-assets` — 캐릭터/장면/소품/스토리보드/그리드/비디오/오디오 생성 실행.

**스킬 vs 서브에이전트 경계**(`README.en.md:219`): 스킬=결정론적 스크립트 실행(API 호출·파일 생성), 서브에이전트=추론 필요 태스크(캐릭터 추출·각본 정규화).

**실행/큐**: MCP 툴(`mcp__arcreel__*`)이 실제 생성을 큐에 인큐. `lib/generation_queue.py` = RPM 제한 + 이미지/비디오/오디오 독립 채널 + lease 스케줄 + 체크포인트 재개(중단 후 재dispatch 시 있는 것 스킵). 서버측 `server/agent_runtime/` = 세션 관리(`session_manager`/`session_actor`), 옵션 조립(`options_assembler`), SSE 스트림(`stream_projector`), transcript 어댑터. **bwrap 샌드박스**로 에이전트 툴콜 격리(파일/네트워크/서브프로세스 allow-list, `README.en.md:125`).

**진입 유연성**: 처음부터 강제 안 함 — "분석만"/"2집만"/"계속"/"분경만" 등 상태검출로 정확한 단계에서 시작(`SKILL.narration.md:293-301`).

**분산 회차 계획**(`plan_episodes`/`replan_episodes` MCP 툴): 서버가 planning_cursor부터 소스 윈도우 읽어 극적 아크 완결 회차 일괄 계획. 메인 에이전트는 툴 1회 호출 + 요약 수신만. 사용자 한마디로 전체 배치 재계획, 소비된 회차 영향 시 `confirm_consumed` 명시확인 요구(`SKILL.narration.md:104-114`).

---

## 5. 훔칠 만한 독창 기능 Top 5 (단계별 인간 개입 루프 중심)

**① 물리적 하드게이트 = Script Review Gate (step1→step2 차단)**
`ScriptReviewGate.tsx` + 백엔드 `mcp__arcreel__confirm_script_review`. step1 구조화 중간산출물이 **명시적 확정 전엔 step2(비주얼 생성) 진입 불가** — `generate_episode_script`가 gate에서 거부. 확인 후 step1이 다시 수정되면 재확정 필요. 두 등가 경로: 웹에서 편집·확정 OR 대화에서 동의 시 에이전트가 confirm 툴 호출. → **당신 스킬의 "계약 파일 + 사람 수정 재실행" 하드게이트의 정확한 참고 구현.**

**② 단계간 확인 프로토콜 (AskUserQuestion 3지선다 루프)**
`SKILL.narration.md:70-79`: 각 서브에이전트 반환 후 메인이 요약 표시 → AskUserQuestion으로 `[다음 단계 진행 / 이 단계 재실행(수정요구 첨부) / 이 단계 건너뛰기]`. 프론트는 `PendingQuestionWizard.tsx`로 위저드 렌더. → 자율성과 개입의 균형: 사용자가 "직접 다 돌려"라고 명시 위임하면 배치 리뷰 스킵 가능.

**③ 2단계 콘텐츠/비주얼 분리로 드리프트 원천 차단**
drama/narration 모두 step1(콘텐츠: 축자 원문·경계·자산참조 확정) → step2(LLM은 비주얼 필드만 생성) → scene_id/segment_id로 후단 병합(`merge_drama_visual_into_scenes`). **원문(novel_text/utterances)은 step2 LLM을 절대 안 거침** → 확장·왜곡 불가. 스키마 `extra="forbid"` + supported_durations `Literal` enum 하드제약으로 잘못된 출력을 생성 시점에 차단. → 세세 설정에서 "고정해야 할 것"과 "생성할 것"을 스키마 레벨로 분리하는 패턴.

**④ 크로스샷 연속성 = 직전 프레임 자동 앵커 + segment_break 게이팅**
`storyboard_sequence.py`: 인접 분경에 직전 이미지를 "연속성 참조(새 설정 추가 아님)" 전용 라벨로 주입하되, `segment_break=true`에서 끊음. 시트(캐릭터/장면/소품)는 씬 출연진에서 자동 dedup 스택. 광고는 제품 참조 절대우선 프리펜드. → 시드 대신 **참조이미지 순서·역할 라벨링**으로 일관성 제어(모델 비종속).

**⑤ 자산 재생성 = 자동 버전 스냅샷 + 파일지문 무효화 + 장부 기반 재개**
`version_manager.py`(재생성마다 `versions/`에 백업 + 원클릭 롤백) + `asset_fingerprints.py`(mtime_ns cache-bust) + 회차 장부 `ledger_status=stale`(재배열 시 구산출물 무효, 파일보존·버전교체) + 큐 체크포인트 재개(있는 것 스킵, 결손만 보충). → "이 카드만 다시" / "실패분만 재시도" / "resume"를 안전하게 지원하는 상태 관리 원형.

**보너스 — 프로필 물화 아키텍처**: `.claude/` 전체(스킬+서브에이전트+references)가 content_mode별로 파일 분기되고 프로젝트 생성 시 복사됨. `agent_runtime_profile/skill-optimization-workspace/manga-workflow-trigger-eval.json` + `evals/evals.json`으로 **스킬 트리거 문구를 eval로 회귀 테스트**. `docs/adr/`에 설계결정(ADR 0040 utterances, 0041 2단계, 0033/0034 참조 유닛) 기록. → 스킬을 제품처럼 버전·평가하는 참고.

---

주의(추측 아닌 확인된 한계): UI 스크린샷은 미확인(`docs/assets/hero-screenshot.png` 바이너리만 존재). `focusedContext`를 **세팅하는** 지점은 components 내 grep에서 `ContextBanner`(표시·해제)만 잡혔고, 실제 set 호출부는 stores 쪽으로 추정되나 이번 탐색에서 파일 확정 안 함. 프롬프트/스킬 언어는 전부 중국어(생성 프롬프트도 중문 강제, `generation-modes.md:62-65`).