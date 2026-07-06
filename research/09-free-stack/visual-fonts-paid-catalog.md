# 비주얼 무료 스택 + 무료 한글 폰트 + 유료 업그레이드 카탈로그

- 조사일: 2026-07-07, 조사자: fable general-purpose 에이전트
- 방법: 전 항목 curl 실측 (키 없이, WSL2에서 직접 실행). 실측 못한 항목은 **미실측** 표기.
- 전제: 이미지 **생성**의 기본 경로는 codex-imagegen($imagegen, 추가 키 불필요)으로 확정 — 본 문서는 그 폴백/보조와 폰트/유료 옵션만 다룸.

---

## 1. 이미지/비주얼 — 키리스 실측 결과

### 1-1. 판정 요약표

| 소스 | 키 필요? | 실측 결과 | 기본 채택 |
|---|---|---|---|
| **Openverse API** | 불필요 | 검색 200 + 원본 다운로드 성공 | ✅ 스톡 사진 폴백 1순위 |
| **Wikimedia Commons API** | 불필요 | 검색 200 + upload.wikimedia.org 다운로드 성공 | ✅ 폴백 2순위 (CC0 필터 용이) |
| **Lorem Picsum** | 불필요 | 1920×1080 JPEG 즉시 수신 | ✅ 플레이스홀더 전용 |
| **unDraw** | 불필요 | 검색 API + cdn SVG 다운로드 성공 | ✅ 플랫 일러스트 |
| Pexels | 문서상 필요 | **키 없이 200 응답 (사진+비디오)** — 비보장 | ⚠️ 기본 제외, 유료편 참조 |
| Pixabay | 필요 | 키 없이 400 (Invalid or missing API key) | ❌ 기본 제외 |
| Unsplash | 필요 | 키 없이 401, source.unsplash.com은 503(폐기) | ❌ 기본 제외 |
| **Wikimedia 비디오** | 불필요 | filetype:video 검색 + .webm 다운로드 성공 | ✅ 스톡 비디오 |
| **Archive.org 비디오** | 불필요 | advancedsearch + metadata + /download/ MP4 성공 | ✅ 스톡 비디오 (OpenMontage 동일 소스) |

### 1-2. Openverse API (키리스 확정)

```
$ curl "https://api.openverse.org/v1/images/?q=seoul%20city&page_size=2" -H "User-Agent: video-skill/1.0"
→ HTTP 200, {"result_count":240, ..., "url":"https://live.staticflickr.com/5214/5464351080_..._b.jpg",
   "license":"by-sa","license_version":"2.0","attribution":"..."}
$ curl -o ov.jpg "https://live.staticflickr.com/5214/5464351080_f701992af3_b.jpg"
→ JPEG 1023x682, 389,694 bytes ✓
```

- **레이트리밋(익명, 응답 헤더 실측)**: `anon_burst 20/min`, `anon_sustained 200/day`. 파이프라인 1회당 컷 수가 적으니 폴백 용도로 충분하지만, 대량이면 캐시 필수.
- 라이선스 필터 실측 OK: `&license=cc0,pdm` → CC0/퍼블릭도메인만 (어트리뷰션 부담 제거). 응답에 `attribution` 문자열이 완성형으로 들어있어 크레딧 자막 자동 생성 가능.
- 원본은 flickr 등 외부 CDN — url 필드 그대로 curl 하면 됨.

### 1-3. Wikimedia Commons API (키리스 확정, 이미지+비디오 겸용)

```
$ curl "https://commons.wikimedia.org/w/api.php?action=query&generator=search\
&gsrsearch=filetype:bitmap%20seoul&gsrnamespace=6&gsrlimit=2\
&prop=imageinfo&iiprop=url|extmetadata&format=json"
→ 200, imageinfo.url = https://upload.wikimedia.org/wikipedia/commons/f/f7/...jpg
$ curl -o wm.jpg <그 URL>  → JPEG 3072x2304 ✓
```

