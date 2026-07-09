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
| v10R (7차) | 3.8 | **4.0 합격** | 3.6 | R15 반영. d2 첫 합격 |
| v10F (8차) | 3.9 | 4.0 유지 | 3.9 | R16 반영(죽은 #root CSS 부활·순위 게이지·제로 액센트·완결문 카피) |
| v10G (9차) | **4.0 합격** | 4.0 | **4.0 합격** | R17 반영(진행 캡션·s09 배경 이미지). **3종 전부 상용 합격선 도달 — 데모 품질 루프 종결, P6 마감** |

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
- P6 마감(release·히어로·태그) → LOOP-PROTOCOL 본 루프(전수조사 → showcase 5종)
- 4.0 도달 데모부터 P6 마감(release mp4·히어로 GIF·v0.1.0)
- 이후 LOOP-PROTOCOL 본 루프(전수조사 → showcase 5종 → 판정 → 학습 반영)

## ⏸ 정지 지점 (2026-07-09, 사용자 지시로 중단)

**완료**: 데모 3종 4.0 합격·v0.1.0 릴리스(소리 있는 v11로 자산 교체 완료), R19 임팩트 수술 커밋(aa4f392), 불변식 게이트 PSNR 방법론 수정(l2-2 PASS·PSNR 83dB), 스튜디오 resolveSchema allOf 버그 수정(u2 PASS), 골든 DOM 재생성(l1-1 PASS), p0d·l2-full-comp PASS, BGM 실배선+빈자막 제거+오디오 게이트(66f458f).

**재개 시 여기부터**:
1. 잔여 게이트 4종 실패 — 청정 재실행에도 실패했으므로 실결함: l2-8-anchors·l2-dense-visual(full-8types 렌더가 --workers=1로 행/초저속 — 타임아웃·워커 설정 검토), p0a·p0c(PoC 렌더 mp4 0바이트 — poc 스크립트의 렌더 인자/환경 확인. p0d는 venv 재구축으로 PASS했음).
2. v12 렌더 3종(R19 임팩트 반영) → 1fps 스트립 동봉 opus 재심("연속 재생" 기준) → 현행본·릴리스 교체.
3. LOOP-PROTOCOL 2단계: showcase 5종 생산(/mnt/d/reelforge-output/showcase/loop1/).
4. 사용자 실관람 피드백 반영 항목: "정적 슬라이드쇼" — R19가 1차 수술, v12 스트립으로 재검.

**주의**: 렌더 게이트는 반드시 1개씩(경합 시 크래시), 게이트 체인 후 chrome-headless 좀비 정리. C드라이브 회수는 사용자가 fstrim+diskpart 실행 대기(vhdx 66.9GB→~37GB 예상, 경로 C:\WSL\Ubuntu-24.04\ext4.vhdx).
