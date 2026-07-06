# fontagent 해부 보고서 (semoji-ai/fontagent)

> **한줄요약**: 에이전트가 typography 결정을 통째로 외주 줄 수 있는 "폰트 전담 서비스 레이어" — SQLite 카탈로그 + 키워드/코호트/레퍼런스 3중 채점 추천 + 이미지 폰트 식별(글리프 지문) + RRF 하이브리드 결합 + 라이선스·자동화 운영 프로파일 + role 기반 handoff 계약(JSON Schema)까지 한 파이프라인으로 묶은 Python 패키지.

- 분석 시점: 2026-07-07, 마지막 커밋 `01f6a85` (2026-04-24, "Add typography presets")
- 규모: Python ~17,139줄 (service.py 4,383줄이 심장), 클론 위치 `/tmp/claude-1000/.../scratchpad/refs/fontagent`
- 인터페이스: CLI(`fontagent/cli.py`) + MCP stdio 서버(`fontagent/mcp_server.py`) + HTTP API/웹 UI(`fontagent/http_api.py`) 3중

---

## 1. 폰트 선택 엔진 구조

선택 엔진은 단일 함수가 아니라 **4겹의 채점 레이어**가 쌓인 구조다. 전부 `fontagent/service.py`의 `FontAgentService`에 있다.

### 1-1. 기본 recommend — 키워드 매칭 + 품질 랭크 (`service.py:1362` `recommend`)
- task 문자열을 공백 토큰으로 쪼개 폰트의 `tags`/`recommended_for`/`family`/`source_site` 코퍼스와 대조.
  - 정확한 태그/역할 일치: +5, 코퍼스 부분 문자열: +3 (주석에 명시: "exact tag match가 가장 discriminative")
  - `recommended_for`에 "title" 포함: +1, 언어 일치: +2
- 여기에 **운영 품질 점수**를 섞는다: `verification_rank × 3`(설치 검증 완료가 최고) + `download_source_rank × 2`(canonical 소스 우대) + 설치 파일 존재 +1.
- 결과마다 `why` 배열(추천 이유 한국어 문장, 최대 5개)을 붙인다 (`_recommendation_reasons`, `service.py:1427`).

### 1-2. 유스케이스 추천 — 코호트 정책 + 레퍼런스 신호 (`service.py:1467` `recommend_use_case`)
요청을 `medium / surface / role / tones / languages / constraints` 구조체(`UseCaseRequest`, `fontagent/use_cases.py:138`)로 받는다. 이것이 이 레포의 "mood 대응물"이다 — **`mood`라는 필드는 이 레포 어디에도 없고, 톤 축은 전부 `tones`라는 이름**이다.

- `build_use_case_query`(`use_cases.py:167`)가 medium/surface/role을 키워드 사전(`MEDIUM_KEYWORDS`, `SURFACE_KEYWORDS`, `ROLE_KEYWORDS`)으로 펼쳐 1-1의 recommend에 넣을 검색 쿼리를 합성.
- **코호트 분류/정책** (`fontagent/font_cohorts.py`):
  - 폰트를 태그 키워드 가중치로 11개 코호트로 분류 (`classify_font_cohorts`): `neutral_ui_sans`, `neutral_content_sans`, `editorial_serif`, `luxury_serif`, `display_bold`, `display_playful`, `retro_signage`, `handwritten`, `tech_display`, `pixel_game`, `general_purpose`. 한/영 키워드 혼용(예: "명조":5, "간판":5, "손글씨":5).
  - 요청별로 `preferred / acceptable / avoid` 코호트 집합을 규칙으로 산출 (`cohort_policy_for_request`, `font_cohorts.py:200`). 예: `video+thumbnail+title` → preferred={display_bold, display_playful}, avoid={editorial_serif}; tones에 "luxury" 있으면 avoid={display_playful, pixel_game}.
  - fit 등급을 점수화 (`cohort_fit_for_request`): preferred(primary 일치) +14, acceptable +3~5, avoid -6~-10.
