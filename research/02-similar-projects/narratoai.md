분석 완료. 아래는 5개 렌즈별 구조화 보고다. 모든 근거는 클론된 저장소(`.../scratchpad/refs/NarratoAI/`) 기준 파일경로로 표기했다.

---

# NarratoAI 해부 보고 — "세세 설정 영상 생성 + 띄워서 수정 UI" 참고용

전제: Streamlit 기반 단일 WebUI. 파이프라인은 "기존 영상 입력 → 자막/키프레임 이해 → LLM이 컷+해설 스크립트 생성(JSON) → 사람이 표로 수정 → OST 타입별 차등 컷 편집 → TTS·자막·BGM 합성" 구조. 4개 워크플로우 모드가 공존한다(아래 3-2).

---

## 1. 파이프라인 구조 & 산출물 스키마

### 1-1. 4개 진입 모드 (`webui/components/script_settings.py:359-365`)
| 모드 | 코드값 | 입력 전제 | 생성기 |
|---|---|---|---|
| 影视解说 Film/TV Narration | `film_summary` | 자막 있음 | `generate_short_summary.py` (3단계 LLM) |
| 短剧解说 Short Drama Summary | `summary` | 자막 있음 | 동일 |
| 画面解说 Auto Generate (**해설 모드 핵심**) | `auto` | **자막·음성 없는 원본** | `webui/tools/generate_script_docu.py` |
| 短剧混剪 Short Generate | `short` | 자막 있음 | `webui/tools/generate_script_short.py` |

### 1-2. 핵심 산출물 스키마 — "스크립트가 컷 타이밍을 지정"하는 포맷
LLM이 뱉는 최종 편집 스크립트의 아이템 스키마(`webui/tools/generate_short_summary.py:34` `PUBLIC_SCRIPT_FIELDS`, 예시는 `app/services/prompts/film_tv_narration/script_generation.py:131-152`):

```json
{ "items": [
  { "_id": 1, "video_id": 1, "video_name": "1.mp4",
    "timestamp": "00:00:01,000-00:00:05,500",
    "picture": "화면 설명(소재 식별용)",
    "narration": "해설 대사",
    "OST": 0 }
]}
```
- `timestamp`는 **해당 `video_id` 원본 파일 내부의 로컬 시각**(멀티 영상 이어붙인 글로벌 시각 아님) — `segment_planning.py:72`.
- `dataclass` 정의는 `app/services/SDP/utils/short_schema.py`의 `ScriptItem/Commentary/PlotPoint`, 파이프라인 결과 집계는 같은 파일 `PipelineResult`.

### 1-3. OST 필드 — 이 프로젝트의 편집 엔진 (`app/services/task.py:312-315`)
컷 타이밍/오디오 처리를 **오직 OST 정수값**으로 분기:
- **OST=0**: 원음 제거, **TTS 오디오 길이에 맞춰 화면을 동적 리타이밍**(해설 나레이션 위주)
- **OST=1**: **timestamp대로 정확히 컷, 원음 유지**(명장면/대사 원본 재생)
- **OST=2**: TTS 길이에 맞춰 컷 + 원음도 유지(다큐 해설 오버레이 — `frame_analysis_service.py:93`, `_build_video_clip_json`에서 OST=2 고정)

이 3값 체계가 "나레이션 얹기 vs 원본 재생"을 한 필드로 표현하는 **훔칠 만한 핵심 프리미티브**다.

### 1-4. 실제 편집 단계 (`app/services/task.py:308~660` `start_subclip`)
1. 스크립트 JSON 로드 → `narration/OST/timestamp` 배열 3개 추출 (`task.py:337-339`)
2. OST∈{0,2} 세그먼트만 TTS 생성 (`task.py:356-370`, `voice.tts_multiple`)
3. `clip_video.clip_video_unified()` — OST별 통합 컷(이중 컷 제거가 설계 목표, `task.py:312`)
4. `update_script.update_script_timestamps()` — TTS 실제 길이로 timestamp 재계산 (`task.py:411`)
5. 오디오/자막 병합 → `audio_merger`, `subtitle_merger` + 프로그램matic 자막 생성 (`task.py:420-470`)
6. `merger_video.combine_clip_videos(..., video_ost_list=video_ost)` 로 컷 이어붙임 (`task.py:502-508`)
7. BGM/원음/TTS 볼륨 믹싱 후 최종 합성 (`task.py:511-560`). OST=1 원음 존재 시 원음 볼륨을 강제 1.0으로 고정(`task.py:532-542`).

