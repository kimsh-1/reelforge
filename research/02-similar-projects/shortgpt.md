I now have a complete picture. Here is the structured analysis.

---

# ShortGPT 해부 보고서 — "세세하게 설정 가능한 영상 생성 스킬" 참고용

클론 위치: `.../scratchpad/refs/ShortGPT`. 아래 모든 항목은 실제 파일 경로 근거만 기재했다.

## 1. EditingEngine / 편집 추상화 구조 — 선언적 JSON 편집 스키마

핵심 아이디어: **모든 편집 동작을 코드가 아니라 JSON "editing step" 파일로 선언**하고, 파이썬은 이 JSON들을 조립·주입·렌더만 한다. 이게 이 레포에서 가장 훔칠 만한 설계다.

**3계층 구조:**

- **개별 스텝 JSON** — `shortGPT/editing_framework/editing_steps/*.json` (15종). 한 파일 = 한 편집 요소. 공통 스키마:
  - `type`: `video` | `image` | `text` | `audio` (렌더 시 asset 분기 기준, `core_editing_engine.py:47-71`)
  - `z`: z-order 정수. 렌더러가 `z` 기준 정렬 후 `CompositeVideoClip`으로 합성 (`core_editing_engine.py:40-41`). 예: 배경영상 `z:0`, 워터마크 `z:3`, 자막 `z:4`, 이미지 `z:5`, 구독애니 `z:6`, 오디오는 음수(`voiceover z:-1`, `extract_audio z:-2`).
  - `inputs`: 이 스텝을 쓸 때 **런타임에 반드시 채워야 하는 필드** 선언. `parameters`(값 치환) 와 `actions`(동작 파라미터 치환) 두 종류. → 누락 시 `addEditingStep`이 예외 발생 (`editing_engine.py:52-57`).
  - `parameters`: TextClip/Clip 생성 인자 (text, font, font_size, color, stroke, size 등)
  - `actions`: 순차 적용되는 변환 리스트. 각 `{type, param}`.

- **주입 엔진** — `shortGPT/editing_framework/editing_engine.py`. `EditingStep` Enum(`:17-32`)이 스텝명↔JSON파일 매핑. `addEditingStep(step, args)`가 JSON을 로드→`inputs` 검증→`args`를 `parameters`/`actions[].param`에 병합→ `visual_assets`/`audio_assets` 딕셔너리에 `{stepname}_{counter}` 키로 누적(`:48-77`). 같은 스텝을 여러 번 추가 가능(자막 100개 등) — counter로 고유화. 최종 산출물이 `self.schema = {'visual_assets':{}, 'audio_assets':{}}`.

- **렌더러** — `shortGPT/editing_framework/core_editing_engine.py` (`CoreEditingEngine`). schema를 받아 MoviePy로 실행. `generate_video`/`generate_image`/`generate_audio` 3개 출력 모드. action 디스패치는 문자열 매칭 if-체인:
  - 공통: `set_time_start`/`set_time_end`/`subclip` (`:113-126`)
  - 비주얼: `resize`/`crop`/`screen_position`/`green_screen`(크로마키)/`normalize_image`/`auto_resize_image`(종횡비 보존 축소) (`:129-169`)
  - 오디오: `normalize_music`/`loop_background_music`(앞 15% 잘라내고 목표길이 루프)/`volume_percentage` (`:172-191`)

**"Flow" (매크로/템플릿):** `shortGPT/editing_framework/flows/build_reddit_image.json`. 여러 asset을 한 JSON에 미리 배치해둔 "완성 레이아웃". `inputs`가 슬래시 경로(`"visual_assets/username_txt/parameters/text"`)로 깊은 필드를 가리키고, `ingestFlow`(`editing_engine.py:80-90`)가 경로를 역순으로 dict를 만들어 재귀 병합. 리믹스 대상: **좌표 고정 텍스트를 템플릿 이미지 위에 얹는 "합성 카드" 패턴** — 카드뉴스류에 직결.

## 2. ContentEngine 종류 — 지원하는 영상 유형(파사드)

베이스 클래스 `AbstractContentEngine` (`shortGPT/engine/abstract_content_engine.py`): 모든 엔진의 공통 뼈대. 특징:
- **step machine**: `self.stepDict = {1: fn, 2: fn, ...}` 순번 딕셔너리. `makeContent()`가 제너레이터로 한 스텝씩 실행하며 진행률 yield (`:63-75`). 각 스텝 완료마다 `_db_last_completed_step` 저장 → **크래시 후 재개 가능**.
- **`__getattr__`/`__setattr__` 마법** (`:29-46`): `self._db_xxx = y` 하면 자동으로 DB에 persist, 읽으면 DB에서 lazy-load + 캐시. 모든 중간 산출물이 자동 영속화되는 핵심 트릭.