- **레퍼런스 신호** (`service.py:1168` `_reference_signal`): 큐레이션된 실사용 레퍼런스(`font_references` 테이블)와 요청의 medium/surface/role/tones 겹침으로 base 점수를 만들고, 그 레퍼런스가 해당 폰트를 지지하면(candidate_font_ids 포함 +8, observed 라벨 매치 +6) 가산. 두 가지 가중이 곱해진다:
  - `REFERENCE_CLASS_WEIGHTS` (`service.py:114`): specimen 0.7 < channel 1.15 < market 1.2 < campaign 1.35 — "실제 캠페인에서 쓰인 증거"가 견본집보다 무겁다.
  - `SURFACE_REFERENCE_COMPATIBILITY` (`service.py:121`): surface 간 전이 행렬. 예: scene_overlay 요청에 cover 레퍼런스는 0.7, thumbnail 레퍼런스는 0.0(차단).
  - 최종적으로 코호트 fit에 따라 레퍼런스 점수에 승수(preferred 1.0 / acceptable 0.35 / neutral 0.2 / avoid 0.15)를 곱해 합산 (`service.py:1539-1555`) — "레퍼런스가 지지해도 코호트가 어긋나면 못 뒤집는다".

### 1-3. 역할(role)별 폰트 시스템 선발 (`service.py:2567` `_select_role_fonts`)
title/subtitle/body 3역할 각각 별도 쿼리(역할별 suffix, `service.py:2523`)로 후보 20개씩 뽑고, `_role_fit_score`(`service.py:971`, 역할별 토큰 가/감점 — 예: subtitle 후보에 "손글씨"/"pixel" 태그면 -3)와 코호트 fit으로 정렬. **역할 간 중복 금지**(used_ids 집합)로 3역할이 서로 다른 폰트를 갖게 강제.

### 1-4. 하이브리드 결합 — identify × recommend RRF (`service.py:4189` `_hybrid_rank_fonts`)
포스터 합성(`compose_text_layers`)에서 시각 채널(글리프 지문 매칭)과 내용 채널(키워드 추천)을 **Reciprocal Rank Fusion(rrf_k=60)** 으로 합친다. 점수 스케일이 다른 두 채널을 정규화 없이 랭크로만 결합. 독창 포인트:
- identify 신뢰도(top1-top2 분리도)에 따라 identify 가중을 최대 1.3×까지만 올림 — "confidence는 랭킹의 결단력이지 세계관의 정확성이 아니다"라는 주석.
- style_hints에 handwriting/brush/script 등 **시각적으로 깨지기 쉬운 카테고리**가 있으면 가중을 역전(identify 0.2, recommend 1.6) — 손글씨는 검출기가 획을 부수므로 내용 채널을 신뢰.
- style_hints와 폰트 태그 겹침으로 사후 보정(겹치면 ×(1+0.15×overlap), 안 겹치면 ×0.7).
- 레이어별 `confidence ∈ [0,1]` + `confidence_tier(high/medium/low/none)` 산출 (`service.py:3812` `_attach_layer_confidence`): 두 채널 합의 시 평균+0.15 보너스, 단일 채널이면 ×0.7 패널티.

### 1-5. 프리셋 오버라이드 (`fontagent/typography_presets.py`, `service.py:475` `apply_preset_to_region`)
자주 쓰는 title/subtitle/body 조합을 `typography_presets` 테이블에 저장(시드 5종: `editorial-serif-ko`, `modern-ui-ko`, `bilingual-neutral`, `traditional-ko`, `brand-developer-ko`). 프리셋 지정 시 역할별 승자를 고정하되, 라이선스 제약 실패 시 `fallback_font_ids` 순차 시도 → 그래도 실패하면 hybrid 결과로 복귀. 프리셋 추천 자체도 채점(tones 겹침 ×3, 언어 ×2, medium/surface +2, confidence×2 — `service.py:353`).

---

## 2. 폰트 DB 스키마

