# 무료(키리스) 한국어 TTS 조사 + 실측 보고서

- 작성: 2026-07-07 (WSL2 Ubuntu, Python 3.12.3, CPU 전용)
- 목적: 영상 자동생성 파이프라인의 **기본 TTS** 선정
- 필수 요건: 한국어 자연스러움 / 워드·문장 타임스탬프(자막 싱크) / 로컬 or 키리스 네트워크 / WSL2 동작 / 상업적 사용 가능
- 실측 산출물: `/mnt/d/video-skill-research/09-free-stack/samples/` (mp3 6종 + 워드 타임스탬프 json)

---

## 1. 비교표 (요약)

| 후보 | 한국어 품질 | 워드 타임스탬프 | 라이선스(상업) | 설치 난이도 | WSL2 실측 | 판정 |
|---|---|---|---|---|---|---|
| **edge-tts 7.2.8** | 상 (Azure Neural 3보이스) | **네이티브 O** (WordBoundary→SRT까지) | 회색지대(비공식 API, MS 약관) | 최하 (`pip install`, 5초 합성) | **O 실측 통과** | **기본 채택** |
| gTTS 2.5.4 | 중하 (구글번역 톤, 단조) | X (whisper 후처리 필요) | 라이브러리 MIT, API는 비공식 | 최하 | **O 실측 통과** | 비상용 폴백 |
| MeloTTS (한국어 모델) | 중 (명료하나 톤 평탄, 화자 1종) | X (whisper 후처리) | **MIT (상업 O)** | 상 (py3.10 고정+mecab 수동, §3.4) | **O 합성 성공 실측** (CPU RTF≈1.7) | **로컬 폴백 1차** |
| Qwen3-TTS 0.6B/1.7B | 상 (한국어 WER 최저 주장) | X | **Apache 2.0 (상업 O)** | 중 (GPU 권장) | 미실측 | 로컬 승격 1순위 |
| Supertonic 3 (수퍼톤) | 상 (국내 최상위권 평판) | X (문서상 언급 없음) | OpenRAIL-M (상업 O, 사용제한 조항) | 중하 (ONNX 99M, GPU 불필요) | 미실측 | 로컬 승격 2순위 |
| Coqui XTTS-v2 (idiap 포크) | 중상 (한국어 발음 어색 사례) | X | **CPML=비상업 전용, 구매처 소멸** | 중 | 미실측 | **탈락(라이선스)** |
| Fish-Speech/OpenAudio S1 | 상 | X | 모델 CC-BY-NC-SA (비상업) | 상 (GPU 필요) | 미실측 | 탈락(라이선스) |
| CosyVoice2/3 (Alibaba) | 중 (중국어 억양 섞임 보고) | X | Apache 2.0 | 상 (conda+ttsfrd) | 미실측 | 보류 |
| F5-TTS + team-lucid/F5-TTS-ko | ? (검증 부족) | X | 한국어 모델 Apache 2.0 표기 | 중 (CPU 느림) | 미실측 | 보류(실험용) |
| Kokoro-82M | — | — | Apache 2.0 | — | 미실측 | **탈락(한국어 미지원)** |
| Zonos (Zyphra) | — | — | Apache 2.0 | — | 미실측 | **탈락(한국어 미지원)** |

핵심: **무료 후보 중 워드 타임스탬프를 네이티브로 주는 것은 edge-tts가 유일**. 나머지는 전부 faster-whisper/whisper.cpp 후처리 정렬이 필요하다(후처리 경로도 실측 통과 — §3.3).

---

## 2. 실측 환경

```
WSL2 (Linux 5.15.167.4-microsoft-standard-WSL2), Python 3.12.3, CPU 전용
venv: /tmp/claude-1000/.../scratchpad/ttstest
설치: pip install edge-tts gTTS  →  edge-tts 7.2.8 / gTTS 2.5.4 (MIT)
테스트 문장(2문장): "안녕하세요, 오늘은 인공지능이 바꾸는 영상 제작의 미래를 살펴보겠습니다.
                    자막 싱크를 위해서는 단어 단위 타임스탬프가 반드시 필요합니다."
```

---

## 3. 실측 로그

### 3.1 edge-tts — 전 항목 통과