구체 엔진 5종:

| 엔진 | 파일 | 유형 | 스텝 수 |
|---|---|---|---|
| `ContentShortEngine` (베이스) | `engine/content_short_engine.py` | 세로 쇼츠 공통 파이프라인(스크립트→TTS→가속→자막→이미지검색→배경음악/영상→렌더→YT메타) | 12 |
| `FactsShortEngine` | `engine/facts_short_engine.py` | "재미있는 사실" 쇼츠. `_generateScript`만 오버라이드(`facts_gpt.generateFacts`) | 12 |
| `RedditShortEngine` | `engine/reddit_short_engine.py` | Reddit 스토리 쇼츠. 스크립트 생성 + `_prepareCustomAssets`에서 Reddit 카드 이미지 합성 + `_editAndRenderShort`에 Reddit 이미지 스텝 추가 오버라이드 | 12 |
| `ContentVideoEngine` | `engine/content_video_engine.py` | 가로/세로 일반 영상. 이미지 대신 **Pexels 스톡 영상**을 자막 타이밍마다 배경으로 깔음. `isVerticalFormat` 플래그로 가로/세로 분기 | 10 |
| `ContentTranslationEngine` | `engine/content_translation_engine.py` | 기존 영상 **더빙/번역**. 전사→번역→구간별 TTS→원본 위 오디오 삽입→선택적 번역자막 | 5 |

**설계 교훈:** 파사드는 얇다 — 대부분 `_generateScript` 한 메서드만 다르고 나머지는 상속. 유형 추가 = 스텝 딕셔너리 재정의 + 스크립트 소스 교체.

## 3. 설정 가능 표면 — 보이스/자막/에셋 필드

**보이스 (`shortGPT/audio/`):** 추상 `VoiceModule`(`voice_module.py`)에 `generate_voice`/`get_remaining_characters`/`update_usage` 3메서드. 구현 2종:
- `ElevenLabsVoiceModule(api_key, voiceName, checkElevenCredits)` — 크레딧 사전 검사(45초=1200자 최소) (`eleven_voice_module.py:12-13`)
- `EdgeTTSVoiceModule(voiceName)` — 무료, 무제한 크레딧 리턴 (`edge_voice_module.py`)
- 설정 표면: **voiceName 하나로 목소리 선택**, 언어는 별도 `Language` Enum(약 80개 언어, `config/languages.py:4+`)으로 스크립트를 GPT 번역 후 TTS.

**자막 (설정 필드는 make_caption*.json의 `parameters`):**
- `font_size`(기본 100), `font`(`fonts/LuckiestGuy-Regular.ttf`), `color`(white), `stroke_width`(3), `stroke_color`(black), `method`("caption"=자동 줄바꿈), `size`([900,450] 박스), `screen_position`(center 등).
- 4종 프리셋 파일: 쇼츠/가로 × 일반/아랍어(RTL). 엔진이 `_db_language`·`_db_format_vertical` 따라 프리셋 선택 (`content_video_engine.py:130-133`).
- 자막 타이밍 로직: `editing_utils/captions.py` — Whisper word-level 타임스탬프를 `maxCaptionSize`(쇼츠 15자, 가로 30자, `content_video_engine.py:71-74`)로 청킹, 구두점 고려 분할.

**에셋/렌더 설정 (엔진 생성자 인자):** `background_video_name`, `background_music_name`(에셋 DB 이름 참조), `num_images`(이미지 삽입 개수), `watermark`(텍스트), `language`, `isVerticalFormat`. 배경음악 볼륨은 코드에 하드코딩(0.08~0.11, `content_short_engine.py:130`).

## 4. 에셋 소싱과 DB — 에셋 관리 방식