SQLite 단일 파일, 경로는 **`<root>/fontagent.db`** (`service.py:157`). 스키마는 `fontagent/db.py`, ORM 없이 raw SQL + dataclass(`fontagent/models.py`). 5개 테이블:

### `fonts` (db.py:8) — 폰트당 메타데이터
| 축 | 컬럼 |
|---|---|
| 식별 | `font_id`(PK), `family`, `slug` |
| 출처 | `source_site`, `source_page_url`, `homepage_url` |
| **라이선스** | `license_id`, `license_summary`(자유 텍스트), `commercial_use_allowed`, `video_use_allowed`, `web_embedding_allowed`, `redistribution_allowed` (4개 boolean 플래그) |
| 분류 | `languages_json`, `tags_json`(무드/스타일 태그), `recommended_for_json`(역할 태그: title/subtitle/body/ui 등) |
| 미리보기 | `preview_text_ko`, `preview_text_en` |
| 다운로드 | `download_type`(direct_file/zip_file/html_button/manual_only), `download_url`, `download_source`(canonical/preview_webfont), `format`, `variable_font` |
| **설치 검증** | `verification_status`, `verified_at`, `installed_file_count`, `verification_failure_reason` |

주목: **가독성 점수 같은 수치 컬럼은 없다.** 가독성/무드는 전부 `tags`/`recommended_for` 태그 문자열로 표현되고 채점 시 키워드 매칭으로 환원된다. 대신 라이선스 4-플래그와 설치 검증 4-컬럼이 1급 시민이다.

### 나머지 테이블
- `font_candidates` (db.py:37): 수집 파이프라인의 인입 큐. `normalized_url` UNIQUE, `status`(discovered→official_candidate→imported 등), `discovery_source`(web_search/manual_curated).
- `font_references` (db.py:51): 실사용 레퍼런스. `medium/surface/role/reference_class/tones/languages/text_blocks/candidate_font_ids/observed_font_labels/palette/ratio_hint/extraction_method/extraction_confidence/status/reference_scope`.
- `font_reference_reviews` (db.py:76): 레퍼런스에 대한 리뷰어(사람/모델) 판정 기록 — `reviewer_kind`, `model_name`, `cohort_tags_json`, `confidence`.
- `typography_presets` (db.py:94): 폰트 조합 레시피. `role_assignments_json`(role→{font_id, fallback_font_ids, pairing_reason}), `source`(curated/manual/learned_from_compose), `confidence`, `verified`.

마이그레이션은 `PRAGMA table_info` 기반 ALTER TABLE 사전(`db.py:113` MIGRATIONS) — 컬럼 없으면 추가하는 단순 방식.

시드는 `fontagent/seed/fonts.json` 5종(pretendard, suit, maruburi, noto-sans-kr, gowun-batang)뿐이고, 실제 카탈로그는 아래 4절의 importer로 불린다.

---

## 3. 외부 파이프라인 통합 계약 (auto_kairos 소비 방식)

### 3-1. 이 레포에서 확인된 사실
- **`mood`·`kairos` 키워드는 코드에 전혀 없다.** 유일한 언급은 `PRODUCT_DIRECTION.md:82`에서 협업 대상 에이전트 목록으로 "Auto Kairos"를 든 것뿐 (ChartAgent/SlideAgent/ImageGenAgent와 나란히).
- 따라서 auto_kairos의 `get_project_fonts(mood=...)`는 이 레포가 제공하는 API가 아니라 **auto_kairos 쪽에서 `fontagent.db` SQLite를 직접 읽는(또는 CLI/MCP를 부르는) 소비자 코드**다. mood→폰트 매핑 로직 자체는 이 레포에 없고, 이 레포의 대응 개념은 `tones`(tags 매칭)다.