- `gsrsearch=filetype:video seoul` 로 바꾸면 비디오 검색: `File:Seoul, central street.webm` → `upload.wikimedia.org/.../Seoul%2C_central_street.webm` 부분 다운로드 실측 ✓ (WebM 확인).
- extmetadata에 라이선스 카테고리(CC-Zero 등) 포함 — 자동 라이선스 게이트 가능. `haswbstatement` 검색이나 카테고리 필터로 CC0만 거르기 가능(세부 쿼리 문법 **미실측**).
- User-Agent 헤더 필수(예의상 연락처 포함 권장). 미설정 시 차단될 수 있음.

### 1-4. Lorem Picsum (플레이스홀더 전용)

```
$ curl -L -o picsum.jpg "https://picsum.photos/1920/1080"  → JPEG 1920x1080 ✓
$ curl "https://picsum.photos/seed/video1/1280/720"  → 302 (리다이렉트, -L 필요)
```
- seed 방식이라 결정론적 재현 가능 → 렌더 테스트/드라이런의 이미지 슬롯 채움용. 실 콘텐츠 사용 비권장(사진 내용 통제 불가).

### 1-5. unDraw (키리스 SVG 일러스트)

```
$ curl "https://undraw.co/api/search?q=teamwork"
→ 200, {"results":[{"title":"Teamwork","media":"https://cdn.undraw.co/illustration/teamwork_zplp.svg"},...]}
$ curl -o undraw.svg "https://cdn.undraw.co/illustration/detailed-answer_kys9.svg"  → SVG ✓
```
- 주의: 파라미터는 `q=` (`query=`는 400 반환, 3자 이상 필요). POST는 405.
- unDraw 라이선스: 상업 사용·수정 자유, 어트리뷰션 불요. 단 "unDraw 자체와 경쟁하는 재배포 플랫폼" 금지 — 영상 삽입은 완전 안전.
- SVG라서 브랜드 컬러 치환(`fill` 교체) 후 렌더 가능 — 일러스트 톤 통일에 유리.
- 보너스 실측: **Iconify API** (`api.iconify.design/mdi/video.svg` → 200, 키리스, 20만+ 아이콘)와 **OpenMoji jsdelivr** (200) 도 키 없이 동작 — 아이콘 슬롯 폴백으로 기록. SVGRepo는 429(봇 차단).

### 1-6. Pexels / Pixabay / Unsplash — 키 필요 여부 실측

```
$ curl "https://api.pexels.com/v1/search?query=city&per_page=1"        → 200 + 정상 JSON (키 없음!)
$ curl "https://api.pexels.com/videos/search?query=city&per_page=1"   → 200 + 정상 JSON (키 없음!)
$ curl "https://pixabay.com/api/?q=city"                               → 400 "Invalid or missing API key"
$ curl "https://api.unsplash.com/search/photos?query=city"             → 401 "OAuth error"
$ curl -L "https://source.unsplash.com/random/800x600"                 → 503 (서비스 폐기)
```
- **Pexels가 키 없이 응답한 것은 공식 문서와 배치되는 동작** (문서상 Authorization 헤더 필수). 언제 막혀도 이상하지 않으므로 **기본 경로 채택 금지**, "발견 사항"으로만 기록. 키는 무료 발급(§3 참조). 단 `images.pexels.com` CDN 직링크 다운로드는 원래 키리스(1280px 리사이즈 파라미터 실측 ✓).
- Pixabay/Unsplash: 키 필수 확정(무료 발급이지만 키리스 기본 경로에서는 제외).

### 1-7. Archive.org (키리스 스톡 비디오 확정)

