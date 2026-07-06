| ID | 기능명 | 설명(1-2줄) | 근거(파일:라인) | 채택제안 | 검증방법 |
|---|---|---|---|---|---|
| PLP-001 | 씬 스키마 | `scene_id/duration/image_prompt/video_prompt/voiceover/transition/camera_motion/shot_mode/speaker_id` 등 씬 단위 계약이 명확하다. | `modules/llm.py:33-49` | P0 씬계약 핵심 | `pytest tests/test_pipeline.py::TestDataStructures::test_script_serialization` |
| PLP-002 | Null 안전 씬 초기화 | LLM·UI가 `null`을 보내도 문자열/리스트 기본값으로 보정해 후속 `.strip()` 오류를 막는다. | `modules/llm.py:51-64` | P1 안정성 필수 | 신규 `pytest tests/test_scene_contract.py::test_scene_null_defaults` |
| PLP-003 | 비디오 스크립트 상위 계약 | 제목, 주제, 스타일, 총 길이, 씬 목록, 캐릭터, 배포 메타데이터를 한 객체로 묶는다. | `modules/llm.py:67-76` | P0 매니페스트 기반 | `pytest tests/test_pipeline.py::TestDataStructures::test_script_serialization` |
| PLP-004 | 캐릭터/대조영상 분석 계약 | 인물 외형, 대체 이미지, reverse prompt, BGM, 색감, 전체 스타일을 구조화한다. | `modules/llm.py:83-108` | P1 리메이크 유용 | 신규 `pytest tests/test_reference_analysis.py::test_analysis_schema_roundtrip` |
| PLP-005 | LLM JSON 출력 프롬프트 | 스크립트 생성 시 JSON 구조, 장면 규칙, 메타데이터, shot mode를 프롬프트에서 강제한다. | `modules/llm.py:115-193` | P0 생성계약 핵심 | 신규 `pytest tests/test_prompts.py::test_script_prompt_contains_required_schema` |
| PLP-006 | Reflection 검수 패스 | 초안 생성 뒤 별도 검수 프롬프트로 JSON 형식, 프롬프트 구체성, 길이, 스타일, shot mode를 재검사한다. | `modules/llm.py:195-208`, `modules/llm.py:363-381` | P0 품질게이트 후보 | 신규 `pytest tests/test_llm_reflection.py::test_reflection_second_call` |
| PLP-007 | Shot mode 기획 규칙 | `multi_ref/first_end_frame/t2v/i2v`를 씬 생성 단계에서 LLM이 표기하도록 한다. | `modules/llm.py:181-188` | P1 렌더전략 분기 | `pytest tests/test_all.py::test_llm_script` |
| PLP-008 | JSON mode 조건부 사용 | 지원 모델에만 `response_format=json_object`를 붙여 OpenAI 호환 모델 차이를 흡수한다. | `modules/llm.py:348-356`, `modules/llm.py:712-715` | P2 모델호환 개선 | 신규 `pytest tests/test_llm_client.py::test_json_mode_supported_models` |
| PLP-009 | 견고한 JSON 파서 | 원문 JSON, markdown 코드블록, 앞뒤 설명 포함, 중첩 JSON 후보를 순차 파싱한다. | `modules/llm.py:718-770` | P1 LLM출력 방어 | `pytest tests/test_pipeline.py::TestDataStructures::test_json_parsing_with_markdown` |
| PLP-010 | 대조영상 역분석 프롬프트 | 영상에서 인물, 분镜, reverse prompt, 색감, BGM, 전체 스타일을 추출하는 분석 프롬프트가 있다. | `modules/llm.py:211-261` | P1 레퍼런스 재현 | 신규 `pytest tests/test_reference_analysis.py::test_video_analysis_prompt_fields` |
| PLP-011 | Gemini 영상 파일 분석 | MIME 판별, Files API 업로드, 처리 완료 폴링, 120초 타임아웃으로 영상 이해를 수행한다. | `modules/llm.py:433-467` | P2 레퍼런스 확장 | 신규 `pytest tests/test_reference_analysis.py::test_gemini_file_poll_timeout` |
| PLP-012 | 분석 모델 fallback | 구형 Gemini 모델을 자동 교체하고 503/429 시 후보 모델로 순차 전환한다. | `modules/llm.py:472-532` | P1 장애복원 좋음 | 신규 `pytest tests/test_reference_analysis.py::test_model_fallback_on_503` |
| PLP-013 | 키프레임 기반 영상분석 fallback | 영상 직접 분석이 불가하면 ffmpeg로 균등 8프레임을 추출해 멀티이미지 분석으로 대체한다. | `modules/llm.py:555-630` | P2 분석복원 확장 | 신규 `pytest tests/test_reference_analysis.py::test_frame_fallback_extracts_8_frames` |
| PLP-014 | 분석 파싱 실패 최소 결과 | 분석 JSON 파싱 실패 시 원문을 보존한 최소 `ReferenceVideoAnalysis`를 반환한다. | `modules/llm.py:641-705` | P1 실패관측 유용 | 신규 `pytest tests/test_reference_analysis.py::test_parse_failure_returns_raw` |
| PLP-015 | 계층형 설정 로딩 | 기본 경로, 명시 경로, 환경변수 override, deep merge로 실행 환경별 설정을 합친다. | `core/config.py:13-18`, `core/config.py:157-203` | P1 배포설정 유용 | `pytest tests/test_pipeline.py::TestConfig::test_config_env_override` |
| PLP-016 | 설정 노브 집합 | LLM, 이미지, 영상, TTS, 로컬 경로, 편집 초안, 메모리, 서버 설정을 dataclass로 분리한다. | `core/config.py:21-143` | P1 옵션체계 참고 | `pytest tests/test_pipeline.py::TestConfig::test_default_config` |
| PLP-017 | 프로젝트 요청 계약 | 주제, 스타일, 길이, 음성, 엔진, 참고 이미지, preset scenes, 해상도, 비율, 전역 스타일을 API 계약으로 받는다. | `api/server.py:208-222` | P0 대시보드 계약 | 신규 `pytest tests/test_api_schema.py::test_create_project_request_schema` |
| PLP-018 | 워크플로 상태 enum | idle부터 completed/failed까지 단계와 진행률, 현재 씬, 결과, 오류를 상태 객체로 표현한다. | `api/server.py:67-88` | P1 진행상태 표준 | 신규 `pytest tests/test_workflow_status.py::test_stage_values` |
| PLP-019 | 프로젝트 메타데이터 복원 | 프로젝트 요약 상태를 JSON으로 저장하고 서버 시작 시 히스토리를 복구한다. | `api/server.py:100-145`, `api/server.py:1538-1541` | P1 작업복원 필요 | 신규 `pytest tests/test_project_meta.py::test_save_and_load_project_meta` |
| PLP-020 | WebSocket 상태 푸시 | 프로젝트별 연결 목록을 관리하고 상태 변경을 실시간 브로드캐스트한다. | `api/server.py:152-201`, `api/server.py:1445-1465` | P1 편집콘솔 필수 | 신규 `pytest tests/test_ws.py::test_status_broadcast` |
| PLP-021 | 5단계 백그라운드 워크플로 | 스크립트, 리뷰, 이미지+TTS, 영상, 조립+초안 생성의 단계형 파이프라인이다. | `api/server.py:402-410` | P0 파이프라인 기준 | 신규 `pytest tests/test_workflow.py::test_stage_order_with_mocks` |
| PLP-022 | 인간 리뷰 게이트 | 스크립트 생성 후 승인 이벤트를 기다리고 30분 타임아웃 또는 거절 시 중단한다. | `api/server.py:481-506`, `api/server.py:715-735` | P0 품질게이트 핵심 | 신규 `pytest tests/test_review_gate.py::test_review_approve_resume` |
| PLP-023 | 리뷰 중 씬 편집 반영 | 사용자가 수정한 씬을 안전 기본값으로 재구성하고 image prompt 변경을 학습 이벤트로 남긴다. | `api/server.py:508-533`, `api/server.py:738-747` | P1 편집루프 중요 | 신규 `pytest tests/test_review_gate.py::test_review_edit_updates_scene` |
| PLP-024 | preset scenes 경로 | 대조영상 분석 결과가 있으면 LLM 생성을 건너뛰고 해당 분镜을 `VideoScript`로 변환한다. | `api/server.py:423-449` | P1 리메이크 빠름 | 신규 `pytest tests/test_workflow.py::test_preset_scenes_skip_llm` |
| PLP-025 | 이미지/TTS 병렬 생성 | 키프레임과 TTS를 동시에 실행하고 TTS 동시성은 낮춰 rate limit 위험을 줄인다. | `api/server.py:541-575` | P1 처리시간 절감 | 신규 `pytest tests/test_workflow.py::test_image_tts_run_concurrently` |
| PLP-026 | TTS 실측 duration 반영 | 생성된 음성 길이에 padding을 더해 씬 duration을 0.5초 단위로 갱신한다. | `api/server.py:577-579`, `modules/tts.py:642-665` | P0 타이밍 핵심 | `pytest tests/test_pipeline.py::TestTTSUtils::test_update_scene_durations` |
| PLP-027 | 전역 스타일 락 | 요청 또는 스크립트 스타일을 이미지 프롬프트에 `GLOBAL STYLE LOCK`으로 주입해 스타일 드리프트를 줄인다. | `api/server.py:542-548`, `modules/image_gen.py:108-124` | P0 일관성 핵심 | 신규 `pytest tests/test_image_prompt.py::test_global_style_lock_in_prompt` |
| PLP-028 | 부분 재개 워크플로 | 기존 `script.json`, keyframes, audio를 스캔해 영상 생성 단계부터 재개한다. | `api/server.py:814-843`, `api/server.py:875-917` | P0 부분재렌더 핵심 | 신규 `pytest tests/test_resume.py::test_resume_requires_all_keyframes` |
| PLP-029 | API 키 상태/검증 API | 키 저장, 설정 singleton reset, 서비스별 최소 요청 테스트, 구성 여부 조회를 제공한다. | `api/server.py:767-811`, `api/server.py:1000-1145` | P1 운영성 좋음 | 신규 `pytest tests/test_settings_api.py::test_key_status_and_update` |
| PLP-030 | 참고 이미지/영상 업로드 | 이미지 저장 또는 영상 1/3 지점 프레임 추출로 캐릭터 참고 이미지를 만든다. | `api/server.py:239-328` | P2 레퍼런스 입력 | 신규 `pytest tests/test_uploads.py::test_video_upload_extracts_frame` |
| PLP-031 | 대조영상 분석 API | 업로드 후 background task로 분석하고 `processing/completed/failed` 상태를 polling한다. | `api/server.py:1195-1279` | P2 리메이크 기능 | 신규 `pytest tests/test_analyze_api.py::test_analysis_lifecycle` |
| PLP-032 | 캐릭터 대체 이미지 | 분석된 캐릭터별 replacement image 업로드, 영상 프레임 추출, 삭제 API를 제공한다. | `api/server.py:1282-1366` | P2 인물치환 확장 | 신규 `pytest tests/test_analyze_api.py::test_replace_character_image` |
| PLP-033 | 분석 기반 프로젝트 생성 | 분석의 전체 프롬프트, 대체 이미지, preset scenes를 묶어 새 프로젝트를 시작한다. | `api/server.py:1369-1429` | P1 레퍼런스 제작 | 신규 `pytest tests/test_analyze_api.py::test_create_project_from_analysis` |
| PLP-034 | 산출물 다운로드 API | 완성 MP4 직접 다운로드와 편집 초안 폴더 ZIP 다운로드를 제공한다. | `api/server.py:1480-1530` | P2 운영편의 확장 | 신규 `pytest tests/test_downloads.py::test_video_and_draft_downloads` |
| PLP-035 | 파일 캐시/스킵 | keyframe, TTS, video clip이 이미 있으면 재생성을 건너뛰어 재시도 비용을 낮춘다. | `modules/image_gen.py:87-94`, `modules/tts.py:83-90`, `modules/video_gen.py:762-774` | P0 부분재렌더 핵심 | 신규 `pytest tests/test_cache.py::test_existing_assets_are_reused` |
| PLP-036 | 참조 이미지 캐릭터 고정 | 참고 이미지를 multipart로 넣고 얼굴, 헤어, 의상, 체형 보존 지시를 강하게 추가한다. | `modules/image_gen.py:130-162` | P1 인물일관성 좋음 | 신규 `pytest tests/test_image_prompt.py::test_reference_parts_added` |
| PLP-037 | 스타일 참고 이미지 | 별도 스타일 이미지를 추가해 팔레트와 미감을 따라가도록 지시한다. | `modules/image_gen.py:164-172` | P2 스타일확장 후보 | 신규 `pytest tests/test_image_prompt.py::test_style_reference_part_added` |
| PLP-038 | 이미지 모델 블랙리스트 | 404/503/타임아웃 모델을 세션 블랙리스트에 넣고 이후 씬에서 건너뛴다. | `modules/image_gen.py:35-51`, `modules/image_gen.py:181-200` | P1 장애복원 좋음 | 신규 `pytest tests/test_image_fallback.py::test_failed_model_blacklisted` |
| PLP-039 | 이미지 생성 타임아웃 | ThreadPoolExecutor로 모델 호출을 감싸 60초 초과 시 다음 모델로 전환한다. | `modules/image_gen.py:214-240` | P1 멈춤방지 중요 | 신규 `pytest tests/test_image_fallback.py::test_timeout_switches_model` |
| PLP-040 | 이미지 오류별 처리 | 404/503은 블랙리스트, 429 spending cap은 즉시 오류, RPM은 대기 후 실패 처리한다. | `modules/image_gen.py:244-274` | P1 에러분기 참고 | 신규 `pytest tests/test_image_fallback.py::test_rate_limit_classification` |
| PLP-041 | 안전 필터 재프롬프트 | IMAGE_SAFETY 응답이면 인물/접촉 단어를 제거한 환경 중심 prompt로 1회 재시도한다. | `modules/image_gen.py:315-356`, `modules/image_gen.py:496-517` | P1 안전복구 유용 | 신규 `pytest tests/test_image_safety.py::test_safety_retry_uses_safe_prompt` |
| PLP-042 | 외형 프롬프트 증강 | 참고 이미지가 없을 때 `characters_in_scene`의 `appearance_prompt`를 image prompt에 추가한다. | `modules/image_gen.py:398-432` | P1 캐릭터일관성 보완 | 신규 `pytest tests/test_image_prompt.py::test_appearance_prompt_injected` |
| PLP-043 | TTS 음색/감정 노브 | MiniMax 기본 음색 목록과 neutral/happy/sad 등 감정 옵션을 payload에 반영한다. | `modules/tts.py:32-47`, `modules/tts.py:127-130` | P2 연출확장 후보 | 신규 `pytest tests/test_tts_payload.py::test_emotion_added_to_payload` |
| PLP-044 | 빈 나레이션 스킵 | voiceover가 비어 있으면 음성 생성을 건너뛰고 빈 경로와 0초를 반환한다. | `modules/tts.py:92-95`, `modules/tts.py:391-395` | P1 엣지케이스 필요 | 신규 `pytest tests/test_tts.py::test_empty_voiceover_skipped` |
| PLP-045 | TTS rate limit 재시도 | RPM/TPM 코드에 대해 5/10/20/40초 지수 대기로 최대 4회 재시도한다. | `modules/tts.py:137-161`, `modules/tts.py:299-319` | P1 API안정성 좋음 | 신규 `pytest tests/test_tts.py::test_rate_limit_backoff` |
| PLP-046 | 화자별 음색 매핑 | narrator, male, female 기본 음색을 분리하고 `speaker_id`와 캐릭터 성별로 음색을 고른다. | `modules/tts.py:182-190`, `modules/tts.py:489-506` | P1 다화자 핵심 | `python tests/test_e2e_real.py` |
| PLP-047 | 다화자 텍스트 분할 | `男：/女：/男（언어）：` 같은 접두사로 대사를 세그먼트화한다. 한국어 화자표기로 확장 가능하다. | `modules/tts.py:216-259` | P1 한국어화 필요 | 신규 `pytest tests/test_tts_multispeaker.py::test_split_korean_speaker_labels` |
| PLP-048 | 다화자 TTS 병합 | 화자별 세그먼트를 각각 합성한 뒤 ffmpeg concat으로 씬 단위 MP3를 만든다. | `modules/tts.py:327-361`, `modules/tts.py:364-467` | P1 대화씬 필수 | 신규 `pytest tests/test_tts_multispeaker.py::test_segments_concat_to_one_mp3` |
| PLP-049 | 오디오 길이 fallback | mutagen, wave, ffprobe 순서로 실제 오디오 duration을 구하고 최후에는 5초를 반환한다. | `modules/tts.py:591-639` | P1 타이밍 안정 | 신규 `pytest tests/test_audio_duration.py::test_duration_fallback_order` |
| PLP-050 | 영상 엔진 자동 라우팅 | 대화/립싱크/다인물은 Seedance, 액션/스포츠/역동 장면은 Kling으로 점수 기반 라우팅한다. | `modules/video_gen.py:95-127` | P2 멀티엔진 확장 | `pytest tests/test_pipeline.py::TestVideoEngineRouting` |
| PLP-051 | 영상 shot mode 자동판별 | scene에 shot_mode가 없으면 참조 캐릭터, 전환 키워드, 풍경/인물 키워드로 생성 모드를 추론한다. | `modules/video_gen.py:41-88` | P1 렌더전략 보조 | 신규 `pytest tests/test_video_mode.py::test_auto_detect_shot_modes` |
| PLP-052 | Kling Omni 배치 | 최대 6개 씬을 multi-shot으로 묶고 duration 합계, image reference, 512자 prompt 제한을 맞춘다. | `modules/video_gen.py:254-370` | P2 외부엔진 확장 | 신규 `pytest tests/test_kling_payload.py::test_omni_batch_payload_constraints` |
| PLP-053 | 영상 작업 폴링 | Kling/Omni/Seedance 작업을 상태 폴링하고 성공 URL, 실패 메시지, timeout을 분기한다. | `modules/video_gen.py:373-423`, `modules/video_gen.py:484-527`, `modules/video_gen.py:591-626` | P1 장기작업 필수 | 신규 `pytest tests/test_video_polling.py::test_poll_success_failed_timeout` |
| PLP-054 | 레거시 I2V payload | Kling I2V에 negative prompt, cfg, duration 5/10초, aspect ratio, 품질 기반 해상도 노브를 넣는다. | `modules/video_gen.py:448-462` | P2 외부엔진 참고 | 신규 `pytest tests/test_kling_payload.py::test_i2v_payload` |
| PLP-055 | 조립 계획 계약 | scenes, video clips, audio clips, output, temp, subtitles, subtitle style, aspect ratio를 조립 단위로 묶는다. | `modules/assembler.py:28-39` | P0 렌더계약 핵심 | 신규 `pytest tests/test_assembly_contract.py::test_plan_required_fields` |
| PLP-056 | 결정적 조립 파이프라인 | trim, SRT 생성, xfade, 오디오 mix, subtitle burn 순서로 최종 MP4를 만든다. | `modules/assembler.py:58-153` | P0 렌더파이프 핵심 | 신규 `pytest tests/test_assembler_e2e.py::test_synthetic_clips_assemble` |
| PLP-057 | 비율별 목표 해상도 | 9:16/3:4는 1080x1920, 그 외는 1920x1080으로 통일한다. | `modules/assembler.py:82-86`, `modules/jianying_draft.py:47-51` | P0 품질게이트 기준 | 신규 `pytest tests/test_resolution.py::test_aspect_ratio_resolution` |
| PLP-058 | 호환 H.264 인코딩 | yuv420p, high profile, level 4.1, faststart를 공통 인코딩 인자로 쓴다. | `modules/assembler.py:41-51` | P1 배포호환 중요 | 신규 `pytest tests/test_encoding.py::test_output_h264_compatible` |
| PLP-059 | scale+pad 정규화 | 각 클립을 타깃 해상도 안에 맞춰 등비 축소 후 검은 패딩과 SAR=1로 통일한다. | `modules/assembler.py:188-214` | P1 xfade안정 필요 | 신규 `pytest tests/test_assembler_filters.py::test_trim_outputs_target_resolution` |
| PLP-060 | xfade 오프셋 계산 | 전환 길이만큼 겹치는 것을 고려해 누적 duration 기반 offset을 계산한다. | `modules/assembler.py:217-287` | P1 전환정확성 필요 | 신규 `pytest tests/test_assembler_filters.py::test_xfade_offsets` |
| PLP-061 | 오디오 adelay 정렬 | xfade로 줄어든 시간축을 고려해 각 음성 트랙을 ms 단위로 지연 후 amix한다. | `modules/assembler.py:289-363` | P0 워드싱크 기반 | 신규 `pytest tests/test_audio_mix.py::test_audio_offsets_consider_xfade` |
| PLP-062 | SRT 생성과 자막 분행 | 실제 오디오 길이, xfade overlap, 화면비별 글자 수, 문장부호 분행을 반영해 SRT를 만든다. | `modules/assembler.py:440-511` | P0 자막품질 핵심 | `pytest tests/test_pipeline.py::TestSubtitleUtils` |
| PLP-063 | 화자 접두사 자막 제거 | TTS용 `男：/女：` 접두사를 화면 자막에서 제거한다. | `modules/assembler.py:433-437`, `modules/jianying_draft.py:36-44` | P1 자막가독성 필요 | 신규 `pytest tests/test_subtitles.py::test_speaker_prefix_removed` |
| PLP-064 | 전환명 매핑 | 내부 전환명을 FFmpeg xfade 이름으로 변환하고 unknown은 fade로 회귀한다. | `modules/assembler.py:535-546` | P1 계약단순화 좋음 | `pytest tests/test_pipeline.py::TestSubtitleUtils::test_map_transition` |
| PLP-065 | 편집 초안 분리 트랙 | pyJianYingDraft 사용 시 비디오/配音/字幕 트랙을 분리하고 각 씬을 독립 세그먼트로 추가한다. | `modules/jianying_draft.py:101-147`, `modules/jianying_draft.py:151-205` | P2 외부편집 확장 | 신규 `pytest tests/test_jianying.py::test_tracks_and_segments_created_with_mock` |
| PLP-066 | 씬 소재 manifest | 각 씬의 실제/계획 길이, 오디오 길이, 프롬프트, shot mode, 파일 경로를 JSON으로 남긴다. | `modules/jianying_draft.py:226-277` | P0 부분재렌더 핵심 | `pytest tests/test_pipeline.py::TestJianyingDraft::test_edl_fallback` |
| PLP-067 | EDL fallback | pyJianYingDraft 실패 시 EDL, SRT, manifest, 가져오기 안내 파일을 생성한다. | `modules/jianying_draft.py:280-373` | P2 편집호환 확장 | `pytest tests/test_pipeline.py::TestJianyingDraft::test_edl_fallback` |
| PLP-068 | 로컬 메모리 저장소 | SQLite에 스타일 선호, procedural memory, 프로젝트 이력, 피드백 이벤트를 저장한다. | `modules/memory.py:53-106` | P2 개인화 확장 | `pytest tests/test_pipeline.py::TestMemorySystem::test_local_memory_store` |
| PLP-069 | 생성 컨텍스트 주입 | 과거 선호, 성공 image prompt, Mem0 검색 결과를 LLM 생성 컨텍스트로 합친다. | `modules/memory.py:222-267` | P2 개인화 후보 | `pytest tests/test_pipeline.py::TestMemorySystem::test_memory_manager_context` |
| PLP-070 | 피드백 기반 학습 | 스크립트에서 평균 씬 길이/태그/전환을 학습하고, 편집·평점으로 가중치를 조정한다. | `modules/memory.py:269-367` | P2 장기개선 후보 | 신규 `pytest tests/test_memory_learning.py::test_rating_adjusts_weights` |

## 이 레포에서 배우지 말 것

1. 실패 이미지를 조용히 placeholder로 대체하기: 생성 실패 후 회색 이미지로 계속 진행하면 품질 하드게이트와 충돌한다. 근거 `modules/image_gen.py:357-363`, `modules/image_gen.py:520-560`.

2. 로컬 에셋을 공개 무료 CDN에 올리는 방식: catbox.moe 업로드는 개인정보, 라이선스, 재현성, 캐시 통제 측면에서 위험하다. 근거 `modules/video_gen.py:207-251`, `modules/video_gen.py:284-298`.

3. 주석과 구현이 다른 fallback 정책: 주석은 “Omni 실패 → v3 i2v → Seedance”라고 하지만 실제 코드는 “不降级”로 바로 예외를 던진다. 근거 `modules/video_gen.py:845-849`, `modules/video_gen.py:704-706`, `modules/video_gen.py:821-823`.