**(1) ko-KR 보이스 전체 목록** (`edge-tts --list-voices | grep ko-KR`) — 3종:

```
ko-KR-HyunsuMultilingualNeural     Male      General    Friendly, Positive
ko-KR-InJoonNeural                 Male      General    Friendly, Positive
ko-KR-SunHiNeural                  Female    General    Friendly, Positive
```

**(2) 합성 4회 (총 4.5~5.3초, 네트워크 왕복 포함)**:

```
$ python test_edge.py out
ko-KR-SunHiNeural  : audio=out/edge_sunhi.mp3  (11.8s), boundaries=16
ko-KR-InJoonNeural : audio=out/edge_injoon.mp3 (12.4s), boundaries=16
ko-KR-HyunsuMultilingualNeural : audio=out/edge_hyunsu.mp3 (12.0s), boundaries=16
ko-KR-SunHiNeural rate=+25% pitch=+10Hz vol=-10% : edge_sunhi_fast.mp3 (9.5s), boundaries=16
real    0m5.327s
```

**(3) WordBoundary 워드 타임스탬프 — 실제 나옴 (검증 완료)**. 단 함정 하나: edge-tts 7.x는 기본값이 `SentenceBoundary`라 **`Communicate(..., boundary="WordBoundary")`를 명시해야** 워드 단위가 나온다(기본값으로 돌리면 0개 — 실측에서 직접 밟은 함정).

```json
[{"text": "안녕하세요", "offset_sec": 0.1,   "duration_sec": 0.925},
 {"text": "오늘은",     "offset_sec": 1.288, "duration_sec": 0.45},
 {"text": "인공지능이", "offset_sec": 1.75,  "duration_sec": 0.688},
 {"text": "바꾸는",     "offset_sec": 2.45,  "duration_sec": 0.637},
 ... 총 16단어, 마지막 "필요합니다" offset 10.137s ]
```

전체 json: `samples/edge_sunhi_words.json`. 오디오 실측 길이(ffprobe 11.808s)와 마지막 워드 offset+duration(10.912s)이 정합 — 자막 싱크에 바로 사용 가능.

**(4) rate/pitch/volume 조절 — 동작 확인**: `rate="+25%"` 적용 시 11.8s → 9.5s로 단축, 타임스탬프도 함께 재계산됨. pitch(`+10Hz`)/volume(`-10%`)도 파라미터 수용.

**(5) SRT 직접 생성 — 동작 확인**: 내장 `SubMaker.feed()` → `get_srt()`로 워드 단위 SRT가 바로 나옴:

```
1
00:00:00,100 --> 00:00:01,025
안녕하세요

2
00:00:01,187 --> 00:00:01,587
자막
...
```

