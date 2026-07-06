  - image|chart|media|table: 텍스트 오버플로 비대상 (바인딩 게이트가 치수 정합만 검사)
  capacity{budgetPx{hangul, latin}, maxLines}:
  해당 슬롯을 하한 폰트로 렌더했을 때의 실측 advance-width 예산(px)과 행 수 상한.
  글자 수는 비례폭 폰트(Pretendard)에서 렌더 폭을 예측하지 못하므로
  수용량 계약의 단위는 글자 수가 아니라 스크립트별(한글/라틴) 측정 폭이다.
  maxGlyphsHint는 사람이 읽는 근사 힌트로만 두고 어떤 게이트에도 쓰지 않는다.
  capacityFloors{archetype: {kind: capacity}}: 템플릿 archetype별·슬롯 kind별 최소 수용량 요약 —
  전 템플릿 단일 최소값은 가장 작은 슬롯 하나가 전체 카피를 과압축시키므로 쓰지 않는다.
  바인딩 전 단계(deck-copy)는 자기 슬라이드의 archetype 추정에 해당하는 하한만
  보수적 기본 예산으로 소비하고, 실제 fit 확정은 plan 단계가 담당한다.
  kind=media는 정지 이미지와 영상을 모두 수용하는 슬롯으로,
  풀슬라이드 영상 템플릿(video-full)의 바인딩 대상이다.
  스키마 원본은 deck-contracts에 두고 deck-layouts와 deck-assembler가 vendored 사본 + diff CI로 공유
- deck-plan.json: 슬라이드↔레이아웃↔슬롯↔콘텐츠 바인딩의 단일 소스.
  slides[].{id, layoutId, slots{slotId: binding}, needsHumanReview?, rejectCount?, releaseBlocked?, truncatedContent?}
  binding: {contentRef, transform?} 객체.
  transform(이미지/미디어 바인딩 전용): {crop{x,y,w,h}?, objectPosition?, overlay{color,opacity}?} —
  plan 단계의 이미지 재조정(크롭 오프셋, 오버레이)이 파일 계약으로 표현되는 자리다 (P5).
  텍스트/차트 바인딩은 transform 없이 contentRef만 갖는다.
  rejectCount: 해당 슬라이드가 거친 copy-reject 왕복 횟수의 최종 기록 (감사 추적용, 0 또는 생략 가능).
  releaseBlocked: 오버플로 해소에 실패한 슬라이드의 릴리스 차단 마커 (생략 시 false).
  title/source 반려 상한 도달, measured-overflow 재왕복 실패 등 해소 불가 종료가 이 필드를 기록하고,
  deck-manifest.json의 releaseBlocked/exportStatus 집계와 P7 익스포트 게이트가 소비한다 —
  releaseBlocked=true 슬라이드가 하나라도 있으면 final 익스포트가 성립하지 않는다.
  contentRef 형식: "copy:{slideId}.{field}" 또는 "asset:{chart|image|motion}:{assetId}".
  배열 필드 arity 규칙: "copy:{slideId}.bullets"는 kind=body 슬롯에 목록(ul)으로 렌더하고,
  수용량 검사는 전체 불릿의 렌더 폭·행 합산 기준으로 한다.
  분할은 불릿 경계에서만 일어나며 원문 순서를 유지해
  뒤쪽 불릿부터 연속 슬라이드로 이월한다 — compose가 임의 판단할 여지를 없애는 결정론 규칙.
  asset:motion의 풀슬라이드 영상은 kind=media 슬롯에만 바인딩한다.
  차트-출처 페어링 규칙: 수치를 포함하는 chart 자산이 바인딩된 슬라이드는
  같은 슬라이드에 kind=source(또는 caption) 슬롯 바인딩이 반드시 존재해야 하며,
  그 내용은 chart-manifest의 sourceRef가 가리키는 claims/source-pack 항목에서
  파생 생성된 sourceLabel을 쓴다 (sourceRef 강제는 아래 chart 자산 필드 계약).
  이 페어를 plan 산출 시 스키마 수준에서 검증하고 미충족이면 plan이 실패 종료한다 —
  compose가 아니라 plan에서 막아 grader hard fail(출처 라인 부재)의 구조적 원인을 제거한다 (P3/P8).
  생산 주체는 deck-assembler의 plan 단계(단독 사용 시 사람이 직접 작성 가능).
  plan은 수용량 검사와 오버플로 해소를 전부 마친 확정 바인딩만 산출하고,
  해소에 실패한 슬라이드는 releaseBlocked=true로 명시 마킹하므로(P7)
  "해소 완료"와 "해소 실패 마킹" 외의 제3 상태(조용한 미해소)가 존재하지 않는다.
  compose 단계와 그 이후 층은 이 바인딩을 소비만 하고 선택하지 않는다 —
  조립 결정론(P7)은 이 계약 수준에서 보장된다
