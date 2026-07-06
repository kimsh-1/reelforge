# REPO-BLUEPRINT — video-factory T3 레포 청사진

작성일: 2026-07-07 · 근거: 스타 상위 7개 오픈소스 비디오 레포 **로컬 클론 실측 조사** (파일 목록 + 내용 직접 확인)
클론 위치: `scratchpad/refs/{MoneyPrinterTurbo,OpenMontage,NarratoAI,ShortGPT,revideo,story-flicks,short-video-maker}`

---

## (a) 7개 레포 관례 비교표 (실측)

### A-1. 다국어 문서 체계 — 최우선 질문

| 레포 | ★ | README 언어 | 파일 명명 | 기본 언어 | 전환 링크 관례 | 별도 레포? |
|---|---|---|---|---|---|---|
| MoneyPrinterTurbo | 96k | 3개 (zh/en/ar) | `README.md` + `README-en.md` + `README-ar.md` | **중국어** | 상단 센터 `<h3>简体中文 \| <a href="README-en.md">English</a> \| <a>العربية</a></h3>` — 현재 언어는 plain text, 나머지만 링크 | ❌ |
| OpenMontage | 34k | 2개 (en/zh-CN) | `README.md` + `README_zh-CN.md` (언더스코어+로케일) | **영어** | zh 파일 1행 `[English](./README.md) \| 简体中文` | ❌ |
| NarratoAI | 10k | 2개 (zh/en) | `README.md` + `README-en.md` | **중국어** | `<p align="center">📖 <a href="README-en.md">English</a> \| 简体中文 \| ☁️ 클라우드판 링크</p>` · **주의: README-en.md가 존재하지 않는 `README-ja.md`를 링크(데드링크 실측 확인)** | ❌ |
| ShortGPT | 7.7k | 1개 (en) — `README-Docker.md`는 도커 안내지 언어 아님 | — | 영어 | 없음 (docs.shortgpt.ai Docusaurus 사이트도 영어 단일) | ❌ |
| revideo | 3.9k | 1개 (en) | — | 영어 | 없음 | ❌ |
| story-flicks | 2.4k | 2개 (en/zh) | `README.md` + `README-CN.md` | **영어** | README 1행 `English \| [简体中文](./README-CN.md)` | ❌ |
| short-video-maker | 1.2k | 1개 (en) | — | 영어 | 없음 | ❌ |

**"언어별 별도 레포"를 쓰는 곳: 7개 중 0개.** `docs/i18n` 방식도 0개. 다국어를 하는 4개 레포 전부 **단일 레포 + 루트 README 변형 파일**이다.

부가 실측:
- 번역본 동기화는 느슨함: MPT zh 449행 vs en 448행(거의 동기), OpenMontage en 723 vs zh 672행, NarratoAI zh 172 vs en 131행(영문판이 축약본).
- 기본 언어 = **주 타깃 커뮤니티 언어** (중국계 프로젝트는 zh 기본, 서구권은 en 기본). GitHub 기본 렌더링이 README.md이므로 "첫 화면에 보일 언어"가 곧 기본 언어.

### A-2. 루트 구조 관례

