# Hyperframes 0.7.26 Source Claim Reverification

검증 대상:
- `/mnt/d/video-skill-research/06-plan/MASTER-PLAN.md` §1~§2
- `/mnt/d/video-skill-research/08-audit/RESOLUTION.md` A절
- 소스 기준: `/mnt/d/deck-factory/vendor/hyperframes`

버전 고정 주장은 CONFIRMED다. `packages/cli/package.json:3`, `packages/core/package.json:3`, `packages/engine/package.json:3`, `packages/producer/package.json:3`, `packages/studio-server/package.json:3` 모두 `0.7.26`이다.

## 판정 요약

| # | 주장/검증 항목 | 판정 | 핵심 결론 | REFUTED/부분 수정문안 |
|---:|---|---|---|---|
| 1 | `render --composition <file>` 씬 단독 렌더와 mount 전제 | 부분 | 옵션은 실재한다. 다만 mount 필수는 `<template>` wrapper entry에 한정된다. standalone HTML orphan은 파일 검증만 통과하면 렌더될 수 있다. | "`--composition`은 파일 단독 렌더를 지원한다. `<template>` subcomposition entry만 `index.html`의 `data-composition-src` mount가 필요하다. standalone orphan HTML은 렌더 가능하다." |
| 2 | `--variables`/`--variables-file` 주입과 subcomposition per-instance 스코핑 | CONFIRMED | CLI 변수는 top-level `window.__hfVariables`로 들어간다. subcomposition instance scope는 host의 `data-variable-values`가 `window.__hfVariablesByComp[scopeId]`로 들어가는 별도 경로다. | - |
| 3 | preview 서버의 Studio UI 억제/headless API mode 플래그 | REFUTED | `hyperframes preview`에는 API-only/headless/UI suppression 플래그가 없다. `--no-open`은 브라우저 자동 열기만 끈다. | "preview 자체 플래그가 아니라 외부 reverse proxy로 UI/static/SPА fallback을 차단하거나, `createStudioApi(adapter)`를 직접 호스트해야 한다." |
| 4 | Studio read-only proxy 차단 목록: `PUT /files`, `file-mutations`, `gsap-mutations` | 부분 | 해당 라우트는 차단 대상이 맞지만 전부가 아니다. `POST/DELETE/PATCH /files`, duplicate/upload, registry install, render start/delete도 쓰기/부작용 라우트다. | "쓰기 차단 목록을 전 라우트 표 기준으로 확장한다. 단순 GET도 preview/thumbnail/waveform처럼 캐시나 ID persist가 있으면 조건부로 둔다." |
| 5 | SSE `/api/events`와 watcher 제외 목록 | 부분 | 이벤트는 `file-change` 하나다. 제외 목록에는 `outputs`, `renders`, `.hyperframes` 등이 있지만 `compositions/`는 없다. | "`compositions/`는 watcher 제외가 아니다. SSE 루프 회피는 `outputs/`, `renders/`, `.hyperframes/` 등 실제 제외 디렉터리로 제한한다." |
| 6 | `transitions.mjs`: outgoing만 연장, incoming start 불변, crossfade duration 규칙 | CONFIRMED | outgoing `data-duration`만 늘리고 incoming `data-start`는 건드리지 않는다. root duration도 갱신하지 않는다. | - |
| 7 | `audio.mjs`: BGM 더킹 부재, TTS 동시성 무제한, request/meta 계약 | CONFIRMED | 동적/keyframed ducking은 없다. BGM은 고정 volume metadata만 갖고, TTS는 `Promise.all(lines.map(...))`로 무제한 병렬이다. | - |
| 8 | lint 규칙 목록과 렌더 함정 4종 탐지 | 부분 | missing clip, same-track overlap, nondeterministic APIs, RAF, GSAP registry는 잡는다. 일반 inline `fetch()` 금지와 `gsap.timeline({ paused: true })` 강제 lint는 없다. | "lint가 모든 렌더 함정을 잡는다고 쓰지 않는다. general script fetch와 unpaused GSAP timeline은 별도 검증/리뷰 항목으로 남긴다." |
| 9 | `seedRandomFromFrame` 기본값과 켜는 방법 | CONFIRMED | 기본 shim은 false다. distributed chunk renderer만 `buildVirtualTimeShim({ seedRandomFromFrame: true })`를 사용한다. CLI 사용자 플래그는 발견되지 않았다. | - |
| 10 | 렌더 시 duration/frame 양자화 | CONFIRMED | 총 프레임은 `Math.ceil(duration * fps)`다. seek time은 frame index 기반이고 runtime quantize는 floor-to-frame이다. | - |

