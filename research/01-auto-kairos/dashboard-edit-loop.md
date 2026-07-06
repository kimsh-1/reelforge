I have a complete picture. Here is my analysis.

---

# auto_kairos 대시보드 "띄워서 수정" 기능 해부

## 요약 (핵심 발견)

auto_kairos의 편집 루프는 **"부분 재렌더"가 사실상 두 층으로 나뉘어 있다**:

1. **미리보기(preview)는 렌더가 아니다** — 편집 UI는 `@remotion/player`로 씬 1개를 브라우저에서 실시간 클라이언트 렌더한다. 최종 영상과 **동일한 React 렌더러 컴포넌트**(`SceneRenderer`)를 쓰므로 WYSIWYG이고, "부분 재렌더"가 필요 없다 — 폼 값을 바꾸면 React state가 바뀌고 Player가 즉시 다시 그린다.
2. **저장은 단일 JSON(`scene_specs.json`)에 반영**되고, 그 뒤 매니페스트만 빠르게 재빌드한다. 실제 무거운 재작업(TTS 재생성, 씬 재분석, 최종 mp4 렌더)은 씬 단위로만 트리거되거나(오디오/이미지) 파이프라인 `--from`/`--only` 스텝 재개로 처리된다.

즉 참고할 설계 포인트는 **"프리뷰=런타임 컴포넌트 재실행(무렌더), 저장=계약 JSON 패치, 무거운 재생성=씬 단위 서브프로세스"** 세 갈래 분리다.

---

## 1. 대시보드 서버 구조

**FastAPI + Jinja2 서버사이드 템플릿 + 정적 자산 + 부분 React SPA 혼합**. 순수 SPA가 아니다.

- 진입: `app.py:66` `app = FastAPI(...)`. 라우터를 다수 `include_router`로 합침 (`app.py:69-82`): `actions`, `json_editor`, `sse`, `memory`, `vault`, **`scene_editor`**, `manifest`, `design_presets`, `messenger`, `tools`, `enrichment`.
- 페이지는 Jinja2 HTML (`auto_agent/dashboard/templates/`): `base.html`, `project.html`, 그리고 탭별 파셜 `partials/_studio.html`, `_storyboard.html`, `_storyboard_scene.html`, `_design.html`, `_assets.html` 등. HTMX 스타일로 `/api/p/{ref}/tab/{tab}`가 HTML 조각을 반환 (`app.py:1117`).
- 씬 편집 전용 라우터: `auto_agent/dashboard/scene_editor.py:20` `APIRouter(prefix="/api/p/{project_ref}/editor")`.
- 편집 UI 자체는 **Vite로 빌드된 React+Remotion 번들** 두 개:
  - `auto_agent/dashboard/static/scene-editor.js` (미니파이 React 번들, `window.mountSceneEditor` / `window.unmountSceneEditor` 전역 노출 — 확인됨).
  - `auto_agent/dashboard/static/preview/index.html` + `assets/index-*.js` (별도 Vite 빌드, "Design Preset Preview"). `grep`상 `remotion`/`React` 포함.
- 프로젝트 참조는 UUID/slug 이중 지원 + canonical redirect(`resolve_project_ref` / `canonical_uuid_url`, 모든 라우트 상단에서 307 리다이렉트).

프론트 기술스택: **Jinja2 HTML + 바닐라 JS(fetch/HTMX식) 셸 안에, React 18 + `@remotion/player` + `@remotion/renderer` TypeScript SPA를 `mountSceneEditor`로 특정 DOM 노드(`#scene-editor-root`)에 마운트**. TS 소스는 `remotion/src/`.

---

## 2. 씬 미리보기 방식 — Remotion Player 라이브 렌더 (사전 렌더 조각 아님)

세 가지 미리보기 경로가 공존한다:

