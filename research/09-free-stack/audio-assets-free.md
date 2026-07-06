# BGM·SFX 무료(키리스) 확보 경로 — 조사·실측 보고서

- 작성: 2026-07-07 | 실측 환경: WSL2 (12코어, RAM 7GB), curl/ffprobe/yt-dlp 2026.06.09
- 목표: **API 키 없이** 영상 파이프라인(deck-factory/video-skill)에 넣을 BGM·SFX 확보
- 실측 산출물: `/tmp/claude-1000/.../scratchpad/audio-test/` (incompetech.mp3, ia_freepd.mp3, fs_preview.mp3 등)

---

## 1. 경로별 비교표 (전부 실측)

| 경로 | 키리스 실측 | 라이선스 | 자동화 | 판정 |
|---|---|---|---|---|
| **hyperframes 번들 SFX** (21파일, 1.3MB) | O — 로컬 파일 그대로 | **Pixabay Content License** (상업OK·무귀속·파생물 재배포 명시 허용, CREDITS.md 동봉) | 완전 (manifest.json에 duration/용도 메타) | **최우선 채택** |
| **short-video-maker 번들 BGM** (31곡, 53MB) | O — 로컬 파일 그대로 | **YouTube Audio Library** (README 명시: 수익화 영상 포함 사용 가능·무귀속) | 완전 (music.ts에 mood+start/end 트림포인트 하드코딩) | **BGM 시드 채택** (원본 mp3 "재배포"는 YAL 그레이 — 영상 사용은 명백 OK) |
| **MoneyPrinterTurbo 번들** (29곡, 56MB) | O | **출처불명** — output000~028.mp3 익명, 메타태그 없음, README 자백: "default music from YouTube videos. If there are copyright issues, please delete" | — | **사용 금지** |
| **incompetech** (Kevin MacLeod) | **O** — 직링크 curl 성공 (200, 5.0MB 320kbps, 2.7s) | CC-BY 4.0 — **귀속 표기 필수** ("Music: Kevin MacLeod (incompetech.com)") | URL 패턴 규칙적 → 스크립트화 쉬움 | 보강용 (크레딧 자동삽입 조건) |
| **FreePD.com** | **X — 사이트 영구 폐쇄** (2008–2025, "Site Closed" 공지 실측) | (구) CC0/PD | — | 직접 불가 |
| └ archive.org FreePD 미러 | **O** — curl 성공 (200, 3.7MB 320kbps, 6.2s) | CC0/PD (FreePD 원본) | archive.org metadata API로 완전 자동화 (단 미러는 41곡 부분본) | CC0 보강용 |
| **Free Music Archive** | **X** — 트랙페이지 200이나 `/track/*/download/`가 로그인 월 반환 (HTML: "Sign in"×7) | 트랙별 CC 상이 | 계정 필요 | 탈락 |
| **Pixabay music** | **X** — CDN 직링크 403, 검색페이지 403 (Cloudflare 봇차단). 공식 API에 오디오 미포함 | Pixabay License (좋음) | 수동 브라우저만 | 수동 보강만 |
| **YouTube Audio Library** | **X** — studio.youtube.com 구글 로그인 필수, 공개 엔드포인트 없음 | YAL (수익화OK·무귀속) | 직접 자동화 불가. **short-video-maker 번들이 사실상 YAL 프리패키지** | 번들 경유로 해결 |
| **freesound** | **△** — API 401 (키 필수), HQ 다운로드 OAuth 필요. 단 **CDN 프리뷰(`*-lq.mp3`, 64kbps)는 키리스 200 실측** | 파일별 CC0/CC-BY/CC-BY-NC — 개별 확인 필수 | 프리뷰 한정 가능 | SFX 한정 보강 (64kbps면 효과음은 충분한 경우 多) |
| **로컬 MusicGen** (facebook/musicgen-small) | **O** — 코드 경로상 완전 키리스 | 생성물 자체 소유 (모델 라이선스 CC-BY-NC 주의: musicgen 가중치는 **비상업 조항** 있음 → 상업 영상엔 재검토 필요) | audio.mjs가 pip 자동설치+detached spawn | 오프라인 배치용 △ |

## 2. 번들 라이브러리 상세 (경로 1)

### short-video-maker — BGM 표준 참조
- `static/music/` 31곡 + `static/music/README.md`: "All music files are sourced from the YouTube audio library... use in any of your videos, including videos that you monetize. No attribution is required."
- `src/short-creator/music.ts`: 곡마다 `{ file, start, end, mood }` — **트림포인트까지 큐레이션 완료**, 그대로 이식 가치 높음.
- **12무드 enum** (`src/types/shorts.ts` MusicMoodEnum): `sad, melancholic, happy, euphoric/high, excited, chill, uneasy, angry, dark, hopeful, contemplative, funny/quirky`