**(6) 차단/약관 리스크 (조사)**:
- Microsoft 비공개 API(Edge 브라우저 "소리내어 읽기"용)를 하드코딩된 TrustedClientToken으로 쓰는 구조. 2024년 Sec-MS-GEC DRM 토큰 도입으로 대규모 403 사태(rany2/edge-tts#290) → 라이브러리가 토큰 생성(SHA-256+클록스큐 보정)으로 대응했으나 **2026년 초에도 403 재발 보고(#458)가 있음**.
- 약관상 회색지대(비문서화 API 무단 사용). **상업 파이프라인의 단일 의존처로는 부적합 → 로컬 폴백을 반드시 함께 구성**해야 함. 대량·고빈도 호출은 차단 촉진 요인이므로 rate-limit/재시도/폴백 스위치 권장.
- 프로젝트 자체는 활발(11.4k 스타, 2026-03 push) — 차단이 와도 수일 내 패치돼 온 이력.

### 3.2 gTTS — 합성 통과, 타임스탬프 없음

```
$ python -c "from gtts import gTTS; gTTS('안녕하세요...', lang='ko').save('out/gtts_ko.mp3')"
gtts saved   → 12.84s mp3
```

- 품질: 구글번역 읽기 톤. 뉴스/설명 영상 내레이션으로는 단조로움(운율 평탄). 보이스 선택·rate/pitch 조절 불가(slow=True뿐).
- 타임스탬프: 전무. 문장별 분할 합성으로 문장 경계만 흉내 가능.
- 이것도 비공식(구글번역 웹 엔드포인트) — edge-tts와 같은 차단 리스크 계열이면서 품질/기능은 전부 열세 → 채택 이유 없음.

### 3.3 타임스탬프 후처리 폴백 (faster-whisper) — 통과

타임스탬프 없는 TTS(MeloTTS/Qwen3/Supertonic 등)를 위한 보완 경로 실측. 이 머신에 faster-whisper 1.2.1 기설치.

```
$ python - <<'EOF'  # gtts_ko.mp3 (12.8s) 대상
WhisperModel('base', device='cpu', compute_type='int8'), word_timestamps=True
→ elapsed 7.2s (CPU), words=16
[(' 안녕하세요.', 0.0, 0.68), (' 오늘은', 1.6, 1.86), (' 인공지능이', 1.86, 2.88), ...]
EOF
```

결론: **12.8초 오디오를 CPU 7.2초에 워드 단위 정렬** — 실시간보다 빠름. 원문 텍스트를 이미 아는 TTS 상황이므로 ASR 오인식은 텍스트 매칭으로 교정 가능. 어떤 TTS를 쓰든 자막 싱크는 확보된다.

### 3.4 MeloTTS — 설치·합성 실측 (Python 3.10에서 성공, 3.12는 실패)

**Python 3.12: 설치 실패**

```
$ pip install git+https://github.com/myshell-ai/MeloTTS.git
× Getting requirements to build wheel did not run successfully (fugashi)
  → fugashi==1.3.0 고정핀: cp312 휠 없음 → 소스 빌드 → 시스템 libmecab 요구
  (transformers==4.27.4 구핀도 3.12 비호환 위험)
```

**Python 3.10 (uv venv): 설치·합성 성공** — 단 함정 2개:

```
$ uv venv --python 3.10 melo310
$ uv pip install "git+https://github.com/myshell-ai/MeloTTS.git"   # 설치 OK
$ python -c "from melo.api import TTS; TTS(language='KR', device='cpu')" + 합성
AttributeError: 'NoneType' object has no attribute 'pos'   # 함정: g2pkk가 mecab 없이 침묵 실패
$ uv pip install python-mecab-ko                            # → 1.3.7 설치로 해결
$ python: TTS(language='KR').tts_to_file(테스트 2문장, spk['KR'], 'melo_ko.wav')
synth 20.1s → melo_ko.wav 12.05s (CPU, RTF≈1.7 — 실시간보다 느림)
```

- 명료도 검증: faster-whisper 재전사 → 원문 2문장 거의 그대로 복원("단어 단위"→"단어 단이" ASR 수준 오차 1건) — **발음 명료도 양호**. 톤은 edge-tts 대비 기계적/평탄, 화자도 KR 1종뿐(속도 조절만 가능).
- 종합 판정: **동작함 (MIT, 완전 로컬) → 로컬 폴백 1차로 채택 가능**. 다만 비용 4가지를 안고 씀: Python 3.10 고정 + python-mecab-ko 수동 추가 + CPU 실시간의 0.6배 속도 + 워드 타임스탬프 없음(§3.3 whisper 후처리 필수). 프로젝트 자체는 2024-12 이후 사실상 방치.
- 샘플: `samples/melo_ko.mp3`

---

## 4. 미실측 후보 상세 (조사 기반)

| 후보 | 요점 | 근거 |
|---|---|---|
| **Qwen3-TTS** (2026-01 오픈소스화) | 10개 언어, 한국어 WER 최저 주장(ElevenLabs v2 대비), Apache 2.0, 0.6B/1.7B, 3초 보이스클로닝. 12.3k 스타·활발. GPU 있으면 로컬 기본으로 승격할 1순위 | github.com/QwenLM/Qwen3-TTS |
| **Supertonic 3** (수퍼톤 오픈모델) | 존재함. 99M ONNX 온디바이스 전용 설계·GPU 불필요 → WSL2/CPU 최적 체급. 한국어 강점, `<laugh>` 등 표현 태그. 모델 라이선스 OpenRAIL-M(상업 허용+사용제한 조항, 원문 확인 필요) | huggingface.co/Supertone/supertonic-3 |
| Coqui XTTS-v2 | 한국어 지원하나 모델 가중치 CPML=**비상업 전용**, Coqui 폐업(2024-01)으로 상업 라이선스 구매처 자체가 소멸 → 상업 프로젝트 사용 불가. idiap 포크는 코드만 유지보수 중 | github.com/idiap/coqui-ai-TTS |
| Fish-Speech/OpenAudio S1 | 품질 상위권이나 모델 CC-BY-NC-SA. "크레딧 표기 시 유튜브 음성은 비상업 간주" 공식 입장(discussion #1001)이 있긴 하나 리스크. GPU 필요 | github.com/fishaudio/fish-speech |
| CosyVoice2/3 | ko 포함(Apache 2.0)이나 한국어 억양에 중국어 억양 섞임 보고. 설치 무거움(conda+ttsfrd) | github.com/FunAudioLLM/CosyVoice |
| F5-TTS 한국어 | 공식 모델은 zh/en+CC-BY-NC. 한국어는 team-lucid/F5-TTS-ko(Apache 2.0)가 유일하나 다운로드 미미·검증 부족 | huggingface.co/team-lucid/F5-TTS-ko |
| Kokoro-82M | **한국어 미지원 확정**(VOICES.md 9개 언어에 ko 없음, issue #294) — 흔한 오해라 명기 | github.com/hexgrad/kokoro |
| Zonos | **한국어 미지원**(en/ja/zh/fr/de). 오픈소스 쪽 2025-03 이후 정체 | github.com/Zyphra/Zonos |

---

## 5. 최종 추천

### 기본 TTS: **edge-tts (ko-KR-SunHiNeural 기본, InJoon 남성 대체)**
- 근거(전부 실측): 설치 1분·합성 5초·품질 상급·**워드 타임스탬프 네이티브**·SRT 직생성·rate/pitch/volume 조절. 무료 후보 중 "자막 싱크 필수" 요건을 후처리 없이 만족하는 유일한 선택지.
- 단서: 비공식 API — 반드시 아래 폴백과 짝으로 운용. 코드에서 `boundary="WordBoundary"` 명시 필수(7.x 기본값 함정).

### 폴백: **MeloTTS-Korean(로컬) + faster-whisper 정렬** (네트워크/403 차단 시)
- 두 구간 모두 실측 통과: MeloTTS 합성 성공(§3.4, MIT·완전 로컬·명료도 양호, 단 py3.10 고정·CPU RTF≈1.7) + faster-whisper 워드 정렬(§3.3, CPU 실시간 이상). 즉 오프라인에서도 자막 싱크까지 끝까지 감.
- 톤 평탄·화자 1종이 아쉬우면 **Qwen3-TTS(Apache 2.0)** 로 승격 검증 권장(미실측, GPU 권장). 비상시 최후 수단은 gTTS(품질 타협, 역시 whisper 정렬).
- 파이프라인 스위치 설계: `edge-tts 실패(403/timeout) → 로컬 TTS 합성 → faster-whisper word_timestamps → 동일 자막 포맷으로 수렴`.

### 유료 업그레이드 후보 (추천 카탈로그용, 체크만 — 미실측)
| 서비스 | 한국어 | 타임스탬프 API |
|---|---|---|
| **Typecast** | 한국어 특화 최강급 | `/v1/text-to-speech/with-timestamps` — 워드/문자 + SRT/VTT 헬퍼 공식 제공 |
| **ElevenLabs** | multilingual v2/v3 지원 | `/with-timestamps` — 문자 단위 타임스탬프(스트리밍 포함) |
| **HeyGen** | 지원 | `POST /v3/voices/speech` — 워드 타임스탬프 옵션 반환 |

한국어 품질+타임스탬프 조합으로는 Typecast가 유료 1순위, 범용성은 ElevenLabs.

---

## 부록: 샘플 파일

`/mnt/d/video-skill-research/09-free-stack/samples/`
- `edge_sunhi.mp3` / `edge_injoon.mp3` / `edge_hyunsu.mp3` — 보이스 3종 동일 문장
- `edge_sunhi_fast.mp3` — rate+25%/pitch+10Hz/vol-10% 조절판
- `edge_sunhi_words.json` — 워드 타임스탬프 16개 (offset/duration, 초 단위)
- `gtts_ko.mp3` — gTTS 비교용
