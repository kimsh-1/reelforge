# FEATURE-MATRIX v1.2 무결성 점검 보고

- 점검일: 2026-07-07 · 대상: `/mnt/d/video-skill-research/07-features/FEATURE-MATRIX.md` (v1.2, T1 반영)
- 방식: 전수 기계 파싱(파이썬, seed=20260707) + 표본 40클러스터 내용 대조. codex 산출물 불신 전제로 원 레포 24개 .md와 직접 대조.
- 파싱 결과: 380행 전수 파싱 성공(도메인 12종), 셀 수 7 아닌 행 0.

## 종합 판정: **PASS (치명 결함 0, 경미 1)**

---

## 1. 출처 실존 검사 — 날조율 **0%**

- **전수 실존 검사**(표본보다 강한 검사로 확대): 380클러스터의 출처 참조 **1,863건 전부** 파싱 성공, 이 중 repo 참조 1,854건은 `07-features/<repo>.md` 원행에 **100% 실존**. 누락/오타 ID **0건**. audit 참조 9건(RESOLUTION-D4/D5/D6, codex-feature-gaps-5/6/9)도 08-audit 문서에 실존.
- **내용 부합 표본 40클러스터**(도메인별 최소 2개 + 랜덤, 클러스터당 원행 1-2건 = 73건 원문 대조):
  - 부합 71/73 (97.3%)
  - **날조(존재하지 않는 근거) 0건 (0%)**
  - 경미 오귀속 1건: `html-video:HV-046`("frame별 나레이션 초안" = 생성 기능) → `audio-tts-C05`("TTS 원문 정규화·의미 보존" = 전처리 계층). 생성과 전처리는 다른 층위 — 클러스터 설명과 층위 불일치.
  - 약한 부합 1건(결함 아님): `Director:DIR-033` → `scene-schema-C01`. 원 레포 채택제안 자체가 "P0 씬 매니페스트"라 귀속은 방어 가능하나, 원행은 씬 분해+duration 강제라 "JSON 진실원 계약"과는 간접 연결.
- 참고: ArcReel.md 원행 일부가 중국어(ARC-001, ARC-006, ARC-050 등)이나 내용은 클러스터 설명과 정확히 부합 — 결함 아님, 원 파일 언어 불통일 기록만 남김.

## 2. 전수 정합

| 항목 | 결과 |
|---|---|
| (a) Phase 열 존재 | **380/380 전 행 존재**, 누락 0 |
| (b) 채택=P0 행 수 | **29 = 상단 통계 29 일치**. Phase 전부 P0-PoC 계열(P0-PoC 28 + P0-PoC/P5 1). 단 quality-gates-C35의 `P0-PoC/P5`는 RESOLUTION D5("P0 fixture+P5 회귀 양쪽 연결")의 의도적 표기 — 결함 아님 |
| (c) gaps 25 CID 대조 | **빠짐 0건**. 추가분 4건 = quality-gates-C35, rendering-C34, rendering-C35, scene-schema-C45 — 전부 RESOLUTION D4/D5/D6이 신설을 지시한 CID(25+4=29). **불법 추가 없음** |
| (d) 신규 CID 4종 | 전부 실재: scene-schema-C45(씬 렌더 어드레싱, L57), rendering-C34(렌더 함정 4종 lint, L105), rendering-C35(MP4 최소 프로필, L106), quality-gates-C35(KO text physical gate, L425). 채택/Phase 전부 P0 정상 |

gaps #2가 금지한 "채택=P0 & Phase=P1~P6" 조합: **0건**.

## 3. consumer 강등 (RESOLUTION D3) — **정상**

D3의 부분 재렌더 중복 10 CID 중 canonical 소유자 scene-schema-C14를 제외한 **9개 전부**에 `→ scene-schema-C14 consumer` 표기 + "프리뷰 등급(전환·BGM 없음), 확정은 전체 렌더" 명시 확인:
rendering-C09 · subtitles-C14 · audio-tts-C10 · assets-images-C08 · config-tokens-C05 · editing-ui-C03 · pipeline-C01 · quality-gates-C08 · misc-C05.
소유자 scene-schema-C14 본행에도 "canonical 부분프리뷰" + 프리뷰 등급 명시 존재. (editing-ui-C03은 P0이면서 consumer — gaps 25 목록에 포함된 CID라 정합.)

## 4. HOLD 전환 2건 — **실재**

- `export-integration-C06` (L480): data-hv-text/content-graph 기반 Restyle → `HOLD RESOLUTION A3 폐기`
- `misc-C03` (L505): data-hv-text/content-graph 이식 → `HOLD RESOLUTION A3 폐기`
둘 다 RESOLUTION A3(전제 불성립) 사유 명기. D9의 feature-gaps #10 기각 결정과도 일치(P0 재승격 흔적 없음).

## 5. 상단 통계 재집계 — **완전 일치**

| 구분 | 헤더 주장 | 실측 |
|---|---:|---:|
| P0 | 29 | **29** |
| P1 | 252 | **252** |
| P2 | 77 | **77** |
| HOLD | 22 | **22** |
| 합계 | 380 | **380** |

## 발견 결함 목록

| # | 심각도 | 위치 | 결함 | 수정안 |
|---|---|---|---|---|
| 1 | 경미 | audio-tts-C05 출처 칼럼 | `html-video:HV-046`(나레이션 초안 **생성**)이 "TTS 원문 정규화·의미 보존(**전처리**)" 클러스터에 귀속 — 층위 불일치 | HV-046을 audio-tts-C05에서 제거하고 나레이션 생성 계열 클러스터(예: llm-prompting 도메인 스크립트 생성 CID)로 재배정, 또는 C05 설명에 "생성 시 언어 유지 조건 포함" 1구 추가로 범위 명시 |
| 2 | 정보 | ArcReel.md 원 파일 | 원 추출행 다수가 중국어 — 매트릭스 자체 결함은 아니나 후속 감사 시 대조 비용 증가 | 원 파일 한국어 재기술은 선택 사항, 매트릭스 수정 불요 |

표본 외 340클러스터의 내용 부합은 미검(실존은 전수 확인됨). 표본 오귀속률 1/40(2.5%, 경미 1)로 외삽 시 전량 재검 불요 판단.
