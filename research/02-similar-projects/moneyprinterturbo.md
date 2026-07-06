분석 완료. 아래 보고합니다. 모든 경로는 클론 루트 `.../scratchpad/refs/MoneyPrinterTurbo/` 기준 절대경로입니다.

---

# MoneyPrinterTurbo 해부 보고

## 1. 파이프라인 단계 구조 (입력 → MP4)

핵심 오케스트레이터는 `app/services/task.py`의 `start(task_id, params, stop_at)` (라인 332~488). 단계마다 `stop_at` 인자로 중간에서 끊고 그 산출물만 반환할 수 있게 설계돼 있음 — 이게 "부분 파이프라인" 설계의 핵심.

| 단계 | 함수 (task.py) | 산출물 / 스키마 |
|---|---|---|
| 1. 스크립트 생성 | `generate_script` (16) | LLM으로 나레이션 대본 생성. 사용자가 직접 대본 입력 시 LLM 스킵 |
| 2. 검색 키워드 생성 | `generate_terms` (38) | 대본에서 스톡영상 검색어 5~8개 추출(list). `video_source=="local"`이면 스킵 |
| — 저장 | `save_script_data` (77) | `task_dir/script.json` = `{script, search_terms, params}` |
| 3. 오디오(TTS) | `generate_audio` (128) | `task_dir/audio.mp3` + `audio_duration` + `sub_maker`(타임라인). 커스텀 오디오 업로드 시 TTS 스킵 |
| 4. 자막 | `generate_subtitle` (188) | `task_dir/subtitle.srt`. edge(TTS 타임라인 기반) 또는 whisper(음성 전사) |
| 5. 소재 확보 | `get_video_materials` (236) | 스톡 다운로드 or 로컬 전처리 → `storage/cache_videos/vid-<md5>.mp4` 경로 리스트 |
| 6. 최종 합성 | `generate_final_videos` (276) | 소재 클립당 시간 커버 → `combined-{n}.mp4`(무자막·무나레이션 컷 붙임) → `final-{n}.mp4`(자막+나레이션+BGM 얹음) |
| 7. 크로스포스팅(옵션) | `upload_post` (440) | TikTok/IG/YouTube Shorts 자동 업로드 |

주목: **combined vs final 2단계 분리** (`app/services/video.py`: `combine_videos` 라인 535, `generate_video` 라인 896). combined는 비주얼 컷 이어붙이기(ffmpeg concat demuxer, 단일 인코딩), final은 그 위에 자막 TextClip·나레이션·BGM 오버레이. → 자막/음성만 바꾸면 combined 재사용하고 final만 다시 뽑을 수 있는 구조적 여지가 있음(단, 현재 코드는 매번 둘 다 재생성).

진행률은 `sm.state.update_task(task_id, progress=…)`로 5→10→20→30→40→50→100 단계 push (`app/services/state.py`).

## 2. 설정 가능 표면 전체 (`VideoParams`, `app/models/schema.py` 라인 58~112)

실제 필드 전부:

**대본/주제**
- `video_subject`, `video_script`(직접 입력 가능), `video_terms`(str|list)
- `video_language`("" = 자동감지), `paragraph_number`(1~10), `video_script_prompt`(≤2000자), `custom_system_prompt`(≤8000자, 커스텀 시스템 프롬프트)

**비디오 소재/화면**
- `video_source`: `pexels`/`pixabay`/`coverr`/`local`
- `video_aspect`: `16:9`/`9:16`/`1:1` → 해상도 1920×1080 / 1080×1920 / 1080×1080 (`VideoAspect.to_resolution`, 라인 37)
- `video_concat_mode`: `random`/`sequential`
- `video_transition_mode`: none/`Shuffle`/`FadeIn`/`FadeOut`/`SlideIn`/`SlideOut` (라인 23)
- `video_clip_duration`: 클립당 최대 초(UI는 2~10, 기본 3)
- `video_count`: 동시 생성 편수(1~5)
- `match_materials_to_script`(bool): 소재를 대본 서사 순서에 매칭
- `video_materials`(List[MaterialInfo{provider,url,duration}]): 로컬 소재
- `custom_audio_file`: TTS 대체 오디오

**음성(TTS)**
- `voice_name`, `voice_volume`(0.6~5.0), `voice_rate`(0.8~2.0)

**BGM**
- `bgm_type`(""/`random`/`custom`), `bgm_file`, `bgm_volume`(0.0~1.0)

**자막 (세밀함이 핵심)**
- `subtitle_enabled`
- `subtitle_position`: top/bottom/center/`custom`, `custom_position`(상단 % 0~100)
- `font_name`(.ttf/.ttc), `font_size`(30~100), `text_fore_color`(HEX 컬러피커)
- `stroke_color`, `stroke_width`(0~10)
- `text_background_color`(bool|HEX), `rounded_subtitle_background`(bool, 둥근 반투명 배경)

**렌더**
- `n_threads`, `config.app.video_codec`(libx264/nvenc/amf/qsv/mf/videotoolbox, 자동 폴백)

전역 설정(`config.example.toml`): TTS 제공자(azure-tts-v1/v2, siliconflow, gemini-tts, mimo-tts, elevenlabs, chatterbox), LLM 제공자 20+개, `subtitle_provider`(edge/whisper), whisper 모델 크기/디바이스, Pexels/Pixabay/Coverr/TwelveLabs 멀티 API키, `material_directory`(캐시 공유 전략), redis 큐, `max_concurrent_tasks`/`max_queued_tasks`.

## 3. WebUI가 편집하게 해주는 것 (`webui/Main.py`, 단일 Streamlit 페이지 1787줄)