| 레포 | 소스 루트 | config 예시 | docs/ 용도 | 데모 자산 위치 |
|---|---|---|---|---|
| MoneyPrinterTurbo | `app/` + `webui/` + `main.py`/`cli.py` | **`config.example.toml` 루트** (복사→config.toml) | 스크린샷 jpg + Colab 노트북 + voice-list | `docs/*.jpg` 커밋, 데모 영상은 README 내 GitHub user-attachments URL |
| OpenMontage | `lib/` + 파이프라인 디렉토리 다수 + `skills/` `styles/` `schemas/` | `config.yaml` 커밋 + `.env`(키만) | **진짜 문서**: ARCHITECTURE.md, PROVIDERS.md, PR_REVIEW_GUIDE.md, stage-gates/ | `assets/`(logo, showcase.jpg, demo mp4, social_preview.png) + `.github/assets/`(다크/라이트 SVG 배지) |
| NarratoAI | `app/` + `webui/` | **`config.example.toml` 루트** | 스크린샷 png만 | `docs/*.png` |
| ShortGPT | `shortGPT/`(패키지) + `gui/` | 없음(GUI에서 키 입력) | **Docusaurus 문서 사이트 전체** | `assets/`, 데모는 user-attachments URL |
| revideo | `packages/`(lerna 모노레포) | 없음 | 없음(외부 docs 사이트, docs.yml로 배포) | `logo.svg` 루트 |
| story-flicks | `backend/` + `frontend/` | **`backend/.env.example`** | 없음 | `backend/examples/screenshot/`, 데모는 user-attachments URL |
| short-video-maker | `src/` + `static/` | 없음(환경변수 문서화) | 없음 | user-attachments URL |

공통 패턴: ① 데모 **영상**은 커밋하지 않고 GitHub user-attachments URL 임베드(4/7), 스크린샷 **이미지**만 커밋(docs/ 또는 assets/). ② Python 계열은 `config.example.toml`, Node 계열은 `.env.example` 또는 env 문서화. ③ Docker는 다층: MPT `Dockerfile`+`Dockerfile.gpu`+compose 3종(dev/gpu/release), short-video-maker Dockerfile 3종(tiny/normal/cuda).

### A-3. README 내용 구조

| 요소 | 실측 |
|---|---|
| 배지 | shields.io stars/issues/forks/license (MPT·NarratoAI는 `for-the-badge` 스타일), Discord(ShortGPT·revideo), npm 버전(revideo), docs 배지(ShortGPT), Trendshift(MPT), 커스텀 SVG 다크/라이트 `<picture>` 배지(OpenMontage "Repo of the Day") |
| 데모 | 히어로 직후 스크린샷/영상. user-attachments `<video>` 임베드(OpenMontage·story-flicks·ShortGPT) 또는 `docs/*.jpg`(MPT·NarratoAI) |
| 기능표 | MPT `- [x]` 체크리스트가 사실상 표준. OpenMontage는 섹션별 산문+표 |
| 설치 | "Docker(권장) → 로컬 수동" 순서 (MPT·NarratoAI·short-video-maker 공통). Colab 원클릭(MPT 배지, ShortGPT 링크) |
| 뉴스/로드맵 | NarratoAI: `## 最新资讯`(날짜별 릴리스 로그) + `## 未来计划`(로드맵). MPT는 로드맵 없음 |
| 스타 히스토리 | **5/7이 api.star-history.com 차트를 README 최하단에** (MPT·NarratoAI·ShortGPT·OpenMontage(다크/라이트 picture)·) |
| 라이선스/면책 | 라이선스 섹션은 말미 관례. NarratoAI는 `⚠️谨防被骗`(사기 주의) 섹션 별도 |
| 후원 | MPT `特别感谢`(스폰서 로고 테이블, README 최상단), NarratoAI `请作者喝一杯咖啡`+`赞助`, FUNDING.yml(OpenMontage·ShortGPT) |

### A-4. 커뮤니티 파일

| 레포 | LICENSE | CONTRIBUTING | CoC | issue 템플릿 | PR 템플릿 | SECURITY | Actions |
|---|---|---|---|---|---|---|---|
| MoneyPrinterTurbo | MIT | ❌ | ❌ | **YAML form** (bug/feature/config.yml) | ❌ | ✅ | ci.yml(lint+test) + docker-ghcr.yml |
| OpenMontage | **AGPLv3** | ❌ | ❌ | YAML form | ✅ | ❌ | ci.yml · CODEOWNERS·FUNDING·agent 지침 파일 다수(CLAUDE.md/AGENTS.md/CODEX.md…) |
| NarratoAI | MIT | ❌ | ❌ | ❌ | ✅ | ❌ | auto-release-generator + codeReview + discord-release-notification |
| ShortGPT | MIT | ✅(.github/) | ✅(.github/) | YAML form ×3(question 포함) | ✅ | ✅ | changelog 생성 |
| revideo | MIT | ✅(루트) | ✅(루트) | ❌ | ❌ | ✅(루트) | verify(PR CI) + publish(npm) + docs |
| story-flicks | **없음** | ❌ | ❌ | ❌ | ❌ | ❌ | 없음 |
| short-video-maker | MIT | ✅(루트) | ❌ | ❌ | ❌ | ❌ | 없음 |