## 1. `render --composition <file>`

판정: 부분.

소스 근거:
- `packages/cli/src/commands/render.ts:155-162`는 `--composition`, alias `-c`를 정의하고, 특정 composition 파일 렌더 또는 생략/`.` 시 `index.html` 렌더라고 설명한다.
- `packages/cli/src/commands/render.ts:642-648`는 `resolveCompositionEntryArg(args.composition, project.dir, statSync)`로 entry 파일을 산출한다.
- `packages/cli/src/utils/renderArgs.ts:129-176`는 `--composition` 값을 프로젝트 내부 파일로만 해석하고, 존재 여부와 파일 여부를 검사한다. 여기에는 mount 검사 로직이 없다.
- `packages/cli/src/commands/render.ts:897-948`와 `packages/cli/src/commands/render.ts:1385-1408`는 `entryFile`을 producer render job config로 전달한다.
- `packages/producer/src/services/renderOrchestrator.ts:1099-1104`는 `job.config.entryFile || "index.html"`을 실제 HTML 경로로 선택한다.
- `packages/producer/src/services/renderOrchestrator.ts:1106-1128`는 entry가 `index.html`이 아니고 raw HTML이 `<template`으로 시작할 때만 `index.html`에서 `data-composition-src` mount를 찾아 standalone shell로 추출한다. mount가 없으면 `Entry file ... is not mounted from index.html via data-composition-src`를 던진다.
- `packages/producer/src/services/renderOrchestrator.ts:924-955`는 mounted host를 찾아 clone한 뒤 standalone render shell을 만든다.
- `packages/producer/src/services/htmlCompiler.ts:1501-1515`는 raw entry 자체를 compile할 때 entry 내부의 subcomposition reference 사용 가능성만 검사한다. raw entry가 `index.html`에 mount됐는지는 검사하지 않는다.

결론:
- `render --composition <file>` 자체는 CONFIRMED다.
- "mount required, unmounted not renderable"은 일반 명제로는 REFUTED다. mount 검사는 `<template>` wrapper entry 전용이다.
- P0b에서 orphan이 렌더 성공했다면, 소스상 가장 그럴듯한 설명은 그 orphan이 `<template>` wrapper가 아니라 standalone HTML entry였다는 것이다.

## 2. Variables와 per-instance scoping

판정: CONFIRMED, 단 scope는 두 경로로 나뉜다.