- **성격**: 씬/소재 단위 타임라인 에디터가 **아니다**. 3열 폼(대본 | 비디오·오디오 | 자막) + 하단 "Generate Video" 버튼으로 §2 파라미터를 전부 노출하는 **파라미터 폼**.
- **부분 재생성 지원 요소**:
  - 대본/키워드를 별도 버튼으로 먼저 생성해 텍스트에어리어에서 **사람이 손으로 수정** 후 본 생성에 사용 (라인 838~884, `Generate Video Script and Keywords` / `Generate Video Keywords`).
  - `st.session_state["video_script"]`, `["video_terms"]`로 중간 산출물을 세션에 유지.
  - 로컬 소재 재업로드 없이 문안만 바꿔 재생성하도록 `st.session_state["local_video_materials"]`에 소재 재사용(라인 143, 1737).
  - TTS 음성 "Play Voice" 미리듣기(라인 1171).
- **한계**: 개별 씬 클립을 교체/재렌더하는 UI는 없음. 재생성은 항상 전체 파이프라인 재실행. 씬 단위 부분 재렌더는 **API 레벨**의 `stop_at`(subtitle/audio만 생성하는 `/subtitle`, `/audio` 엔드포인트, `app/controllers/v1/video.py` 라인 122~133)에서만 가능하고 UI엔 노출 안 됨.
- **주의(설계 참고용 함정)**: UI 비디오 소스 드롭다운에 TikTok/Bilibili/Xiaohongshu(douyin/bilibili/xiaohongshu)가 있으나(라인 898~900) **백엔드 구현 전무**(grep 결과 0건), Generate 버튼이 pexels/pixabay/coverr/local만 허용(라인 1684). = 미끼 옵션.

## 4. 비디오 소재 소싱 방식

**전량 스톡 풋티지 기반. AI 영상 생성은 없음** (`app/services/material.py`).

- 제공자별 검색 함수: `search_videos_pexels`(라인 55), `search_videos_pixabay`(112), `search_videos_coverr`(168). 모두 `search_term` + `minimum_duration`(=clip_duration) + `video_aspect`로 API 호출.
- Pexels는 aspect의 `orientation` 파라미터로 필터하고 **정확히 목표 해상도 일치**하는 파일만 채택(라인 98); Pixabay는 `width >= target`; Coverr는 필터 없이 다운스트림 letterbox 처리(16:9 위주라).
- 다운로드: `save_video`(244) — URL md5 해시로 `storage/cache_videos/vid-<hash>.mp4` 캐싱(중복 회피), 다운로드 후 `VideoFileClip`으로 유효성 검증.
- **소재 순서 로직 2종**: 기본 `download_videos`(304)는 전 키워드 후보를 합쳐 셔플/순차; `_download_videos_by_script_order`(386)는 키워드별 그룹 라운드로빈으로 대본 서사 순서 보존.
- 로컬 소스: 이미지도 허용 → `preprocess_video`(라인 1138)에서 이미지를 **Ken Burns 줌 효과**(라인 1209, `resized(lambda t: 1+…)`) 걸어 mp4로 변환. 480×480 미만 소재는 탈락.
- 오디오 소재: TTS 나레이션(멀티 제공자) + `resource/songs/`의 내장 BGM 30곡(`output0XX.mp3`).

## 5. 훔칠 만한 독창 기능 Top 5

1. **`stop_at` 부분 파이프라인 계약** (`task.py:332`, `controllers/v1/video.py:115~133`) — script/terms/audio/subtitle/materials/video 단계별로 끊고 그 산출물만 반환. `script.json`이라는 계약 파일에 `{script, search_terms, params}`를 남김. → "중간 단계 계약 파일 + 지점 재개" 설계에 그대로 이식 가능.

2. **combined(비주얼 컷) / final(오버레이) 2단계 렌더 분리** (`video.py:535` vs `896`) — 비주얼 컷 조립과 자막·음성·BGM 오버레이를 분리. 자막·톤·음성만 수정 시 무거운 컷 조립을 건너뛸 수 있는 구조적 근거. ffmpeg concat demuxer로 재인코딩 최소화(`concat_video_clips_with_ffmpeg:316`).

3. **자막 렌더링 정밀도 툴킷** (`video.py:746~1080`) — PIL로 폰트 실측 후 CJK 문자단위 줄바꿈(`wrap_text`), 닫는 구두점이 홀로 다음 줄 떨어지는 것 교정(라인 805), TextClip 투명 마스크의 **실제 가시 픽셀 bbox 기준 시각 중앙 정렬**(`_get_visible_center_position:860`), 둥근 반투명 자막 배경(`_rounded_subtitle_background_clip:838`). 자막 세밀 편집 UI 설계의 레퍼런스.

4. **`match_materials_to_script` 서사 순서 매칭** (`task.py:38`, `material.py:386`) — 키워드를 대본 서사 순으로 생성하고 키워드 그룹 라운드로빈 다운로드로 "뒤 내용 화면이 앞에 먼저 뜨는" 문제 해결. 소재-대본 시간축 정합 아이디어.

5. **하드웨어 인코더 자동 폴백 + 멀티 API키 로테이션** (`video.py:206~296` `_write_videofile_with_codec_fallback`, `material.py:37~52` `get_api_key` 스레드세이프 카운터) — nvenc/amf/qsv 시도 실패 시 런타임에 해당 코덱 비활성화 후 libx264 재시도; API키 레이트리밋 회피 로테이션. 프로덕션 견고성 패턴.

보조로 볼 것: TwelveLabs Marengo 512-dim 임베딩으로 검색어를 주제 관련도순 **의미 재정렬**(`app/services/twelvelabs.py:97 rerank_terms_by_subject`, 옵트인) — 소재 관련성 랭킹 아이디어. whisper 자막을 원본 대본으로 사후 교정하는 `subtitle.correct`(`subtitle.py:200`)도 참고.