```
$ curl "https://archive.org/advancedsearch.php?q=city+timelapse+AND+mediatype:movies\
&fl[]=identifier&fl[]=licenseurl&rows=3&output=json"
→ 200, identifier 목록 (일부 licenseurl 포함, 예: CC BY-NC-SA 4.0)
$ curl "https://archive.org/metadata/wccctvtx-City_Hall_Christmas_Tree_Timelapse"
→ 파일 목록: .HD.mov(h.264, 22MB), .mp4(h.264, 4.1MB), .mp3, .png ...
$ curl -r 0-300000 -o ia.mp4 "https://archive.org/download/<identifier>/<file>.mp4"
→ ISO Media MP4 ✓ (Range 요청도 동작)
```
- 3단 파이프: advancedsearch(검색) → metadata(파일 목록+포맷) → /download/(직다운). 전부 키리스.
- **주의**: licenseurl이 없는 항목 다수 + NC(비상업) 라이선스 혼재 → `q=...AND licenseurl:*creativecommons*` 식 필터 + NC/ND 제외 로직 필수. Prelinger Archives 컬렉션(`collection:prelinger`)은 퍼블릭 도메인 위주라 안전한 기본 풀(컬렉션 단위 필터 **미실측**).

### 1-8. 기본 채택 권고 (키리스 캐스케이드)

```
이미지: codex-imagegen(생성, 확정) → Openverse(license=cc0,pdm) → Wikimedia Commons → [테스트만] Picsum
일러스트/아이콘: unDraw SVG → Iconify
비디오: Wikimedia Commons(filetype:video) → Archive.org(prelinger/CC 필터)
```

---

## 2. 무료 한글 폰트 (.woff2 번들, 재배포 라이선스)

### 2-1. 실측 + 라이선스 표

| 폰트 | 라이선스 | 재배포/번들 | 직다운 URL (전부 curl 실측) | 결과 |
|---|---|---|---|---|
| **Pretendard** | SIL OFL 1.1 | ✅ 가능 | `https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/variable/woff2/PretendardVariable.woff2` (2.0MB, 가변 45~920) / static: `.../dist/web/static/woff2/Pretendard-Bold.woff2` | 200, WOFF2 바이트 검증 ✓ |
| **SUIT** | SIL OFL 1.1 | ✅ 가능 | `https://cdn.jsdelivr.net/gh/sun-typeface/SUIT@2/fonts/variable/woff2/SUIT-Variable.woff2` (624KB) | 200, WOFF2 검증 ✓ |
| **Noto Sans KR** | SIL OFL 1.1 | ✅ 가능 | `https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-kr@latest/korean-400-normal.woff2` | 200 ✓ |
| **Noto Serif KR** | SIL OFL 1.1 | ✅ 가능 | `https://cdn.jsdelivr.net/fontsource/fonts/noto-serif-kr@latest/korean-700-normal.woff2` | 200 ✓ |
| **나눔고딕/명조** | SIL OFL 1.1 | ✅ 가능 | `https://cdn.jsdelivr.net/fontsource/fonts/nanum-gothic@latest/korean-400-normal.woff2`, `nanum-myeongjo@latest/...` | 200 ✓ |
| **나눔고딕코딩** | SIL OFL 1.1 | ✅ 가능 | `https://cdn.jsdelivr.net/fontsource/fonts/nanum-gothic-coding@latest/korean-400-normal.woff2` | 200 ✓ |
| **D2Coding** (네이버) | SIL OFL 1.1 | ✅ 가능 | `https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_three@1.0/D2Coding.woff` (**woff, woff2 아님**) | 200 ✓ / fontsource엔 없음(404) |
| **Gmarket Sans** | 자체 무료 라이선스 | ⚠️ 조건부 — 원형 유지 재배포 가능·수정 금지·폰트 단독 판매 금지 (세부 원문 **미실측**) | `https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_2001@1.1/GmarketSansMedium.woff` / `GmarketSansBold.woff` (**woff**) | 200 ✓ |
| **에스코어드림** | 자체 무료 라이선스 | ⚠️ 조건부 — 자유 사용·수정/판매 금지 (세부 원문 **미실측**) | `https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_six@1.2/S-CoreDream-6Bold.woff` (1~9 굵기, **woff**) | 200 ✓ |