- **에디터 라이브 프리뷰 (핵심)**: `remotion/src/editor/SceneEditorPanel.tsx`. 좌측 `<Player component={SingleScenePlayer} inputProps={{scene, meta}} .../>` (`SceneEditorPanel.tsx:272-286`), 우측 편집 폼. 파일 헤더 주석: *"폼에서 씬 속성을 수정하면 Player가 실시간으로 결과를 보여줌(WYSIWYG)"* (`SceneEditorPanel.tsx:1-7`). `SingleScenePlayer.tsx:53`이 최종 렌더와 동일한 `SceneRendererInner`를 호출 → **미리보기와 최종 산출물의 렌더 경로가 동일**. 맵 씬은 `MapSceneRenderer` lazy 로드 (`SingleScenePlayer.tsx:14, 38-50`).
- **Remotion Studio iframe**: `partials/_studio.html:21` `<iframe id="studio-iframe">`가 `http://localhost:{STUDIO_PORT}` Remotion Studio를 띄움 (`_studio.html:442`). 저장 후 캐시버스터 쿼리로 iframe 새로고침 (`_studio.html:417-424`).
- **디자인 프리셋 프리뷰 iframe**: `partials/_design.html:32` `<iframe src="/static/preview/index.html">`, 폼 변경을 `postMessage({type:'preset-update', preset})`로 iframe에 밀어넣어 실시간 갱신 (`_design.html:434-437`).
- **정적 썸네일 폴백**: `scene_editor.py:109` `/thumbnails/scene/{n}` — Remotion `renderStill`로 PNG를 캐시(`output/{dir}/thumbnails/scene_NNN.png`). 씬 편집 시 무효화(삭제)되어 다음 캡처 때 재생성 (`app.py:2623-2628`).

---

## 3. 사용자가 편집할 수 있는 것 & 저장 위치

편집 폼(`SceneEditorPanel.tsx`)에서 편집 가능한 속성:
- **텍스트**: `concept`, `narration`, `headline`(`{{강조}}` 마크업+줄바꿈), `title`, `items[]`(값/설명 포함, `ItemsEditor`), `source`, `speaker`(quote 전용).
- **레이아웃/연출**: `layout`(24종, `SceneEditorPanel.tsx:15-21`), `chartStyle`(pie/donut), `orientation`(bar), `withPortrait`/`portraitPlacement`, `mood`(7종), `reveal`(12종), `emphasis`, `hideLabels`, item 아이콘(lucide 아이콘 카탈로그).
- **위치 미세조정**: headline/items/source의 `offsetX/offsetY` 슬라이더 → `visualization.creative`에 저장 (`SceneEditorPanel.tsx:192-222`).
- **이미지**: `ImageSelector`로 후보 선택/교체, `imageAsset.placement/opacity/offsetX/offsetY/scale/fit`, Ken Burns `enabled/zoomFactor`.

**편집 반영 대상 = 계약 파일 `scene_specs.json`** (프로젝트 `output_dir` 내). DB에는 프로젝트 메타/상태만.
- 저장 API: `scene_editor.py:1194` `POST /api/p/{ref}/editor/scenes/{n}`. body `{scene_data, mode}`. 저장 전 `_backup_json`으로 백업(`scene_editor.py:1299`), `scenes[idx] = {**old, **new}` 병합(단 `imageAsset`은 deep-merge로 `source:"none"` 등 보존, `scene_editor.py:1285-1290`), 그리고 `scene_specs.json`에 `write_text` (`scene_editor.py:1302-1305`).
- 이중 저장 경로도 존재: `app.py:2584` `PUT /api/p/{ref}/scenes/{n}` — `scene_specs.json` 갱신 후 `pm.save_project_json`으로 Supabase Storage에도 동기화하고 썸네일 무효화.
- narration 전용: `scene_editor.py:1908` `/scenes/{n}/update-narration`; 이미지 선택/업로드/비디오 트림/asset-type 등도 같은 라우터에 (`scene_editor.py:485,695,741,1484,1635,1699`).

`mode` 값: `"save"`(그냥 저장), `"save_fix"`(Haiku 1회로 정합성 자동보정 `_coherence_fix`, `scene_editor.py:1276-1279,1432`), `"preview"`(저장 없이 diff+경고만 반환, `scene_editor.py:1268`). 저장 시 레이아웃 제약 검증(`LAYOUT_CONSTRAINTS` items 최소/최대/필수필드 경고, `scene_editor.py:1242-1259`).

---

