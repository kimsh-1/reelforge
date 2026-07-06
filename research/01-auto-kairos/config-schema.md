충분히 조사했습니다. 발견한 설정 계층 전체를 정리해 보고드립니다.

---

# auto_kairos 설정 가능성(configurability) 표면 전체 보고

주제 한 줄 → 리서치 → 원고 → 씬설계 → TTS/이미지/자막 → Remotion 렌더까지 자동화하는 파이프라인. 설정 노브는 **5개 계층**으로 나뉩니다: (A) 환경변수 `.env`, (B) 프로젝트 DB config, (C) 아트스타일 프리셋 JSON, (D) 씬 매니페스트 스키마, (E) 음성 프리셋. 아래는 코드에서 확인된 것만 인용합니다.

## A. 전역 환경변수 노브 — `.env.example`
경로: `auto_kairos/.env.example`

- **API 키 (필수)**: `GOOGLE_API_KEY`(Gemini 팩트체크/TTS), `ELEVENLABS_API_KEY`(TTS), `OPENAI_API_KEY`(Whisper 자막동기화), `FAL_API_KEY`(Qwen 이미지), `SERPER_API_KEY`(구글 이미지검색), `PIXABAY_API_KEY`, `NAVER_API_CLIENT_ID/SECRET`(한국뉴스), `MINIMAX_API_KEY`
- **ElevenLabs 상세** (선택, `:44-52`): `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL_ID`(기본 `eleven_multilingual_v2`), `ELEVENLABS_VOICE_SETTINGS`(JSON: stability/similarity_boost)
- **이미지 엔진** (`:80`): `SEARCH_ENGINE` = `serper` | `pixabay`
- **인프라**: `SUPABASE_URL/KEY/BUCKET`, `KAIROS_DISCORD_WEBHOOK_URL`, `KAIROS_DASHBOARD_URL`, `KAIROS_CORS_ORIGINS`, `AUTO_AGENT_WORKSPACE`, `AUTO_AGENT_DB`, `KAIROS_VAULT_DIR`(NAS 볼트), `NODEJS_BIN_DIR`, `CLAUDE_CLI`, `CODEX_IMAGEGEN_DIR`
- **YouTube OAuth**: `YOUTUBE_CLIENT_ID/SECRET/REFRESH_TOKEN/CHANNEL_ID_*`
- **레거시 토글**: `ENABLE_LEGACY_INGEST=1` (CLAUDE.md `:120`)

## B. 프로젝트별 DB config — CLI `config set <key> <value>`
경로: `auto_agent/db/cli.py:150-255`, 설정은 SQLite `projects.config` JSON에 저장 (`auto_agent/db/project_manager.py`)

확인된 설정 키 (`db/cli.py`, `project_manager.py`, 프로젝트 생성 시 `cmd_project`):
- `art_style` — 스타일 ID 또는 JSON 경로 (설정 시 `provision_art_style()`로 프로젝트 폴더에 복제; `db/cli.py:220`)
- `voice` — 프리셋 이름 → `voice_id`+`voice_settings`로 자동 해석 (`db/cli.py:197-210`)
- `voice_id`, `voice_settings` (JSON)
- `writing_style`
- `duration_minutes` (프로젝트 생성 시, `db/cli.py:89`)
- `font_family` (`auto_agent/cli.py:643-708`, `cmd_font`, `DEFAULT_FONT`)
- `video_theme` = `dark`(기본) | `white` (`build_manifest.py:260`)
- `channel`
- `config-inspector` 에이전트가 파이프라인 시작 전 DB config ↔ artstyle JSON ↔ env 교차검증·자동수정 (`auto_agent/data/skills/agents/config-inspector/SKILL.md`). **단일 소스는 artstyle JSON** — voice_id 불일치 시 artstyle 값으로 덮어씀.

CLI: `config get|set|set-json|delete`, `voice list|add|remove`, `font`, `style list`, `bg`.

## C. 아트스타일 프리셋 — `design_tokens`가 핵심 노브
경로: `auto_agent/data/artstyle/styles/*.json` (v3, 5개) + `styles_v4/*.json` (v4, 4개)
스키마 검증: `auto_agent/data/artstyle/preset_schema.py`