- copy-reject.json: plan 단계가 수용량 초과 슬라이드를 deck-copy로 반려할 때 쓰는 계약.
  rejects[].{slideId, slotId, capacity, measured, attempt, attemptedLayouts[], reason}
  attempt: 슬라이드당 재진입 카운터 (1부터 시작). 카운터는 이 파일 필드로만 영속하며,
  plan/오케스트레이터의 메모리 상태나 계약 밖 재진입 카운터에 의존하는 것을 금지한다 —
  어느 층이 재시작돼도 파일만 보고 루프 위치가 복원돼야 한다.
  종료 조건 (계약 수준):
  - plan은 반려 산출 시 직전 copy-reject.json의 해당 슬라이드 attempt에 +1 한 값을 기록하고,
    attempt > 2인 rejects 항목은 스키마 검증 실패로 정의한다 (상한 2회가 스키마에 박힌다)
  - deck-copy는 재작성 copy.json에 rejectAttempt로 attempt를 에코한다 (위 copy.json 규약)
  - rejectAttempt=2인 재작성분이 다시 수용량을 초과하면 plan은 반려를 산출할 수 없으므로(스키마 위반)
    kind별 터미널 액션으로 종료한다 — body는 강제 연속 슬라이드 분할,
    title/source는 분할·truncate 금지 kind이므로 카피는 그대로 두되 해소 실패로 확정하고
    deck-plan.json 해당 슬라이드에 releaseBlocked=true를 기록한다
    (카피 유지는 해소로 간주되지 않으며, 이 슬라이드는 final 익스포트에서 차단된다 — P7 익스포트 게이트),
    caption은 allowLossyTruncate 슬롯에 한해 truncate + truncatedContent 기록.
    어느 경우든 deck-plan.json 해당 슬라이드에
    needsHumanReview=true와 rejectCount(최종 attempt 값)를 기록하고,
    releaseBlocked 발생분은 deck-manifest.json의 releaseBlocked=true·exportStatus=draft로 집계된다 (P7)
  반려 왕복은 오케스트레이터(L3)가 파일로만 중재한다 (층간 직접 호출 금지 원칙 유지)
- chart-manifest.json / image-manifest.json / motion-manifest.json:
  assets[].{id, path, kind, engine, width, height, tokensRef, altText} (공통 코어)
  chart 자산 추가 필드: caption, sourceRef, sourceLabel, sourceUrl, retrievedAt, dataHash, units, caveat? —
  수치 데이터를 렌더한 차트는 sourceRef·retrievedAt·dataHash가 조건부 필수.
  sourceRef는 자유 문자열이 아니라 claims.json의 claims id 또는 source-pack.json의 소스 id 참조로
  강제하고, sourceLabel은 그 참조 대상에서 파생 생성되는 표시용 값으로 격하한다
  (직접 입력 금지 — 조작 가능한 문자열이 출처 계층을 우회하는 경로를 계약에서 제거).
  claims/source-pack이 없는 단독 사용에서는 sourceRef 생략을 허용하되,
  그 산출물은 P8 신뢰성 게이트를 통과하지 못하는 degrade 등급임을 매니페스트에 명시한다.
  plan의 차트-출처 페어링 검증과 grader 신뢰성 규칙(sourceRef 무결성 검증 포함, P8)이 이 필드를 소비한다
  image 자산 추가 필드: provider, model(생성기 추상화 — 특정 모델명을 계약에 굽지 않는다),
  focalBox, textSafeRegions[], backgroundVariance, ocrFindings[], recommendedCropCandidates[] —
  plan 단계가 텍스트 배치·크롭 재조정(deck-plan binding.transform)을 파일만 보고 결정하는 근거
  motion 자산은 durationMs, fps 필드를 추가로 필수화한다
  (MP4 클립·합성 MP4의 렌더 계약, 프레임 결정론 검증의 기준값)
