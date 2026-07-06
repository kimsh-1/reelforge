<h3 align="center">한국어 | <a href="README-en.md">English</a> | <a href="README-ja.md">日本語</a></h3>

<h1 align="center">video-factory</h1>

<p align="center">
  <a href="#"><img alt="CI placeholder" src="https://img.shields.io/badge/CI-placeholder-lightgrey"></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-Apache--2.0-blue"></a>
  <a href="#"><img alt="Docker placeholder" src="https://img.shields.io/badge/docker-placeholder-lightgrey"></a>
</p>

브리프 한 줄에서 시작해 나레이션 영상 계약, 컴파일, 렌더, 게이트 검증까지 이어지는 결정론적 비디오 제작 레포입니다. 데모 영상과 대형 미디어는 커밋하지 않고, 증거와 연구 자료만 추적합니다.

## [overview] 프로젝트 소개

video-factory는 한국어 나레이션 중심의 가로, 세로, 정사각 영상 생성을 목표로 합니다. 렌더 엔진은 `hyperframes@0.7.26`으로 정확히 고정하고, 편집은 HTML을 직접 고치는 대신 `scene_specs` 같은 계약 파일을 수정한 뒤 재컴파일하는 단일 경로를 사용합니다.

이 T3 커밋은 제품 완성본이 아니라 레포 정본입니다. 연구 문서 00~10, P0 PoC 증거, 게이트 러너 골격, 라이선스 정책, Codex 실행 규칙을 한곳으로 이관합니다.

## [architecture] 아키텍처 5계층 요약

| 계층 | 역할 |
|---|---|
| L0 계약 | `scene_specs`, `audio_meta`, `design-tokens`, `versions`, `render-manifest`를 진실원천으로 둡니다. |
| L1 파이프라인 | 브리프를 대본, 씬, 음성, 이미지, 컴파일 입력으로 변환합니다. |
| L2 컴파일러 | 계약 파일을 읽어 결정론적 hyperframes HTML과 자체 render-lint 결과를 만듭니다. |
| L3 스튜디오 | adapter-hosted 미리보기와 스키마 기반 편집 패널을 제공합니다. |
| L4 게이트/패키징 | `vf gate`, CI, 골든 픽스처, 회귀 검증, 최종 스킬 패키징을 담당합니다. |

## [p0-results] P0 실증 결과

| 게이트 | 결과 | 이관된 증거 |
|---|---|---|
| P0a | 통과 | 환경 doctor, 5초 MP4, yuv420p, faststart, 결정론 재렌더 기록 |
| P0b | 통과 | 씬 3개 마운트, 씬 단독 렌더, orphan 렌더 성공 기대값, 본문 프레임 일치 |
| P0c | 통과 | edge-tts 워드 산출, CJK 폰트 렌더, OCR 양성 대조, 20라인 스트레스 |
| P0d | 통과 | 나레이션 수정, sourceHash 변화, 선택적 재TTS, 전체 재컴파일, SSE 1회 관측 |

정오표 반영: P0c는 워드싱크 렌더를 아직 증명하지 않았습니다. 현재 증명된 것은 words 산출, 단조성, 오디오 길이 정합, 정적 한글 렌더입니다.

## [free-stack] 무료 스택

기본 경로는 키리스와 무료입니다. 한국어 TTS는 `edge-tts`를 기본 후보로 두고, 전사/정렬은 future gate에서 `faster-whisper`로 고정합니다. 이미지는 codex-imagegen과 키리스 스톡 폴백을 전제로 하며, BGM은 검증된 CC0 또는 CC-BY 출처만 허용합니다.

금지 항목은 `THIRD_PARTY_LICENSES.md`에 고정되어 있습니다. MusicGen, 출처 불명 BGM, 재배포가 막힌 SFX, 비상업 가중치 기반 TTS는 기본 스택에 넣지 않습니다.

## [roadmap] 로드맵 P1~P6

- P1: 계약 스키마 5종, 검증기, 네거티브 픽스처 스위트.
- P2: 오디오 비의존 컴파일러, 씬 블록 8종, 전환과 render-lint.
- P3: TTS, 이미지, 버전, 재개 가능한 파이프라인과 실 TTS 스모크.
- P4: Studio adapter, 폼 생성기, 편집 영향 클래스, 동시 편집 처리.
- P5: 장영상 메모리, 골든 회귀, 시각 판정 게이트.
- P6: 스킬 패키징, 멀티포맷, deck-factory 연계, 교차환경 해시.

## [installation] 설치

```bash
cd ~/video-factory
npm ci
npm run lint
npm run gate
node bin/vf gate list
```

렌더 게이트를 실제로 다시 돌릴 때만 `node bin/vf gate p0b --execute`처럼 실행합니다. 생성된 영상은 `out/` 아래에 두고 커밋하지 않습니다.

## [disclaimer] 라이선스와 면책

코드는 Apache-2.0입니다. 미디어, 폰트, BGM, SFX는 개별 라이선스를 따르며 산출물 사용 책임은 사용자에게 있습니다. 유료 어댑터 키는 전부 선택 사항이고, 기본 동작은 키를 요구하지 않아야 합니다.