### 3-2. 이 레포가 공식적으로 제공하는 통합 계약 4종
1. **font-system 파일 3종 세트** (`prepare_font_system`, `service.py:2681` + `fontagent/font_system.py`): 프로젝트 경로에 폰트를 설치한 뒤,
   - `fontagent/font-system.json` — role→{font_id, family, asset_path, generic_family, defaults(weight/line_height/tracking_em)} 매니페스트
   - `fontagent/fonts.css` — `@font-face` + `--font-title` 등 CSS 커스텀 프로퍼티 토큰 (`font_system.py:116`)
   - `fontagent/remotion-font-system.ts` — `export const fontSystem = {...} as const` (`font_system.py:146`)
   - role별 기본값이 하드코딩: title{weight:700, lh:1.1, tracking:-0.02em}, subtitle{600, 1.35}, body{400, 1.6} (`font_system.py:41`).
   - 파일 선택 휴리스틱: role별 확장자·굵기 선호 순위(title은 black→extrabold→bold 순, body는 regular 우선)로 설치 파일 중 하나를 고름 (`pick_preferred_file`, `font_system.py:89`).
2. **`typography-handoff.v1` JSON Schema 계약** (`generate_typography_handoff`, `service.py:2772`; 스키마 `fontagent/schemas/typography-handoff.v1.schema.json`): font_system에 더해 `hints`(type_scale/contrast/ratio), `guidance`(한국어 지침 문장), `license_notes`, 그리고 `design_agent_handoff.collaboration_boundary` — "FontAgent가 소유: 폰트 추천·라이선스·역할·defaults / 디자인 에이전트가 소유: 레이아웃·컬러·그리드·최종 위계"를 계약 안에 명문화.
3. **`fontagent.text-layer-handoff.v1`** (`compose_text_layers`, `service.py:3679`): 멀티모달 에이전트가 OCR로 region(bbox/text/role/style_hints/language)을 넘기면, region→폰트 배정 + confidence + 설치 경로 + CSS/Remotion export를 한 호출로 반환. FontAgent는 OCR을 직접 하지 않는다는 경계가 README에 명시.
4. **MCP stdio 서버** (`fontagent/mcp_server.py`, protocol 2025-06-18): 도구 28종 — `search_fonts`, `recommend_fonts`, `recommend_use_case`, `guided_interview_recommend`, `install_font`, `prepare_font_system`, `generate_typography_handoff`, `compose_text_layers`, `build_glyph_index`, `identify_font_in_image`, 프리셋 CRUD 5종, `get_catalog_status`, `get_license_policy_catalog`, `get_contract_schema`, `bootstrap_project_integration` 등.

### 3-3. 프로젝트 부트스트랩 — 통합 자동 배선 (`fontagent/project_bootstrap.py`)
`bootstrap_project_integration`이 소비자 프로젝트에 **에이전트용 시스템 프롬프트 + Codex 스킬(SKILL.md) + MCP 설정 예시**를 생성해 준다. 프롬프트에 워크플로우가 박혀 있다: "① get_catalog_status → ② 브리프 모호하면 guided_interview_recommend → ③ 구조화됐으면 recommend_use_case → ④ `license_profile.status=allowed` + `automation_profile.status=ready` 후보 우선 → ⑤ prepare_font_system → ⑥ 후속 에이전트 있으면 generate_typography_handoff" (`project_bootstrap.py:12-36`). `examples/mcp_configs/`에 claude_desktop/codex/vscode용 설정, `.codex/skills/fontagent-specialist/`에 자체 스킬 동봉.

---

## 4. 폰트 수집/등록 워크플로우

전체 흐름: **discover(후보 URL 수집) → import(소스별 파서로 fonts 테이블 upsert) → resolve(다운로드 링크 자동 해석) → install/verify(설치 검증) → license reconcile**. 사용자 문서와 분리된 "운영자 영역"으로 명시(`NETWORK_RUNBOOK.md`).

