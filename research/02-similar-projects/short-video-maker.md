I have everything needed. Here is the structured analysis.

---

# short-video-maker 해부 보고서

버전 1.3.4, MIT. TypeScript 단일 프로세스. 핵심 파이프라인은 `src/short-creator/`에 집중. 아래는 모두 클론 소스 기준 확인된 사실만 정리.

---

## 1. MCP 서버 인터페이스

파일: `src/server/routers/mcp.ts` (SSE transport), `src/server/server.ts:28` (`/mcp` 에 마운트)

- MCP 서버명 `"Short Creator"`, `@modelcontextprotocol/sdk`의 `McpServer` + `SSEServerTransport` 사용. 전송은 SSE 전용: `GET /mcp/sse` (연결), `POST /mcp/messages?sessionId=...` (메시지). transport는 `sessionId`별로 메모리 맵에 보관 (`mcp.ts:13`, `:79`).
- 노출 툴은 **딱 2개**:

**툴 A — `get-video-status`** (`mcp.ts:33`)
- 설명: "Get the status of a video (ready, processing, failed)"
- 입력: `{ videoId: z.string() }`
- 반환: 상태 문자열을 text content로.

**툴 B — `create-short-video`** (`mcp.ts:52`)
- 설명: "Create a short video from a list of scenes"
- 입력 스키마 = `{ scenes: z.array(sceneInput), config: renderConfig }` (둘 다 `src/types/shorts.ts`에서 import)
- 동작: `shortCreator.addToQueue(scenes, config)` 호출 → **즉시 videoId 반환** (비동기 큐, 블로킹 안 함). 에이전트는 이후 `get-video-status`로 폴링.

**씬 배열 스키마 전체** (`shorts.ts:33` `sceneInput`) — 놀랄 만큼 미니멀:
```
sceneInput = {
  text:        string   // 이 씬에서 나레이션(TTS)될 대사
  searchTerms: string[] // Pexels 스톡영상 검색어. 설명에 "1 word,
                        // 씬당 2-3개 제공, 문맥과 매칭되게" 라고 명시
}
```
즉 에이전트는 **비주얼을 직접 만들지 않는다.** 대사와 "검색 키워드"만 주면, 서버가 Pexels에서 배경 스톡 클립을 골라온다. 이것이 이 프로젝트의 핵심 설계 결정.

`config` 스키마는 항목 3 참조. `shorts.ts:145`에 동일 구조의 `createShortInput`(REST 검증용)도 정의됨.

---

## 2. 렌더 스택 & 로컬 의존성

전부 **로컬/오프라인 실행** (Pexels API만 외부 네트워크). `package.json` 및 각 라이브러리 파일 확인:

| 역할 | 구현 | 파일 | 비고 |
|---|---|---|---|
| 렌더러 | **Remotion** (React→비디오, h264) | `src/short-creator/libraries/Remotion.ts` | `@remotion/bundler`로 컴포넌트 번들 → `selectComposition` → `renderMedia`. 헤드리스 크롬(`ensureBrowser`) 사용 |
| TTS | **Kokoro** (`kokoro-js`, ONNX) | `libraries/Kokoro.ts` | 모델 `onnx-community/Kokoro-82M-v1.0-ONNX` (`config.ts:112`). **device: "cpu" 고정** ("node에선 cpu만 지원"). 정밀도 `fp32` 기본, env로 조정 |
| 자막 타임스탬프 | **whisper.cpp** | `libraries/Whisper.ts` | `@remotion/install-whisper-cpp`. 기본 모델 `medium.en` (`config.ts:11`). `tokenLevelTimestamps: true`로 **단어(토큰) 단위 타임스탬프** 추출 → 카라오케식 자막의 근거 |
| 오디오 처리 | **ffmpeg** (`fluent-ffmpeg` + `@ffmpeg-installer/ffmpeg`) | `libraries/FFmpeg.ts` | Whisper용 WAV 정규화(pcm_s16le/mono/16kHz), mp3 변환, data-URI 변환 |
| 배경 영상 | **Pexels API** (스톡 비디오) | `libraries/Pexels.ts` | 유일한 필수 외부 키 `PEXELS_API_KEY` (`config.ts:104`) |
| 배경 음악 | 번들된 30개 로컬 mp3 | `src/short-creator/music.ts` | 파일명·구간·mood를 하드코딩한 정적 목록 |