- 실측 로그 요지: 위 URL 전부 `curl -sIL` → `200 font/woff2`(또는 `font/woff`), Pretendard·SUIT는 실바이트 다운로드 후 `file` 로 WOFF2 매직 확인.
- 함정 2개: ① Pretendard는 **gh 경로가 아니라 npm 경로**(`gh/orioncactus/pretendard@v1.3.9/dist/...`는 404 — monorepo라 `packages/pretendard/dist/...`로 써야 gh도 200). ② 눈누(projectnoonnu) CDN 계열은 대부분 **woff2가 아닌 woff** — 번들 규격을 woff2로 못박으려면 OFL 폰트(Pretendard/SUIT/Noto/나눔)로 구성하는 게 깔끔.
- 공공 무료 폰트(눈누 등재 기준): 지자체/기업 배포 폰트 다수가 projectnoonnu jsdelivr 리포로 서빙됨(위 Gmarket/에스코어와 동일 패턴). 단 폰트마다 라이선스 제각각 — fontagent의 라이선스 4-플래그(`commercial/video/web_embedding/redistribution`) 패턴으로 개별 검증 후 편입 권장. 개별 실측은 **미실측**.

### 2-2. 3롤 추천 세트 (fontagent tones 개념 적용)

fontagent는 mood 대신 `tones`×코호트(11종)로 역할별 폰트를 뽑고 title{700,-0.02em}/subtitle{600}/body{400,1.6} 기본값을 준다. 같은 구조로:

**기본 세트 (전부 OFL — 라이선스 게이트 없이 무조건 번들 가능):**

| 롤 | 폰트/굵기 | 코호트 | 근거 |
|---|---|---|---|
| 제목(title) | **Pretendard Variable 800~900** | display_bold~neutral | 가변 1파일로 전 굵기 커버, 한/영 조화 최상, 자간 -0.02em |
| 본문(body/자막) | **Pretendard Variable 400~500** | neutral_content_sans | 제목과 같은 파일 재사용 → 번들 2.0MB 1개로 2롤 해결 |
| 모노(숫자/코드/타이머) | **D2Coding** (OFL, woff) 또는 나눔고딕코딩(woff2) | tech_display | 한글 지원 고정폭, 데이터·카운트업 프레임용 |

**tones별 오버라이드:**

| tone | 제목 교체 | 비고 |
|---|---|---|
| editorial/luxury | Noto Serif KR 700~900 | editorial_serif 코호트, 다큐·프리미엄 톤 |
| geometric/브랜드·프로모 | SUIT Variable 800 | Pretendard보다 기하학적, 가변 624KB로 가벼움 |
| display/유튜브 썸네일급 | Gmarket Sans Bold (woff, ⚠️조건부) | display_bold 대표지만 비OFL — 라이선스 노트 첨부 조건 |
| traditional | 나눔명조 700 | OFL |

- 권고: 스킬 번들에는 **Pretendard Variable + SUIT Variable + Noto Serif KR(700) + 나눔고딕코딩 = 4파일 전부 OFL** 로 고정하고, Gmarket/에스코어 등 조건부는 "다운로드 어댑터"(URL만 갖고 있다가 사용 시점에 받기)로 분리 — 재배포 리스크 0.

---

## 3. 유료 업그레이드 카탈로그 (추천용 — 코드 기본값 금지)

> 전부 **어댑터 슬롯만 파두고 기본은 무료 경로**. 가격은 2026-07 기준 대략치, 실결제 검증 **미실측**.