### A-5. 릴리스/배포

- 태그: MPT `v1.3.1`, ShortGPT `v0.3.0` (semver+v 접두). NarratoAI는 `project_version` 파일 + auto-release-generator 워크플로로 GitHub Release 자동 생성(softprops/action-gh-release) + Discord 알림.
- 도커 이미지: MPT → **ghcr.io/harry0703/moneyprinterturbo:latest** (docker-ghcr.yml로 QEMU 멀티아치 자동 발행, `docker-compose.release.yml`이 이 이미지를 참조). short-video-maker → Docker Hub `gyoridavid/short-video-maker:{latest,latest-tiny,latest-cuda}` 3변형.
- 원클릭 배지: Colab 배지(MPT — `docs/*.ipynb`를 배지로 연결), ShortGPT Colab 링크. Railway/Render/Vercel 배지는 7개 중 0개.

---

## (b) 다국어 결론

**단일 레포 + 루트 README 변형 파일. 이론의 여지 없음.**

1. **별도 레포 방식은 0/7.** 96k★ MoneyPrinterTurbo부터 1.2k★까지 어떤 레포도 언어별 레포를 쪼개지 않는다. `docs/i18n`도 0/7.
2. 표준형: `README.md`(기본 언어) + `README-{lang}.md`(하이픈 소문자 — MPT·NarratoAI·story-flicks 3곳이 이 명명). 언더스코어 로케일(`README_zh-CN.md`)은 OpenMontage 1곳뿐 → 하이픈이 다수파.
3. 전환 링크는 **모든 언어판 최상단 공통 1행**: 현재 언어는 plain text, 나머지는 상대 링크. MPT의 `<h3 align="center">` 형이 가장 보편적 렌더링.
4. 기본 언어 = 주 커뮤니티 언어. 중국 타깃 96k 레포가 중국어를 README.md로 두고도 세계 1위 성장을 했다 — "기본이 영어여야 스타를 받는다"는 통념은 실측과 다르다. 단, 발견성(검색·GitHub About)은 영어 병기가 담당.
5. 경고 사례: NarratoAI `README-en.md`가 존재하지 않는 `README-ja.md`를 링크(데드링크) + 영문판이 국문판 대비 41행 짧은 축약본. → **번역판 3종의 링크·섹션 동기화를 CI로 검사할 가치**가 있다.

**video-factory 결정: 단일 레포. `README.md`(한국어 기본) + `README-en.md` + `README-ja.md`. 3파일 모두 최상단에 동일한 전환 라인.**

---

## (c) video-factory T3 레포 청사진

### C-1. 루트 트리

