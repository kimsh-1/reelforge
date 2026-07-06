# 프로젝트 목표와 제약 — 새 독립 영상 스킬

작성: 2026-07-07. 다음 턴 기능구현 토론 에이전트들이 가장 먼저 읽을 문서.

## 목표

auto_kairos(semoji-ai)의 개념을 참고해 **"세세하게 설정 가능한 영상 생성 스킬"**을 독립 레포로 만든다.

핵심 요구 3가지 (사용자 지시 원문 기준):
1. **세세하게 설정 가능** — 전역(해상도·fps·아트스타일·보이스·BGM·자막 스타일)부터 씬 단위(duration·전환·연출·오버라이드)까지 계층적 설정 표면.
2. **디테일하게 설정 가능** — auto_kairos 수준의 디자인 토큰(자막 16필드, 무드별 색/속도, 폰트 토큰)을 계약 파일로 노출.
3. **띄워서 수정 가능한 기능** — 산출물을 브라우저에 띄워 씬 단위로 수정 → 부분 재생성/재렌더하는 편집 루프.

## 확정된 방향

- **새 독립 레포**로 판다 (deck-factory 안에서 확장하지 않음). deck-factory PLAN.md의 스킬별 독립 레포 구조(kimsh-1/deck-motion 슬롯)와 정합.
- **렌더 베이스 = hyperframes** (Remotion 아님). 사용자 확정: "하이퍼프레임 베이스로 뜯어서 만들 것". Remotion 쪽 지식(auto_kairos 매니페스트, Player/Studio 패턴)은 개념만 이식.
- deck-factory와의 인터페이스는 **파일 계약**(motion-manifest.json)만. 코드 의존 없음.
- 이 스킬 단독으로도 동작해야 함 (주제/브리프 → 영상), deck-factory 없이.

## deck-factory 쪽에서 지켜야 할 계약 (요약)

`deck-factory-contracts-excerpt.md` 참조. 핵심:
- motion-manifest.json: `assets[].{id, path, kind, engine, width, height, tokensRef, altText}` + motion 전용 `durationMs, fps` 필수.
- 배경 HEX를 tokens.json과 정합 (합성 이음매 방지).
- 프레임 결정론 검증 (동일 입력 2회 렌더 해시 비교).
- P4 deck-motion 포지셔닝: 옵셔널 플러그인 — 새 스킬이 없어도 deck-factory E2E는 완결.

## 사용자 작업 스타일 제약

- 계획 우선(PLAN.md/WORKERS.md 패턴), 워커 분산(codex 동시성 15, 단 GPU/렌더 작업은 4~6), 중간 계약 파일 필수(사람 수정·재실행 가능).
- "완료" 과장 금지 — deck-factory 리빌드 교훈: 스텁/껍데기 금지, empirical 검증 게이트.
- 생성 이미지 위 코드 글자 합성 절대 금지 (프롬프트 수정 후 재생성만).
- 품질 게이트는 물리적 하드게이트(card-shorts G1~G20, deck-factory grader 90점 방식).

## 이미 보유한 자산 (재구축 금지, 재사용)

- hyperframes 스킬팩 전체 (~/.claude/skills/hyperframes*) + 엔진 벤더 사본(/mnt/d/deck-factory/vendor/hyperframes).
- hyperframes-media: TTS(HeyGen/ElevenLabs/Kokoro 로컬)·BGM·SFX·whisper 전사·캡션 — auto_kairos의 ElevenLabs+Whisper+FAL 의존을 대체.
- image-prompt 스킬(C1~C12 플레이북) + codex-imagegen 러너 — 씬 이미지 생성 경로.
- card-shorts의 시퀀스 템플릿·하드게이트 체계, deck-factory의 grader/계약 패턴.
- codex-spawn — 씬 병렬 생산 분산.

## 미결정 (토론 대상)

1. 스킬 이름/레포명.
2. 씬 매니페스트 스키마 — auto_kairos scene_specs(플랫) + manifest.ts(렌더) 2계층을 따를지, 단일 계층으로 합칠지.
3. 편집 대시보드 아키텍처 — hyperframes 프리뷰 서버 재사용 vs 자체 FastAPI/Node 서버 + iframe 임베드 vs 씬별 독립 컴포지션. (05-hyperframes-base/engine-internals.md 결론 참조)
4. 시각화 슬라이드 컴포넌트 세트 범위 (auto_kairos ~20종 중 무엇을 1차로).
5. 지도 씬(Mapbox) — 스킵 or 프리렌더 배경만.
6. TTS 기본 프로바이더와 한국어 전처리 수준.
7. deck-factory P4 절 개정 시점.
