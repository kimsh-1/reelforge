I now have complete coverage of this small project. Here is the analysis.

---

# story-flicks 해부 보고 — "영상 생성 스킬" 설계 참고

전체 규모: 백엔드 FastAPI(파일 ~20개) + 프론트 React/Vite(파일 ~15개). 실제 파이프라인 로직은 사실상 3개 파일에 집중 (`services/llm.py`, `services/video.py`, `services/voice.py`).

## 1. 파이프라인 구조와 산출물 스키마

단일 동기 요청-응답 파이프라인이다. 큐/작업상태 폴링이 없다 — `POST /video/generate`가 전체를 블로킹으로 돌리고 완성 URL을 반환한다 (`backend/app/api/video.py:11-24`).

흐름 (`backend/app/services/video.py:212-274`, `llm.py:161-185`):
1. **스토리 생성** — LLM 1콜로 전체 세그먼트를 한 번에 생성. 각 세그먼트 = `{text, image_prompt}`. `text`는 사용자 선택 언어, `image_prompt`는 항상 영어 강제 (`llm.py:311`).
2. **이미지 생성** — 세그먼트별 루프, `image_prompt`로 이미지 API 호출 → `url` 필드 채움 (`llm.py:177-184`).
3. **다운로드 + 영속화** — 각 URL을 `{i}.png`로 저장, 전체 요청+scenes를 `story.json`으로 저장 (`video.py:258-271`).
4. **TTS + 자막** — 세그먼트별 `generate_voice()`가 edge-tts로 `{i}.mp3` + `{i}.srt` 생성 (word-boundary 타임스탬프 기반) (`voice.py:1089-1146`).
5. **합성** — MoviePy로 세그먼트별 클립(이미지+오디오+자막) 만들고 `concatenate_videoclips`로 이어붙여 `video.mp4` 출력 (`video.py:85-209`).

산출물 스키마:
- `StoryScene`: `text`, `image_prompt`, `url` (`backend/app/schemas/video.py:291-295`)
- 작업 디렉토리 산출물: `story.json`(전체 상태), `{i}.png`, `{i}.mp3`, `{i}.srt`, `video.mp4`. task_id = `str(int(time.time()))` (`video.py:254`).
- LLM 계약: 루트 객체에 `list` 키, 원소는 `{text, image_prompt}` (`llm.py:288-327`). `_validate_story_response`로 형식 검증 (`llm.py:205-231`).

주목할 점: task_id 타임스탬프 기반이라 동시 요청 충돌 가능. story.json이 재실행/재현의 단일 소스.

## 2. 설정 가능 표면 (프론트에서 고를 수 있는 옵션 전부)

`frontend/src/components/StoryFrom/index.tsx:93-192` + `backend/app/schemas/video.py:297-311` 기준:

| 옵션 | 타입 | 근거 |
|---|---|---|
| text_llm_provider | Select (동적, API 응답) | StoryForm:93-106 |
| image_llm_provider | Select (동적) | StoryForm:107-120 |
| text_llm_model | 자유 입력 텍스트 | StoryForm:121-127 |
| image_llm_model | 자유 입력 텍스트 | StoryForm:128-134 |
| resolution | 자유 입력 텍스트 (기본 `1024*1024`) | StoryForm:135-141 |
| language | Select (5종: zh-CN/zh-TW/en-US/ja-JP/ko-KR) | constants/index.ts:9-30 |
| voice_name | Select (언어 선택 시 필터링되어 채워짐) | StoryForm:142-173 |
| story_prompt | TextArea | StoryForm:174-180 |
| segments | number 1-10 | StoryForm:181-187 |

중요한 한계:
- **`image_style`(realistic/cartoon/watercolor/oil_painting)와 StoryType enum이 백엔드에 정의만 되어 있고 프론트/프롬프트에 미연결.** `const.py:12-17`에 존재하지만 StoryForm에 해당 필드 없음, 그리고 `_get_story_prompt`(llm.py:273-327)가 image_style을 프롬프트에 반영하지 않음 → 사실상 죽은 옵션.
- `voice_rate`도 스키마엔 있으나(기본 1.0) 프론트 폼에 입력 없음.
- 프로바이더/모델을 프론트에서 자유 텍스트로 입력받는 구조 → 유연하지만 검증 없음.
- 프로바이더 목록은 백엔드가 설정된 API 키 유무로 동적 반환 (`llm.py:187-203`).

voice_name 필터링: 언어 선택 → `getSelectVoiceList`로 해당 locale voice만 필터 → 첫 항목 자동 선택 (StoryForm:147-152). 전체 voice 카탈로그는 edge-tts 하드코딩 문자열 (`voice.py:78-1044`), locale 5종으로 필터 (`voice.py:77`).

## 3. 프론트엔드 구조 — 편집/재생성 기능

**편집·재생성 기능 없음.** 구조가 극단적으로 단순:
- `App.tsx` = StoryForm + VideoResult 조합 + 언어 셀렉터.
- 상태관리: zustand 스토어에 `videoUrl` 단 하나 (`frontend/src/stores/index.ts`, StoryForm에서 `setVideoUrl`).
- 제출 시 `message.loading(..., 0)`로 무한 로딩 토스트, 완료되면 videoUrl 세팅 (StoryForm:52-69). 진행률/스트리밍 없음.
- `VideoResult`: 단순 `<video controls>` 플레이어. 재생만, 세그먼트 편집·재생성·다운로드 버튼 없음 (`VideoResult/index.tsx` 전체 19줄).
- i18n은 있음 (react-i18next, en/zh locale) — 편집 기능과 무관.

