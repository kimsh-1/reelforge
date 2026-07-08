# LOOP-STATE — 품질 루프 진행 기록

## 데모 3종 판정 이력 (5축 평균, 합격선 4.0)
| 라운드 | d1-usage | d2-engine | d3-intro | 비고 |
|---|---|---|---|---|
| v5 (1차) | 2.7 | 3.4 | 2.9 | 첫 3심 |
| v6 (2차) | — | — | — | 카피 미반영 사고로 무효(세대 정합 게이트 신설) |
| v7 (3차) | 2.9 (d1만) | — | — | R8 반영판. QC는 truncation으로 4/6 FAIL만 노출 |
| v8 (4차) | 3.4 | 3.7 | 3.5 | R9~R11 반영, QC 35/35 첫 전판 통과 |
| v9 (5차) | 3.5 | 3.74 | 3.3 | R12 반영. 공통 뿌리 발견: 씬 진입 리빌 지연이 고정시각 샘플에 '빈 유리판'으로 찍힘 |
| v10 (6차) | 3.6 | 3.4 | 3.0 | R13·R14 반영. 진입·반복·대비 해소됐으나 statistic 전체렌더 변수 미주입(치명)·한글 클리핑 신규 발견 |
| v10R (7차) | 진행 | 진행 | 진행 | R15 반영: statistic 루트 오바인딩 근본수정(전체=단독 일치 실증), 한글 line-height, quote 각주 중복 |

## 수술 이력
- R9: compare/bar/list 리빙 모션 동결 해소(상시 CSS 루프) — fe07fea
- R10: line 라벨 클리핑·compare 본문·statistic 카운트업/unit·numbered 에코 — 277a491 (검증을 d1만 수행한 결함 → R12 교훈)
- R11: quote 상시 리빙 루프 + QC truncation(head -4) 수정 — 616dd72
- R12: 4차 지적 6클러스터(compare 본문·다크 저대비·line nice ticks·보조 패널·unit 문맥·numbered 시맨틱) + compare 출처 각주 단일화 — bcf3ef0 (워커 타임아웃, 오케스트레이터 직접 검증 마감)
- R13: 진입 압축(0.4s 구조 완성·1.0s 카운트업 완주) + compare repeatIndex 스택 변형 + statistic 겹침·quote 패널 일관·line 라벨 오프셋·bar/numbered 정리 — 51fa576 (t=0.4s 프레임 실측 검증)
- 스펙: d3 s09 프리셋 수 정합(19)·s07 몽타주 대구 카피
- R14: statistic/numbered 상시 리빙 루프+다크씬용 글로우 드리프트(QC 픽셀 문턱 diff≥4 대응) — 89c8fc2
- R15: statistic 루트 오바인딩(R13의 [data-hf-inner-root] 광역 선택자가 문서 첫 'root' 저작 블록에 바인딩→크래시) 근본수정, 한글 상단 클리핑(line-height<1+overflow), quote 각주 자기중복 — 975d07c. 교훈: 전체 렌더 전용 버그는 단독 렌더 검증으로 못 잡음 → 대조 프레임 필수

## 다음
- v10 렌더/QC → opus 3심 6차
- 4.0 도달 데모부터 P6 마감(release mp4·히어로 GIF·v0.1.0)
- 이후 LOOP-PROTOCOL 본 루프(전수조사 → showcase 5종 → 판정 → 학습 반영)