소스 근거:
- `packages/cli/src/commands/render.ts:275-289`는 `--variables`, `--variables-file`, `--strict-variables`를 정의한다.
- `packages/cli/src/utils/variables.ts:47-94`는 inline JSON과 file JSON을 상호 배타적으로 처리하고, JSON object만 허용한다.
- `packages/cli/src/commands/render.ts:886-894`는 variables를 resolve하고 project index schema 기준으로 검증한다.
- `packages/cli/src/utils/variables.ts:155-160`, `packages/cli/src/utils/variables.ts:174-185`, `packages/cli/src/utils/variables.ts:207-232`는 schema validation, strict error, non-strict warning을 처리한다.
- `packages/engine/src/types.ts:121-130`와 `packages/producer/src/services/renderOrchestrator.ts:266-274`는 render/capture variables가 `window.__hfVariables`로 inject된다고 문서화한다.
- `packages/engine/src/services/frameCapture.ts:416-430`는 page script 실행 전에 `window.__hfVariables = JSON.parse(json)`을 설치한다.
- `packages/core/src/runtime/getVariables.ts:1-14`는 top-level path가 declared defaults와 `window.__hfVariables`를 merge하고, subcomposition path가 `window.__hfVariablesByComp[compositionId]`를 사용한다고 설명한다.
- `packages/core/src/runtime/getVariables.ts:22-30`, `packages/core/src/runtime/getVariables.ts:39-67`는 default와 override merge를 구현한다.
- `packages/core/src/runtime/compositionLoader.ts:223-234`는 host의 `data-variable-values`를 parse한다.
- `packages/core/src/runtime/compositionLoader.ts:307-345`는 duplicate instance별 runtime composition id를 부여한다.
- `packages/core/src/runtime/compositionLoader.ts:534-548`는 host values를 `window.__hfVariablesByComp[runtimeScopeCompositionId]`에 저장한다.
- `packages/core/src/runtime/compositionLoader.ts:551-570`는 subcomposition scripts를 scoped `getVariables`로 감싼다.
- `packages/core/src/compiler/htmlBundler.ts:381-392`, `packages/core/src/compiler/htmlBundler.ts:945-948`도 host variable values를 bundle-time `window.__hfVariablesByComp`에 주입한다.

결론:
- CLI `--variables`/`--variables-file`은 top-level/global render-time injection이다.
- subcomposition per-instance scoping은 CLI per-instance 인자가 아니라 host `data-variable-values`로 작동한다.

## 3. Preview headless/API-only/UI suppression flag

판정: REFUTED.

소스 근거:
- `packages/cli/src/commands/preview.ts:80-145`의 preview args에는 `dir`, `port`, `force-new`, `list`, `kill-all`, `open`, selection/context flag, browser path/user data dir/remote debugging port만 있다. headless, api-only, no-ui, studio-disable 류 플래그는 없다.
- `packages/cli/src/commands/preview.ts:102-106`의 `--no-open`은 "Open browser automatically"만 끈다.
- `packages/cli/src/commands/preview.ts:835-910`는 embedded mode에서 항상 Studio server를 만들고, Studio summary를 출력하며, 조건부로 브라우저만 연다.
- `packages/studio-server/src/createStudioApi.ts:21-36`는 API sub-app만 만드는 factory를 제공하지만, CLI preview flag가 아니다.
- `packages/cli/src/server/studioServer.ts:607-622`는 `/api/*`에 shared API를 mount한다.
- `packages/cli/src/server/studioServer.ts:624-635`는 Studio static assets를 serve한다.
- `packages/cli/src/server/studioServer.ts:653-721`는 SPA fallback `GET *`를 serve한다.

수정문안:
> Hyperframes 0.7.26의 `hyperframes preview`에는 Studio UI 억제/headless API mode 플래그가 없다. read-only API mode가 필요하면 외부 reverse proxy에서 UI/static/fallback routes를 차단하고 허용 API만 통과시키거나, 별도 host에서 `createStudioApi(adapter)`를 직접 mount한다.

## 4. Studio file-write/mutation routes

판정: 부분. 자세한 전수 표는 `studio-routes-whitelist.md`에 작성했다.