빌드/배포: Docker 3종 (`main.Dockerfile`, `main-cuda.Dockerfile` GPU용, `main-tiny.Dockerfile` 경량). 데이터 디렉토리 `~/.ai-agents-az-video-generator` (`config.ts:56`).

**렌더 컴포지션** (`components/videos/PortraitVideo.tsx`, 대응 Landscape판):
- 세로 1080×1920 / 가로 1920×1080 (`components/utils.ts:132` `getOrientationConfig`).
- 각 씬 = Remotion `<Sequence>`, 안에 `<OffthreadVideo>`(Pexels 클립, muted) + `<Audio>`(TTS mp3) + BGM `<Audio loop>`.
- 자막: `createCaptionPages`(`utils.ts:37`)로 단어들을 페이지/라인으로 묶음(portrait 기준 `lineMaxLength:20, lineCount:1, maxDistanceMs:1000`). **현재 재생 프레임과 각 단어의 startMs/endMs를 비교해 활성 단어에 하이라이트 배경**을 입힘 (`PortraitVideo.tsx:129`). 폰트 Barlow Condensed, 흰 글씨+검정 스트로크+대문자.

---

## 3. 설정 가능 표면

**전역 렌더 config** (`shorts.ts:86` `renderConfig`, 전부 optional) — 씬 배열과 나란히 1개만 받음. 즉 **씬별 옵션은 없다** (텍스트+검색어만 씬별):

| 필드 | 타입/값 | 기본 | 설명 |
|---|---|---|---|
| `paddingBack` | number(ms) | — | 나레이션 끝난 뒤 영상 지속 시간. 마지막 씬에만 가산 (`ShortCreator.ts:119`) |
| `music` | `MusicMoodEnum` | 랜덤 | 12종 무드: sad/melancholic/happy/euphoric/excited/chill/uneasy/angry/dark/hopeful/contemplative/funny (`shorts.ts:3`) |
| `captionPosition` | top/center/bottom | center | (`PortraitVideo.tsx:40`) |
| `captionBackgroundColor` | CSS 색 문자열 | blue | 활성 단어 하이라이트 색 |
| `voice` | `VoiceEnum` | af_heart | **28종** Kokoro 음성 (af_/am_/bf_/bm_ = 성별·억양) (`shorts.ts:43`) |
| `orientation` | portrait/landscape | portrait | 해상도+컴포넌트 결정 |
| `musicVolume` | muted/low/medium/high | high | 각각 0/0.2/0.45/0.7 (`utils.ts:149`) |

**env 전역 설정** (`config.ts`): `PEXELS_API_KEY`(필수), `PORT`(3123), `WHISPER_MODEL`, `KOKORO_MODEL_PRECISION`, `CONCURRENCY`(도커 메모리 대응), `VIDEO_CACHE_SIZE_IN_BYTES`, `DATA_DIR_PATH`, `LOG_LEVEL`, `DOCKER`, `DEV`.

---

## 4. REST API / 큐 구조

**REST** (`src/server/routers/rest.ts`, `/api` 마운트):
- `POST /api/short-video` — `{scenes, config}` 검증(`server/validator.ts`) 후 큐잉, `201 {videoId}`
- `GET /api/short-video/:id/status` — `{status}`
- `GET /api/short-video/:id` — 완성 mp4 바이너리 스트리밍 (`getVideo`가 파일 통째로 `readFileSync`)
- `GET /api/short-videos` — 전체 목록+상태
- `DELETE /api/short-video/:id`
- `GET /api/music-tags`, `GET /api/voices` — 선택지 열거
- `GET /api/tmp/:file`, `GET /api/music/:file` — **렌더 중간산물 서빙용 내부 엔드포인트** (아래 큐 참조)
- `GET /health`

**큐 구조** (`src/short-creator/ShortCreator.ts:27`) — 매우 단순, 의도적으로 원시적:
- 인메모리 배열 `queue[]`. `addToQueue`가 cuid로 id 생성·push하고, **큐 길이가 1이면 `processQueue()` 시동** (`ShortCreator.ts:62`).
- `processQueue`는 항상 `queue[0]`만 처리 → 끝나면 `shift()` 후 재귀. **동시성 1(직렬), 영속성 없음(재시작 시 소실)**. 소스에 `// todo add mutex lock`, `// todo add a semaphore` 주석으로 한계 자인.
- 상태 판정은 파일시스템 기반: 큐에 있으면 `processing`, 결과 mp4 존재하면 `ready`, 아니면 `failed` (`ShortCreator.ts:43`).