- **발견 2경로** — ① 웹 검색 (`fontagent/discovery.py`): 테마별 한국어 검색 쿼리 세트(`DISCOVERY_QUERY_SETS`: default/display-ko/editorial-ko/playful-ko)로 후보 URL을 `font_candidates` 큐에 적재. ② 수동 큐레이션 시드 (`fontagent/curated_candidates.py`): 빙그레/배민/G마켓 등 공식 배포처 목록을 `manual_curated`+`official_candidate` 상태로 주입.
- **소스별 importer 15종** (`fontagent/official_sources.py` 1,565줄 + `fontagent/noonnu.py`): naver_hangeul, hancom, goodchoice, cafe24, jeju, google_display, league, velvetyne, fontshare(API), gmarket, nexon, woowahan, fonco, gongu(공공누리), noonnu. 각각 HTML/CSS/JSON 파서가 family·라이선스 플래그·다운로드 URL을 추출해 `upsert_many`(font_id 충돌 시 UPDATE)로 등록. noonnu는 테스트 픽스처(`tests/fixtures/noonnu/`)까지 있는 HTML 파싱.
- **다운로드 자동 해석기** (`fontagent/resolver.py:443` `resolve_download`): `html_button` 타입이면 외부 페이지를 최대 2단계까지 따라가며 direct/zip 링크를 추출(`window.open`/`<a href>`/CSS url()/JSON path 패턴 + GitHub releases 특수 처리), 확장자 없는 엔드포인트는 실제 GET probe로 Content-Type/Content-Disposition 판별(`_probe_download_candidate`). 실패 시 웹폰트 미리보기 CSS에서 woff라도 건진다(`_resolve_webfont_preview`).
- **브라우저 에스컬레이션** (`resolver.py:586` `write_browser_download_task`): 자동 해석 불가 페이지는 `{font_id}.browser-download-task.json`을 생성 — accept_domains, 클릭 지시(instructions), success_criteria가 든 **브라우저 가능 워커용 작업 명세서**. 알려진 난공불락 페이지(cafe24, jeju)는 `KNOWN_BROWSER_PAGE_TASKS`에 페이지별 힌트 하드코딩. 실제 산출물 예시가 `examples/browser_tasks/`에 있음.
- **설치 검증 영속화**: `verify_installations`/`install`이 결과를 fonts 테이블의 `verification_status`/`installed_file_count`에 기록하고, 이것이 그대로 추천 채점(1-1의 quality rank)에 되먹임된다.
- **레퍼런스 학습 트랙** (별도, `REFERENCE_LEARNING_PLAN.md` + `reference_web/image/vision/intelligence.py` + `reference_packs.py` + `obsidian_export.py`): 실사용 사례를 Playwright DOM/OCR/비전 추론으로 추출해 `font_references`에 적재하고 Obsidian vault(`fontagent_vault/`)로 내보내는 계획. 비전 추론은 특정 공급자에 안 묶고 Codex/Claude 등 vision-capable 에이전트에 위임하는 설계.

---

## 5. 훔칠 만한 독창 기능 Top 3

### ① 라이선스·자동화 "운영 프로파일"을 모든 추천 결과에 부착 (`service.py:634` `_license_profile`, `service.py:887` `_automation_profile`)
단순 boolean이 아니라 판정 근거를 구조화한다: `status`(allowed/caution/blocked/unknown) + `confidence` + `basis[]`(판정 근거 코드) + `gaps[]`(확인 안 된 항목) + **`recommended_action`**(proceed / proceed_with_license_note / review_license_page / do_not_use). 소스 신뢰도 레지스트리(`fontagent/license_policy.py` — 소스별 trust_level/review_level)와 license_summary 텍스트의 명시적 허용/금지 정규식을 교차 검증하고, 구조화 플래그와 텍스트가 모순되면 `commercial_use_structured_flag_needs_review` gap을 낸다. **영상 스킬에 이식할 가치**: BGM/폰트/이미지 등 모든 에셋에 "쓸 수 있는가"가 아니라 "어떤 조건으로 쓸 수 있고 뭘 더 확인해야 하는가"를 기계가 읽는 형태로 붙이는 패턴. automation_profile(ready/assisted/manual/blocked)은 "자동 파이프라인에 태울 수 있는 에셋인가"를 채점에 직접 반영한다.