## 4. 편집 후 재실행 흐름 — 전면 재렌더 아님, 씬 단위 + 매니페스트 재빌드

편집→저장→반영은 **최종 mp4 재렌더 없이** "계약 JSON 패치 + 경량 매니페스트 재빌드"로 끝난다:

1. `SceneEditorPanel.handleSave` (`SceneEditorPanel.tsx:234-256`): `POST .../editor/scenes/{n}` 저장 성공 → 곧바로 `POST /api/p/{slug}/rebuild-manifest` fire-and-forget.
2. 저장 라우트 내부에서도 조건부 재빌드: `imagePath/imageAsset/visualization/layout/headline/items` 등 매니페스트 영향 필드가 바뀌면 `_rebuild_manifest_sync` 호출 (`scene_editor.py:1307-1314`).
3. `rebuild-manifest` (`scene_editor.py:35`)와 `_rebuild_manifest_sync` (`scene_editor.py:78-101`): `python -m auto_agent.scripts.build_manifest {project_id} {storage_key} {out_dir}` 서브프로세스 실행 → 산출된 `remotion/public/manifests/{key}.json`을 `remotion/public/manifest.json`으로 `shutil.copy2` → **Remotion Studio/Player가 즉시 최신 매니페스트를 읽음**. 무거운 픽셀 렌더 없음.

무거운 재작업이 필요한 경우는 **명시적으로 씬 단위**:
- **씬 재연출(LLM)**: `app.py:2633` `POST /scenes/{n}/rerun` — 해당 씬 JSON만 컨텍스트로 `claude --model sonnet`을 서브프로세스 호출, `sceneNumber/narration/chapter`는 보호하고 연출 요소만 개선해 그 씬만 교체 저장 (`app.py:2665-2705`).
- **씬 TTS 재생성**: `app.py:1550` `POST /tts/regenerate/{n}` (버전 관리 `tts/versions`, `tts/select`).
- **씬 이미지 생성/선택**: `app.py:2124` auto-prompt, `2212` generate, `1434` select — 모두 `{scene_num}` 스코프.
- **씬 분할(구조 변경 + 부분 재생성)**: `scene_editor.py:1326` `/scenes/{n}/split`. 동기 단계에서 specs 분할·파일 renumber·매니페스트 재빌드 후, `_asyncio.create_task(_bg_split_postprocess(...))` (`scene_editor.py:1419-1422`)로 **양쪽 씬만** 백그라운드 TTS 재생성 + 씬 재분석 (`app.py:1673` `_bg_split_postprocess`, `_process_one(scene_num)`이 TTS 서브스크립트 `--scene {n}` 및 씬별 LLM 재분석 실행). 이것이 진짜 "부분 재생성" 패턴의 표본이다.
- **전체/스텝 재개**: `app.py:2943` `POST /pipeline/start` body `{from_step}` → `python -m auto_agent.orchestrator.runner --project {slug} --from {step}` 서브프로세스 (`app.py:2981-3002`). 로그는 `output/{dir}/pipeline.log`. `/pipeline/status`(2011), `/pipeline/stop`(3036).

"띄워서" UI 트리거: 스토리보드 씬 카드 클릭 → 모달/탭에서 `_tryMountEditor()`가 `scene-editor.js`의 `window.mountSceneEditor`를 호출해 `#scene-editor-root`에 React 에디터를 마운트하고, 씬 데이터+meta를 병렬 fetch (`partials/_storyboard_scene.html:440-494`, `_storyboard.html:317-333`). 저장 완료 시 `document.dispatchEvent(new CustomEvent('scene-editor-saved'))` → Studio iframe 새로고침 (`_studio.html:581`, `map-editor.js:326`).

---

## 5. 세션/상태 관리 & 재개

이 레포에는 `session_manager.py`/`storage.py`가 **없다**(검색 확인). 상태 추적은 세 곳으로 분산:

- **DB (SQLite/Supabase)**: `auto_agent/db/project_manager.py` `ProjectManager` — 프로젝트 레코드, `output_dir`, `status`(`update_project(id, status="in_progress")`, `runner.py:1025`), config, `save_project_json`(Supabase Storage 미러). 스키마 `auto_agent/db/schema.sql`, 연결 `connection.py`, 버전 `version_manager.py`.
- **파이프라인 진행 상태 파일**: `runner.py:845` `pipeline_state.json`(프로젝트 dir). 실행 종료 시 `completed_steps/failed_steps/skipped_steps/results/config` 저장 (`runner.py:5578-5592`). 다음 실행 시 로드해 **resume**: 완료/실패 스텝을 이어받아 이미 끝난 스텝은 스킵 (`runner.py:844-855`). `--force`는 상태 초기화(전체 재실행, `runner.py:974-977`), `--from`은 이전 실패만 초기화(`runner.py:980-981`).
- **스텝 필터링/부분 실행 로직**: `runner.py:937` `run(from_step, only_step, stop_after_step, force)`. `--from`은 시작점까지 스킵(`runner.py:1046-1054`), `--only`는 단일 스텝(`1037-1044`), `--until`(`stop_after_step`)은 `_filter_steps_until`로 허용 스텝 집합 계산(`runner.py:136-156, 964-969`). 훅 시스템 `register_pre_step/post_step`으로 스텝 전후 검증(`runner.py:516-530`, 예: step_2 후 캐릭터 검증).
- **진행 이벤트/실시간 UI**: SSE `auto_agent/dashboard/sse.py`, 에이전트 메시지 `agent_messenger.py`(`post_message(...phase="pipeline")`), 각 스텝 결과는 `PipelineState.results`에 누적.

계약 파일들(재개·부분수정의 단위): `scene_specs.json`(씬 배열, 편집 대상), `image_assets.json`, `video_assets.json`, `art_style.json`, `character_plan.json`, `research_report.md`, `manifest.json`(렌더 입력). 편집은 항상 이 파일들을 패치하고, 렌더러는 이 파일들을 재읽기만 하면 되도록 설계되어 있다.

---

## 새 영상 스킬 설계에 참고할 데이터 흐름 (한 줄 요약)

```
[사용자 편집: React 폼(@remotion/player 라이브 프리뷰, 무렌더 WYSIWYG)]
   → POST /editor/scenes/{n} {scene_data, mode}
   → scene_specs.json 백업 후 해당 씬만 병합 저장 (imageAsset deep-merge)
   → 매니페스트 영향 필드 변경 시에만 build_manifest 서브프로세스 → manifest.json 교체
   → Player/Studio가 새 매니페스트 재읽기 (픽셀 재렌더 없음)
[무거운 재생성이 필요할 때만]
   → 씬 단위 서브프로세스: /rerun(LLM 재연출) · /tts/regenerate · /images/generate · /split→_bg_split_postprocess(해당 씬만 TTS+재분석)
   → 전체 진행/재개는 runner --from/--only, 상태는 pipeline_state.json(completed/failed steps)로 resume
```

핵심 교훈 3가지: (a) **프리뷰와 최종 렌더가 같은 컴포넌트 트리를 공유**하면 "부분 재렌더" 문제 대부분이 사라진다(런타임 재실행으로 대체). (b) **편집의 진실 원천을 씬 배열 JSON 하나로** 고정하고 렌더러는 그걸 재읽기만. (c) **무거운 작업만 씬 스코프 서브프로세스로 격리**하고, 파이프라인 재개는 스텝 단위 상태파일로.

관련 파일 경로:
- 편집 UI/프리뷰: `remotion/src/editor/SceneEditorPanel.tsx`, `remotion/src/editor/SingleScenePlayer.tsx`, `auto_agent/dashboard/static/scene-editor.js`, `auto_agent/dashboard/static/preview/`
- 편집 백엔드: `auto_agent/dashboard/scene_editor.py`, `app.py`(2584/2633/2943), `auto_agent/dashboard/json_editor.py`
- 매니페스트 빌드: `auto_agent/scripts/build_manifest.py`
- 상태/재개: `auto_agent/orchestrator/runner.py`(845/937/5578), `auto_agent/db/project_manager.py`
- UI 셸: `auto_agent/dashboard/templates/partials/_studio.html`, `_storyboard.html`, `_storyboard_scene.html`, `_design.html`