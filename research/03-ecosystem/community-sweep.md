# 커뮤니티 스윕 — 미커버 AI 영상 자동생성 오픈소스·논의 발굴

- 조사일: 2026-07-07
- 방법: `gh search repos`/`gh api`(GitHub 검색·topic·README), HN Algolia API, WebSearch(레딧·블로그), 상위 3개 얕은 클론 해부
- 제외(기분석 완료): auto_kairos, MoneyPrinterTurbo, ShortGPT, NarratoAI, story-flicks, short-video-maker, claude-code-video-toolkit, OpenMontage, ArcReel, revideo, fontagent
- 한계 고지: 레딧 직접 접근은 JSON API·Jina 모두 403 차단. 레딧발 교훈은 WebSearch 결과에 인용된 것만 채록했고, 스레드 원문 URL은 확보 실패. 그 외 항목은 전부 직접 확인(★수는 `gh repo view` 실측, 2026-07-07 기준).

---

## ① 발굴 프로젝트 목록

### A. 대형 — 배틀테스트된 파이프라인 (1k★+)

| 프로젝트 | ★ | 한 줄 | 차별점 | 최근 push |
|---|---|---|---|---|
| [FujiwaraChoki/MoneyPrinter](https://github.com/FujiwaraChoki/MoneyPrinter) | 13,712 | MoviePy 기반 유튜브 쇼츠 자동화 — MoneyPrinterTurbo의 원조 | Turbo와 별개 리포. 사실상 레거시(마지막 push 2026-03), 역사적 참조용 | 2026-03 |
| [elebumm/RedditVideoMakerBot](https://github.com/elebumm/RedditVideoMakerBot) | 12,509 | 레딧 스레드 → 스크린샷+TTS+게임플레이 배경 영상, 원커맨드 | "레딧 낭독+Subway Surfers" 장르의 표준 구현체. 코멘트 스크린샷 오버레이 방식이 고유 | 2026-06 |
| [modelscope/FunClip](https://github.com/modelscope/FunClip) | 5,892 | FunASR 전사 + LLM 보조 클리핑, 로컬 Gradio UI | 알리바바 modelscope 공식. ASR 정확도(중국어 강함)와 "전사 텍스트를 선택해서 자르는" UI 패턴 | 2026-06 |
| [SamurAIGPT/AI-Youtube-Shorts-Generator](https://github.com/SamurAIGPT/AI-Youtube-Shorts-Generator) | 4,134 | 롱폼 → 바이럴 9:16 쇼츠 (Opus Clip/Klap 오픈소스 대안 자처) | Whisper+GPT 하이라이트 검출+화자 리프레임. 클리핑 세그먼트 최다 스타 | 2026-06 |
| [video-db/Director](https://github.com/video-db/Director) | 1,431 | VideoDB의 "AI 비디오 에이전트" 프레임워크 | 에이전트 27종 플러그인 구조 + 채팅 UI. 아래 ② 해부 | 2026-01 |
| [HKUDS/VideoAgent](https://github.com/HKUDS/VideoAgent) | 1,259 | 비디오 이해·편집·리메이크 올인원 에이전틱 프레임워크 | intents.yml 선언형 워크플로 그래프. 아래 ② 해부 | 2026-07 |

### B. 중형 — 최근 6개월 활발한 신흥 (100★~1k★)

| 프로젝트 | ★ | 한 줄 | 차별점 | 최근 push |
|---|---|---|---|---|
| [FujiwaraChoki/supoclip](https://github.com/FujiwaraChoki/supoclip) | 888 | "F*** OpusClip" — 셀프호스트 클리핑 | 워터마크·처리분 과금·락인에 대한 반발을 정체성으로 내건 리포. README가 상용툴 불만의 요약본 | 2026-07 |
| [univa-agent/univa](https://github.com/univa-agent/univa) | 516 | UniVA: Universal Video Agents (논문 공식 구현) | 학술 계열 범용 비디오 에이전트 | 2026-05 |
| [SamurAIGPT/AI-Faceless-Video-Generator](https://github.com/SamurAIGPT/AI-Faceless-Video-Generator) | 460 | 스크립트+음성+talking face 전부 AI 생성 | faceless인데 아바타 얼굴을 생성하는 변종 | 2026-02 |
| [heygen-com/skills](https://github.com/heygen-com/skills) | 336 | HeyGen v3 Video Agent 파이프라인용 AI 에이전트 스킬 | 상용 벤더가 "Claude 스킬 포맷"으로 배포 — 우리 스킬 설계와 직접 비교 대상 | 2026-05 |
| [cclank/lanshu-awesome-ai-video-kit](https://github.com/cclank/lanshu-awesome-ai-video-kit) | 299 | 실측 프롬프트 543개·모델 15종·Claude Skill 7개·SOP 21편 | awesome 리스트 중 유일하게 "출처 필드 강제 + GitHub Action 주간 모델 엔드포인트 자동 점검" 운영 | 2026-05+ |
| [2417467487-hub/Trend2Video-Pro](https://github.com/2417467487-hub/Trend2Video-Pro) | 212 | 트렌드/URL → 발행 패키지(MP4+제목+썸네일+해시태그+자막+**품질 리포트**) | 출력을 "영상"이 아니라 "발행 패키지"로 정의. SQLite 트렌드 메모리, Streamlit 콘솔 | 2026-06 |
| [prajwal-y/video_explainer](https://github.com/prajwal-y/video_explainer) | 196 | 기술문서 → 해설영상, ClaudeCode로 3일 만에 제작 ([Show HN](https://news.ycombinator.com/item?id=46457050)) | Remotion+Claude 씬 컴포넌트 생성+4단계 시각 정련+팩트체크 게이트. "TTS를 스토리보드보다 먼저" 아키텍처 | 2026-02 |
| [OpenDemon/Pilipili-AutoVideo](https://github.com/OpenDemon/Pilipili-AutoVideo) | 188 | 한 문장 → 자막 완성본, 로컬 배포 풀오토 에이전트 | Kling/Seedance 생성영상 + 剪映(CapCut) 초안 내보내기 루프. 아래 ② 해부 | 2026-03 |

### C. 소형 — 패턴 관찰용 (관찰 가치 있는 것만)

| 프로젝트 | ★ | 한 줄 | 관찰 포인트 |
|---|---|---|---|
| [Dark2C/Viral-Faceless-Shorts-Generator](https://github.com/Dark2C/Viral-Faceless-Shorts-Generator) | 83 | 트렌딩 토픽 → AI 스크립트+TTS+FFmpeg 쇼츠 | 트렌드 스크레이핑을 입력으로 쓰는 전형 |
| [Anil-matcha/ai-clipping-comfyui](https://github.com/Anil-matcha/ai-clipping-comfyui) | 32 | ComfyUI 노드로 만든 Opus Clip 대안 | 클리핑을 ComfyUI 노드그래프로 표현하는 접근 |
| [xixihhhh/hotclip](https://github.com/xixihhhh/hotclip) | 7 | 라이브 리플레이 → 화자분리+버티컬 재구성 쇼츠 | 라이브 커머스/스트리밍 리플레이 특화 니치 |
| [GitHub topic: opus-clip-alternative](https://github.com/topics/opus-clip-alternative) | — | 2026 상반기에 신생 리포 10여 개 집중 생성 | "셀프호스트 클리핑" 세그먼트가 지금 가장 붐비는 골드러시 지대라는 신호 |

기타: `gh search`에서 "youtube automation AI", "text to video pipeline" 계열은 0~10★ 리포가 수백 개 — 아이디어는 완전 커모디티화됐고, 차별화는 스키마·품질게이트·편집루프에서만 남아 있음이 확인됨.

---

## ② 상위 3개 간단 해부

클론 위치: `/tmp/claude-1000/.../scratchpad/refs/{Director,VideoAgent,Pilipili-AutoVideo}` (--depth 1)

### 1. OpenDemon/Pilipili-AutoVideo — "AI 90% + 인간 10%" 루프의 교과서

**씬 스키마** (`modules/llm.py`의 `Scene` dataclass):
```python
scene_id, duration(TTS 시간으로 동적 결정), image_prompt(생성이미지용 영문),
video_prompt(Kling/Seedance 모션용 영문 — 이미지와 분리!), voiceover(중문 나레이션),
transition(crossfade/fade/wipe/cut), camera_motion(static/pan/zoom),
shot_mode(LLM 자동 태깅), character_refs(멀티 주체 참조이미지 리스트),
speaker_id(TTS 음색 배분), characters_in_scene
```
- `image_prompt`와 `video_prompt`를 분리한 것이 핵심 — "정지 프레임 생성"과 "모션 지시"를 다른 모델에 보냄. `__post_init__`에서 LLM이 null을 뱉어도 안 죽게 방어(실전 운영 흔적).
- **설정 표면** (`configs/config.example.yaml`): llm(6개 프로바이더 스왑) / image_gen(Nano Banana) / video_gen(Kling 3.0·Seedance 1.5) / tts(MiniMax·Seedance 원생오디오) / local(ffmpeg·whisperx) / jianying / memory(Mem0) — 레이어별 프로바이더 교체가 설정 한 줄. 모든 duration은 "TTS 시간이 정답"으로 역산.
- **편집 UI**: 자체 UI는 사실상 스텁(frontend에 .env.example뿐). 대신 `modules/jianying_draft.py`가 **분镜별 독립 트랙(영상/음성/자막 분리)으로 CapCut(剪映) 초안 프로젝트를 생성** — "단일 씬만 교체하고 전체 재실행 없이 마무리"를 CapCut에 위임. 편집 UI를 만들지 않고 기존 편집기의 프로젝트 포맷을 타깃하는 전략은 우리 기획에 그대로 이식 가능한 아이디어.
- 조립(`modules/assembler.py`): TTS 길이로 각 클립 정밀 트림 → xfade 전환(오버랩 오프셋 보정) → SRT 번인 → Windows 호환 H.264 인자 하드코딩.

### 2. video-db/Director — 에이전트 프레임워크 + 채팅 UI 원형

- `backend/director/agents/`에 27개 에이전트 파일: `text_to_movie, prompt_clip, subtitle, dubbing, clone_voice, editing/(code_executor 포함), frame, upload, censor, pricing…` — 기능 1개=에이전트 1개, JSON-Schema로 파라미터 선언(`TEXT_TO_MOVIE_AGENT_PARAMETERS`)해서 LLM 함수호출에 그대로 노출.
- 엔진 추상화: `SUPPORTED_ENGINES = ["stabilityai", "kling", "videodb"]`, 오디오는 `["elevenlabs", "videodb"]` — 각 툴이 `PARAMS_CONFIG`를 자기 모듈에서 export하는 패턴.
- **편집 UI 없음**: 프론트는 Vue 뷰 1개(`DefaultView.vue`)가 `@videodb/chat-vue` 채팅 컴포넌트를 얹은 게 전부. 타임라인·씬 편집 전부 대화로. VideoDB 클라우드 종속이 강함(로컬 파일 파이프라인은 아님).

### 3. HKUDS/VideoAgent — 선언형 인텐트→역할 체인

- `environment/roles/`에 원자 역할(오디오 추출/보컬 분리/라우드니스 정규화/전사/TTS/SVC/믹서/머지 + vid_news·vid_summ·vid_qa·stand_up·cross_talk 장르 모듈).
- `environment/config/intents.yml`이 인텐트를 역할 체인으로 선언 매핑 — 예: `Text-to-Speech: [AudioExtractor, TTSSlicer, Transcriber, TTSWriter, TTSInfer, TTSReplace, …]`. `graph.txt` 기반 그래프 워크플로 생성 + 적응 피드백 루프.
- 로컬 무거운 툴 번들(`tools/`: CosyVoice, fish-speech, seed-vc, DiffSinger, ImageBind, videorag) — 셀프호스트 지향이지만 설치 비용이 매우 큼. "이해(RAG)·편집·리메이크"를 한 프레임워크로 묶은 유일한 리포.

**video_explainer(196★) 보너스 인사이트** (README 실측): 파이프라인이 `Document→Script→TTS→Storyboard→Animation` 순서 — **TTS를 스토리보드보다 먼저 돌려 word-level timestamp를 비주얼 싱크의 단일 기준으로 삼는다**고 명시. 씬은 Remotion 컴포넌트(*.tsx)로 Claude가 생성, 4단계 시각 정련 + 소스 대조 팩트체크 게이트 내장. 우리 접근(claude-code 기반)과 가장 유사한 사고방식.

---

## ③ 커뮤니티 실전 교훈·불만 — 우리 기능 기획에 직결

### HN에서 (직접 확인)

1. **툴 파편화가 1번 불만** — [Show HN: Magiclip 스레드(41p/22c)](https://news.ycombinator.com/item?id=46086920): "Modern video editing requires 8+ different tools… Subtitles here. Audio cleanup there. Silence removal elsewhere." → 올인원·단일 워크플로 자체가 셀링 포인트.
2. **생성 단가 공포** — 같은 스레드: "A single veo3 video costs about $3 to make. Down from about $6." 크레딧 이코노미가 서비스 생존을 좌우. 무료 체험은 "시간 기반이 아니라 크레딧 기반으로 하라"(가짜 계정 폭탄 방지) 조언까지.
3. **"AI slop assembly line" 반발 정서** — 같은 스레드에서 "Create a viral Reel in just 2 clicks" 카피가 즉시 조롱당함. 품질 게이트·팩트체크를 전면에 내세우는 포지셔닝이 방어막.
4. HN에서 오픈소스 '파이프라인' Show HN은 의외로 희소 — faceless/쇼츠 관련은 대부분 SaaS 홍보 포스트(수 점대)이고, 오픈소스는 [video_explainer(ClaudeCode 3일 빌드)](https://news.ycombinator.com/item?id=46457050) 정도. **"오픈소스 + 에이전트 네이티브" 슬롯이 HN에서 비어 있음.**

### 자동화 실전기에서 (직접 확인)

5. **"Automation solves production. It doesn't solve distribution."** — [dev.to: 29편/$0 자동화 실험](https://dev.to/maxxmini/i-automated-a-youtube-channel-with-ai-29-videos-0-budget-heres-what-happened-1ef8): 매일 업로드가 스팸 패턴으로 찍혀 8일차 이후 15편이 일 조회 0~1. 툴이 해결할 문제와 아닌 문제의 경계.
6. **자막 드리프트는 반드시 터진다** — 같은 글: 무음 압축 후 자막이 최대 7초 밀림 → 로컬 Whisper word-timestamp로 재정렬 스크립트를 따로 만들어야 했음. video_explainer의 "TTS-first, timestamp가 진실의 원천" 설계와 정확히 같은 결론.

### 레딧발 (WebSearch 경유 인용 — 스레드 원문 URL 미확보, 간접 출처만)

7. **설치 복잡이 최다 이탈 사유** — MoneyPrinterTurbo류 GitHub 이슈·레딧 공통 상위 3개: Python 버전 불일치, ffmpeg 경로, CUDA 라이브러리 누락 ([verdent 가이드](https://www.verdent.ai/guides/moneyprinterturbo-github), [aifruit](https://aifruit.app/blog/moneyprinterturbo-alternative)).
8. **"You can't automate something you don't understand"** — 페이스리스 채널 커뮤니티의 반복 정서: 완전자동 판매 코스에 대한 불신, 툴은 "standalone automation engine이 아니라 efficiency multiplier"로 기대치 재조정 ([Medium 요약](https://medium.com/@smdsule85/the-3-best-faceless-youtube-channels-courses-2a7b7cf2f4e5) 및 WebSearch 인용).
9. **상용 클리핑툴 과금 불만이 오픈소스 붐을 만드는 중** — Opus Clip 처리분 과금·구독 해지 시 프로젝트 만료·환불 버튼 은닉 등 ([ngram 비교](https://www.ngram.com/blog/opus-clip-alternatives-tested)); supoclip README가 이 불만(워터마크/분 제한/락인)을 조목조목 명문화. GitHub `opus-clip-alternative` topic에 2026 상반기 신생 리포가 집중 생성된 것과 일치.

### 기능 기획으로의 번역

| 커뮤니티 불만 | 우리 기능 함의 |
|---|---|
| 8개 툴 전전 | 자막·무음제거·BGM·클리핑을 한 스킬 체인에 |
| 설치 지옥(CUDA/ffmpeg) | 의존성 프리플라이트 닥터 + 클라우드/로컬 폴백 |
| 자막 드리프트 | word-timestamp를 파이프라인의 1급 계약물로 (TTS-first) |
| 씬 하나 고치려고 전체 재실행 | 씬 단위 계약 파일 + 외부 편집기(CapCut 초안류) 내보내기 |
| AI slop 낙인 | 품질 리포트·팩트체크 게이트를 출력물에 동봉 (Trend2Video의 "발행 패키지" 개념) |
| 생성 단가 | 씬별 shot_mode로 "생성영상 vs 정지이미지+모션" 비용 라우팅 (Pilipili 패턴) |

---

## ④ 결론

발굴된 생태계는 3계열로 정리된다. **(a) 에이전트 프레임워크형**(Director·HKUDS VideoAgent·univa·HeyGen skills) — 대화/인텐트로 조작, 편집 UI 없음, 선언형 워크플로가 공통 패턴. **(b) 완전자동 생성 파이프라인형**(Pilipili·Trend2Video·video_explainer) — 씬 스키마 + 프로바이더 스왑 설정 + 품질 게이트가 성숙도 지표. **(c) 클리핑형**(FunClip·AI-Youtube-Shorts-Generator·supoclip·hotclip) — 상용툴 과금 반발로 지금 가장 리포가 쏟아지는 골드러시 지대(단, 우리 주제와는 결이 다름).

우리 기획에 가장 값진 수확 셋: ① **Pilipili의 CapCut 초안 내보내기** — 편집 UI를 직접 만들지 않고 기존 편집기 프로젝트 포맷을 출구로 쓰는 "AI 90/인간 10" 루프, ② **video_explainer의 TTS-first 아키텍처**(word timestamp = 싱크의 단일 진실) — 커뮤니티 실전기 불만과 정확히 맞물림, ③ **Trend2Video의 '발행 패키지 + 품질 리포트' 출력 정의** — AI slop 반발에 대한 구조적 방어. 그리고 HN 관찰상 "오픈소스 + 에이전트 네이티브(스킬형) 영상 파이프라인" 슬롯은 아직 비어 있다 — HeyGen이 상용 스킬 리포(336★)로 먼저 움직이기 시작한 것이 유일한 경쟁 신호.
