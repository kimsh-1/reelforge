I have everything needed. Here is the analysis.

---

# OpenMontage 해부 보고서

클론 위치: `scratchpad/refs/OpenMontage`. 근거 경로는 모두 이 루트 기준 상대경로로 표기.

**핵심 아키텍처 한 줄**: 코드 오케스트레이터가 없다. AI 코딩 에이전트가 오케스트레이터다. Python은 "툴 + 영속성"만 제공하고, 창작 로직·품질기준·워크플로우는 전부 읽을 수 있는 YAML 매니페스트 + Markdown 스킬 파일에 있다 (`README.md` "How It Works" 섹션, `PROJECT_CONTEXT.md`).

**수치 실측 (마케팅 문구 vs 실제)**:
- 파이프라인: `skills/pipelines/` 하위 12개 디렉토리 + `pipeline_defs/` 12개 실 yaml (+`framework-smoke.yaml` 테스트용). → **12개 확인**.
- 툴: README 본문 "52 tools", 아키텍처 다이어그램 "48 Python tools" 로 자체 불일치. 실측: `tools/` 하위 `.py` ~103개, `capability=` 선언 파일 90개. 능력군(capability) 24종.
- 스킬: 표제 "500+/400+" — 실측 `.agents/skills/` (Layer 3) 디렉토리 79개, `.md` 파일 **562개**. Layer 2 `skills/`는 core 6 + creative 35 + meta 11 + pipelines 103 = ~155개.

---

## 1. 12개 파이프라인 (이름 · 용도 · 입출력)

각 파이프라인 = `pipeline_defs/<name>.yaml` (매니페스트: 스테이지·툴·리뷰기준·성공게이트) + `skills/pipelines/<name>/` (스테이지별 director 스킬). 근거: `pipeline_defs/*.yaml` description·stages.

1. **animated-explainer** (`animated-explainer.yaml`, category=generated) — 토픽/아이디어 한 줄 → 리서치·내레이션·비주얼·음악 전부 AI 생성 교육 영상. 입력: 텍스트 토픽. 출력: 완성 mp4. 스테이지: research→proposal→**sample**→script→scene_plan→assets→edit→compose→publish.
2. **animation** (`animation.yaml`, category=animation) — 모션그래픽·키네틱 타이포·다이어그램·수학 비주얼. 입력: 토픽 + animation mode 선택. 출력: 애니메이션 mp4. 스테이지 동일(9단계).
3. **avatar-spokesperson** (`avatar-spokesperson.yaml`, category=custom) — 디지털 프레젠터가 앵커인 스포크스퍼슨/온보딩/세일즈 영상. 입력: 스크립트/아이디어. 출력: 립싱크 아바타 영상. 스테이지: idea→script→scene_plan→assets→edit→compose→publish (리서치 없음).
4. **character-animation** (`character-animation.yaml`, category=animation) — 재사용 가능한 로컬 카툰 캐릭터 애니메이션. 입력: 스크립트+씬플랜 → character specs·rig plans·pose libraries·action timelines. 출력: 브라우저 렌더 SVG/Canvas/Remotion/HyperFrames 애니. 스테이지에 **character_design·rig_plan** 고유 단계 추가(11단계). 원격 video-gen 대체가 아닌 결정론적 로컬 모션 지향.
5. **cinematic** (`cinematic.yaml`, category=cinematic) — 무드 주도 트레일러·브랜드필름·몽타주. 입력: 공급 푸티지/스틸/소스미디어(옵션 생성 인서트). 출력: 드라마틱 편집본. reference_input analysis_depth=deep.
6. **clip-factory** (`clip-factory.yaml`, category=custom) — 롱폼(웨비나·스트림·인터뷰) 1개 → N개 독립 숏폼 딜리버러블. 입력: 롱폼 소스. 출력: 랭킹된 여러 클립. script 단계에서 "clip-worthy 세그먼트 식별·랭킹 (hook, coherence, value, energy, platform fit)".
7. **documentary-montage** (`documentary-montage.yaml`, category=documentary) — 검색 우선(retrieval-first) 실footage 몽타주. 입력: 테마 브리프. Pexels/Archive.org/NASA/Wikimedia/Unsplash에서 **CLIP 기반 시맨틱 코퍼스** 구축 후 슬롯 설명으로 검색해 채움. 출력: 내러티브 비트 배열 + 음악싱크 + 혼합시대 footage 균일 컬러그레이드. 스테이지 최소(idea→scene_plan→assets→edit→compose). Adam Curtis/Chris Marker 톤.
8. **hybrid** (`hybrid.yaml`, category=hybrid) — 소스 푸티지 + 생성/디자인 서포트 에셋 결합(인터뷰+다이어그램, 제품footage+오버레이). 입력: 소스+생성. 출력: 크로스미디엄 편집본.
9. **localization-dub** (`localization-dub.yaml`, category=custom) — transcript-first 로컬라이제이션. 입력: 기존 소스 영상. 출력: 번역 자막·더빙 오디오·옵션 립싱크 언어변형.
10. **podcast-repurpose** (`podcast-repurpose.yaml`, category=custom) — 팟캐스트 오디오/비디오 → 오디오그램·캡션클립·인용 소셜에셋. 입력: 팟캐스트. 출력: 다중 딜리버러블.
11. **screen-demo** (`screen-demo.yaml`, category=?) — 2모드: (1) REAL CAPTURE(screen_recorder/cap_recorder/playwright-recording로 실화면 캡처→콜아웃·zoom crop·자막), (2) SYNTHETIC(Remotion TerminalScene로 CLI/터미널 데모를 결정론적 애니로 렌더 — 타이핑 명령·스크롤 출력·커서). 입력: 화면녹화 or 명령시퀀스. 출력: 데모 영상.
12. **talking-head** (`talking-head.yaml`) — 푸티지 주도 화자 영상(발표·브이로그·인터뷰). 입력: 화자 footage. 출력: 편집된 토킹헤드.