---

## 2. 설정 가능 표면 (config 전체)

### 2-1. 편집 파라미터 데이터모델 — `app/models/schema.py` `VideoClipParams` (line 160-224)
가장 참고할 만한 "세세 설정" 표면. 실측 필드:
- **자막 스타일**: `font_name`(기본 SimHei), `font_size`(36), `text_fore_color`, `text_back_color`, `stroke_color`, `stroke_width`, `subtitle_position`(top/bottom/center/custom), `custom_position`(70.0)
- **자막 마스크(원본 자막 가리기)**: `subtitle_mask_enabled` + 가로/세로 각각 x/y/width/height/blur_radius/opacity 퍼센트 (line 189-202) — **기존 영상의 하드번 자막을 블러로 덮고 새 자막 얹는 기능**
- **자막 위치 프리셋**: `subtitle_position_landscape_y_percent`(85), `..._portrait_y_percent`(82)
- **TTS**: `voice_name`, `voice_volume`, `voice_rate`, `voice_pitch`, `tts_engine`, `tts_volume`
- **오디오 믹싱**: `original_volume`(원음, 기본 1.2), `bgm_volume`(0.3), `bgm_type`/`bgm_file` — 상수는 `AudioVolumeDefaults`(schema.py:16-34, 원음 max 2.0 허용해 TTS와 밸런스)
- **자동 전사(ASR)**: `subtitle_auto_transcribe_*` 7개 필드(backend/api_url/hotword/enable_spk 등)
- **출력**: `video_aspect`(16:9/4:3/9:16/3:4/1:1 → 해상도 매핑 schema.py:49-56), `n_threads`, `draft_name`(剪映 초안명)

### 2-2. 전역 config (`config.example.toml`)
- **LLM**: vision/text 이원화. `vision_llm_provider`/`text_llm_provider` + 각 `*_model_name/api_key/base_url/temperature/top_p/max_tokens/thinking_level`(auto/off/low/medium/high). OpenAI 호환 통일 프로토콜(line 12-62).
- **비전 대안**: TwelveLabs Pegasus 네이티브 비디오 이해(`vision_llm_provider="twelvelabs"`, line 35-43) — 키프레임을 짧은 클립으로 재조합해 동작/시계열 파악.
- **키프레임 추출**(`[frames]` line 295-303): `frame_interval_input`(3초), `vision_batch_size`(10, LLM 1회 처리 프레임 수), `vision_max_concurrency`(2)
- **TTS 엔진 9종**: `indextts`, `indextts2`, `omnivoice`, `edge_tts`, `qwen3_tts`, `tencent_tts`, `doubaotts`, `azure_speech`, `soulvoice` — 각 섹션에 세부 파라미터. 특히 `[indextts2]`는 **8차원 감정 벡터**(vec_happy/angry/sad/afraid/disgusted/melancholic/surprised/calm, line 180-188) + emotion_mode(speaker/audio/vector/text) 제공.
- **ASR**: `[fun_asr]` local/firered/bailian 백엔드, hotword, speaker diarization.
- **联网 검색**: `[tavily]` search_depth(basic/advanced/fast/ultra-fast) — 작품명으로 공개 줄거리/인물 검색해 LLM 이해 보강.

---

## 3. WebUI 편집 기능 (스크립트/컷 단위 수정·재생성)

### 3-1. 팝업 표 편집기 — "띄워서 수정 UI"의 직접 참고 대상
`webui/components/script_settings.py:1099-1153` `render_video_script_editor`:
- `@st.dialog("Video Script", width="large")` **모달 다이얼로그**로 띄움 (line 1101)
- `st.data_editor(num_rows="dynamic", row_height=72, ...)` — **스프레드시트형 인라인 편집**, 행 추가/삭제 가능
- 컬럼별 타입/폭 지정(`column_config`, line 1117-1138): `_id`/`video_id`/`OST`는 `NumberColumn`(OST는 min0/max2 step1), `timestamp`/`picture`/`narration`은 `TextColumn`(폭 200/320/480)
- 편집 결과를 `st.expander("Raw JSON Preview")`로 실시간 JSON 미리보기(line 1142-1143)
- `Save Script` → `save_script_with_validation`(line 1145, 1850) 로 검증 후 저장
- 표↔JSON 왕복 변환: `_script_json_to_table`(1031)/`_script_table_to_json`(1069), 빈 행·NaN 정리 로직 포함