주요 소스 근거:
- `packages/studio-server/src/createStudioApi.ts:21-36`는 projects, storyboard, files, preview, lint, render, thumbnail, selection, waveform, fonts, registry routes를 모두 register한다.
- `packages/cli/src/server/studioServer.ts:541-553`, `packages/cli/src/server/studioServer.ts:556-568`, `packages/cli/src/server/studioServer.ts:575-589`, `packages/cli/src/server/studioServer.ts:596-605`, `packages/cli/src/server/studioServer.ts:611-622`, `packages/cli/src/server/studioServer.ts:633-635`, `packages/cli/src/server/studioServer.ts:654-721`가 CLI wrapper/config/runtime/events/render/static/SPА fallback surface를 구성한다.
- `packages/studio-server/src/routes/files.ts:1585-2095`는 `/files`, `/file-mutations`, `/duplicate-file`, `/upload`, `/gsap-animations`, `/gsap-mutations`를 모두 포함한다.
- `packages/studio-server/src/routes/preview.ts:241-321`는 GET preview 중 `persistHfIdsIfNeeded`를 호출할 수 있다.
- `packages/studio-server/src/helpers/hfIdPersist.ts:13-38`는 새 `data-hf-id`가 mint되면 HTML을 `writeFileSync`로 저장한다.
- `packages/studio-server/src/routes/render.ts:49-124`는 POST render start에서 output/renders 작업을 만들고, `packages/studio-server/src/routes/render.ts:201-216`는 render delete를 수행한다.
- `packages/studio-server/src/routes/thumbnail.ts:12-124`와 `packages/studio-server/src/routes/waveform.ts:8-45`는 GET이지만 cache file을 쓴다.
- `packages/studio-server/src/routes/registry.ts:14-33`와 `packages/cli/src/server/studioServer.ts:504-530`는 registry install이 project dir에 파일을 설치함을 보여준다.

결론:
- `PUT /files`, `file-mutations`, `gsap-mutations` 차단은 맞지만 불완전하다.
- read-only proxy는 method가 GET인지뿐 아니라 실제 파일쓰기/캐시쓰기/렌더 job 생성 여부를 기준으로 나눠야 한다.

## 5. SSE `/api/events`

판정: 부분.

소스 근거:
- `packages/cli/src/server/studioServer.ts:579-589`는 SSE route에서 event 이름을 `file-change`, data를 `{"path": relativePath}`로 보낸다.
- `packages/cli/src/server/fileWatcher.ts:11-23`의 제외 목록은 `.cache`, `.git`, `.hyperframes`, `.next`, `.vite`, `build`, `coverage`, `dist`, `node_modules`, `outputs`, `renders`다.
- `packages/cli/src/server/fileWatcher.ts:26-30`는 path part가 위 set에 포함되면 제외한다.
- `packages/cli/src/server/fileWatcher.ts:32-49`는 recursive watch와 debounce notify를 수행한다.

수정문안:
> SSE 루프 회피용 산출물은 `outputs/`, `renders/`, `.hyperframes/` 등 실제 watcher 제외 디렉터리에 둔다. `compositions/`는 제외 목록에 없으므로 안전 디렉터리로 쓰지 않는다.

## 6. `transitions.mjs`

판정: CONFIRMED.

소스 근거:
- `skills/faceless-explainer/scripts/transitions.mjs:13-21`의 주석은 "EXTEND-OUTGOING-ONLY"로, outgoing wrapper `data-duration`만 transition 길이만큼 늘리고 `data-start`는 움직이지 않으며 voice/BGM/SFX/captions도 건드리지 않는다고 적는다.
- `skills/faceless-explainer/scripts/transitions.mjs:175-190`는 boundary마다 incoming start를 `T`로 읽고 outgoing duration을 `outgoing.duration + dur`로 갱신한다. incoming start mutation은 없다.
- `skills/faceless-explainer/scripts/transitions.mjs:197-208`는 ping-pong tracks를 rewrite하되 start는 유지한다.
- `skills/faceless-explainer/scripts/transitions.mjs:211-235`는 root `data-duration` 값을 읽어 GSAP full-span no-op을 넣지만 root duration을 바꾸지는 않는다.
- `skills/faceless-explainer/scripts/transitions.mjs:264-310`는 overlap, cross-track, id, same-track overlap 조건을 verify한다.

결론:
- crossfade overlap은 total duration 계산에서 빼거나 더하지 않는다.
- P0d의 ±1 frame 원인은 transition이 incoming start를 이동해서가 아니라, duration source와 `ceil(duration * fps)` 양자화 차이 후보가 더 직접적이다.

## 7. `audio.mjs`

판정: CONFIRMED.