**공통 플로우**: `research → proposal → script → scene_plan → assets → edit → compose` + publish (`README.md` Pipelines 섹션). 각 스테이지마다 전용 director 스킬 md.

---

## 2. 52개 툴 + 에이전트 스킬 체계 조직

**3-레이어 지식 아키텍처** (`skills/INDEX.md`, `README.md`):
- **Layer 1 — "무엇이 존재하나"**: `tools/tool_registry.py` (20KB) + `tools/base_tool.py` (16KB). 각 툴이 `capability`, `provider`, `tier`, `status`, `dependencies`, `cost`, `agent_skills[]` 을 클래스 선언으로 명시.
- **Layer 2 — "OpenMontage가 어떻게 쓰나"**: `skills/{core,creative,meta,pipelines}/`. 관례·아티팩트 매핑·품질 체크리스트.
- **Layer 3 — "기술 자체가 어떻게 동작하나"**: `.agents/skills/` (79개 디렉토리, 562 md). 벤더 API 지식(remotion, gsap-core, elevenlabs, bfl-api, threejs-*, hyperframes-* 등). 툴의 `agent_skills[]`가 이걸 포인팅.

**툴 폴더 조직** (`tools/`): video(35 py), graphics(16), audio(15), analysis(14), enhancement(7), capture(4), avatar(3), _comfyui(3), character(2), publishers(2), subtitle(2).

**능력군(capability) 24종 + Selector 패턴** (실측 `grep capability=`): video_generation(19 provider), image_generation(12), analysis(12), video_post(9), tts(7), enhancement(6), character_animation(6), screen_capture(3), graphics(3), subtitle/music_search/music_generation/avatar/audio_processing(각 2), source_ingest/publish/music_library/corpus_population/clip_retrieval/clip_acquisition(각 1).

**Selector/Provider 패턴** (`skills/INDEX.md`): 멀티프로바이더 능력군은 `tts_selector`/`video_selector`/`image_selector`가 레지스트리에서 프로바이더 자동발견 → API키 유무·비용·요건으로 최적 라우팅. **하드코딩 툴 리스트 없음** — 레지스트리가 단일 진실원천. 새 툴은 폴더에 넣고 capability/provider만 선언하면 셀렉터가 자동 편입.