```
video-factory/
├── README.md                     # 한국어 (기본)
├── README-en.md                  # English
├── README-ja.md                  # 日本語
├── LICENSE                       # Apache-2.0 (본체) — C-5 참조
├── NOTICE                        # Apache-2.0 관례: hyperframes 등 고지
├── THIRD_PARTY_LICENSES.md       # 번들 에셋(폰트·BGM·SFX) 라이선스 목록
├── CONTRIBUTING.md               # 루트 (revideo·short-video-maker 방식)
├── CODE_OF_CONDUCT.md
├── SECURITY.md
├── CHANGELOG.md
├── config.example.toml           # 루트 config 예시 (MPT·NarratoAI 관례)
├── .env.example                  # API 키 전용 (OpenMontage 관례: 키는 env, 동작설정은 config)
├── Dockerfile
├── docker-compose.yml            # 로컬 빌드용
├── docker-compose.release.yml    # ghcr 발행 이미지 참조 (MPT 관례)
├── pyproject.toml / package.json # 스택 확정 후 택1
├── src/  (또는 app/)             # 파이프라인 본체
├── skills/                       # 스킬/워크플로 정의 (OpenMontage 관례)
├── templates/                    # 영상 템플릿·스타일 프리셋
├── assets/                       # logo.png, social_preview.png, showcase.jpg
│   └── demo/                     # 커밋용 스크린샷·gif (영상 mp4는 커밋 금지 → user-attachments)
├── docs/
│   ├── ARCHITECTURE.md           # OpenMontage 방식: docs/는 진짜 문서
│   ├── PROVIDERS.md              # TTS·이미지·영상 프로바이더별 설정
│   ├── CONFIGURATION.md
│   └── images/                   # README에서 참조하는 스크린샷
├── examples/                     # 입력 브리프 → 산출 결과 예시 (스크린샷+설정 파일)
├── tests/
└── .github/
    ├── ISSUE_TEMPLATE/
    │   ├── bug_report.yml        # YAML form (MPT·OpenMontage·ShortGPT 관례)
    │   ├── feature_request.yml
    │   └── config.yml            # blank_issues_disabled + Discussions 링크
    ├── PULL_REQUEST_TEMPLATE.md
    ├── FUNDING.yml
    └── workflows/                # C-6 참조
```

### C-2. README 3종 목차 설계 (3파일 섹션 1:1 동기 — NarratoAI의 축약본 실수 방지)

공통 골격(실측 관례 순서):
```
[센터 히어로] 로고 → h1 → shields.io 배지 줄(stars/license/CI/docker) →
언어 전환 라인: 한국어 | English | 日本語   ← 3파일 모두 동일 위치, 현재 언어만 plain
한 줄 피치 → 데모 영상(user-attachments) → 스크린샷

## ✨ 기능           ← MPT식 `- [x]` 체크리스트
## 🎬 데모            ← 세로 9:16 / 가로 16:9 샘플 표 (MPT 관례)
## 🚀 빠른 시작       ← Docker(권장) → 로컬 순서
## ⚙️ 설정            ← config.example.toml + .env.example 설명, docs/ 링크
## 🧩 아키텍처        ← 다이어그램 1장 + docs/ARCHITECTURE.md 링크
## 🗺 로드맵          ← NarratoAI 未来计划 방식 체크리스트
## 📰 뉴스            ← 날짜별 릴리스 하이라이트 (NarratoAI 방식)
## ❓ FAQ / 트러블슈팅 ← MPT 방식 (ffmpeg 등 실환경 에러 위주)
## 🤝 기여            ← CONTRIBUTING.md 링크
## 📝 라이선스 & 면책  ← Apache-2.0 + 번들 에셋 고지 + 생성 콘텐츠 책임 면책
## ☕ 후원
## Star History       ← 최하단, api.star-history.com 다크/라이트 <picture> (OpenMontage 방식)
```
- `README.md`: 한국어. `README-en.md`: 동일 구조 완역. `README-ja.md`: 동일 구조 완역.
- 전환 라인 형식(MPT 최다 관례): `<h3 align="center">한국어 | <a href="README-en.md">English</a> | <a href="README-ja.md">日本語</a></h3>`

### C-3. 배지·데모 자산 계획