소스 근거:
- `skills/hyperframes-media/scripts/audio.mjs:16-27`는 `audio_request.json` 계약을 정의한다: `provider`, `lang`, `speed`, `lines[{ id, text, sfx }]`, `bgm{ mode, query, prompt, blob, archetype, arc }`.
- `skills/hyperframes-media/scripts/audio.mjs:29-35`는 `audio_meta.json` 계약을 정의한다: `tts_provider`, `voice_id`, `bgm`, `bgm_pending`, `voices[{ id, path, duration_s, words }]`, `sfx[{ id, name, file, source, offset_s, duration_s, volume }]`, `total_duration_s`.
- `skills/hyperframes-media/scripts/audio.mjs:70-99`는 기본 request/output 경로와 request parse를 수행한다.
- `skills/hyperframes-media/scripts/audio.mjs:128-160`는 `synthLine`을 `Promise.all(lines.map(synthLine))`로 실행한다. concurrency limiter가 없다.
- `skills/hyperframes-media/scripts/audio.mjs:168-178`, `skills/hyperframes-media/scripts/audio.mjs:179-241`, `skills/hyperframes-media/scripts/audio.mjs:260-271`는 BGM metadata를 만들고 meta file을 쓰지만 dynamic ducking envelope를 만들지 않는다.
- `skills/hyperframes-media/scripts/lib/bgm.mjs:36-49`, `skills/hyperframes-media/scripts/lib/bgm.mjs:94-110`는 voice 유무에 따라 고정 volume `0.8`/`0.9`를 둔다.
- `skills/faceless-explainer/scripts/assemble-index.mjs:375-401`는 "duck under narration"이라고 주석을 달지만 실제 emit은 단일 `data-volume="${vol}"`이다.
- `packages/producer/src/services/render/stages/probeStage.ts:100-114`, `packages/producer/src/services/render/stages/probeStage.ts:400-420`, `packages/producer/src/services/htmlCompiler.ts:1793-1870`는 producer가 authored volume automation을 발견할 수 있음을 보여준다. 즉 ducking을 하려면 composition 쪽에서 keyframe/automation을 만들어야 한다.

결론:
- `audio.mjs` 자체에는 dynamic/keyframed BGM ducking이 없다.
- TTS concurrency unlimited 주장은 CONFIRMED다.
- request/meta field 계약도 CONFIRMED다.

## 8. Lint rules와 렌더 함정 탐지

판정: 부분.

Rule aggregate:
- `packages/lint/src/hyperframeLinter.ts:14-24`는 core, media, gsap, captions, composition, adapters, textures, fonts, slideshow rule set을 `ALL_RULES`로 합친다.
- `packages/lint/src/hyperframeLinter.ts:26-59`는 모든 rule을 실행하고 error가 없으면 ok로 판단한다.
- `packages/lint/src/hyperframeLinter.ts:103-155`는 media URL HEAD check용 `inaccessible_media_url`을 만든다. 이것은 composition JS 안의 임의 `fetch()` 금지가 아니라 lint 자체의 remote media 검증이다.

Rule inventory:

| 그룹 | rule code |
|---|---|
| core | `root_missing_composition_id`, `root_missing_dimensions`, `head_leaked_text`, `visible_markup_comment`, `missing_timeline_registry`, `timeline_registry_missing_init`, `timeline_id_mismatch`, `invalid_inline_script_syntax`, `host_missing_composition_id`, `scoped_css_missing_wrapper`, `composition_self_attribute_selector`, `studio_missing_editable_id`, `non_deterministic_code`, `pointer_events_none` |
| composition | `invalid_parent_traversal_in_asset_path`, `composition_file_too_large`, `timeline_track_too_dense`, `timed_element_missing_visibility_hidden`, `deprecated_data_layer`, `deprecated_data_end`, `split_data_attribute_selector`, `template_literal_selector`, `timed_element_missing_clip_class`, `overlapping_clips_same_track`, `root_composition_missing_data_start`, `standalone_composition_wrapped_in_template`, `root_composition_missing_html_wrapper`, `requestanimationframe_in_composition`, `invalid_variable_values_json`, `invalid_composition_variables_declaration`, `subcomposition_blanks_before_host`, `subcomposition_root_styled_by_class`, `root_composition_missing_duration_source` |
| media | `imperative_media_control`, `duplicate_media_id`, `duplicate_media_discovery_risk`, `video_missing_muted`, `video_muted_with_declared_audio`, `video_nested_in_timed_element`, `media_in_subcomposition`, `self_closing_media_tag`, `placeholder_media_url`, `base64_media_prohibited`, `media_missing_data_start`, `media_missing_id`, `media_missing_src`, `media_preload_none`, `media_crossorigin_breaks_preview`, `video_audio_double_source` |
| gsap | `overlapping_gsap_tweens`, `gsap_exit_missing_hard_kill`, `gsap_fullscreen_overlay_starts_visible`, `gsap_animates_clip_element`, `unscoped_gsap_selector`, `gsap_css_transform_conflict`, `missing_gsap_script`, `audio_reactive_single_tween_per_group`, `gsap_infinite_repeat`, `gsap_repeat_ceil_overshoot`, `scene_layer_missing_visibility_kill`, `gsap_timeline_not_registered`, `gsap_timeline_registered_before_async_build`, `gsap_from_opacity_noop`, `gsap_group_selector_keyframes` |
| adapters | `missing_lottie_script`, `missing_three_script` |
| fonts | `google_fonts_import`, `system_font_will_alias`, `font_family_without_font_face` |
| textures | `texture_drop_shadow_on_text`, `texture_class_missing_base`, `texture_text_missing_mask`, `texture_class_unknown` |
| captions | `caption_exit_missing_hard_kill`, `caption_text_overflow_risk`, `caption_transcript_not_inline`, `caption_transcript_parse_error`, `caption_container_relative_position`, `caption_overflow_clips_scaled_words`, `caption_textshadow_on_group_container`, `caption_fittext_scale_mismatch` |
| slideshow | `slideshow_invalid`, `slideshow_unresolved_ref` |
| project-level | `audio_file_without_element`, `audio_src_not_found`, `missing_local_asset`, `texture_mask_asset_not_found`, `multiple_root_compositions`, `duplicate_audio_track`, `missing_or_empty_sub_composition` |

렌더 함정별 판정:
- Missing `class="clip"`: CONFIRMED. `packages/lint/src/rules/composition.ts:346-378`의 `timed_element_missing_clip_class`가 잡고, `packages/lint/src/rules/composition.ts:232-260`의 `timed_element_missing_visibility_hidden`도 관련 보조 정보를 낸다.
- Same-track overlap: CONFIRMED. `packages/lint/src/rules/composition.ts:380-430`의 `overlapping_clips_same_track`가 잡는다.
- Nondeterminism: CONFIRMED. `packages/lint/src/rules/core.ts:446-492`의 `non_deterministic_code`가 `Math.random`, `Date.now`, `new Date`, `performance.now`, `crypto.getRandomValues` 등을 잡는다.
- `requestAnimationFrame`: CONFIRMED. `packages/lint/src/rules/composition.ts:498-517`의 `requestanimationframe_in_composition`이 잡는다.
- GSAP registry 누락: CONFIRMED. `packages/lint/src/rules/core.ts:247-280`, `packages/lint/src/rules/core.ts:282-306`, `packages/lint/src/rules/gsap.ts:1032-1059`가 registry init, id mismatch, timeline registration을 잡는다.
- 임의 inline script의 render-time `fetch()`: REFUTED. 일반 금지 rule은 발견되지 않았다. caption transcript fetch와 remote media URL lint는 별도다.
- `gsap.timeline({ paused: true })` 강제: REFUTED. unpaused timeline rule은 발견되지 않았다. runtime adapter는 `packages/core/src/adapters/gsap.ts:30-41`에서 timeline을 pause/seek하지만 lint가 authored `paused: true`를 강제하지는 않는다.

## 9. `seedRandomFromFrame`

판정: CONFIRMED.