- image-reject.json: plan 단계가 이미지 재생성을 deck-imagery로 반려할 때 쓰는 계약 —
  copy-reject.json과 대칭 구조.
  rejects[].{slideId, slotId, reason(textSafeMismatch|contrast|ocr|variance), requiredRegions[], attempt}
  attempt 카운터·슬라이드당 상한 2회·파일 영속 규칙은 copy-reject와 동일 (attempt>2는 스키마 위반).
  상한 도달 시 터미널 폴백: 토큰 파생 단색/그라데이션 배경 또는 벡터 패턴으로 대체 바인딩하고
  needsHumanReview=true를 기록한다 — 이미지 수율이 덱 완성을 막지 않는다 (P5)
- slides/*.html: 슬라이드 HTML 산출물 계약 (정본: deck-contracts, 스키마가 아니라 DOM 규약 + 검증 스크립트).
  grader/editor/exporter의 상호 독립은 이 계약이 근거다 —
  셋은 서로의 존재가 아니라 이 규약만 가정한다.
  - 파일 구조: 슬라이드당 자체 완결형 HTML 1파일(slide-NN.html), 외부 참조는 ./assets/ 상대경로만(자산 계약),
    저작 해상도는 deck-constants.json의 canvas 값
  - 필수 루트: <section class="slide" data-slide-id data-layout-id> 1개.
    단독 생산물(비 deck-factory 경로)은 data-layout-id 생략 가능
  - 슬롯 규약: 각 슬롯 컨테이너에 data-slot-id,
    data-slot-kind(title|body|image|chart|caption|media|table|source),
CI 게이트 채택 전에 예산을 문서화한다 (P2와 동일 요구).

### P4. deck-motion — 3b1b 스타일 정지컷/영상

목적.
manim으로 3b1b 스타일 PNG 정지컷과 MP4 클립을 만들고,
hyperframes로 자막/전환/오디오를 얹은 발표용 MP4 또는 하이브리드 덱 자산을 만든다 [5].
포지셔닝: 코어 덱 파이프라인 밖의 옵셔널 플러그인이다 (산출물이 3급 베스트 에포트, 1.2).
motion-manifest가 없어도 파이프라인 전체가 완결되며,
core E2E와 5.2 환경 게이트는 이 리포의 의존성(LaTeX/FFmpeg)을 요구하지 않는다
(doctor motion 프로파일 전용, 5.2).

입출력 계약.
- 입력: 주제 브리프 → scenes.md (manim-composer 산출) + tokens.json (배경 HEX 정합용)
- 출력: PNG 정지컷(manim -s), MP4 클립(manim -qh), 합성 MP4(hyperframes render) + motion-manifest.json

기존 자산 재사용 vs 신규.
- 재사용: manim-composer / manimce-best-practices / manimgl-best-practices 3종 스킬 (이미 설치됨, 재구축 금지).
  hyperframes 스킬 팩과 CLI (Apache 2.0).
- 신규: 두 툴체인을 잇는 글루 — scenes.md → 씬별 렌더 잡 분배(codex-spawn),
  해상도/배경색 정합 규칙(Manim 배경 HEX를 tokens.json과 일치), doctor 스크립트(FFmpeg/LaTeX/Node22/Chrome 점검).

정량 합격기준.
- PoC 게이트 선행: 수식 1컷 PNG → 3슬라이드 hyperframes HTML → 5초 MP4 관통이 로컬(WSL)에서 성공해야 본 빌드 착수 [5]
- 씬 렌더 성공률 95% 이상 (실패분 자동 재시도 1회 포함), 렌더 로그에 LaTeX 오류 0건
- PNG 배경색이 슬라이드 배경 토큰과 HEX 일치 (픽셀 샘플링 검사) — 합성 이음매 방지 [5]
- MP4는 지정 fps/해상도 준수, 프레임 결정론 검증(동일 입력 2회 렌더 해시 비교)
- 산출 컷을 opus가 3b1b 레퍼런스 대비 스타일 판정 4/5 이상 (5.4 프로토콜)

상업 벤치마크: 3Blue1Brown 본편의 컷 구성 밀도.

워커 배정: codex가 manim 씬 코드 대량 생성(동시성은 GPU/OOM 고려해 15가 아닌 4~6으로 제한 [5]),
opus가 씬 계획 검토와 컷 판정, sonnet이 doctor/렌더 스모크 테스트, fable이 PoC 게이트 판단.

테스트 전략: doctor 스크립트를 CI 진입 조건으로, 씬 템플릿 3종 골든 렌더, WSL 환경에서 ManimGL은 옵션 처리(CE 기본).

"의존"은 코드 import가 아니라 파일 계약 소비를 뜻한다.

| 리포 | 담는 것 | 파일 계약상 의존 |
|---|---|---|
| kimsh-1/deck-contracts | 계약 JSON 스키마 + 검증 스크립트 원본 + 문서. 아주 작게 유지 | 없음 (최하단) |
| kimsh-1/deck-tokens | L0 스킬. 토큰 스키마, 프리셋 라이브러리, 대비 검증기 vendored 사본(정본은 deck-contracts) | deck-contracts |
| kimsh-1/deck-layouts | 레이아웃 템플릿 카탈로그 (HTML 조각 + 슬롯 정의) + layout-manifest.json, 오버플로 검사기 | deck-contracts, deck-tokens 산출물 |
| kimsh-1/deck-charts | 차트 스킬. 라우팅 로직 + 엔진별 렌더 스크립트 + 테마 어댑터 | deck-contracts, deck-tokens 산출물 |
| kimsh-1/deck-motion | manim + hyperframes 파이프라인 스킬 (배경 HEX를 토큰과 정합) | deck-contracts, deck-tokens 산출물 |
| kimsh-1/deck-imagery | 이미지 생성 스킬 (프롬프트 컴파일 + 배치 생성 + 구도 필터) | deck-contracts, deck-tokens 산출물 |
| kimsh-1/deck-storyline | 소스 수집·주장 정리·아웃라인 스킬 (source-pack + claims + outline.md, P10) | deck-contracts |
| kimsh-1/deck-copy | 프레젠테이션 카피 스킬 (액션 타이틀 + 서술형 개조식 + 윤문 연계) | deck-contracts, deck-layouts 산출물(capacityFloors 수용량 하한 소비, 부재 시 degrade), deck-storyline 산출물(outline/claims, 부재 시 사용자 직접 입력) |
| kimsh-1/deck-grader | 덱 채점기 CLI (DOM 파서 + 31규칙 + 가중합 리포트, P8) | deck-contracts |
| kimsh-1/deck-assembler | L2 조립기 (plan + 결정론 compose) + 뷰어 + 익스포터 | deck-contracts, 위 전부의 산출물 |
| kimsh-1/deck-editor | 비주얼 마감 에디터 (slides-grab 이식, 장기 구동 서버, P9) | deck-contracts (자산/이미지 계약만) |
| kimsh-1/deck-factory | L3 오케스트레이터 스킬 + E2E 시나리오 + 플러그인 패키징(marketplace.json) | 전부 (산출물 소비) |