**에셋 DB (`shortGPT/config/asset_db.py`):** 이름(문자열) → 에셋 딕셔너리 매핑. 로컬/원격 2개 컬렉션.
- `AssetType` Enum: video/audio/image/background music/background video/other (`:19-25`)
- **로컬 에셋**: `public/` 폴더를 rglob 스캔해 확장자로 타입 자동판별 후 DB 등록(`sync_local_assets`, `_add_local_asset_from_path` `:108-195`).
- **원격 에셋**: 주로 YouTube URL. `get_asset_link` 호출 시 yt-dlp로 실제 스트림 URL 해석, 만료(`expire=` 파라미터) 체크 후 캐시, 오디오는 로컬 다운로드(`_get_youtube_asset_link` `:311-341`). URL은 base64로 인코딩해 저장.
- 시드 데이터: `.database/template_asset_db.json` — 배경음악 2곡, 게임플레이 배경영상 3종(Minecraft/Car/Ski), Reddit 템플릿 PNG, 구독 애니. 최초 실행 시 `asset_db.json`으로 복사.

**동적 소싱 (실행 중 외부 API):**
- 배경 **스톡 영상**: `api_utils/pexels_api.py` — GPT가 만든 검색어로 Pexels 검색, 정확히 1920×1080 또는 1080×1920, 15초 근접 순 정렬로 최적 클립 선택(`getBestVideo`), 중복 URL 회피.
- 삽입 **이미지**: `editing_utils/editing_images.py` → `api_utils/image_api.py`의 Bing 이미지 검색. 목표 해상도(720×720)에 가장 가까운 것 선택.
- 배경 영상 랜덤 구간 추출: `editing_utils/handle_videos.py:extract_random_clip_from_video`.

**DB 엔진 (`shortGPT/database/`):** TinyDB 기반 `tinymongo`로 MongoDB-like 인터페이스, 저장은 JSON 파일(`./.database`). `TinyMongoDocument`(`db_document.py`)가 점표기 경로(`a.b.c`) 중첩 저장/조회 지원, thread-lock. 콘텐츠별 진행상태는 `ContentDataManager`(`content_data_manager.py`)가 `content_type`/`ready_to_upload`/`last_completed_step`로 관리.

## 5. 훔칠 만한 독창 기능 Top 5

1. **선언적 JSON 편집 스텝 + z-order 합성** (`editing_framework/editing_steps/*.json` + `core_editing_engine.py`). 편집 프리미티브를 코드에서 완전 분리. 스킬 설계에 직수입 가치 최상 — 새 편집 요소 = 코드 수정 없이 JSON 추가. `inputs` 블록이 "런타임 필수 필드"를 스키마 자체에 선언해 검증까지 데이터로 처리.

2. **Flow = 좌표고정 합성 템플릿** (`flows/build_reddit_image.json` + `ingestFlow`). 템플릿 이미지 위 여러 텍스트를 절대좌표로 얹어 카드 이미지를 렌더. 슬래시 경로로 깊은 필드에 값 주입하는 `ingestFlow` 병합이 영리하다. **카드뉴스/썸네일 합성 스킬에 그대로 이식 가능.**

3. **재개 가능한 step-machine + 자동 영속화** (`abstract_content_engine.py`의 `stepDict` + `__getattr__/__setattr__` DB 프록시 + `last_completed_step`). `self._db_x = y` 대입만으로 모든 중간 산출물이 저장되고, 크래시/중단 후 정확히 멈춘 스텝부터 재개. 긴 영상 파이프라인의 안정성 패턴.

4. **얇은 파사드 상속 구조** (`FactsShortEngine`가 `_generateScript` 1개만 오버라이드, `RedditShortEngine`이 3개 오버라이드). 영상 "유형"을 최소 변경으로 확장하는 템플릿 메서드 패턴. "세세하게 설정 가능"의 골격.

5. **콘텐츠 인지형 에셋 소싱 파이프라인** — GPT가 자막 타이밍별 검색어 생성 → Pexels/Bing에서 **해상도·종횡비·길이 제약으로 필터링**해 자동 매칭(`pexels_api.py:getBestVideo`, `editing_images.py`), 배경음악은 앞 15% 스킵 후 목표길이 루프(`core_editing_engine.py:180-185`). 자막 타이밍에 비주얼을 동기화하는 "시간축 기반 에셋 배치" 발상이 핵심.

**주의(추측 아닌 관찰된 한계):** 렌더러 action 디스패치가 문자열 if-체인이라 확장 시 코드 수정 필요(진짜 플러그인 아님); 배경음악 볼륨·구독애니 타이밍(3.5초) 등 일부 값은 JSON이 아니라 파이썬에 하드코딩; `core_editing_engine.py`의 `normalize_music` action은 오디오 JSON에서 `normalize_audio`로 오타 나 있어 매칭 안 됨(`background_music.json:17` vs `core:176`).