소스 근거:
- `packages/producer/src/services/fileServer.ts:185-197`는 `seedRandomFromFrame`이 true면 `Math.random`/crypto를 현재 frame keyed PRNG로 대체하고, 기본 false면 native nondeterminism을 유지한다고 설명한다.
- `packages/producer/src/services/fileServer.ts:209-216`, `packages/producer/src/services/fileServer.ts:222-270`는 option true일 때만 seeded random block을 설치한다.
- `packages/producer/src/services/fileServer.ts:370-374`는 in-process 기본 `VIRTUAL_TIME_SHIM = buildVirtualTimeShim({ seedRandomFromFrame: false })`를 만든다.
- `packages/producer/src/services/renderOrchestrator.ts:1370-1375`와 `packages/producer/src/services/render/stages/probeStage.ts:164-170`는 normal render/probe가 false shim을 사용함을 보여준다.
- `packages/producer/src/services/distributed/renderChunk.ts:24-35`, `packages/producer/src/services/distributed/renderChunk.ts:501-512`는 distributed chunk renderer만 seeded-random shim을 사용한다고 명시하고 실제로 true를 넘긴다.
- `packages/producer/src/services/fileServer-seededRandom.test.ts:65-90`, `packages/producer/src/services/fileServer-seededRandom.test.ts:92-105`는 default false와 true 동작을 테스트한다.

결론:
- 기본값은 off다.
- 켜는 방법은 코드 경로상 `buildVirtualTimeShim({ seedRandomFromFrame: true })`다. 내장 사용처는 distributed chunk renderer이며 CLI user-facing flag는 발견되지 않았다.

## 10. Frame quantization과 duration 계산

판정: CONFIRMED.

소스 근거:
- `packages/producer/src/services/htmlCompiler.ts:1695-1701`는 root의 `data-duration` 또는 `data-composition-duration`에서 static duration을 읽는다.
- `packages/producer/src/services/render/stages/compileStage.ts:145-156`는 compiled `staticDuration`을 render composition duration 초기값으로 둔다.
- `packages/producer/src/services/render/stages/probeStage.ts:147-151`는 duration이 0 이하이거나 unresolved composition, auto-start video, scripted audio 등이 있으면 probe가 필요하다고 판단한다.
- `packages/producer/src/services/render/stages/probeStage.ts:249-263`는 duration이 있으면 static duration을 쓰고, 없으면 browser에서 `getCompositionDuration`을 읽는다.
- `packages/producer/src/services/render/stages/probeStage.ts:451-452`는 `totalFrames = Math.ceil(duration * fpsToNumber(job.config.fps))`를 사용한다.
- `packages/core/src/adapters/gsap.ts:33-35`의 GSAP adapter duration frame도 `Math.ceil(durationSeconds * fps)`다.
- `packages/engine/src/services/frameCapture.ts:1480-1494`도 static frame set total을 `Math.max(1, Math.ceil(duration * fps))`로 만든다.
- `packages/producer/src/services/render/stages/captureStage.ts:274-278`는 `i < rangeFrames`로 `[0,totalFrames)` frame을 돌고, time을 `absoluteIdx * fps.den / fps.num`으로 계산한다.
- `packages/engine/src/services/parallelCoordinator.ts:257-266`도 worker frame loop와 time 계산이 동일하다.
- `packages/core/src/inline-scripts/parityContract.ts:35-40`는 `quantizeTimeToFrame`에서 `Math.floor(safeTime * safeFps + 1e-9) / safeFps`를 쓴다.
- `packages/engine/src/services/frameCapture.ts:1299-1311`는 capture 전 `quantizeTimeToFrame`을 호출하고 `window.__hf.seek(t)`로 seek한다.

결론:
- 초에서 총 frame 수로 갈 때는 반올림이 아니라 올림이다.
- seek time은 frame index 기반이고 runtime quantize는 floor-to-frame이다.
- P0d ±1 frame은 `duration * fps`가 정수가 아닐 때 `ceil`로 한 frame 늘어나는 케이스, 또는 static/probed duration source 차이와 직접 관련된다.
