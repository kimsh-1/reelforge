# FREE-STACK 라이선스 적대적 재검증 — 재배포(public GitHub 레포 번들) 기준

- 작성: 2026-07-07 | 검증자: fable general-purpose (적대 재검증 임무)
- 기준: **"사용 가능"이 아니라 "재배포 가능"** — 에셋을 public GitHub 레포에 커밋할 수 있는가
- 방법: 전 항목 웹 원문 대조 (WebFetch/WebSearch/wayback/curl + 폰트 바이너리 name 테이블 실사)
- 대상 원본: `09-free-stack/audio-assets-free.md`, `visual-fonts-paid-catalog.md`, `tts-korean-free.md`

---

## 판정 요약표

| # | 항목 | 원 보고서 판정 | **재검증 판정 (재배포 기준)** |
|---|---|---|---|
| 1 | short-video-maker 번들 31곡 (YAL) | "BGM 시드 채택 (재배포는 그레이)" | **불가 — 시드에서 제외** |
| 2 | hyperframes SFX 21파일 (Pixabay) | "재배포까지 깨끗한 유일한 번들" | **불가 — 원문에 standalone 재배포 금지 명문, CREDITS.md 주장은 원문에 없음** |
| 3 | FreePD archive.org 미러 41곡 | "CC0 보강용" | **조건부 가능 — CC0 확증, 단 미러 출처증빙 절차 필수 + 오염 아이템 혼동 주의** |
| 3b | incompetech CC-BY | "보강용 (크레딧 조건)" | **가능 — CC BY 4.0은 재배포 명시 허용, 귀속 형식 확정** |
| 4 | Pretendard·D2Coding·Noto·SUIT (OFL) | "재배포 가능" | **가능(조건부) — 폰트별 저작권 고지+OFL 전문 동봉 필수, 공식 빌드 woff2만** |
| 5 | edge-tts | "회색지대, 폴백 짝 운용" | **미확정/고위험 — 재배포 이슈 아닌 사용 리스크. 생성 음성에 상업권 부여 근거 자체가 없음** |
| 6 | MusicGen 가중치 CC-BY-NC | "기본 오프, 상업 재검토" | **불가(상업) — 재검토 여지 없음. 상업 파이프라인 산출 금지로 못박기** |

---

## 1. short-video-maker 번들 31곡 — [재배포 불가] ← 최대 리스크 적중

### 원문 증거

**YouTube Audio Library 다운로드 약관** (YouTube Studio 다운로드 시 동의 문구, 복수 2차 출처에서 동일 인용 확인):

> "By downloading music from the YouTube Audio Library, you agree that you will not **make available, distribute or perform the music files from this library separately from videos and other content into which you have incorporated these music files** (standalone distribution of these files is not permitted)."

