| ID | 기능명 | 설명(1-2줄) | 근거(파일:라인) | 채택제안 | 검증방법 |
|---|---|---|---|---|---|
| DIR-001 | 에이전트 레지스트리 | 기능을 독립 에이전트로 등록하고 LLM 오케스트레이터가 선택하게 하는 구조. | `backend/director/handler.py:47-74` | P1 확장성 좋음 | `pytest tests/test_agent_registry.py` |
| DIR-002 | Tool-call 공통 계약 | 모든 에이전트가 name/description/parameters를 LLM tool schema로 노출. | `backend/director/agents/base.py:55-61` | P0 계약 핵심 | `pytest tests/test_tool_contract.py` |
| DIR-003 | 자연어 오케스트레이션 프롬프트 | 누락 의존성 자동 해결, 에이전트 선택, 모호성 확인 규칙을 시스템 프롬프트에 명시. | `backend/director/core/reasoning.py:22-64` | P1 운영 흐름 | `pytest tests/test_reasoning_prompt_policy.py` |
| DIR-004 | 컬렉션/미디어 컨텍스트 주입 | 세션 시작 시 현재 비디오/컬렉션의 제목, ID, 길이, 이미지 목록을 reasoning context에 주입. | `backend/director/core/reasoning.py:120-157` | P1 편집 맥락 | `pytest tests/test_context_bootstrap.py` |
| DIR-005 | 반복 Tool-call 루프 | LLM 응답의 tool_calls를 실행하고 결과를 다시 context에 넣어 최대 반복 처리. | `backend/director/core/reasoning.py:221-267` | P0 파이프라인 핵심 | `pytest tests/test_reasoning_tool_loop.py` |
| DIR-006 | 최종 요약 합성 | 에이전트 실행 결과를 사용자용 “Final Cut” 요약으로 재가공. | `backend/director/core/reasoning.py:274-315` | P1 결과 설명 | `pytest tests/test_final_summary.py` |
| DIR-007 | 상태형 메시지 계약 | progress/success/error와 text/video/image/search 결과 타입을 Pydantic 모델로 정의. | `backend/director/core/session.py:22-30`, `backend/director/core/session.py:77-171` | P0 UI 계약 | `pytest tests/test_message_schema.py` |
| DIR-008 | WebSocket 진행상태 발행 | OutputMessage 갱신 시 Socket.IO로 emit하고 DB에도 저장. | `backend/director/core/session.py:222-243` | P1 대시보드 필수 | `pytest tests/test_realtime_progress.py` |
| DIR-009 | 추론/에이전트 컨텍스트 저장 | reasoning context와 agent별 context를 분리 저장하고 edited_context로 재주입 가능. | `backend/director/core/session.py:334-364` | P1 재개 편집 | `pytest tests/test_context_resume.py` |
| DIR-010 | DB 어댑터 추상화 | SQLite/Postgres를 같은 BaseDB 인터페이스로 교체. | `backend/director/db/base.py:4-49`, `backend/director/db/__init__.py:7-19` | P2 배포 유연성 | `pytest tests/test_db_adapter_contract.py` |
| DIR-011 | DB 헬스체크/자동 초기화 | 세션/대화/context 테이블 존재를 확인하고 없으면 초기화. | `backend/director/db/sqlite/db.py:262-280`, `backend/director/db/postgres/db.py:213-231` | P1 운영 안정성 | `pytest tests/test_db_healthcheck.py` |
| DIR-012 | 서버 설정 노브 | DB_TYPE, HOST, PORT, ENV_PREFIX 등을 환경변수로 오버라이드. | `backend/director/entrypoint/api/server.py:39-57`, `backend/director/entrypoint/api/__init__.py:33-45` | P1 배포 설정 | `pytest tests/test_server_config.py` |
| DIR-013 | REST/Socket API 분리 | REST는 세션/미디어 관리, Socket은 chat 실행을 담당. | `backend/director/entrypoint/api/routes.py:10-14`, `backend/director/entrypoint/api/socket_io.py:10-18` | P1 UI 연동 | `pytest tests/test_api_boundaries.py` |
| DIR-014 | 프론트 채팅 셸 | Vue에서 backend socket/http URL을 주입하고 Ctrl/Cmd+K로 새 세션 생성. | `frontend/src/views/DefaultView.vue:9-14`, `frontend/src/views/DefaultView.vue:26-32` | P2 UX 참고 | `npm run build && npm run test:e2e` |
| DIR-015 | 미디어 CRUD API | 컬렉션, 비디오, 오디오, 이미지 조회/삭제/업로드/generate_url 엔드포인트. | `backend/director/entrypoint/api/routes.py:65-258` | P1 에셋 관리 | `pytest tests/test_media_routes.py` |
| DIR-016 | 이미지 입력 텍스트화 | LLM context로 보낼 때 이미지 content를 JSON 설명 텍스트로 변환. | `backend/director/core/session.py:246-264` | P2 멀티모달 대체 | `pytest tests/test_user_message_sanitizer.py` |
| DIR-017 | YouTube playlist 업로드 | URL 업로드 시 playlist를 감지해 각 영상 URL을 순차 업로드. | `backend/director/agents/upload.py:111-180` | P2 소스 수집 | `pytest tests/test_upload_playlist.py` |
| DIR-018 | 구조화 이벤트 알림 | 업로드 성공 후 videos 목록 갱신 이벤트를 emit. | `backend/director/agents/upload.py:85-91`, `backend/director/core/session.py:408-416` | P1 대시보드 갱신 | `pytest tests/test_realtime_events.py` |
| DIR-019 | 타임라인 DSL 참조 | video/image/audio/text/caption, clip, track, timeline 계약을 프롬프트 안에 내장. | `backend/director/agents/editing/agent.py:93-180`, `backend/director/agents/editing/agent.py:250-679` | P0 씬 계약 참고 | `pytest tests/test_timeline_manifest_schema.py` |
| DIR-020 | 편집 코드 템플릿 | Timeline 생성, track 추가, generate_stream까지 코드 구조를 강제. | `backend/director/agents/editing/agent.py:682-733` | P1 생성 안정성 | `pytest tests/test_editing_code_template.py` |
| DIR-021 | 편집 전 미디어 검증 | get_media tool로 video/audio/image 존재와 메타데이터를 확인. | `backend/director/agents/editing/agent.py:793-817`, `backend/director/agents/editing/media_handler.py:17-39` | P0 에셋 검증 | `pytest tests/test_media_verification_tool.py` |
| DIR-022 | 실행 결과 계약 | 생성 코드가 `stream_url`을 만들지 않으면 실패 처리하고 generated_code를 결과에 포함. | `backend/director/agents/editing/code_executor.py:14-43` | P1 재현성 | `pytest tests/test_code_execution_result.py` |
| DIR-023 | 오디오 트랜스코딩 재시도 | 오디오 실패 키워드 감지 시 백오프 재시도 후 video-only fallback 생성. | `backend/director/agents/editing/code_executor.py:98-165`, `backend/director/agents/editing/code_executor.py:174-189` | P1 엣지케이스 | `pytest tests/test_render_retry_fallback.py` |
| DIR-024 | 편집 전용 반복 루프 | 편집 에이전트는 별도 agent_context와 최대 25회 코드 생성 루프를 사용. | `backend/director/agents/editing/agent.py:865-969` | P1 복잡 편집 | `pytest tests/test_editing_agent_loop.py` |
| DIR-025 | 캡션 자산 스타일 계약 | CaptionAsset에 ASS 색상, 폰트, 위치, 애니메이션을 포함. | `backend/director/agents/editing/agent.py:518-548` | P0 자막 계약 | `pytest tests/test_caption_asset_schema.py` |
| DIR-026 | 자막 설정 노브 | 언어, 템플릿, 폰트, 굵기, 애니메이션, 위치, 색, 외곽선, 마진을 tool schema로 노출. | `backend/director/agents/subtitle.py:16-100` | P0 자막 필수 | `pytest tests/test_subtitle_params.py` |
| DIR-027 | 자막 프리셋 | TikTok, cinematic, boxed 등 8개 스타일 템플릿 제공. | `backend/director/agents/subtitle.py:103-208` | P1 품질 기본값 | `pytest tests/test_subtitle_templates.py` |
| DIR-028 | 언어별 폰트/코드 매핑 | 인도계 언어 폰트와 Gemini 지원 ISO 코드를 별도 매핑. | `backend/director/agents/subtitle.py:222-246` | P2 다국어 확장 | `pytest tests/test_language_font_mapping.py` |
| DIR-029 | 자막 transcript fallback/번역 | transcript가 없으면 spoken words indexing 후 재조회하고 필요 시 번역. | `backend/director/agents/subtitle.py:448-482` | P0 자막 안정성 | `pytest tests/test_subtitle_transcript_fallback.py` |
| DIR-030 | 자막 타임라인 합성 | 원본 비디오 clip과 caption clip을 같은 track에 올려 최종 stream 생성. | `backend/director/agents/subtitle.py:513-533` | P0 워드싱크 후보 | `pytest tests/test_subtitle_timeline_render.py` |
| DIR-031 | Text-to-movie 엔진 설정 | 엔진별 max_duration, preferred_style, prompt_format을 분리. | `backend/director/agents/text_to_movie.py:136-155` | P1 씬 생성 제약 | `pytest tests/test_text_to_movie_engine_config.py` |
| DIR-032 | 일관된 Visual Style JSON | 카메라, 컬러, 조명, 무드, 캐릭터/세팅 상수를 JSON으로 먼저 생성. | `backend/director/agents/text_to_movie.py:373-402` | P0 씬 일관성 | `pytest tests/test_visual_style_contract.py` |
| DIR-033 | 씬 시퀀스 생성/시간 보정 | 스토리를 3개 씬으로 분해하고 suggested_duration을 int로 강제. | `backend/director/agents/text_to_movie.py:404-454` | P0 씬 매니페스트 | `pytest tests/test_scene_sequence_contract.py` |
| DIR-034 | 엔진별 프롬프트 압축 | Kling 계열은 구조를 유지하며 2450자 이하로 압축. | `backend/director/agents/text_to_movie.py:456-501` | P1 프롬프트 품질 | `pytest tests/test_prompt_compression.py` |
| DIR-035 | 배경음악 프롬프트 제한 | 음악 프롬프트를 100자 이하로 줄이고 전체 영상 길이에 맞춰 생성. | `backend/director/agents/text_to_movie.py:312-327`, `backend/director/agents/text_to_movie.py:503-521` | P1 오디오 정렬 | `pytest tests/test_bgm_prompt_duration.py` |
| DIR-036 | 씬+음악 최종 합성 | 생성된 씬 영상을 순차 inline하고 BGM을 overlay하며 다른 트랙 비활성화 가능. | `backend/director/agents/text_to_movie.py:523-538` | P1 최종 조립 | `pytest tests/test_movie_composition.py` |
| DIR-037 | 임시 산출물 생명주기 | UUID 파일명으로 생성하고 업로드 후 로컬 파일 삭제. | `backend/director/agents/text_to_movie.py:266-310`, `backend/director/agents/video_generation.py:295-297` | P1 캐시 정책 | `pytest tests/test_temp_asset_cleanup.py` |
| DIR-038 | 비디오 생성 엔진 라우터 | Stability/FAL/VideoDB와 text_to_video/image_to_video job_type을 schema로 분리. | `backend/director/agents/video_generation.py:22-105`, `backend/director/agents/video_generation.py:153-169` | P1 모델 교체 | `pytest tests/test_video_generation_router.py` |
| DIR-039 | image-to-video 입력 검증 | duration 범위, image_id 존재, URL 생성 실패를 명시적으로 검증. | `backend/director/agents/video_generation.py:207-239` | P0 품질 게이트 | `pytest tests/test_image_to_video_validation.py` |
| DIR-040 | 다중 모델 비교 UI | 여러 생성 작업의 placeholder를 먼저 띄우고 성공/오류를 슬롯별 갱신. | `backend/director/agents/comparison.py:96-128` | P2 평가 확장 | `pytest tests/test_generation_comparison.py` |
| DIR-041 | 이미지 생성/향상 라우터 | text_to_image는 VideoDB/Flux, image_to_image는 FAL로 분기. | `backend/director/agents/image_generation.py:17-68`, `backend/director/agents/image_generation.py:107-160` | P2 이미지 에셋 | `pytest tests/test_image_generation_router.py` |
| DIR-042 | 오디오 생성 라우터 | TTS, SFX, 음악 생성을 ElevenLabs/Beatoven/VideoDB로 분기. | `backend/director/agents/audio_generation.py:20-97`, `backend/director/agents/audio_generation.py:155-205` | P0 TTS 기반 | `pytest tests/test_audio_generation_router.py` |
| DIR-043 | TTS 음성 노브 | voice_id, output_format, language_code, stability, similarity, style, speaker_boost 제공. | `backend/director/tools/elevenlabs.py:54-136`, `backend/director/tools/elevenlabs.py:169-188` | P0 한국어 TTS | `pytest tests/test_tts_voice_config.py` |
| DIR-044 | 오디오 다운로드 data URL | 생성 오디오를 base64 data URL로 즉시 다운로드 가능하게 노출. | `backend/director/agents/audio_generation.py:224-238` | P2 리뷰 편의 | `pytest tests/test_audio_download_link.py` |
| DIR-045 | Stability 폴링 생성 | text→image→resize→image-to-video→result polling 흐름. | `backend/director/tools/stabilityai.py:50-135` | P2 외부 엔진 | `pytest tests/test_stability_adapter.py` |
| DIR-046 | FAL 모델 allowlist | text/image video/image 변환 모델명을 enum으로 제한하고 일부 모델 duration 특례 처리. | `backend/director/tools/fal_video.py:7-63`, `backend/director/tools/fal_video.py:107-124` | P1 모델 안전장치 | `pytest tests/test_fal_model_config.py` |
| DIR-047 | Kling 카메라 제어 | camera_control에 pan/tilt/roll/zoom 등 수치 노브와 JWT/polling 처리. | `backend/director/tools/kling.py:5-108`, `backend/director/tools/kling.py:119-187` | P2 모션 제어 | `pytest tests/test_kling_camera_config.py` |
| DIR-048 | Beatoven 비동기 음악 | track 생성 후 compose task 상태를 polling해 mp3 저장. | `backend/director/tools/beatoven.py:24-68` | P2 음악 확장 | `pytest tests/test_beatoven_polling.py` |
| DIR-049 | spoken/scene 인덱싱 | spoken words와 scene index를 분리하고 shot/time 기반 scene 추출 설정 제공. | `backend/director/agents/index.py:10-27`, `backend/director/agents/index.py:244-261` | P1 검색 기반 편집 | `pytest tests/test_indexing_config.py` |
| DIR-050 | 상세 scene 분석 프롬프트 | OCR, 로고, 인물, 장르, 개인정보/민감성까지 scene index 프롬프트에 포함. | `backend/director/agents/index.py:114-205` | P1 품질 메타데이터 | `pytest tests/test_scene_index_prompt_snapshot.py` |
| DIR-051 | 검색 임계값 노브 | semantic/keyword, result_threshold, score_threshold, dynamic_score_percentage 지원. | `backend/director/agents/search.py:22-60`, `backend/director/agents/search.py:135-153` | P1 자동 클립 품질 | `pytest tests/test_search_thresholds.py` |
| DIR-052 | 검색 결과 compilation | 검색 shot을 UI 결과로 그룹화하고 compilation clip과 LLM 요약을 생성. | `backend/director/agents/search.py:170-262` | P1 리뷰 워크플로 | `pytest tests/test_search_compilation.py` |
| DIR-053 | Prompt Clip 병렬 추출 | transcript/scene/multimodal 문서를 chunking하고 ThreadPool로 LLM 매칭 실행. | `backend/director/agents/prompt_clip.py:54-114`, `backend/director/agents/prompt_clip.py:116-220` | P1 자동 하이라이트 | `pytest tests/test_prompt_clip_matching.py` |
| DIR-054 | Prompt Clip 타임라인 생성 | 매칭 문장을 keyword search로 timestamp화하고 timeline 구간 stream 생성. | `backend/director/agents/prompt_clip.py:237-252`, `backend/director/agents/prompt_clip.py:284-341` | P1 부분 재렌더 후보 | `pytest tests/test_prompt_clip_timeline.py` |
| DIR-055 | timestamp transcript 포맷 | transcript를 N분 단위로 그룹화해 `[mm:ss mm:ss]` 텍스트 출력. | `backend/director/agents/transcription.py:17-24`, `backend/director/agents/transcription.py:67-101` | P2 편집 보조 | `pytest tests/test_transcript_timestamp_grouping.py` |
| DIR-056 | 비속어 censor 타임라인 | LLM이 profanity timestamp JSON을 만들고 beep audio를 padding 포함 overlay. | `backend/director/agents/censor.py:21-27`, `backend/director/agents/censor.py:49-60`, `backend/director/agents/censor.py:141-160` | P2 정책 확장 | `pytest tests/test_censor_timeline.py` |
| DIR-057 | 더빙 엔진 추상화 | ElevenLabs job polling/download/upload와 VideoDB 직접 dubbing을 모두 지원. | `backend/director/agents/dubbing.py:13-47`, `backend/director/agents/dubbing.py:100-157` | P2 다국어 확장 | `pytest tests/test_dubbing_engines.py` |
| DIR-058 | 음성복제 권한 게이트 | voice clone 요청에 명시적 authorization flag와 audio_url/video_id 배타 검증. | `backend/director/agents/clone_voice.py:57-70`, `backend/director/agents/clone_voice.py:166-183` | P1 안전 게이트 | `pytest tests/test_voice_clone_authorization.py` |
| DIR-059 | 다중 영상 음성 교체 | 샘플 구간에서 음성을 clone하고 여러 video transcript를 합성 오디오로 overlay. | `backend/director/agents/voice_replacement.py:15-67`, `backend/director/agents/voice_replacement.py:187-287` | P2 음성 워크플로 | `pytest tests/test_voice_replacement.py` |
| DIR-060 | 프레임 추출 preview | video_id와 timestamp로 썸네일 프레임을 생성해 ImageContent로 표시. | `backend/director/agents/frame.py:37-60`, `backend/director/tools/videodb_tool.py:243-251` | P1 씬 썸네일 | `pytest tests/test_frame_extraction.py` |
| DIR-061 | stream/download 유틸 | video_id 또는 stream_url을 플레이어로 반환하고, stream은 다운로드 URL로 변환. | `backend/director/agents/stream_video.py:39-75`, `backend/director/agents/download.py:36-58` | P1 리뷰/반출 | `pytest tests/test_stream_download_agents.py` |
| DIR-062 | 웹 비디오 검색 검증 | count/duration/query를 검증하고 YouTube 채널/playlist 등 비영상 URL을 필터링. | `backend/director/agents/web_search_agent.py:155-206` | P2 소스 탐색 | `pytest tests/test_web_video_search_filter.py` |

## 이 레포에서 배우지 말 것

1. 임의 생성 Python을 `exec`로 실행하는 방식. `__builtins__`를 그대로 열고 생성 코드를 실행한다는 점이 위험하다. 근거: `backend/director/agents/editing/code_executor.py:20-23`, `backend/director/agents/editing/code_executor.py:109`.

2. tool 계약 불일치를 테스트 없이 방치하는 방식. `SubtitleAgent`는 `index_spoken_words(video_id, language_code=...)`로 호출하지만 실제 `VideoDBTool.index_spoken_words`는 `video_id`만 받는다. 근거: `backend/director/agents/subtitle.py:457-459`, `backend/director/tools/videodb_tool.py:261-265`.

3. mutable default를 모델/DB 인자에 쓰는 방식. 메시지 리스트와 응답 dict, metadata 기본값이 공유 상태 버그를 만들 수 있다. 근거: `backend/director/core/session.py:183-198`, `backend/director/agents/base.py:18-23`, `backend/director/db/sqlite/db.py:31-39`.