**프리셋 인벤토리 (v3, `id | voice_id | baseTheme`)**:
- `semoji` (세모지스타일, 2D 플랫) | `W7FnAxJNpD5WGjrF5GLp` | light
- `semoji_3D` | `W7FnAxJNpD5WGjrF5GLp` | light
- `quirky_cartoon` (이로미즘) | `9Sj8ugvpK1DmcAXyvi3a` | dark
- `lego` (최후의경제왕) | `4JJwo477JUAx3HV0T7n7` | dark
- `stickman_cute` | default | dark

**필수 섹션** (`preset_schema.py:6-9`): `image`, `voice`, `creative`, `scenes`, `guidelines`. `image` 필수: `staging`(enum `cinematic`|`flat`), `reference_image`, `scene_style_description`. `voice` 필수: `voice_id`.

**프리셋 최상위 필드** (semoji.json 인용):
- `id, name, description, channel, reference_image, scene_style_description`
- `style{}`: `art_style, linework{outline,variation}, shapes, color_palette, shading, character_design`
- `technical{no_text, critical_requirements[]}`
- `voice{voice_id, voice_settings{stability, similarity_boost, style, speed}}`
- `creative{headline_frequency, mood_palette[], preferred_layouts[items_grid,items_list,counter,bar,pie,flow]}`
- `scenes{density(high), min_duration_sec:3, max_duration_sec:12, prefer_split_on[]}`
- `guidelines`, `writing_style`, `mood[]`

**`design_tokens{}` — 가장 세밀한 시각 노브** (semoji.json:87-262):
- `baseTheme, defaultBackground, defaultBgOpacity, disableIcons, disableSpotlight, quoteReveal(typewriter|fade), headlineTypewriterTriggers[], defaultItemEntrance(fadeRise|overshoot|bounce|scale|spring), countUpThreshold`
- `texture{src, blendMode, opacity, topLayer}`
- `colors{accent, accentRgb, accentBg, accentBorder, accentSoft, cardBg, cardBorder}`
- `moods{dramatic|urgent|somber|informative|contemplative|suspense|triumphant}` — 각 `{accent, accentRgb, speed, glow}`
- `layout{cardRadius, gap}`, `map{defaultTheme}`
- `variants{itemsList, itemsGrid, comparisonCell, metricCard}`
- `chartagent{theme_set, theme_overrides{pattern_mode}}`
- `fonts{body|headline|value|subtitle|mono}` — 각 `{family, fallback, files[{file,weight}]}`
- `subtitle{max_chars_per_line, fontSize, fontFamily, fontWeight, color, strokeWidth, strokeColor, keywordColor, keywordStrokeColor, backgroundColor, border, borderRadius, boxShadow, bottomOffset, maxWidth, lineHeight}`
- `enable_web_search`

**전체 DesignPreset 타입 정의** (TS, 훨씬 방대): `remotion/src/design/types.ts` — `PresetColors`(15필드+rank), `PresetTypography`(35개 폰트 크기 토큰), `PresetLayout`(50+ 치수 토큰), `ComponentVariants`(30종 컴포넌트별 variant enum: circleBadge/card/metricCard/callout/tag/divider/timelineDot 등), `MoodOverride`, `PresetBackground{pattern:dots|grid|lines|none}`. 매니페스트로 `DesignPresetOverride`(전 필드 deep-partial)를 넘겨 프리셋 위에 덮어쓸 수 있음.

**v4 스키마는 구조가 다름** (`styles_v4/iromism.json`): `channel, style_id, mood, illustration_mode(예: cinematic_documentary_cartoon), color_palette{primary,secondary,accent,background,note}, character_design_rules, image_generation_defaults{aspect_ratio:"16:9", negative_keywords[], style_keywords[]}, reference_aesthetic, reference_scenes_dir, secondary_reference_image, original_motif`. v4 빌더: `auto_agent/modules/v4_bridge/build_art_style.py`.

## D. 씬 매니페스트 스키마 — 두 계층
### D-1. 에이전트 저작 `scene_specs.json` (플랫 스키마)
정의: `auto_agent/data/skills/agents/script-director/SKILL.md:873-945`, 규칙: `docs/rules/scene-specs-rules.md`