**씬당 렌더 파이프라인** (`createShort`, `ShortCreator.ts:89`) — 씬마다 순차:
1. Kokoro로 `text`→TTS 오디오(+길이) 생성
2. ffmpeg로 WAV 정규화 → whisper.cpp로 단어단위 자막 생성 → ffmpeg로 mp3 저장
3. Pexels에서 `searchTerms`로 `audioLength+3s` 이상인 HD 클립 검색, 이미 쓴 id 제외, tmp에 다운로드
4. 씬 객체(자막/영상URL/오디오URL+duration) 축적. **주목: 영상·오디오를 `http://localhost:PORT/api/tmp/...` URL로 참조** → Remotion 헤드리스 크롬이 자기 서버로 HTTP 요청해 로드 (그래서 `/api/tmp` 엔드포인트 존재)
5. 총 길이로 BGM 랜덤 선택 → `remotion.render()` → 완료 후 tmp 파일 삭제

---

## 5. 훔칠 만한 독창 기능 Top 3

**① "에이전트는 대본+검색어만, 서버가 비주얼을 조달" 계약** (`shorts.ts:33`)
씬 스키마가 `text` + `searchTerms[]` 단 2필드. LLM이 영상 소스를 만들 필요가 없고, "이 문장엔 이런 키워드의 스톡 영상"만 판단하면 됨. 스키마 `describe`에 프롬프트 지시("1 word, 2-3개, 문맥 매칭")를 박아 에이전트를 유도. → 영상 스킬 설계 시, LLM 산출물을 **의미(대사)와 검색의도(키워드)로 최소화**하고 실제 에셋 해결은 툴 쪽으로 넘기는 분리가 핵심 참고점. (단, Pexels 스톡 의존 = 비주얼 통제력 낮음이라는 트레이드오프도 명확.)

**② 던지고-폴링하는 비동기 잡 계약 (2-tool 패턴)** (`mcp.ts:52`, `ShortCreator.ts:54`)
`create-short-video`가 **즉시 videoId 반환** → `get-video-status`로 폴링. 렌더처럼 수십 초~분 걸리는 작업을 MCP 툴 타임아웃 안에서 처리하는 정석. 큐는 인메모리 직렬(동시성1)로 극단적으로 단순하지만 "제출/조회 분리 + 파일존재로 상태판정"이라는 계약 자체는 그대로 이식 가치. (영속 큐·세마포어는 소스 주석대로 미완 — 여기를 개선 포인트로.)

**③ whisper 단어단위 타임스탬프 → 프레임 동기 카라오케 자막** (`Whisper.ts:47` + `utils.ts:37` + `PortraitVideo.tsx:129`)
자기가 만든 TTS 오디오를 **다시 whisper로 받아써서** 단어별 start/end ms를 얻고(원문 텍스트를 알면서도 STT로 타이밍만 추출하는 역발상), `createCaptionPages`로 페이지네이션한 뒤 Remotion에서 현재 프레임과 비교해 활성 단어만 하이라이트. TTS 텍스트 길이를 임의로 못 믿는 상황에서 **정확한 자막 싱크를 얻는 실전 기법**. 영상 스킬에 캡션 싱크가 필요하면 이 "TTS→STT 재정렬" 루프가 바로 훔칠 값.

**보너스 아키텍처 트릭**: 중간산물을 로컬 HTTP URL로 노출해 Remotion 헤드리스 브라우저가 로드하게 한 패턴(`ShortCreator.ts:179` + `/api/tmp`). 파일경로 대신 self-served URL을 쓰는 우회는 브라우저 기반 렌더러(Remotion 계열)에 유용.

**참고 한계(설계 시 피할 점)**: 큐 영속성·동시성·뮤텍스 전부 미구현(소스 todo 자인); TTS·자막·검색어 지시가 `.en` 모델/영어 위주; 비주얼이 Pexels 스톡에 종속.