### ② 시각 채널 × 의미 채널의 RRF 결합 + 신뢰도 철학 (`service.py:4189`)
스케일이 다른 두 채점기를 정규화 없이 랭크 융합(RRF)하고, (a) 신뢰도 가중 상한 1.3× ("확신에 찬 오답이 정답을 익사시키지 못하게"), (b) 취약 카테고리(손글씨)에서 가중 자동 역전, (c) 두 채널 합의 시 confidence 보너스 / 단일 채널 시 패널티 → high/medium/low tier로 다운스트림에 전달. **이식 가치**: 영상 스킬에서 "비전 모델이 본 것"과 "메타데이터가 말하는 것"(장면 분위기 판정, 컷 선택, 썸네일 채점 등)을 합칠 때 그대로 쓸 수 있는 결합 설계도.

### ③ 코호트 정책(preferred/acceptable/avoid) + 레퍼런스 클래스 가중 (`fontagent/font_cohorts.py`, `service.py:114`)
mood→폰트를 일대일 매핑 테이블로 박지 않고, ① 폰트를 11개 유형군으로 분류 → ② 요청(medium×surface×role×tones)별로 유형군 3분류 정책을 규칙 합성 → ③ 실사용 레퍼런스 증거를 클래스별 가중(캠페인 1.35 > 마켓 1.2 > 견본 0.7)과 surface 전이 행렬로 할인해 얹는 3층 구조. 태그가 늘어도 정책 규칙만 고치면 되고, "증거가 있어도 유형군이 어긋나면 못 뒤집는" 안전핀(avoid 시 레퍼런스 점수 ×0.15)이 있다. **이식 가치**: mood별 BGM/폰트/컬러 선택을 설계할 때 "mood→에셋 직결 사전" 대신 이 3층(유형군 분류 / 컨텍스트별 허용 정책 / 증거 가중)으로 짜면 세세한 설정 가능성과 자동 추천이 공존한다.

**차점 후보(기록용)**: ④ 자동화 실패를 사람/브라우저-워커 작업 명세 JSON으로 강등하는 에스컬레이션 계약(`resolver.py:586`) — "실패"가 아니라 "다음 워커의 입력"이 되는 설계. ⑤ handoff 계약에 에이전트 간 소유권 경계(`collaboration_boundary`)를 데이터로 명문화(`service.py:2854`) — 멀티 에이전트 파이프라인에서 역할 침범을 스키마 수준에서 막는다.

---

## 부록: 파일 지도 (핵심만)

| 파일 | 역할 |
|---|---|
| `fontagent/service.py` (4,383줄) | 모든 비즈니스 로직 — 추천/채점/설치/handoff/compose |
| `fontagent/db.py`, `repository.py`, `models.py` | SQLite 스키마·마이그레이션·raw SQL 저장소·dataclass |
| `fontagent/use_cases.py`, `font_cohorts.py` | 유스케이스 프리셋 10종·코호트 11종 분류/정책 |
| `fontagent/resolver.py`, `installer.py` | 다운로드 링크 다단계 자동 해석·설치 |
| `fontagent/official_sources.py`, `noonnu.py`, `discovery.py`, `curated_candidates.py` | 수집: importer 15종·웹검색·수동 큐레이션 |
| `fontagent/license_policy.py` | 소스별 신뢰도 레지스트리 |
| `fontagent/font_identify/` | 글리프 지문(픽셀+HOG+잉크밀도+획폭 히스토그램, 코사인 유사도) 이미지→폰트 식별 |
| `fontagent/font_system.py`, `template_bundle.py` | CSS/Remotion/manifest export |
| `fontagent/typography_presets.py` | 폰트 조합 프리셋 시드 5종 |
| `fontagent/mcp_server.py`, `http_api.py`, `cli.py` | 3중 인터페이스 |
| `fontagent/project_bootstrap.py` | 소비자 프로젝트에 프롬프트/스킬/MCP 설정 자동 생성 |
| `fontagent/reference_*.py`, `fontagent_vault/` | 레퍼런스 학습 트랙 + Obsidian export |
| `fontagent/schemas/typography-handoff.v1.schema.json` | handoff 계약 JSON Schema |