씬당 필드:
```
sceneNumber, chapter, title, narration, concept,
layout, motion, mood,
headline, items[], values[], unit, source, icons[], flags[],
imageAsset, mapScene, chartConfig, characters[], background_context, is_first_of_background
```
- `layout` enum (SKILL.md:302): `cinematic, counter, before_after, items_list, headline_only, items_grid, metric_spotlight, bar, pie, line, area, quote_portrait, comparison_table, split, ...`
- `visual_kind` (단일 primary, SKILL.md:533): `generate_image | search_image | chart | map_scene | video | none` + `visual_kind_reason` 필수
- `mood` enum: dramatic/contemplative/urgent/triumphant/somber/informative/suspense
- `imageAsset.source`: `generate`(prompt, background, camera, placement) | `search`(query, placement)
- `videoAsset`: `query, keywords[], license_preference, duration_hint{min,max}, segment_hint, placement`
- `chartConfig` — layout이 bar/pie/line/area일 때 필수, `vizType` 동반

### D-2. Remotion 소비 `manifest.json` (`build_manifest.py`가 생성)
타입 정의: `auto_agent/remotion_template/src/types/manifest.ts` (가장 완전한 렌더 스키마)
- `meta{topic, resolution{width:1920,height:1080}, fps:30, subtitleFont, vizFont, designTokens, videoTheme(dark|white), artStyle, designPreset}` — 기본값 `build_manifest.py:831-835`
- `SceneEntry`: `sceneNumber, imagePath, audioPath, audioDurationSec, subtitles[], visualization, kenBurns, transition, vizAnimation, imageMode(cover|contain), imageAsset{placement(fullscreen|background|center|left|right|inline), opacity, offsetX/Y, scale, itemImages}, overrides(CanvasOverrides), vizBackgroundPath, trailerVideoPath, trailerClip, videoThumbPath, mapScene, overlays[]`
- `CreativeDirection`: `concept, layout, reveal(fade_in|stagger|stagger_then_flash|cascade|count_up|typewriter|spotlight|split_reveal|zoom_in|build_up|dramatic_pause|parallel), emphasis(number|keyword|count|contrast|sequence|person|quote|none), headline, mood`
- `KenBurnsConfig{enabled, zoomFactor, zoomDirection(in|out), panDirection(none|left|right|up|down), panX, panY, easing}`
- `TransitionConfig{type(crossfade|cut|fade|slide|wipe|slide_left|slide_right|wipe_left|wipe_right), durationFrames, easing}`
- `VizAnimationConfig{stagger, itemDuration, easing, titleFadeIn, titleSlideUp, itemSyncPoints[], exitFadeOut, exitDirection}`
- `SubtitleConfig` (16필드): visible/fontFamily/fontSize/fontWeight/color/strokeColor/strokeWidth/keywordColor/keywordStrokeColor/bottomOffset/maxWidth/lineHeight/backgroundColor/borderRadius/boxShadow — 기본값 인라인 명시
- `MapSceneData{mapType(location_reveal|route_animation|territory_overlay|fly_through), mapStyle(11종: modern_clean|historical|dark_cyber|satellite|vintage_parchment|minimal_light|dark_elegant|blueprint|warm_earth|matte_slate|clean_white), camera{keyframes[{frame,center,zoom,bearing,pitch}]}, markers[], route, territories[], labels[], prerenderedBg}` (맵 테마 실파일: `remotion_template/test/theme_*.json` 8종)
- `OverlayItem{type(gif|lottie), assetId, position(9종), x/y/scale/opacity/enterFrame/exitFrame/loop}`
- `BGMConfig{path, volume, loop}` — 단, `build_manifest.py:841`에서 현재 `"bgm": None` 하드코딩 (BGM은 스키마상 존재하나 자동주입 미구현, 수동 설정 여지)

**Remotion 슬라이드 레이아웃 15종** (`remotion_template/test_props/slide_*.json`): summary, proscons, profile, qna/qna_img, definition/definition_img, ranking/ranking_img, checklist, countdown/countdown_img, statistic/statistic_img, process. 디자인 프리셋 TS: `remotion/src/design/presets/` (semoji, semoji_3D, quirky_cartoon, lego, stickman_cute).