- 배지(shields.io, for-the-badge): GitHub stars · license · CI 상태 · ghcr docker pulls · (성장 후) Trendshift.
- 데모: ① 히어로 mp4 1개 — user-attachments 업로드(커밋 X), ② 9:16/16:9 샘플 2×2 테이블(story-flicks 방식 `<table><video>`), ③ 커밋 자산은 `assets/`의 logo·social_preview·showcase 스틸과 `docs/images/` 스크린샷만.
- 다크/라이트: 로고와 스타 히스토리는 `<picture>` + `prefers-color-scheme`(OpenMontage 실측).

### C-4. Community 파일 목록

`LICENSE`, `NOTICE`, `THIRD_PARTY_LICENSES.md`, `CONTRIBUTING.md`(루트), `CODE_OF_CONDUCT.md`(Contributor Covenant), `SECURITY.md`, `.github/ISSUE_TEMPLATE/{bug_report.yml,feature_request.yml,config.yml}`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/FUNDING.yml`. — 7개 중 이 전부를 갖춘 곳은 없으나(ShortGPT가 최다) 각 항목은 전부 상위 레포 실측 관례의 합집합.

### C-5. LICENSE 권고

**본체 Apache-2.0** + `NOTICE` + `THIRD_PARTY_LICENSES.md` 분리.
- 근거: 우리는 hyperframes(Apache-2.0)에 의존 — Apache-2.0 본체가 의존성과 호환 마찰이 없고 NOTICE 승계 의무를 자연스럽게 이행한다. MIT(5/7 다수파)도 가능하지만 특허 조항·NOTICE 체계가 없어, 의존성 고지+번들 에셋 혼재 상황에선 Apache-2.0이 더 안전.
- **번들 에셋(폰트·BGM·SFX·템플릿 이미지)은 코드 라이선스와 별개** — `THIRD_PARTY_LICENSES.md`에 에셋별 출처·라이선스(OFL, CC0, CC-BY 등)를 표로 명시하고 README 라이선스 섹션에서 "코드는 Apache-2.0, 번들 에셋은 개별 라이선스" 1줄 고지. CC-BY 에셋은 산출물 크레딧 의무까지 명기.
- AGPLv3(OpenMontage)는 SaaS 전개 시 전염 조항으로 채택자 진입장벽 → 기각.
- story-flicks처럼 LICENSE 부재는 법적으로 all-rights-reserved가 되어 2.4k★에서도 감점 요인 — 반면교사.

### C-6. GitHub Actions (gate CI) 계획

| 워크플로 | 트리거 | 내용 (실측 모델) |
|---|---|---|
| `ci.yml` | push/PR | lint + test + **gate 체인**(G-게이트: 렌더 스모크·계약 파일 검증·골든 스냅샷). 모델: MPT/OpenMontage ci.yml + revideo verify.yml(PR 전용 잡 분리) |
| `readme-sync.yml` | PR (README* 변경) | 3개 README의 섹션 헤더 수·상대 링크 유효성 검사 — NarratoAI 데드링크(README-ja) 사고 방지, 우리 고유 추가 |
| `docker-ghcr.yml` | tag `v*` push | QEMU 멀티아치 buildx → `ghcr.io/<owner>/video-factory:latest,vX.Y.Z` (MPT docker-ghcr.yml 그대로 이식) |
| `release.yml` | tag push | softprops/action-gh-release로 자동 릴리스 노트(NarratoAI auto-release-generator 모델), semver `vX.Y.Z` 태그 |

---

### 실측 근거 파일 (대표)
- `refs/MoneyPrinterTurbo/{README.md:11, README-en.md:11, README-ar.md:11}` — 3언어 전환 라인
- `refs/NarratoAI/README-en.md:6` — 존재하지 않는 README-ja.md 링크(데드링크)
- `refs/MoneyPrinterTurbo/.github/workflows/docker-ghcr.yml:20` — `IMAGE_NAME: ghcr.io/harry0703/moneyprinterturbo`
- `refs/OpenMontage/README.md:703-707` — star-history 다크/라이트 `<picture>`
- `refs/short-video-maker/README.md:124-160` — Docker Hub tiny/normal/cuda 3변형