핵심: LLM 산출 JSON을 **표로 펼쳐 사람이 컷 타이밍·해설·OST를 직접 고치고**, 저장 후 그 JSON이 그대로 편집 엔진 입력이 되는 "계약 파일" 패턴.

### 3-2. 재생성 흐름 (`render_script_buttons` script_settings.py:1553-1657)
- 모드별 버튼 라벨 분기(`auto`→Generate Video Script, `short`→Generate Short Video Script, summary계열→生成剪辑脚本, `.json`→Load Video Script)
- **해설/혼합 모드는 2버튼 분리**: `생성解说文案`(문안만 재생성) + `생성剪辑脚本`(전체 재생성) (line 1642-1654) → **부분 재생성**을 문안/컷플랜 단계로 나눠 제공
- 인라인 파라미터: 影视/短剧 유형 selectbox(1600), **원片占比**(원본 원음 비율 0~90% 10단위, line 1616-1622) → LLM이 OST=1 총 길이 비율을 이 값에 맞춤(`short_drama_narration/script_matching.py:94`), 解说语言 9개+커스텀(1624-1638)

### 3-3. 자막 파이프라인 UI (`render_fun_asr_transcription` script_settings.py:1156~)
전사(Fun-ASR local/firered/bailian) → 번역(`subtitle_translator`, 배치+병렬, line 1351-1407) → 교정(`subtitle_corrector`, line 1302-1348) 3단 버튼. 자막 미리보기는 접이식 `st.expander`(line 908).

### 3-4. 결과 리뷰 (`webui.py:211-368`)
`Generate Video` 버튼 → 백그라운드 태스크(`tm.start_subclip_unified`, webui.py:282) → 상태 폴링 루프로 진행률 표시 → 완료 시 `st.video()` 인라인 프리뷰(비율에 따라 폭 320/600, line 344-354). **표 편집 → 생성 → 프리뷰 → 재편집** 루프.

---

## 4. 씬 매니페스트 / 스토리보드 스키마

### 4-1. 다큐(해설 모드) 중간 산출물 — `frame_analysis_*` 아티팩트
`app/services/documentary/frame_analysis_service.py:449-509` `_build_analysis_artifact`가 저장하는 매니페스트(`artifact_version:"documentary-frame-analysis-v2"`):
- 최상위 메타: `video_path`, `frame_interval_seconds`, `vision_batch_size`, `vision_llm_provider/model_name`, `vision_max_concurrency`, `generated_at`
- `batches[]`: batch_index, status, `time_range`("HH:MM:SS,mmm-HH:MM:SS,mmm"), raw_response, `frame_paths[]`, `frame_observations[]`, `overall_activity_summary`, fallback_summary, error_message
- 평탄화 뷰: `frame_observations[]`(frame_path/timestamp/observation), `overall_activity_summaries[]`
- 데이터클래스: `frame_analysis_models.py` `FrameBatchResult`, 설정은 `DocumentaryAnalysisConfig`(frame_interval/batch_size/concurrency 유효성 `__post_init__` 검증)

### 4-2. 타임스탬프 인코딩 트릭 (파일명이 곧 타임코드)
키프레임 파일명 `keyframe_NNNNNN_TTTTTTTTT.jpg`에 시각을 인코딩. `_timestamp_from_keyframe_name`(service.py:609-618)이 9자리 토큰을 HH:MM:SS,mmm로 역파싱. 배치 time_range = 첫프레임~끝프레임. → **소재-타임코드 매핑을 파일명만으로 무상태 복원**. 키프레임 캐시키는 `video_path+mtime+interval` md5(service.py:309-324)로 재실행 시 재추출 생략.

### 4-3. 2단계 스토리보드 계획 (影视/短剧 해설)
- **segment_planning** (`prompts/film_tv_narration/segment_planning.py`): 컷 플랜만 생성. 출력에 `story_role`(개장 훅/인물소개/인과전환…), `intent`, `transition` **내러티브 역할 필드** 포함(segment_planning.py:98-100). 규칙: 첫 컷은 반드시 OST=0 훅, OST=1 3연속 금지, video_id 전환 전 OST=0 브릿지 필수(line 63-85).
- **script_generation** (script_generation.py): 위 플랜의 `_id/video_id/timestamp/OST` **글자 그대로 복사**하고 `picture`/`narration`만 채움(line 79-83). "해설 글자수/5 = 필요 화면 초"로 밀도 산정(line 102-105). → **컷 구조 확정 단계와 문안 작성 단계를 분리**한 2패스 설계.

