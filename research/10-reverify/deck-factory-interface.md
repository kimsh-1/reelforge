# deck-factory 인터페이스 실검증 (10-reverify)

검증: 2026-07-07 · deck-factory PLAN.md 원문(2.3절·P4절·5.2) ↔ video-factory MASTER-PLAN §2.1 대조.

## 필드 매핑표 (deck motion-manifest 필수 ← video render-manifest)

| deck 필드 | 파생원 | 판정 |
|---|---|---|
| id | scene.sceneId | OK |
| path | 확정 렌더 MP4 | △ 입도 불일치(아래 ③) |
| kind | 상수 "motion/media" | OK |
| engine | render-manifest에 없음 | ✗ 어댑터가 상수 "hyperframes" 주입 |
| width/height | meta.resolution 분해 | OK |
| durationMs | durationFrames×1000/fps | OK (round-trip 단서 ⑤) |
| fps | meta.fps | OK |
| tokensRef | design-tokens→deck-tokens 어댑터(B4) | △ 매핑 미명세 |
| altText | 소스 없음 | ✗ 파생 불가 — L0 신설 필요 |

## 수정 필요 5건 (v1.3 반영 대상)

1. **altText 필드 신설**: scene_specs에 altText(+선택 caption) — deck 접근성 규약 요구, narration 유추는 계약이 아님.
2. **어댑터 명세 확장(B4-확장)**: engine 상수 주입 + **durationFrames 병행 emit**(durationMs만으로는 30fps 정수 반올림 시 역산 불일치 — deck 5.2 바인딩게이트가 durationMs/fps 존재를 검사하므로 어댑터 필수) + 토큰 매핑 최소 3축(palette-role·배경 HEX·fonts) 명세. 배경 HEX는 deck P4 합성 이음매 게이트 직결.
3. **씬별 클립 주소 규약**: deck는 슬라이드별 asset:motion→kind=media 슬롯 바인딩을 기대 — 메인 전체 MP4 1개가 아니라 sceneId→클립 파일 주소를 motion-manifest로 노출하는 규약 추가 (프리뷰 티어 씬 렌더 산출물 재활용 가능).
4. **deck doctor motion 프로파일 분기**: 기존 프로파일은 FFmpeg+LaTeX(manim 전제) — hyperframes-engine 자산은 LaTeX 면제 분기 필요 (deck-factory 쪽 P4 개정 시 반영).
5. **durationMs round-trip 게이트**: durationMs↔durationFrames 왕복 일치 검사.

## 포지셔닝 정정

video-factory는 **deck-motion(3b1b manim 경로)의 대체가 아니다** — engine 구분자로 공존하는 병렬 생산자. deck-factory P4의 manim/LaTeX PoC와 3b1b 스타일 판정(4/5)은 deck 쪽 잔여 작업으로 그대로 존속. video-factory가 대신 충족하는 것: fps/해상도 준수·프레임 결정론·렌더 성공률.