**스코어드 셀렉터**: 모든 프로바이더를 7차원(task fit, output quality, control, reliability, cost efficiency, latency, continuity)으로 점수화해 자동 선택 + 감사가능 decision_log (`README.md`).

---

## 3. 씬/타임라인 매니페스트 스키마 (씬별 설정 필드)

두 개의 핵심 아티팩트 스키마 (`schemas/artifacts/`, 총 15개 JSON Schema).

### `scene_plan.schema.json` (씬 계획 — "무엇을 촬영/생성하나")
씬 배열, 각 씬 필드:
- **필수**: `id`, `type`(enum: talking_head/broll/animation/character_scene/diagram/text_card/transition/generated/screen_recording), `description`, `start_seconds`, `end_seconds`.
- `script_section_id`, `framing`, `movement`, `transition_in/out`, `overlay_notes`.
- **`shot_language`** (구조화된 촬영 어휘): `shot_size`(10종 enum: extreme_wide…establishing), `camera_movement`(18종: pan/tilt/dolly/tracking/crane/whip_pan/orbital/rack_focus…), `lens_mm`(14/24/35/50/85/135/200 고정), `lighting_key`(11종: high_key/golden_hour/neon/rim_lit/volumetric…), `depth_of_field`(shallow/medium/deep), `color_temperature`.
- **내러티브 메타**: `shot_intent`(왜 이 샷이 존재하나), `narrative_role`(10종 enum: establish_context/build_tension/deliver_payload/emotional_beat/call_to_action…), `information_role`, `hero_moment`(bool — 영상의 시각적 정점).
- **`character_actions`**: 리그드 캐릭터 씬용 — character_id, emotion, action_sequence[], dialogue, target.
- `texture_keywords`(grain/anamorphic/gritty/ethereal…), `required_assets`(type, description, source: generate/source/provided/record).

### `edit_decisions.schema.json` (편집 결정 — "어떻게 조립하나")
- **`cuts[]`**: id, source, in/out_seconds, `speed`, `layer`(primary/overlay/background), `transform`(scale/position/`animation`=ken-burns-slow-zoom 등/crop x·y·w·h), `transition_in/out` + `transition_duration`, `reason`.
- **`overlays[]`**: asset_id, start/end, position(x·y·w·h), animation, opacity.
- **`audio`**: narration.segments[], music(volume, fade_in/out, **`ducking`** = bool 또는 {threshold_db, reduction_db, attack_ms, release_ms}), sfx[].
- **`subtitles`**: enabled, style(sentence/word-by-word/karaoke), font, font_size, color, outline_color, background(alpha 지원), position, max_words_per_line.
- **proposal에서 잠기는 3직교축**: `renderer_family`(8종: explainer-data/cinematic-trailer/documentary-montage/product-reveal…), `render_runtime`(remotion/hyperframes/ffmpeg), `composition_mode`(templated/atelier). edit는 이걸 변경 못 함(로그된 결정 없이는).
- `slideshow_risk_score`(average + verdict: strong/acceptable/revise/fail — `lib/slideshow_risk.py`).

이 둘의 분리가 설계상 중요: **scene_plan = 콘텐츠 의도, edit_decisions = 렌더 지시**. 씬별 개별 수정 시 어느 아티팩트를 건드릴지 명확.

---

## 4. 미리보기/편집 루프 — UI 유무, 부분 재렌더