### 4-4. 외부 NLE 내보내기 매니페스트 — 剪映(CapCut) 드래프트
`app/services/jianying_draft_builder.py` + `jianying_task.py`: 자체 스키마 → 剪映 드래프트 JSON(track/segment/material_collections, 자산 복사·경로 플레이스홀더 치환)으로 변환. WebUI `Export to Jianying Draft` 버튼(webui.py:625). → **"자동 생성 후 전문 편집기로 띄워 미세수정"** 패턴의 실제 구현체.

---

## 5. 훔칠 만한 독창 기능 Top 5

**1. OST 3값 편집 프리미티브 (`task.py:312-315`, `clip_video.clip_video_unified`)**
컷 타이밍/오디오 정책을 정수 하나로. 0=나레이션(TTS길이 리타이밍·원음제거), 1=원본재생(timestamp정확컷·원음유지), 2=해설 오버레이(TTS리타이밍·원음유지). "기존 영상에 나레이션 얹기"가 곧 OST=2/0 세그먼트 섞기로 환원됨 → 스킬의 컷 스키마에 그대로 이식 가치 높음.

**2. 해설 모드(画面解说) — 자막 없는 원본에 나레이션 생성 (`documentary/frame_analysis_service.py`)**
자막·음성 없는 다큐/동물/건축 영상을 대상으로: 키프레임 추출 → 비전 LLM 배치 분석(프레임별 observation + 배치 활동요약, PROMPT_TEMPLATE service.py:18-35) → time_range별 `picture` 조립 → 텍스트 LLM이 해설 문안 생성 → 전 세그먼트 OST=2 고정. **"영상이 뭘 하는지 모를 때 화면을 읽어서 해설을 쓰는" 완결 경로.** 배치 동시성·세마포어·실패 배치 fallback까지 구현(`_analyze_batches` service.py:340-410).

**3. 2패스 스토리보드(컷플랜 ↔ 문안 분리) + 내러티브 역할 태깅 (`segment_planning.py` → `script_generation.py`)**
플래너는 `story_role/intent/transition`으로 인과 사슬을 설계만 하고, 라이터는 구조 필드를 동결(복사)한 채 문안만 채움. 훅/브릿지/OST연속제한 등 편집 문법을 프롬프트 규칙으로 코드화. 부분 재생성("문안만 다시")이 자연스럽게 가능(UI 3-2).

**4. 원본 자막 마스크 오버레이 (`schema.py:189-202`, `config.example.toml:263-278`)**
기존 영상의 하드번 자막 위에 가로/세로별 위치·크기·블러·불투명도 퍼센트로 블러 박스를 덮고 새 자막을 얹는 파라미터군. 리캡션/더빙 워크플로우에서 실전 필수 기능.

**5. 스프레드시트 모달 편집기 + JSON 계약 파일 (`script_settings.py:1099-1153`)**
LLM JSON을 `st.dialog`+`st.data_editor`로 띄워 컷별 timestamp/picture/narration/OST를 인라인 수정, Raw JSON 실시간 미리보기, 검증 저장. 저장된 JSON이 그대로 편집 엔진 입력 = **"생성물을 계약 파일로 남겨 사람이 고치고 재실행"** 구조. 사용자의 "띄워서 수정 UI" 요구에 가장 근접한 레퍼런스.

---

### 보조 참고 포인트
- 감정 벡터 TTS: `[indextts2]` 8차원 감정(`config.example.toml:180-188`) — 해설 톤 세밀 제어 참고.
- 멀티 영상 입력: `video_origin_paths[]` + video_id 로컬 타임스탬프 규약(`segment_planning.py:71-72`) — 여러 소스 이어붙일 때 시각 혼동 방지.
- 프롬프트 레지스트리: `app/services/prompts/`가 category/version/parameters 메타(`PromptMetadata`)로 프롬프트를 모듈화 — 모드별 프롬프트 관리 구조 참고(`prompts/manager.py`, `registry.py`).
- 재실행 캐시: 키프레임(`_build_keyframe_cache_key`)·분석 아티팩트를 md5 키로 캐시해 재생성 비용 절감.

한계/미확인: `clip_video.clip_video_unified` 내부 ffmpeg 컷 구현 상세, `update_script.update_script_timestamps`의 TTS 리타이밍 수식, 短剧混剪(`short`) 전용 파이프라인(`SDP/`)의 세부 스키마는 파일 존재만 확인하고 라인 단위 검증은 하지 않았다(요청 5개 렌즈 밖).