## E. TTS 음성/프로바이더
- 프리셋 저장소: 워크스페이스 루트 `voices.json`, 관리자 `auto_agent/voice_manager.py`. 기본 3개(`DEFAULT_VOICES:14-49`): 이로미즘/세모지/최후의경제왕 — 각 `{name, voice_id, description, voice_settings{stability, similarity_boost, style, use_speaker_boost, speed}}`
- 엔진: `auto_agent/tools/elevenlabs.py` — `tts_provider: Literal["elevenlabs","gemini"]`(`:236`, 기본 elevenlabs). 프로바이더별 분기: elevenlabs는 `voice_id`+`model_id`(기본 `eleven_multilingual_v2`), gemini는 `gemini_voice`. 코드 하드 기본 voice_id `9Sj8ugvpK1DmcAXyvi3a`(`:248`). output_format `mp3_44100_128` / gemini는 wav. with-timestamps 엔드포인트로 단어 타임스탬프 확보.
- 한국어 전처리 노브: `korean_tts_preprocessor.py`, 규칙 `auto_agent/data/skills/shared/korean-tts-rules.md`, `data/prompts/single-call/tts-preprocess.md` (숫자→한글, 기호 처리 등)
- 자막 동기화: OpenAI Whisper (`.env` `OPENAI_API_KEY`)

## F. 기타 사용자 조정 노브
- **파이프라인 정의**: `auto_agent/data/pipeline.json` (`$schema: docs/pipeline-schema.json`) — phase/step/agent/module, `blocking`, `skip_resume`, `checks[]`. 스텝 실행 제어: CLI `run --from/--only step_X`
- **에이전트 설정**: `auto_agent/data/agents.json` (모델, max_turns, allowed_tools, shared_skills)
- **채널 플레이북**: `auto_agent/data/channel_playbook.json`, **스텝 라벨**: `data/step_labels.json`
- **리서치 신뢰도**: `auto_agent/research/trust_tiers.json`
- **시리즈 사전기획 스키마**: `auto_agent/data/docs/series-plan-schema.json` — `series_id, title, channel, writing_style, total_episodes, series_angle, series_hook, key_entities[], episodes[{episode_number, title, scope_start, scope_end, core_question, key_events[], key_persons[]}]`
- **래칫 리뷰 임계값**: `pass_threshold`(기본 90, CLAUDE.md 트러블슈팅에선 85 조정 언급), 최대 3라운드
- **차트 테마**: `chartagent_dashboard/dashboard_manifest.json` + `theme_gallery_cases/` (프리셋 `theme_set`, `pattern_mode`로 참조)
- **폰트 엔진**: `fontagent.db` — mood별 프로젝트 폰트 자동선택 (`get_project_fonts(mood=...)`, `build_manifest.py:820`)

## 설계 참고용 핵심 요약
- **단일 소스 원칙**: 시각 설정의 진실은 `artstyle JSON의 design_tokens` 한 곳 → TS `resolvePreset.ts`와 Python `_load_design_tokens()`가 각각 소비 (`scene-specs-rules.md:20-24`). 하드코딩 색상 금지.
- **씬 스키마는 플랫**: 중첩 `visualization.creative` 미사용(에이전트 저작 단), 렌더 매니페스트에서만 중첩(`visualization{creative}`)으로 변환.
- **오버라이드 계층**: artstyle 기본값 → `meta.designPreset`(DeepPartial) → 씬별 `overrides`(CanvasOverrides: headline/image x/y/size) 순으로 좁아짐. 세밀 설정 스킬 설계 시 이 3단 오버라이드 모델이 참고점.
- **BGM은 스키마만 존재, 자동주입 미구현** — 새 스킬에서 채울 여지.

주요 파일 절대경로:
- `/tmp/claude-1000/-home-seunghyeong/ce8cbf1e-1e75-4f17-bf49-55b322c34874/scratchpad/auto_kairos/auto_agent/remotion_template/src/types/manifest.ts` (렌더 스키마 전체)
- `.../remotion/src/design/types.ts` (DesignPreset 전체 토큰)
- `.../auto_agent/data/artstyle/styles/semoji.json` (프리셋 실예시)
- `.../auto_agent/data/skills/agents/script-director/SKILL.md` (씬 스펙 저작 규칙)
- `.../auto_agent/db/cli.py` + `.../auto_agent/voice_manager.py` + `.../auto_agent/tools/elevenlabs.py` (config/voice/TTS)
- `.../auto_agent/data/artstyle/preset_schema.py` (프리셋 검증 규칙)