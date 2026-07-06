# FREE-STACK — 무료 키리스 스택 확정표

작성: 2026-07-07 · 원칙 [RESOLUTION F1~F4]: **키리스·무료가 기본(default), 유료는 어댑터 슬롯+추천 카탈로그만.** 코드 기본값에 API 키 요구 금지. 아래 전 항목은 실측 검증 완료(각 상세 보고서에 명령·출력 로그).

## 기능별 확정표

| 기능 | 무료 기본 (키리스) | 폴백 체인 | 유료 추천 옵션 (체크만) | 상세 |
|---|---|---|---|---|
| **한국어 TTS** | **edge-tts** (ko-KR-SunHiNeural 기본/InJoon 남성) — 워드 타임스탬프 네이티브·SRT 직생성·rate/pitch 조절, 전부 실측 ✓ | 403/차단 시: **MeloTTS-Korean(MIT) 합성 실측 ✓**(py3.10 venv 필수 — py3.12 설치 불가·python-mecab-ko 수동 추가, CPU RTF≈1.7, 톤 평탄) + faster-whisper 워드 정렬(실측 ✓) → 최후 gTTS. 승격 후보 Qwen3-TTS(미실측) | Typecast(한국어+타임스탬프 API 1순위) / ElevenLabs / HeyGen | tts-korean-free.md |
| **자막 전사/정렬** | faster-whisper 1.2.1 (기설치, CPU 실시간 이상 실측 ✓) — whisper 모델 버전 고정 | — | — | tts-korean-free.md §3.3 |
| **BGM** | 시드 = **FreePD 검증 41곡(CC0)** — 트랙별 freepd 카탈로그 대조+PROVENANCE.md 동봉 조건 + **incompetech 선별(CC-BY 4.0, 3줄 크레딧 형식)**. ~~SVM 31곡~~ **재배포 불가(YAL 약관) — 제외, music.ts의 무드/트림포인트 메타 설계만 이식** | ~~MusicGen~~ **금지 확정**(가중치 CC-BY-NC — 상업 파이프라인 사용 자체가 위반) | HeyGen 카탈로그(통합비용 0, 1순위) / Epidemic / Artlist | 10-reverify/license-recheck.md |
| **SFX** | **레포 번들 금지** — hyperframes SFX 21은 Pixabay standalone 재배포 금지(CREDITS.md의 '재배포 허용' 문구는 원문에 없는 자체 작문으로 판명). 대신 **hyperframes npm 패키지 의존으로 node_modules에서 참조**(우리가 재배포하지 않음) + 렌더된 영상 내 사용은 허용 | freesound lq 프리뷰(키리스 ✓, 라이선스 트랙별 확인) | — | 10-reverify/license-recheck.md |
| **이미지 생성** | **codex-imagegen** (기존 보유 인프라, 추가 키 없음) + image-prompt C12 플레이북 | 폴백 스톡: Openverse(익명 20/min 주의) → Wikimedia Commons → unDraw SVG (전부 키리스 실측 ✓) | FAL nano-banana / gpt-image API | visual-fonts-paid-catalog.md |
| **스톡 비디오** | Wikimedia `filetype:video` + Archive.org 3단 다운로드 (키리스 ✓, NC 라이선스 필터 필수 — L0-9 게이트 연결) | — | Pexels/Pixabay (키 무료 발급 — 키 관리 수용 시 1순위 추천) | visual-fonts-paid-catalog.md |
| **한글 폰트** | **Pretendard Variable**(제목/본문, npm 경로) + **D2Coding**(모노) + Noto Serif KR/SUIT(톤 오버라이드) — 전부 OFL. **조건**: 각 폰트에 OFL 라이선스 파일 동봉 의무 + Pretendard·SUIT는 RFN 선언 있음 → **공식 빌드 woff2 원형만 배포, 자체 서브셋/재변환 시 개명 의무** | Gmarket Sans 등 비OFL 조건부는 다운로드 어댑터로 분리 | — | 10-reverify/license-recheck.md |
| **렌더** | hyperframes 0.7.26 로컬 (Puppeteer+chrome-headless-shell+ffmpeg, 전부 로컬) | — | AWS Lambda (hyperframes lambda — 대량/장영상 시) | 05-hyperframes-base |
| **시각 판정(L2-8)** | fable/opus 세션 워커 (API 키 아닌 구독 경로) | — | — | VERIFICATION-PLAN |

## 금지·주의 판정 (10-reverify/license-recheck.md 재검증 반영)

- **MoneyPrinterTurbo 번들 29곡: 사용 금지** (출처불명 자백 확인).
- **short-video-maker 31곡: 레포 재배포 불가** (YAL 약관이 standalone 배포 명문 금지 — 해당 레포 자체가 위반 상태). 메타 설계만 이식.
- **hyperframes SFX 21: 레포 번들 불가** (Pixabay standalone 재배포 금지) — npm 의존 참조로 우회.
- **archive.org의 동명 아이템 `freepd`(1,025곡): 오염물** (BBC Earth 립 혼입) — 검증된 41곡 미러와 절대 혼동 금지.
- **MusicGen: 전면 금지 확정** (가중치 CC-BY-NC — 생성 행위 자체가 제한, 산출물 커밋도 금지).
- **edge-tts: 고위험 유지** — 무단 API라 생성 음성의 상업권 근거 부재, 403 사태 전력(2024-10·2026-01). 라이브러리는 LGPLv3(pip 의존만, 정정). 음성 파일 레포 커밋 금지, 로컬 폴백 필수 상비.
- Pexels 키리스 200 응답: 비보장 동작 — 기본 채택 금지, 키 발급 경로로만.
- Coqui XTTS-v2: CPML 비상업 + 라이선스 구매처 소멸 — 상업 사용 불가.
- Fish-Speech/F5-TTS 공식: CC-BY-NC — 제외. Kokoro/Zonos: 한국어 미지원 확정.
- edge-tts는 비공식 API — 반드시 로컬 폴백과 짝 운용, `boundary="WordBoundary"` 명시(7.x 기본값 함정).
- MusicGen 가중치 비상업 조항 — 산출물 상업 배포 시 사용 금지 유지.

## 파이프라인 반영 (P0c·L3-2 기준)

```
TTS: edge-tts(기본) ──403/timeout──▶ 로컬 TTS + faster-whisper 정렬 ──▶ 동일 audio_meta.json 포맷 수렴
BGM: manifest(무드 enum+license) ◀── 번들 시드 70곡   SFX: hyperframes 21
폰트: Pretendard+D2Coding .woff2 번들(컴파일러 하드룰 L0-7)
이미지: codex-imagegen ──▶ 폴백 Openverse/Wikimedia (라이선스 L0-9 통과분만)
유료 어댑터: tts/{typecast,elevenlabs,heygen} 슬롯 — 키 감지 시에만 활성+추천 배너, paid-adapter 프로파일로 별도 검증
```