### Backlot = "Living Storyboard" (`backlot/`)
- **명시적으로 READ-ONLY** (`backlot/README.md`: "A read-only local board", `backlot/server.py`: "The server never writes to project directories"). 즉 **편집 UI가 아니라 모니터링/승인 대시보드**다.
- 스택: FastAPI + SSE + `watchfiles`. `projects/<id>/`에 파이프라인이 이미 쓰는 파일들에서 보드 상태를 파생. 에이전트 개입 없음.
- 상태 소스 매핑(`backlot/README.md` 표): identity=project.json+pipeline yaml, 스테이지/게이트/버전=`checkpoint_<stage>.json`+`history/`, 스크립트카드=`artifacts/script.json`, 필름스트립=`scene_plan × script × asset_manifest` 조인, 생성중 시머/액티비티=`events.jsonl`(BaseTool 계측이 기록), 비용미터=checkpoint `cost_snapshot`, 렌더=`renders/*.mp4`.
- 서버 라우트(`backlot/server.py`): `/api/project/{id}/state`, `/api/project/{id}/events`(SSE), `/thumb/...`, `/media/...`. 썸네일 캐시 320/640/960 폭.
- **승인 게이트는 채팅에서 응답** — 보드는 "무엇이 왜 대기중인지" 표시만, 사용자는 채팅으로 답함 (`README.md`: "Creative gates hold until you answer… you reply in chat").
- **REPLAY RUN**: 완성된 런을 checkpoint history + event 타임스탬프로 재구성해 end-to-end 스크럽.
- **스토리보드 = 실제 승인 게이트**: 에셋 생성이 씬별 contact sheet(테이크·프롬프트·per-asset 비용·품질점수)에서 일시정지 → **렌더 전에** 비주얼 승인.

### 부분 재렌더 / 프리뷰 메커니즘
- **"sample" 서브스테이지** = 부분 프리뷰의 핵심 (`pipeline_defs/animated-explainer.yaml` L106, cinematic/animation/character-animation에도 존재): proposal 후 assets 전에 **10-15초 프리뷰 클립**을 먼저 렌더해 승인받음. condition=`video_analysis_brief_exists`. 전체 생산 전 톤/음성/스타일 검증.
- **체크포인트 기반 resume** (`skills/meta/checkpoint-protocol.md`, `schemas/checkpoints/checkpoint.schema.json`): status enum = completed/failed/**awaiting_human**/**in_progress**. "intra-stage checkpointing"으로 부분진행 resume. compose에서 크래시하면 idea가 아닌 compose부터 재개.
- **진짜 씬 단위 "부분 재렌더" 전용 API는 없음**. 대신 EP(executive-producer) 피드백 루프로 "send-back": 문제 씬을 asset director(재생성) 또는 compose director(재렌더)로 되돌림 (`skills/pipelines/*/executive-producer.md`: "EP FEEDBACK — Re-render Required", max_revisions_per_stage=3, max_send_backs=3). 재렌더는 전체 컴포지션 재실행이 기본이나, retake 프롬프트/seed를 asset_manifest에 기록해 일관 재생산 (`skills/pipelines/cinematic/asset-director.md`, seedance-prompting.md).

**→ 우리 설계 시사점**: OpenMontage의 "띄워서 수정 UI"는 실제로는 **read-only 관찰 보드 + 채팅 승인 게이트**이고, 진짜 인라인 편집은 없다. 우리가 인라인 수정 UI를 만든다면 이건 그들이 안 한 차별점.

---

## 5. 렌더러 (ffmpeg/Remotion/브라우저?)

**3개 런타임, `edit_decisions.render_runtime`으로 라우팅** (`tools/video/video_compose.py` docstring 확인):
1. **Remotion (기본)** — React 기반 프레임정확 렌더, `npx remotion render` 서브프로세스. `remotion-composer/` (React/TS): `Explainer.tsx`, `CinematicRenderer.tsx`, `TalkingHead.tsx`, `LyricOverlay.tsx`, `CollageBurst.tsx`, `TitledVideo.tsx`. data-driven explainer·기존 React 씬스택의 기본. `remotion-composer/SCENE_TYPES.md`에 stock `cut.type` 레지스트리(text_card/stat_card/bar_chart…).
2. **HyperFrames** — HTML/CSS/GSAP 렌더, `hyperframes_compose` 툴. 벤더링 v0.7.17. 모션그래픽·키네틱타이포·product promo·website-to-video·**리그드 SVG 캐릭터 애니**. 내재적으로 atelier(cut-schema 없음, hand-authored `index.html` + `data-*` 타이밍 속성 + GSAP 타임라인). `ink-theater/`가 SVG 퍼펫/mocap 엔진.
3. **FFmpeg (항상 무료/가용)** — concat/trim, 자막 burn-in, 오디오 mux, 컬러그레이드. 컴포지션 없는 단순 컷 또는 명시적 지정 시.