### hyperframes — SFX 표준 참조
- `skills/hyperframes-media/assets/sfx/`: 21파일 1.3MB. chime/click/error/glitch×3/impact-bass×2/key-press/notification/ping/pop/riser/sparkle/typing/whoosh×3
- CREDITS.md: Pixabay Content License — "Redistribution as part of derivative works" 명시 허용. **재배포까지 깨끗한 유일한 번들.**
- manifest.json: 파일별 duration + 사용 시나리오 설명 (에이전트 자동 선택용).

### MoneyPrinterTurbo — 반면교사
- `resource/songs/` 29곡 전부 `outputNNN.mp3` 익명, ffprobe 메타 encoder뿐. README가 저작권 문제를 스스로 인정. 이식 금지.

## 3. 로컬 생성 (경로 3) — hyperframes audio.mjs 실사

`/mnt/d/deck-factory/vendor/hyperframes/skills/hyperframes-media/scripts/audio.mjs` (282줄) + `lib/bgm.mjs`:

- 크리덴셜 **단일 스위치**: HeyGen 키 있음 → BGM/SFX 카탈로그 retrieve. 없음 →
  - BGM: Lyria(GEMINI/GOOGLE_API_KEY 필요 — 무자격이면 스킵) → **로컬 MusicGen** (`facebook/musicgen-small` via transformers, `pip install transformers torch soundfile numpy` 자동 시도, detached spawn + `bgm_pending`/`wait-bgm.mjs`) — **완전 키리스 경로 존재 확인**.
  - SFX: 번들 21파일 폴백. 단, 명시적 `retrieve` 모드는 무자격 시 폴백 없이 스킵(라인 191).
- **WSL CPU 현실성 실측**: torch 미설치 상태, RAM 7GB/12코어. 첫 실행 비용 = torch CPU 휠 ~800MB + 모델 ~2.2GB 다운로드, fp32 로드 ~4GB RAM → 7GB에서 빠듯하나 구동 가능선. 30초 시드 클립 생성 CPU 수 분 급. **온디맨드(렌더 중) 생성은 비현실적, 오프라인 사전 배치 생성용으로만 적합.** detached 설계가 이를 전제.
- 주의: musicgen 모델 가중치 라이선스에 비상업 조항(CC-BY-NC) — 수익화 영상 파이프라인 기본값으로는 부적합.

## 4. 권장 전략

1. **SFX = hyperframes 21파일 번들 복사** (라이선스·메타 완비, 즉시). 부족분은 freesound lq 프리뷰(CC0 필터 수동 확인) 보강.
2. **BGM = 시드 ~70곡 로컬 라이브러리 구축**: short-video-maker 31곡(무드+트림포인트 이식) + archive.org FreePD 미러 41곡 CC0(스크립트 자동 수집 가능) + incompetech CC-BY 선별(엔딩 크레딧 자동 삽입 전제).
3. **무드 태깅 = 12무드 enum 채택** + `manifest.json` 스키마 `{file, mood, start, end, license, attribution}` — short-video-maker 방식 그대로, license 필드만 추가.
4. **로컬 MusicGen은 옵션 C**: 비상업 조항 때문에 기본 오프, "라이선스 클린 시드 확장" 필요 시 오프라인 배치로만.
5. **유료 옵션(추천용)**: 1순위 **HeyGen 카탈로그** — hyperframes가 이미 기본 retrieve 경로(`npx hyperframes auth login`, min_score 0.4 검색)라 통합 비용 0. Epidemic Sound/Artlist(월 ~$10-17 구독)는 수익화 대량 운영 전까지 불필요.

## 5. 실측 로그 요약

```
FreePD.com                  → 200 but "Site Closed" (영구 폐쇄 공지, 2008-2025)
freepd.com/music/*.mp3      → 404
archive.org FreePD mirror   → 200, 3,716,639B mp3 320kbps, 6.2s  [키리스 OK]
incompetech .mp3 직링크      → 200, 5,005,207B mp3 320kbps, 2.7s  [키리스 OK]
FMA /track/*/download/      → 200 but HTML 로그인 월 ("Sign in")   [키리스 NO]
Pixabay cdn/검색             → 403 / 403 Cloudflare               [키리스 NO]
freesound API (no key)      → 401 "Authentication credentials were not provided"
freesound cdn *-lq.mp3      → 200, mp3 64kbps                    [프리뷰만 키리스 OK]
YouTube Audio Library       → 로그인 필수, 공개 엔드포인트 없음      [번들 경유]
로컬 python                  → torch 미설치, RAM 7GB (MusicGen 빠듯-가능)
번들: SVM 31곡/53MB(YAL)·hyperframes SFX 21개/1.3MB(Pixabay)·MPT 29곡/56MB(출처불명→금지)
```
