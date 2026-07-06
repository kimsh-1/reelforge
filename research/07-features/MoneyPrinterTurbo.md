| ID | 기능명 | 설명(1-2줄) | 근거(파일:라인) | 채택제안 | 검증방법 |
|---|---|---|---|---|---|
| MPT-001 | 통합 영상 생성 계약 | 주제, 스크립트, 검색어, 소스, 오디오, 자막, 스타일, 프롬프트를 단일 요청 모델로 묶는다. hyperframes 씬 매니페스트의 상위 프로젝트 계약으로 이식 가능. | app/models/schema.py:58 | P0 계약 핵심 | `pytest tests/contracts/test_manifest_schema.py` |
| MPT-002 | 비율별 해상도 매핑 | 16:9, 9:16, 1:1을 고정 렌더 해상도로 변환한다. 결정론 렌더 타깃 프리셋으로 적합. | app/models/schema.py:32 | P0 렌더 기준 | `pytest test/services/test_schema.py` |
| MPT-003 | 소재 정보 표준형 | provider, url, duration만 가진 소재 계약으로 외부/로컬 소재를 정규화한다. | app/models/schema.py:51 | P1 에셋 정규화 | `pytest tests/assets/test_material_contract.py` |
| MPT-004 | 단계별 파이프라인 중단점 | `script`, `terms`, `audio`, `subtitle`, `materials`, `video` 단계에서 중간 산출물만 생성한다. 부분 재렌더와 대시보드 미리보기에 직접 유용. | app/services/task.py:332 | P0 부분 재렌더 | `pytest tests/pipeline/test_stop_at.py` |
| MPT-005 | 작업 진행률 상태 | 단계마다 `state`와 `progress`를 갱신해 장시간 작업 상태를 노출한다. | app/services/task.py:334 | P1 대시보드 상태 | `pytest tests/pipeline/test_task_progress.py` |
| MPT-006 | 스크립트 산출물 저장 | 생성 스크립트, 검색어, 파라미터를 `script.json`으로 남긴다. 재현 가능한 매니페스트 스냅샷으로 확장 가능. | app/services/task.py:77 | P0 재현성 기반 | `pytest tests/pipeline/test_artifact_snapshot.py` |
| MPT-007 | 사용자 스크립트 우선 | 사용자가 스크립트를 넣으면 LLM 생성을 건너뛴다. 편집 대시보드의 수동 수정 흐름에 필요. | app/services/task.py:16 | P1 편집 흐름 | `pytest test/services/test_task.py -k generate_script` |
| MPT-008 | 고급 스크립트 프롬프트 | 단락 수, 추가 요구사항, 커스텀 시스템 프롬프트를 분리해 조합하고 길이를 제한한다. | app/services/llm.py:634 | P1 프롬프트 품질 | `pytest test/services/test_llm.py -k build_script_prompt` |
| MPT-009 | 다중 LLM provider 어댑터 | OpenAI 호환, Azure, Gemini, Qwen, Ollama, LiteLLM 등 여러 provider를 한 함수에서 추상화한다. | app/services/llm.py:139 | P2 공급자 확장 | `pytest test/services/test_llm.py -k provider` |
| MPT-010 | LLM 응답 정규화 | `<think>` 블록, 빈 응답, 비문자 응답을 제거/차단해 스크립트와 자막 오염을 막는다. | app/services/llm.py:46 | P1 출력 정제 | `pytest test/services/test_llm.py -k normalize_text_response` |
| MPT-011 | 에러 내 민감정보 마스킹 | base_url 계정정보와 query token을 에러 메시지에서 제거한다. | app/services/llm.py:69 | P1 보안 기본 | `pytest test/services/test_llm.py -k sanitize_error` |
| MPT-012 | 스크립트 후처리 | LLM이 반환한 마크다운 기호, 링크형 문법을 제거해 낭독용 원문으로 만든다. | app/services/llm.py:699 | P1 낭독 안정 | `pytest tests/text/test_script_cleanup.py` |
| MPT-013 | 스크립트 생성 재시도 | LLM 스크립트 생성 실패 시 최대 5회 재시도한다. | app/services/llm.py:718 | P1 외부 안정성 | `pytest tests/llm/test_retry_policy.py` |
| MPT-014 | 검색어 JSON 계약 | 소재 검색어는 JSON string array, 영어, 1-3단어 규칙으로 강제한다. | app/services/llm.py:760 | P1 소재 검색 | `pytest test/services/test_llm.py -k generate_terms` |
| MPT-015 | 내레이션 순서 검색어 | 스크립트 순서와 같은 chronological 검색어를 생성해 화면과 말의 시간 순서를 맞춘다. | app/services/llm.py:766 | P0 씬 정렬 | `pytest test/services/test_llm.py -k script_ordered_keywords` |
| MPT-016 | JSON fence 복구 | LLM이 ```json fence나 설명을 붙여도 배열/객체를 추출해 복구한다. | app/services/llm.py:744 | P1 LLM 내성 | `pytest test/services/test_llm.py -k code_fence` |
| MPT-017 | 의미 기반 검색어 재정렬 | TwelveLabs Marengo 임베딩으로 주제와 검색어 cosine similarity를 계산해 관련도 높은 소재를 먼저 받는다. | app/services/twelvelabs.py:97 | P2 품질 확장 | `pytest test/services/test_twelvelabs.py -k rerank` |
| MPT-018 | 영상 클립 QA 분석 | TwelveLabs Pegasus로 클립 URL을 설명/검증하는 선택 기능을 둔다. | app/services/twelvelabs.py:135 | P2 QA 확장 | `pytest test/services/test_twelvelabs.py -k analyze_clip` |
| MPT-019 | 플랫폼별 게시 메타데이터 | TikTok, Shorts, Reels별 title, caption, hashtag 길이와 개수를 제한해 생성한다. | app/services/llm.py:872 | P2 배포 확장 | `pytest test/services/test_llm.py -k social_metadata` |
| MPT-020 | 해시태그 정규화 | 문자열/배열 해시태그를 `#tag` 형식으로 중복 제거하고 유니코드 글자를 보존한다. | app/services/llm.py:954 | P2 배포 품질 | `pytest test/services/test_llm.py -k normalize_hashtags` |
| MPT-021 | 소셜 자동 업로드 | 생성 후 Upload-Post API로 TikTok, Instagram, YouTube에 cross-post하고 YouTube synthetic media 플래그를 보낸다. | app/services/upload_post.py:28 | HOLD 제품범위 외 | `pytest test/services/test_upload_post.py` |
| MPT-022 | 동시성/대기열 제한 | 최대 동시 작업과 큐 크기를 제한하고 초과 시 429로 거절한다. | app/controllers/manager/base_manager.py:11 | P1 운영 보호 | `pytest test/services/test_video.py -k task_manager` |
| MPT-023 | Memory/Redis 상태 백엔드 | 단일 프로세스 메모리와 Redis 상태 저장을 선택할 수 있다. | app/services/state.py:26 | P2 분산 운영 | `pytest test/services/test_state.py` |
| MPT-024 | 작업 산출물 URL 변환 | 상태에 저장된 파일 경로를 안전하게 상대 URL로 변환하고 원본 상태는 변경하지 않는다. | app/controllers/v1/video.py:90 | P1 대시보드 링크 | `pytest test/services/test_video.py -k task_query` |
| MPT-025 | Range 기반 영상 스트리밍 | 생성 영상을 HTTP Range로 스트리밍해 브라우저 프리뷰를 지원한다. | app/controllers/v1/video.py:337 | P1 프리뷰 재생 | `pytest tests/api/test_range_stream.py` |
| MPT-026 | 경로 화이트리스트 해석 | 사용자 입력 경로를 realpath와 commonpath로 검증해 디렉터리 탈출을 차단한다. | app/utils/file_security.py:4 | P0 파일 보안 | `pytest tests/security/test_path_resolver.py` |
| MPT-027 | 업로드 파일명 정규화 | 브라우저 업로드 파일명에서 디렉터리 조각과 `..`을 제거/거절한다. | app/controllers/v1/video.py:63 | P1 업로드 보안 | `pytest tests/api/test_upload_sanitization.py` |
| MPT-028 | 커스텀 오디오 경로 제한 | task-local 파일 또는 프로젝트 내부 서버 파일만 커스텀 오디오로 허용한다. | app/services/task.py:89 | P0 오디오 보안 | `pytest test/services/test_task.py -k custom_file` |
| MPT-029 | 로컬 소재 모드 | `video_source=local`이면 업로드/지정 소재를 전처리하고 외부 검색어 생성을 생략한다. | app/services/task.py:236 | P1 에셋 편집 | `pytest test/services/test_task.py -k task_local_materials` |
| MPT-030 | 로컬 소재 재사용 UI | Streamlit 세션에 최근 업로드 소재를 저장해 문안만 바꿔 재생성할 때 소재를 유지한다. | webui/Main.py:1715 | P1 편집 효율 | `pytest tests/dashboard/test_local_material_reuse.py` |
| MPT-031 | BGM 파일 관리 API | 로컬 BGM 목록과 업로드를 제공하되 mp3만 허용하고 파일명만 노출한다. | app/controllers/v1/video.py:235 | P1 오디오 에셋 | `pytest tests/api/test_bgm_assets.py` |
| MPT-032 | API 키 라운드로빈 | 여러 소재 API 키를 thread lock으로 순환 사용해 rate limit을 완화한다. | app/services/material.py:37 | P2 운영 확장 | `pytest tests/assets/test_api_key_rotation.py` |
| MPT-033 | TLS 검증 노브 | 외부 API와 다운로드는 기본 TLS 검증을 켜고 명시 설정일 때만 끈다. | app/services/material.py:20 | P1 공급망 보안 | `pytest test/services/test_material.py -k tls` |
| MPT-034 | Pexels 해상도 필터 | 목표 비율의 정확한 해상도 파일만 선택한다. | app/services/material.py:55 | P2 소재 품질 | `pytest tests/assets/test_pexels_filter.py` |
| MPT-035 | Pixabay 해상도 필터 | 목표 폭 이상인 Pixabay 후보만 선택한다. | app/services/material.py:112 | P2 소재 품질 | `pytest tests/assets/test_pixabay_filter.py` |
| MPT-036 | Coverr provider 통합 | Coverr signed mp4 다운로드 URL을 표준 소재로 변환하고 duration string도 처리한다. | app/services/material.py:168 | P2 소재 확장 | `pytest test/services/test_material.py -k coverr` |
| MPT-037 | URL 해시 기반 다운로드 캐시 | query 제거 URL의 md5로 캐시 파일명을 만들고 duration/fps 유효성을 확인한다. | app/services/material.py:244 | P1 캐시 필수 | `pytest test/services/test_material.py -k save_video` |
| MPT-038 | 소재 저장 위치 노브 | 소재 캐시를 공유 저장소, 지정 디렉터리, task-local 중 선택한다. | app/services/material.py:320 | P1 캐시 정책 | `pytest tests/assets/test_material_directory.py` |
| MPT-039 | 중복 URL 제거와 시간 예산 | 중복 소재 URL을 제거하고 필요한 오디오 길이를 넘으면 다운로드를 멈춘다. | app/services/material.py:337 | P1 비용 절감 | `pytest tests/assets/test_duration_budget.py` |
| MPT-040 | 순서 보존 라운드로빈 다운로드 | 검색어별 후보를 1개씩 순환 다운로드해 초반 키워드가 타임라인을 독점하지 않게 한다. | app/services/material.py:386 | P0 씬 동기화 | `pytest test/services/test_material.py -k round_robin` |
| MPT-041 | 로컬 소재 품질 게이트 | 로컬 소재는 허용 디렉터리 내부, 읽기 가능, 최소 480x480을 통과해야 한다. | app/services/video.py:1138 | P0 품질 하드게이트 | `pytest test/services/test_video.py -k preprocess_video` |
| MPT-042 | 손상 이미지 메타데이터 복구 | 이미지 열기 실패 시 EXIF를 제거한 sanitized PNG를 만들어 재시도한다. | app/services/video.py:372 | P2 엣지케이스 | `pytest tests/assets/test_image_sanitize.py` |
| MPT-043 | 이미지 소재 영상화 | 정지 이미지를 duration 있는 클립으로 바꾸고 점진 줌 효과를 적용한다. | app/services/video.py:1194 | P2 이미지 씬 | `pytest tests/render/test_image_clip.py` |
| MPT-044 | 클립 분할과 연결 모드 | 원본 영상을 `max_clip_duration` 단위로 분할하고 sequential 모드에서는 첫 조각만 사용한다. | app/services/video.py:535 | P1 타임라인 구성 | `pytest tests/render/test_clip_segmentation.py` |
| MPT-045 | 같은 원본 반복 최소화 | random 모드에서 원본별 가장 긴 1개를 먼저 배치해 같은 소재 반복감을 줄인다. | app/services/video.py:100 | P1 시청 품질 | `pytest test/services/test_video.py -k prioritize_unique` |
| MPT-046 | 오디오 길이 안전 여유 | ffmpeg 프레임 반올림으로 영상이 음성보다 짧아지는 문제를 막기 위해 0.1초 여유를 둔다. | app/services/video.py:89 | P0 싱크 품질 | `pytest test/services/test_video.py -k safety_margin` |
| MPT-047 | 소재 부족 시 루프 보강 | 처리된 클립 길이가 음성보다 짧으면 기존 클립을 반복해 타임라인을 채운다. | app/services/video.py:698 | P1 완주 보장 | `pytest tests/render/test_clip_loop_fill.py` |
| MPT-048 | 비율 불일치 letterbox | 원본 비율이 다르면 타깃 캔버스에 검은 배경과 중앙 배치로 맞춘다. | app/services/video.py:624 | P1 화면 안정 | `pytest tests/render/test_aspect_fit.py` |
| MPT-049 | 전환 효과 세트 | fade in/out, slide in/out, shuffle 전환을 제공한다. | app/services/video.py:646 | P2 장면 연출 | `pytest tests/render/test_transitions.py` |
| MPT-050 | FFmpeg concat 경로 escaping | concat demuxer list에서 공백, 따옴표, Windows 경로를 안전하게 포맷한다. | app/services/video.py:299 | P1 렌더 안정 | `pytest test/services/test_video.py -k concat_path` |
| MPT-051 | 하드웨어 인코더 fallback | 코덱 화이트리스트, ffmpeg encoder probe, 런타임 실패 시 libx264 재시도를 지원한다. | app/services/video.py:154 | P1 렌더 운영 | `pytest test/services/test_video.py -k codec` |
| MPT-052 | Windows 임시 오디오 회피 | Windows에서는 MoviePy 임시 오디오를 시스템 temp에 써서 파일 잠금 문제를 피한다. | app/services/video.py:245 | P2 플랫폼 안정 | `pytest test/services/test_video.py -k temp_audio_dir` |
| MPT-053 | MoviePy stdout 억제 | 무음 영상 probe 출력이 사용자 로그를 오염시키지 않도록 stdout을 캡처한다. | app/services/video.py:400 | P2 UX 개선 | `pytest test/services/test_video.py -k quietly` |
| MPT-054 | clip 리소스 재귀 해제 | reader, audio, mask, child clip을 닫고 GC를 호출해 파일 핸들 누수를 줄인다. | app/services/video.py:430 | P1 장시간 안정 | `pytest tests/render/test_clip_cleanup.py` |
| MPT-055 | 안전한 BGM 선택 | BGM은 songs 디렉터리 내부 mp3만 허용하고 random 목록이 비면 무음으로 간다. | app/services/video.py:478 | P1 오디오 보안 | `pytest test/services/test_video.py -k bgm_file` |
| MPT-056 | 음성/BGM 믹싱 | 음성 볼륨, BGM 볼륨, BGM 루프, 3초 fade-out을 합성한다. | app/services/video.py:1082 | P1 오디오 품질 | `pytest tests/audio/test_mix_policy.py` |
| MPT-057 | 오디오 fps와 bitrate 고정 | AAC 192k와 입력 오디오 fps 보존으로 환경별 음질 변동을 줄인다. | app/services/video.py:67 | P1 품질 하드게이트 | `pytest tests/render/test_audio_encode_params.py` |
| MPT-058 | 무음 나레이션 모드 | `no-voice` 선택 시 텍스트 길이 기반 duration을 추정하고 silent mp3를 만든다. | app/services/voice.py:259 | P1 무나레이션 지원 | `pytest test/services/test_voice.py -k no_voice` |
| MPT-059 | TTS provider dispatcher | voice_name prefix로 Azure, SiliconFlow, Gemini, MiMo, ElevenLabs, Chatterbox를 라우팅한다. | app/services/voice.py:357 | P1 TTS 확장 | `pytest test/services/test_voice.py -k tts` |
| MPT-060 | 음성 카탈로그 정규화 | provider별 음성 목록을 표시용 성별 suffix와 prefix id 형식으로 통일한다. | app/services/voice.py:59 | P1 음성 선택 | `pytest test/services/test_voice.py -k voices` |
| MPT-061 | Edge TTS 속도 변환 | 배율형 speech rate를 edge_tts가 요구하는 부호 있는 퍼센트로 변환하고 invalid 값을 1.0으로 돌린다. | app/services/voice.py:444 | P1 TTS 안정 | `pytest test/services/test_voice.py -k convert_rate` |
| MPT-062 | Edge TTS 버전 호환/타임아웃 | `boundary` 지원 여부와 sync/async stream을 감지하고 전체 stream timeout을 건다. | app/services/voice.py:564 | P1 외부 안정성 | `pytest test/services/test_voice.py -k edge_tts` |
| MPT-063 | TTS 재시도와 빈 파일 정리 | Azure v1 TTS를 3회 재시도하고 실패한 0바이트 파일을 삭제한다. | app/services/voice.py:721 | P1 장애 회복 | `pytest tests/audio/test_tts_retry_cleanup.py` |
| MPT-064 | Azure v2 워드 경계 | Azure Speech SDK word boundary event를 받아 legacy subtitle offset으로 저장한다. | app/services/voice.py:917 | P1 워드싱크 | `pytest test/services/test_voice.py -k azure_tts_v2` |
| MPT-065 | 비워드싱크 TTS 시간축 보강 | Gemini, MiMo, ElevenLabs, Chatterbox처럼 word timestamp가 없는 provider는 문장 길이 비례로 SubMaker를 채운다. | app/services/voice.py:492 | P1 자막 fallback | `pytest test/services/test_voice.py -k legacy_submaker` |
| MPT-066 | ElevenLabs 즐겨찾기 음성 목록 | ElevenLabs API에서 favorite voice만 가져오고 disabled voice를 제외한다. | app/services/voice.py:142 | P2 TTS 편의 | `pytest test/services/test_voice.py -k elevenlabs_voices` |
| MPT-067 | Self-hosted Chatterbox TTS | OpenAI-compatible `/audio/speech` 서버를 붙여 로컬/자가호스팅 TTS를 쓴다. | app/services/voice.py:1321 | P2 로컬 TTS | `pytest test/services/test_voice.py -k chatterbox` |
| MPT-068 | 자막 provider fallback | Edge 자막 파일이 없으면 Whisper로 fallback하고, 커스텀 오디오는 Whisper만 자막 생성 가능하게 한다. | app/services/task.py:188 | P0 자막 안정 | `pytest test/services/test_task.py -k generate_subtitle` |
| MPT-069 | Whisper 워드 타임스탬프 | faster-whisper를 `word_timestamps`와 VAD로 실행하고 문장부호에서 SRT를 끊는다. | app/services/subtitle.py:21 | P0 워드싱크 기반 | `pytest tests/subtitles/test_whisper_wordsync.py` |
| MPT-070 | 자막-스크립트 교정 | Levenshtein similarity로 Whisper 자막을 스크립트 문장에 맞춰 병합/수정한다. | app/services/subtitle.py:174 | P0 자막 품질 | `pytest test/services/test_subtitle.py -k correct` |
| MPT-071 | SRT 마지막 블록 보존 | trailing blank line이 없어도 마지막 자막 block을 버리지 않는다. | app/services/subtitle.py:145 | P1 SRT 내성 | `pytest test/services/test_subtitle.py -k last_block` |
| MPT-072 | 스크립트 정규화 | 마크다운 구분선과 underscore 강조를 제거해 TTS cue와 스크립트 매칭 실패를 줄인다. | app/utils/utils.py:246 | P1 자막 매칭 | `pytest test/services/test_voice.py -k markdown` |
| MPT-073 | 다국어 문장부호 분리 | 중국어, 영어, 아랍어 문장부호를 처리하고 소수점/천단위 쉼표는 끊지 않는다. | app/models/const.py:1 | P1 한국어도 확장 | `pytest test/services/test_voice.py -k punctuation` |
| MPT-074 | 아랍어 문자형 정규화 | 변음부호와 글자 변형을 제거해 TTS cue와 원문 비교를 보강한다. | app/services/voice.py:1444 | P2 다국어 확장 | `pytest test/services/test_voice.py -k arabic` |
| MPT-075 | Edge cue 문장 집계 | edge_tts 7.x의 단어/짧은 cue를 스크립트 문장 단위 SRT로 합친다. | app/services/voice.py:1529 | P0 한국어 자막 | `pytest test/services/test_voice.py -k edge_cue_aggregation` |
| MPT-076 | Legacy SubMaker 집계 | 기존 `subs/offset` 구조도 같은 문장 매칭 로직으로 SRT를 만든다. | app/services/voice.py:1584 | P1 provider 호환 | `pytest test/services/test_voice.py -k legacy` |
| MPT-077 | SRT 쓰기 검증 | SRT를 쓴 뒤 MoviePy parser로 읽어 duration을 확인하고 실패 시 파일을 삭제한다. | app/services/voice.py:1503 | P0 품질 하드게이트 | `pytest tests/subtitles/test_srt_gate.py` |
| MPT-078 | 자막 줄바꿈 엔진 | PIL로 실제 폰트 폭을 재고 긴 CJK/긴 단어를 문자 단위로 쪼개며 시작 문장부호를 보정한다. | app/services/video.py:746 | P0 한국어 필수 | `pytest test/services/test_video.py -k wrap_text` |
| MPT-079 | 자막 배경 렌더링 | boolean/string 배경색을 정규화하고 RGBA 둥근/사각 배경 클립을 만든다. | app/services/video.py:827 | P1 자막 가독성 | `pytest test/services/test_subtitle_background_settings.py` |
| MPT-080 | 실제 픽셀 기준 중앙정렬 | TextClip의 투명 mask bbox를 읽어 글자의 실제 보이는 영역을 배경 중앙에 둔다. | app/services/video.py:860 | P1 시각 품질 | `pytest test/services/test_subtitle_background_settings.py -k visible` |
| MPT-081 | 자막 위치 클램프 | top, center, bottom, custom을 지원하고 custom y가 화면 밖으로 나가지 않게 제한한다. | app/services/video.py:1064 | P1 편집 노브 | `pytest tests/subtitles/test_position_clamp.py` |
| MPT-082 | 자막 스타일 UI | 폰트, 색, 크기, stroke, 배경, rounded background를 UI와 params에 연결한다. | webui/Main.py:1460 | P1 씬 편집 | `pytest tests/dashboard/test_subtitle_controls.py` |
| MPT-083 | 단계별 API 엔드포인트 | `/videos`, `/subtitle`, `/audio`, `/scripts`, `/terms`, `/social-metadata`를 분리 제공한다. | app/controllers/v1/video.py:115 | P1 부분 실행 | `pytest tests/api/test_stage_endpoints.py` |
| MPT-084 | i18n 로딩 캐시 | UI 언어를 session state로 보존하고 locale JSON 로딩을 캐시한다. | webui/Main.py:141 | P1 한국어 우선 | `pytest test/services/test_webui_i18n.py` |
| MPT-085 | CLI 자동화 인터페이스 | UI 없이 모든 주요 노브와 `stop_at`을 인자로 받아 JSON 결과를 출력한다. | cli.py:82 | P1 CI 재현 | `pytest test/services/test_cli.py` |

## 이 레포에서 배우지 말 것

1. **주석 처리된 인증을 기본으로 두는 API**
   - `router = new_router()`가 인증 의존성 없이 열려 있다. 생성 API는 비용과 파일 I/O가 크므로 우리 프로젝트는 최소 로컬 토큰/세션 가드를 기본값으로 둬야 한다.
   - 근거: app/controllers/v1/video.py:36, app/controllers/v1/llm.py:15

2. **전역 mutable config를 UI 실행 중 직접 변경**
   - Streamlit rerun 흐름에서 `config.app`, `config.ui`를 계속 수정하고 마지막에 저장한다. 결정론 렌더와 품질 게이트에는 프로젝트/씬 매니페스트 스냅샷이 더 안전하다.
   - 근거: webui/Main.py:398, webui/Main.py:1677, webui/Main.py:1786

3. **seed 없는 랜덤성과 imperative MoviePy 파이프라인**
   - 소재 shuffle, random choice, random BGM이 seed/manifest에 기록되지 않는다. hyperframes는 씬 JSON에 RNG seed와 선택 결과를 고정해야 한다.
   - 근거: app/services/video.py:132, app/services/video.py:646, app/services/video.py:664, app/services/material.py:360