- 검증 경로: [support.google.com/youtube/answer/3376882](https://support.google.com/youtube/answer/3376882) (공개 헬프 페이지 — 여기엔 재배포 조항이 아예 없고, 위 조항은 Studio 내 다운로드 동의창 약관), [justanswer.com 변호사 답변 인용](https://www.justanswer.com/intellectual-property-law/ma9he-tell-terms-conditions-mean.html), [licenseorg.com YAL 가이드](https://www.licenseorg.com/guide/music-audio/youtube-audio-library) ("Tracks cannot be sublicensed or delivered as standalone assets").

### 판정 논리

1. **mp3 파일을 레포에 커밋 = "영상에 통합되지 않은 상태의 음원 파일을 make available/distribute"** — 약관이 금지하는 행위 그 자체. 그레이가 아니라 명문 위반.
2. short-video-maker 레포 자체의 처리: 레포는 MIT이지만 **MIT는 코드에만 적용** — `static/music/README.md`는 "All music files are sourced from the YouTube audio library... No attribution is required"라고만 쓰고(사용 허가 문구만 인용), 재배포 권한 근거는 제시하지 않음. 메인 README에는 음원 라이선스 언급 자체가 없음. **즉 short-video-maker 자신이 이미 약관 위반 상태의 번들이고, 그걸 복사하면 위반을 승계**한다.
3. 2차 리스크: YAL 허가는 **다운로드한 본인**의 영상 사용에 부여됨. 우리 레포에서 곡을 받은 제3자 사용자는 YAL에서 직접 받은 적이 없으므로, 그 사용자의 영상 사용 권리 체인도 성립하지 않음.

### 조치

- **31곡 mp3 전부 시드에서 제외.**
- 이식 가치가 있는 것은 **코드/메타데이터만**: `music.ts`의 `{file, start, end, mood}` 트림포인트 큐레이션과 12무드 enum은 MIT 코드 → 스키마·설계로 재사용 가능(곡 파일명 참조는 자체 시드로 교체).

---

## 2. hyperframes SFX 21파일 (Pixabay) — [재배포 불가] ← 원 보고서 핵심 주장 반박됨

### 원문 증거

**Pixabay Content License Summary** ([pixabay.com/service/license-summary/](https://pixabay.com/service/license-summary/), Cloudflare 403 우회 후 원문 확보):

> "**You cannot sell or distribute Content (either in digital or physical form) on a Standalone basis.** Standalone means where no creative effort has been applied to the Content and it remains in substantially the same form as it exists on our website."

### 판정 논리

1. SFX mp3를 레포에 그대로 커밋 = **"no creative effort applied, substantially the same form"인 콘텐츠의 digital 배포** → 금지 조항에 정면으로 해당. 소프트웨어 패키지의 일부라는 사실이 파일 자체가 standalone(추출 가능한 원형 그대로)이라는 성격을 바꾸지 못함.
2. **원 보고서와 hyperframes CREDITS.md의 "Redistribution as part of derivative works 명시 허용" 문구는 Pixabay 라이선스 원문에 존재하지 않는다.** CREDITS.md(`/mnt/d/deck-factory/vendor/hyperframes/skills/hyperframes-media/assets/sfx/CREDITS.md`)를 실사한 결과 해당 문구는 hyperframes 측의 자체 해석/작문이며, 심지어 괄호 예시도 "(such as videos rendered with HyperFrames)" — **렌더된 영상** 얘기다. 렌더된 영상 내 사용·배포는 허용이 맞지만, **원형 mp3의 레포 번들은 그 범주가 아니다.** hyperframes 자신이 이 라이선스 하에서 mp3를 레포에 담고 있는 것 역시 동일한 위반 소지 — "쟤도 하니까"는 방어가 아님.
3. 허용되는 것: 렌더 결과물(영상) 안에 믹스된 상태로의 사용·배포, 상업 포함, 무귀속.

### 조치

- **21파일 레포 커밋 금지.** 원 보고서의 "최우선 채택 / 재배포까지 깨끗한 유일한 번들" 문구 삭제 필요.
- 대안: (a) 사용 시점 다운로드 어댑터(로컬 캐시, 레포 밖), (b) CC0 SFX로 대체 시드 구축(freesound CC0 필터 등 — 단 freesound도 파일별 확인), (c) 자체 생성(신스) SFX.

---

## 3. FreePD 미러 41곡 — [조건부 가능] / incompetech — [가능]

### 3-1. FreePD CC0 확증 (원문)

freepd.com wayback 스냅샷(2020·2023, `web.archive.org/web/2023id_/https://freepd.com/`) 실측 인용:

> "**This music is all licensed CC0 1.0 Universal Public Domain Dedication.**" / "Includes the Creative Commons 0 license. Use them how you want!"

CC0 1.0 = 저작권 포기 → **재배포·수정·상업 사용 완전 자유, 귀속 불요.** 레포 번들에 법적 장애물 없음.

### 3-2. 미러의 실체 (archive.org metadata API 실측)

- **41곡 아이템 = `allfreepdmusicbykuronekony4n`** ("all freepd music (by kuronekony4n)", 2020-03-21 업로드, uploader `willynash99@gmail.com`, 구글드라이브 덤프 경로 그대로). 파일명(Adventure, Adventures of Flying Jack, Advertime, Ancient Rite, Assassin...)은 FreePD 카탈로그 곡명과 일치. **단 아이템에 licenseurl 메타데이터 없음** — "진짜 FreePD 컬렉션"이라는 증빙은 파일명 대조 수준이고, 제3자 재업로드라 변조/혼입 가능성은 배제 못함.
- **함정: archive.org에 `freepd`라는 별도 아이템이 존재** ("Free Public Domain Music", 2022-03-18, 익명 33mail 업로더, **mp3 1,025개**). 실사 결과 **"Animals Of The ABC Islands _ Wild Caribbean _ BBC Earth.mp3" 같은 명백한 저작권 립이 혼입**돼 있음. 이 아이템을 미러로 오인해 수집하면 저작권 침해물을 레포에 커밋하게 됨. **수집 스크립트는 반드시 아이템 식별자를 `allfreepdmusicbykuronekony4n`로 고정**하고 `freepd` 아이템은 블랙리스트.

### 3-3. 조건 (이행 시 재배포 가능)

1. 트랙별로 FreePD 카탈로그(wayback 스냅샷) 또는 원작자 소스(Kevin MacLeod 곡은 incompetech에도 CC0/CC-BY로 존재)와 곡명 대조 → 대조표를 `PROVENANCE.md`로 레포에 동봉.
2. 대조 실패 트랙은 제외.
3. CC0이므로 귀속은 불요하나, 출처 기록은 방어 문서로 유지.

### 3-4. incompetech CC-BY 4.0 — [재배포 가능]

- incompetech FAQ/licenses 페이지 실측: 무료 라이선스는 **CC BY 4.0**, 요구 크레딧 형식(원문):

> "**\<Title\> Kevin MacLeod (incompetech.com)**
> **Licensed under Creative Commons: By Attribution 4.0 License**
> **http://creativecommons.org/licenses/by/4.0/**"

- CC BY 4.0 자체가 "Share — copy and redistribute the material in any medium or format" 명시 → **mp3 레포 번들 허용.** 조건은 §3(a) 귀속: 작자 표시 + 라이선스명 + 라이선스 URI + (수정 시) 수정 표시. → 레포에는 곡별 위 3줄 크레딧을 담은 `ATTRIBUTION.md` 동봉 + 영상 산출물 크레딧 자동 삽입(원 보고서 계획 유지).

---

## 4. 폰트 (Pretendard·SUIT·Noto·D2Coding, OFL 1.1) — [재배포 가능 (조건부)]

### OFL 1.1 원문 (openfontlicense.org 공식 텍스트 실측)

- **번들 허용 명문**: "The Font Software... may be **bundled, redistributed and/or sold with any software, provided that each copy contains the above copyright notice and this license.** These can be included either as stand-alone text files, human-readable headers or in the appropriate machine-readable metadata fields."
- **단독 판매만 금지**: "Neither the Font Software nor any of its individual components... may be **sold by itself**." (무료 레포 배포는 판매가 아니므로 무관)
- **Modified Version 정의에 포맷 변환 포함**: derivative "made by adding to, deleting, or substituting — in part or in whole — any of the components of the Original Version, **by changing formats** or by porting..."
- **RFN 조항**: "No Modified Version of the Font Software may use the Reserved Font Name(s) unless explicit written permission is granted."
- **동일 라이선스 승계**: 조건 5 — 재배포는 반드시 OFL 그대로.

### 폰트별 RFN 실사 결과

| 폰트 | RFN 선언 (원문 실측) | woff2 재배포 판정 |
|---|---|---|
| Pretendard | **RFN 'Pretendard'** (+승계 RFN 'Source', 'Inter', 'M PLUS 1') — LICENSE 원문 | **공식 dist의 woff2는 저작권자 본인 빌드 = Original 재배포 → 이름 그대로 OK.** 우리가 서브셋/재변환하면 Modified → 개명 필요 |
| SUIT | **RFN 'SUIT'** — "Copyright (c) 2022, SUNN (http://sun.fo/suit), with Reserved Font Name SUIT." | 동일 — 공식 variable woff2 원형 재배포 OK, 자체 변환 시 개명 |
| Noto Sans/Serif KR | noto-cjk LICENSE에 **RFN 선언 없음** | fontsource 서브셋 woff2도 RFN 문제 없음 → 재배포 OK (OFL 고지 동봉 조건) |
| D2Coding | 폰트 바이너리 name 테이블 실사(v1.3.2 zip): nameID 13 = "licensed under the SIL Open Font License, Version 1.1", **RFN 선언 없음.** 단 nameID 7 = "**D2Coding ligature is a registered trademark of NHN Corporation**" (상표는 OFL과 별개 층위) | OFL 재배포 OK. projectnoonnu의 제3자 woff 변환본보다 **공식 zip에서 자체 변환(개명 불요 — RFN 없음)** + OFL 고지 동봉이 안전 |

### 조건 (이행 시 전부 재배포 가능)

1. **폰트별 저작권 고지 + OFL 1.1 전문을 레포에 동봉** — 이게 무조건 조건이다. 현 계획(woff2만 복사)은 이 요건 누락 → `fonts/LICENSES/` 디렉토리에 폰트별 원 LICENSE 파일 추가.
2. **공식 배포 빌드 그대로**(Pretendard dist/web woff2, SUIT fonts/variable woff2) 사용 — 원형 무수정 재배포는 RFN을 건드리지 않음.
3. 자체 서브셋·재변환 금지(하면 Pretendard/SUIT는 개명 의무 발생). Noto는 fontsource 서브셋 OK.
4. 임베드(CSS @font-face로 웹/영상 렌더에 사용)는 OFL이 제한하지 않음 — 문제 없음.

---

## 5. edge-tts — [미확정/고위험] (재배포 이슈 아님 — 런타임 사용 리스크)

### 원문/사실 증거 (GitHub 실측)

- 구조: MS **비공개 API**(Edge 브라우저 내장 읽기 기능용) + 하드코딩 TrustedClientToken. MS가 문서화·허가한 적 없음.
- 차단 이력: **2024-10 Sec-MS-GEC 토큰 도입으로 대규모 403** ([rany2/edge-tts#290](https://github.com/rany2/edge-tts/issues/290), 2024-10-25 보고 → PR #303으로 토큰 생성 우회 구현·완화). **2026-01-20 403 재발 보고** ([#458](https://github.com/rany2/edge-tts/issues/458), edge-tts 7.2.1) — **"closed as not planned"** 즉 미해결 종결. 차단은 계정 단위가 아닌 IP/핸드셰이크 수준 403으로 나타남(계정 밴 사례는 미확인 — 애초에 계정을 안 쓰는 구조).
- 라이선스 공백: 상업 사용 "허용/금지" 이전에, **MS가 이 경로의 생성 음성에 어떤 권리도 부여한 적이 없다.** Azure Speech 정식 약관의 상업 사용권은 유료 구독 고객에게 부여되는 것 — 무단 엔드포인트 사용자는 그 체인 밖. 즉 상업 영상의 음성 트랙 권리를 물었을 때 댈 근거가 0. MS Services Agreement의 무단 접근 금지 조항 위반 소지도 상존.

### 판정

- **레포 관점**: edge-tts 라이브러리 라이선스는 **LGPLv3** (LICENSE 원문 실측: "The MIT license is used for 'src/edge_tts/srt_composer.py' only. All remaining files are licensed under the LGPLv3." / PyPI classifier도 LGPLv3). pip 의존성으로 쓰는 것은 문제없으나 **코드를 레포에 복사(vendoring)하면 LGPL 고지·소스제공 의무 승계** — 의존 선언만 할 것. **생성된 음성 파일을 레포에 커밋하는 것은 금지** (권리 근거 없는 산출물을 배포물로 만드는 행위).
- **파이프라인 관점**: 원 보고서의 "회색지대·폴백 필수" 평가는 유지하되 수위 상향 — 상업 산출물 기본 경로로는 **미확정(권리 근거 부재)**, 개인/실험용 한정. 상업 라인은 로컬 TTS(MeloTTS MIT, Qwen3-TTS Apache 2.0) 또는 유료 정식 API로.

---

## 6. MusicGen (facebook/musicgen-small) — [상업 불가 확정]

### 원문 증거

audiocraft 공식 모델카드(`model_cards/MUSICGEN_MODEL_CARD.md`) 실측:

> "Code is released under MIT, **model weights are released under CC-BY-NC 4.0**."
> "The model should not be used on downstream applications without further risk evaluation and mitigation."

CC BY-NC 4.0 §2(a)/§1: 부여되는 권리는 **NonCommercial 목적 한정** — "NonCommercial means not primarily intended for or directed towards commercial advantage or monetary compensation."

### 판정 논리

- 가중치의 NC 제한은 **모델 사용 행위**에 걸린다. 상업 영상 파이프라인의 BGM을 만들 목적으로 모델을 돌리는 것 = 상업적 이익을 직접 겨냥한 사용 → 위반. 산출물의 저작권 지위(AI 산출물 무저작권 논변)와 무관하게, 사용 라이선스 위반이 성립하므로 "산출물은 자유" 논리는 방어가 안 됨.
- **레포 관점**: NC 모델 산출 음원을 public 레포에 커밋해 상업 파이프라인 시드로 삼는 것 = 동일 위반의 고정화. 커밋 금지.
- 원 보고서의 "기본 오프, 상업 영상엔 재검토 필요" → **"상업 파이프라인 사용 금지, 재검토 여지 없음"으로 확정 강화.** 비상업 실험 한정으로만 옵션 유지. (상업 가능 대체: Stable Audio Open의 산출물 조항 별도 검토, 또는 정식 유료 카탈로그.)

---

## FREE-STACK 수정 필요사항 (파일별)

### `audio-assets-free.md`
1. **[삭제] short-video-maker 31곡 "BGM 시드 채택"** → "코드/메타데이터(무드·트림포인트 스키마)만 이식, 곡 파일은 YAL 약관(standalone 배포 금지 명문)으로 제외"로 교체. "영상 사용은 명백 OK" 문구도 수정 — YAL 허가는 직접 다운로드한 본인에게만 성립.
2. **[삭제] hyperframes SFX "재배포까지 깨끗한 유일한 번들" / "파생물 재배포 명시 허용"** — Pixabay 원문에 해당 문구 없음, 반대로 standalone 배포 금지 명문. 렌더된 영상 내 사용만 허용으로 정정. SFX 시드는 CC0 소스로 재구축 또는 다운로드 어댑터화.
3. **[수정] FreePD 미러**: 아이템 식별자 `allfreepdmusicbykuronekony4n` 고정 명시 + **`freepd` 아이템(1,025곡, BBC 립 혼입) 블랙리스트 경고** 추가 + 트랙별 카탈로그 대조·PROVENANCE.md 절차 추가.
4. **[추가] incompetech**: 재배포 가능(CC BY 4.0 Share 조항) 명시 + 3줄 귀속 형식 확정 기입.
5. **[강화] MusicGen**: "재검토 필요" → "상업 사용 금지 확정(가중치 CC-BY-NC 4.0), 산출물 레포 커밋 금지".
6. **결과 반영**: BGM 시드 구성이 "31+41+α" → "**FreePD CC0 41(검증분) + incompetech CC-BY 선별**"로 축소됨을 명시.

### `visual-fonts-paid-catalog.md`
7. **[추가] OFL 이행 조건**: 폰트별 저작권 고지+OFL 전문 동봉 의무(`fonts/LICENSES/`), 공식 빌드 원형만 재배포, 자체 서브셋/재변환 시 RFN 개명 의무(Pretendard·SUIT는 RFN 선언 확인됨) 규칙 추가. D2Coding은 RFN 없음(실사)·NHN 상표 고지 유지 조건 기입.

### `tts-korean-free.md`
8. **[강화] edge-tts**: "회색지대" → "생성 음성에 대한 상업 사용권 부여 근거 자체가 부재(무단 API)" 명시, 생성 음성 파일 레포 커밋 금지, edge-tts는 LGPLv3이므로 pip 의존 선언만(코드 복사 시 LGPL 의무 승계). 상업 라인 기본은 로컬(MeloTTS MIT / Qwen3-TTS Apache 2.0) 권장.

---

## 검증 출처 일람

| 항목 | 원문 URL |
|---|---|
| YAL 헬프 | https://support.google.com/youtube/answer/3376882 |
| YAL 다운로드 약관 인용 | https://www.justanswer.com/intellectual-property-law/ma9he-tell-terms-conditions-mean.html · https://www.licenseorg.com/guide/music-audio/youtube-audio-library |
| Pixabay Content License | https://pixabay.com/service/license-summary/ (403 우회 원문 확보) |
| short-video-maker | https://github.com/gyoridavid/short-video-maker (MIT, 음원 라이선스 문서 부재) + raw static/music/README.md |
| FreePD CC0 | web.archive.org 스냅샷 (2020/2023, freepd.com "licensed CC0 1.0 Universal") |
| archive.org 미러 | https://archive.org/metadata/allfreepdmusicbykuronekony4n (41곡) · https://archive.org/metadata/freepd (오염 아이템) |
| incompetech | https://incompetech.com/music/royalty-free/licenses/ · faq.html (CC BY 4.0 + 크레딧 형식) |
| OFL 1.1 | https://openfontlicense.org/open-font-license-official-text/ |
| Pretendard LICENSE | https://raw.githubusercontent.com/orioncactus/pretendard/main/LICENSE (RFN 'Pretendard') |
| SUIT LICENSE | https://raw.githubusercontent.com/sun-typeface/SUIT/main/LICENSE (RFN 'SUIT') |
| Noto CJK LICENSE | https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/LICENSE (RFN 없음) |
| D2Coding | naver/d2codingfont v1.3.2 zip 바이너리 name 테이블 실사 (OFL 1.1, RFN 없음, NHN 상표 고지) |
| edge-tts 차단 이력 | https://github.com/rany2/edge-tts/issues/290 (2024-10 Sec-MS-GEC 403) · /issues/458 (2026-01 재발, not planned 종결) · LICENSE 원문(LGPLv3+MIT 1파일) |
| MusicGen | https://raw.githubusercontent.com/facebookresearch/audiocraft/main/model_cards/MUSICGEN_MODEL_CARD.md (weights CC-BY-NC 4.0) |