**런타임 선택은 proposal에서 잠김** (`render_runtime`). Remotion=데이터주도/기존 React 스택 기본, HyperFrames=모션그래픽 헤비 브리프. 결정 매트릭스는 `skills/core/hyperframes.md`.

**브라우저 렌더링**: Remotion·HyperFrames 모두 Chromium(Node) 기반 헤드리스 렌더. character-animation은 "browser-rendered SVG/Canvas/Remotion/HyperFrames".

---

## 6. 훔칠 만한 독창 기능 Top 5

1. **3직교축 잠금 + 아티팩트 분리 (renderer_family / render_runtime / composition_mode)** — `schemas/artifacts/edit_decisions.schema.json`. "창작 문법 / 기술 엔진 / 조립방식"을 독립 축으로 분리하고 proposal에서 잠근 뒤 하위 스테이지가 못 바꾸게 governance. scene_plan(의도)과 edit_decisions(렌더지시)의 명확한 분리 = **세세한 설정 가능 스킬의 데이터모델 청사진**.

2. **"sample" 프리뷰 서브스테이지 + 스토리보드 승인 게이트** — `pipeline_defs/*.yaml`의 `sub_stages: sample` (10-15초 프리뷰) + Backlot contact sheet가 **렌더 전** 씬별 테이크·프롬프트·비용·품질점수로 승인. 비싼 전체 생성 전 저비용 검증 루프. 우리 "띄워서 수정 UI"의 승인 게이트 모델로 직수입 가능.

3. **`shot_language` 구조화 촬영 어휘 enum** — `scene_plan.schema.json`. shot_size 10종·camera_movement 18종·lens_mm 고정값·lighting_key 11종을 자유텍스트가 아닌 **enum 드롭다운**으로. + `narrative_role`/`shot_intent`/`hero_moment`. UI에서 씬별 셀렉트박스로 노출하기 완벽한 스키마. "세세하게 설정 가능"의 실제 필드 목록.

4. **atelier(bespoke) vs templated 모드 분기** — `skills/meta/bespoke-composition.md` + `edit_decisions.bespoke` 블록. "엔진 지식은 재사용, 창작 컴포넌트는 절대 재사용 금지" 원칙으로 hero 작업은 매번 fresh 비주얼언어를 강제. `_render_via_atelier`가 stock 레지스트리를 완전 우회하고 project-local Remotion entry를 렌더. **템플릿 양산 ↔ 1회성 고품질을 한 파이프라인에서 스위칭.**

5. **CLIP 시맨틱 코퍼스 검색 기반 실footage 몽타주** — `pipeline_defs/documentary-montage.yaml` + capability `corpus_population`/`clip_retrieval`/`clip_acquisition`. 무료/오픈 아카이브(Archive.org/NASA/Wikimedia/Pexels)로 CLIP 인덱싱 코퍼스 구축 → 슬롯 설명으로 시맨틱 검색해 실제 모션클립을 비트별로 편집. "이미지 몇 장 애니메이션"이 아닌 진짜 footage 편집을 무료 경로로. + **7차원 스코어드 프로바이더 셀렉터**(`tools/tool_registry.py`)와 **slideshow_risk_score 품질게이트**(`lib/slideshow_risk.py`)도 함께 참고할 governance 장치.

**보너스 아키텍처 교훈**: 코드 오케스트레이터 없이 YAML 매니페스트 + Markdown director 스킬 + JSON 아티팩트 스키마 3종으로 전 워크플로우를 선언 — 에이전트가 읽고 실행. `events.jsonl`을 BaseTool이 계측 기록하고 read-only 보드가 SSE로 실시간 파생하는 패턴은 "수정 UI"를 파일감시 기반으로 얹기 좋은 구조.

**주의(확인된 불일치)**: 표제 수치는 자체 문서 내에서도 흔들림 — "52 tools"(README 본문) vs "48"(다이어그램), "500+/400+ skills"(실측 Layer3 md 562개). 파이프라인 12개는 정확.