즉 "원클릭 생성 후 재생"이 전부. 세그먼트 텍스트 수정, 이미지 재롤, 개별 씬 재생성 같은 편집 루프는 **UI에 전혀 없다.** 다만 백엔드에 `test_mode`가 있어 저장된 `story.json`으로 이미지/오디오 재사용해 영상만 재합성 가능 (`video.py:220-236`) — 개발자용 재실행 훅이지 사용자 편집 기능은 아님.

## 4. 이미지 프로바이더 추상화 방식

**추상화라 부르기 애매한 if/elif 분기.** 단일 메서드 `generate_image()` 안에서 provider 문자열로 하드 분기 (`backend/app/services/llm.py:92-159`):
- `aliyun` → dashscope `ImageSynthesis.call` (SDK), 반환 `result.url`
- `openai` → `openai_client.images.generate` (DALL-E), `quality="standard"`, size에 `*`→`x` 변환
- `siliconflow` → raw `requests.post`, payload에 `seed`(랜덤), `guidance_scale=7.5`, `batch_size=1`, `image_size`

공통 계약: 입력 `prompt/resolution/model`, 출력 = **이미지 URL 문자열** (파일 아님). 실패 시 빈 문자열 반환 후 상위에서 url=None 처리 (`llm.py:157-159`, 179-184).

텍스트 LLM은 별도로 `_generate_response`에서 유사 분기 (openai/aliyun/deepseek/ollama/siliconflow, 전부 OpenAI SDK 호환 클라이언트로 통일) (`llm.py:233-264`). 클라이언트는 모듈 로드 시 API 키 유무로 조건부 초기화 (`llm.py:23-35`).

관찰:
- 인터페이스/베이스클래스/레지스트리 없음. 새 프로바이더 추가 = elif 한 줄 추가 + 클라이언트 초기화 + `get_llm_providers` 리스트 편집, 3곳 수정 필요.
- `normalize_keys`(llm.py:68-90)로 프로바이더 간 JSON 응답 키 불일치를 사후 보정 — 프로바이더 다양성의 대가.
- openai 경로엔 안전 프롬프트 프리픽스(`safe_prompt`) 붙지만 aliyun 경로는 원본 prompt 사용 (일관성 없음, `llm.py:110-115`).

## 5. 훔칠 만한 독창 기능 Top 3

1. **word-boundary TTS → SRT → 영상 길이 역산 (자막이 타이밍의 진실 소스).** edge-tts 스트림의 `WordBoundary` 이벤트로 단어별 타임스탬프를 받아 SRT 생성 (`voice.py:1118-1146`), 그 SRT의 최대 종료시각을 씬 길이로 삼아 이미지 클립 duration을 맞춘다 (`video.py:120-130`). "오디오 길이에 영상을 맞춘다"는 원칙이 깔끔. 게다가 문장부호로 스크립트를 분할(`split_string_by_punctuations`, voice.py:35-73)한 뒤 TTS 단어들을 다시 매칭(`match_line`, voice.py:1215-1233)해 "부호 단위 자막 줄"을 만든다 — 다국어(CJK 포함) 자막 세그멘테이션 로직을 그대로 참고할 만함.

2. **정지 이미지에 켄번즈(느린 팬) 모션 부여로 "숏비디오" 느낌.** 이미지를 1.2배 확대(`image_scale=1.2`)한 뒤 시간에 따라 x좌표를 선형 이동시키는 `debug_position(t)` 클로저로 패닝 효과 (`video.py:125-136`). 소스가 정지 이미지뿐인데도 동적으로 보이게 하는 최소비용 트릭. 확대 배율/이동 방향만 파라미터화하면 바로 재사용 가능.

3. **`story.json` = 재현·부분재실행 계약 파일 + `test_mode` 재합성 훅.** 요청 파라미터와 생성된 전 씬을 한 파일에 영속화하고 (`video.py:252-271`), `test_mode`로 기존 png/mp3/srt를 재사용해 합성만 다시 돌린다 (`video.py:104-107`, 220-236). 비싼 단계(LLM·이미지 생성)를 건너뛰고 합성만 반복하는 개발/디버그 루프 — 스킬의 "중간 산출물 계약 + 재실행" 패턴과 정확히 같은 발상. 다만 여기선 사용자 편집 UI로 승격되진 않았으니, 이 계약 파일을 편집 가능하게 노출하는 것이 story-flicks가 놓친 확장 지점이자 우리가 가져갈 개선 여지.

---
### 설계 시 유의 (확인된 약점)
- 동기 블로킹 1콜 파이프라인 → 긴 작업에 진행률/취소 없음, task_id 타임스탬프 충돌 가능 (`video.py:254`, `api/video.py`).
- 스토리 전체를 LLM 1콜로 생성 → 세그먼트별 재생성 불가 구조 (`llm.py:44-67`).
- image_style·voice_rate 등 스키마엔 있으나 미배선된 "유령 옵션" 존재 (`const.py:12-17` vs StoryForm).
- 프로바이더 추상화가 if/elif 3중복 → 확장 비용 있음.
- 반환 URL이 `http://127.0.0.1:8000`로 하드코딩 (`api/video.py:20`).