| 기능 | 제품 | 무엇이 좋아지나 (1줄) | 대략 비용 | 어댑터 슬롯 위치 |
|---|---|---|---|---|
| TTS | **ElevenLabs** | 무료(Kokoro 로컬) 대비 한국어 감정·억양이 방송급으로, 보이스 클론 가능 | Starter $5/월(~30분), Creator $22/월(~100분) | `hyperframes-media`의 `scripts/audio.mjs` — 이미 HeyGen/ElevenLabs/Kokoro 멀티프로바이더 구조, ELEVENLABS_API_KEY만 주입 |
| TTS | **HeyGen TTS** | HeyGen 구독 하나로 TTS+BGM 카탈로그+아바타를 한 키로 통합 | Creator ~$24~29/월 | 동일 `audio.mjs` (HeyGen provider 기본 지원) |
| TTS | **Typecast** | 한국어 특화 캐릭터 보이스 다양성(예능/광고 톤) | ~$9.99/월부터 (**미실측**) | `audio.mjs`에 provider 1개 추가 구현 필요 |
| 이미지 | **FAL nano-banana** | codex-imagegen 대비 API 직접 호출 — 스폰 오버헤드 없이 초 단위 응답·동시성 제어·정확한 해상도 | ~$0.039/장 | 이미지 생성 어댑터: codex-imagegen 러너와 동일한 `프롬프트 jsonl → PNG 회수` 계약을 지키는 `generate()` 슬롯 |
| 이미지 | **OpenAI gpt-image API** | codex와 같은 모델 계열을 키로 직접 — 파이프라인 내 재현성·에러 핸들링 개선 | ~$0.01(low)~$0.17(high)/장 | 동일 슬롯 (프롬프트 규격은 image-prompt 스킬 그대로 재사용) |
| 스톡 | **Pexels/Pixabay 키** | (유료 아님, 무료 키) Openverse 20/min·200/day 리밋 해제 + 고품질 큐레이션 사진·비디오 정식 보장 | 무료 (가입만) | 스톡 폴백 캐스케이드에 provider 2개 삽입 — Openverse와 같은 `search→url→download` 인터페이스 |
| BGM | **Epidemic Sound** | 유튜브 Content ID 클레임 걱정 없는 정식 라이선스 음원 4만곡 | Personal ~$10~18/월 | `media-use` resolve 캐스케이드(현 HeyGen 카탈로그 검색 자리)에 provider 추가 |
| BGM | **Artlist** | 영상용 시네마틱 큐레이션 + SFX 포함 플랜 | ~$9.99~29.9/월 | 동일 media-use 슬롯. 단 API 없어 다운로드 자동화는 수동/브라우저 워커 (**미실측**) |
| 립싱크/아바타 | **HeyGen** | 얼굴 없는 파이프라인에 AI 프리젠터 씬 추가 — 아바타 발화 클립 생성 후 talking-head-recut/embedded-captions에 연결 | Creator ~$24~29/월 + API 크레딧 별도 | 새 씬 타입 어댑터: 스크립트→HeyGen video API→mp4 회수→합성 트랙 |
| 클라우드 렌더 | **AWS Lambda** (hyperframes lambda) | 로컬 ffmpeg/크로미움 렌더를 병렬 람다로 — 3분 영상 렌더가 분 단위→수십 초, WSL 부하 0 | 종량제(렌더 분당 수 센트 수준, **미실측**) | `hyperframes-cli`의 `hyperframes lambda deploy/render/progress/destroy` — 스킬에 이미 존재, AWS 자격증명만 주입 |

**추천 우선순위(체감 대비 비용):** ① Pexels/Pixabay 키(공짜인데 스톡 품질 급상승) → ② ElevenLabs Starter $5(내레이션 품질이 영상 체감의 절반) → ③ hyperframes lambda(대량 생산 시점에) → ④ FAL/gpt-image 키(codex 스폰이 병목이 될 때만) → ⑤ HeyGen(아바타 니즈 생기면).

---

## 부록: 실측 환경/원칙

- 실측: 2026-07-07, WSL2 curl, 키/토큰 일절 미사용 (Pexels 200 응답도 무헤더 상태).
- 다운로드 검증은 전부 `file` 매직 바이트 확인 (JPEG/WebM/MP4/SVG/WOFF2).
- 스크래치: `/tmp/claude-1000/.../scratchpad/imgtest/` (ov.jpg, wm.jpg, wm.webm, ia.mp4, undraw.svg, pt.woff2, suit.woff2 등).
- 미실측 목록: Wikimedia CC0 전용 검색 문법, Archive.org 컬렉션 필터, Gmarket/에스코어 라이선스 원문, Typecast 최신 가격, Artlist 자동화 경로, Lambda 렌더 실비용.
