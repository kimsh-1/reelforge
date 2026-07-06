# opus 적대감사 — video-factory v1 파일 계약 체계

감사관: opus (계약/스키마 렌즈) · 2026-07-07 · 대상: MASTER-PLAN §2.1 L0 2계층 매니페스트 + 게이트 리포트 + 버전 계약
판정 기준: 진실원천 단일성, 무효화 규칙 명문화, 층 귀속 무모순, 파생 가능성. 근거 = auto_kairos config-schema.md / remotion-contract.md / arcreel.md / deck-factory-excerpt.md.

| 번호 | 심각도 | 대상 | 결함 | 수정 제안 |
|---|---|---|---|---|
| 1 | 치명 | render층 재생성 무효화 | scene_specs 편집 → "해당 씬만 재컴파일"(§2.4)이 audio 실측(audioDurationSec·subtitles.words·itemSyncPoints)을 재계산하는지 재사용하는지 규칙 부재. 시나리오: narration 오타 1자 수정 → 재-TTS 트리거면 전 씬 타이밍/자막 변동(비용·비결정), 재사용이면 오디오-텍스트 불일치 렌더. | render-manifest에 `sourceHash`(narration_tts 해시) 필드 추가 + 무효화 규칙 명문: narration_tts 불변 시 audio/subtitle/words 투과, 변경분만 재-TTS·재-whisper. |
| 2 | 치명 | 편집 동시성 계약 | 사람이 대시보드에서 narration 수정 중(unsaved) + 파이프라인 step2가 동시 scene_specs 재생성 → 사용자 초안 무통보 덮어씀. ArcReel은 `dirtyRef` JSON-diff로 초안 보존(arcreel §1), auto_kairos·ArcReel 모두 버전 백업 보유. v1엔 dirty/lock/백업 계약 전무. | scene_specs에 편집락(`editLock`/`dirty` 마커) + 저장 전 자동 백업 `versions/scene_specs/gen_NN` 계약(ArcReel version_manager 이식). 파이프라인 쓰기 전 dirty 확인 의무화. |
| 3 | 치명 | 버전 계약 위치 | §2.3이 `gen_02 + selected 포인터` 언급하나 L0 스키마 3종(scene_specs/render-manifest/design-tokens) 어디에도 버전 필드·파일 없음. 무엇이 gen을 증가시키고 selected를 어디 기록하는지 미정 → 재개 시 어느 gen이 진실인지 판정 불가. | `versions.json`(resource_type별 백업 인덱스 + `selected` 포인터) 신설 계약 = L0 스키마 4번째. ArcReel `versions/{resource_type}/versions.json` 패턴 채택. |
| 4 | 치명 | 게이트 입력해시 정의 | `reports/<gate>-<입력해시>.json`의 해시 대상 미정의. G-V2(오디오-자막 정합)가 scene_specs 해시로 키잉되면, 오디오만 재생성(길이 변동)됐는데 scene_specs 불변 → stale PASS 재사용 → endSec>audioDurationSec 자막을 통과시켜 출고. | 게이트별 입력집합 스키마 명시: G-V1=render-manifest+asset 바이트, G-V2=audioDurationSec+subtitles+words, G-V6=scene_specs. 해시=정렬 직렬화 SHA256, 리포트에 `inputSet[]` 열거. |
| 5 | 중대 | itemSyncPoints 누락 | §2.1 render-manifest scenes[] 나열(audioPath·audioDurationSec·subtitles·imagePath·kenBurns·transition)에 `vizAnimation.itemSyncPoints[]` 빠짐. auto_kairos의 시각화 항목↔나레이션 초 동기(remotion-contract §1.4) 상실 → 차트 항목이 발화와 무관하게 등장. | render-manifest scenes[]에 `vizAnimation{stagger,itemSyncPoints[{itemIndex,startSec}]}` 추가, 컴파일러가 words 타임에서 파생. |
| 6 | 중대 | subtitleConfig/designTokens 이중 거주 | 16필드 subtitleConfig·designTokens가 design-tokens.json(진실원천, §2.1)과 render-manifest.meta 양쪽에 존재. §2.4 편집 대상은 scene_specs만 명시 → 자막색/폰트 편집 경로 미정의, 두 사본 drift. | render-manifest.meta.designTokens/subtitleConfig를 "컴파일 산출 읽기전용 스냅샷"으로 계약 명시. 편집은 design-tokens.json만, 스튜디오 프리뷰도 진실원천 읽음. |
| 7 | 중대 | CanvasOverrides 층 귀속 | overrides{}를 scene_specs(저작 플랫층)에 배치했으나 auto_kairos에선 headline x/y·image w/h 픽셀좌표 = 캔버스에디터 산출(렌더층 CanvasOverrides). 픽셀값이 저작 진실원천 오염 + 멀티포맷(쇼츠 1080×1920)에서 픽셀좌표 무의미. | overrides 좌표를 해상도 독립 0~100%로 강제 + 포맷별 overrides 서브키(`overrides.byFormat`) 분리. 픽셀 캔버스 조작은 render층 파생 필드로 격리. |
| 8 | 중대 | motion-manifest durationMs 파생 | deck-factory motion-manifest는 durationMs·fps 필수(deck-excerpt L75). 우리 render-manifest는 duration 필드 없음(audio 실측). remotion-contract §1.1의 2% 패딩·min 3프레임 규칙 때문에 durationMs = audioDurationSec×1000 단순 파생 불가 → deck 합성 시 씬 경계 어긋남. | 컴파일러가 패딩 반영한 확정 `durationFrames`를 render-manifest scenes[]에 굽고, motion-manifest export가 이를 소비(재계산 금지). |
| 9 | 중대 | tokensRef 네임스페이스 | deck-factory 자산 tokensRef는 deck-tokens 참조(deck-excerpt L64), video-factory는 design-tokens.json(스키마 상이). export 시 tokensRef가 어느 토큰을 가리키나 미정 → 배경 HEX 정합 게이트(G-V5) 통과 근거 없음. | design-tokens→deck-tokens 매핑 어댑터 계약 신설 + motion-manifest tokensRef가 참조할 정본 명시. |
| 10 | 중대 | 멀티포맷 render-manifest 단수 | §4 확정 멀티포맷(본편 1920×1080/쇼츠 1080×1920/정사각 1080×1080)인데 render-manifest.meta.resolution 단일. imageAsset placement·자막 bottomOffset·safeZone이 포맷마다 달라야 하나 포맷별 파생 규칙 미정 → 세로 쇼츠에서 자막/이미지 크롭 파괴. | 포맷별 render-manifest N개 파생 계약 + `formatOverrides` 레이어(placement·bottomOffset·maxWidth 재계산 규칙). |
| 11 | 중대 | words 진실원천 소실 경로 | subtitles[].words[]는 whisper 전사 산출로 render층에만 존재, scene_specs엔 narration_tts만. 재컴파일이 whisper 재실행 안 하면 words 소실, 하면 비결정+비용. §2.3 audio_meta.json이 words를 영속하는지 계약 없음. | audio_meta.json을 words+audioDurationSec 진실원천으로 승격(오디오 바이트와 함께 영속). 재컴파일은 audio_meta에서 words 투과, whisper는 오디오 변경 시만. |
| 12 | 중대 | extra=forbid vs 예약/자유필드 | G-V6이 extra=forbid(ArcReel 패턴)로 할루시네이션 필드 차단하나, §4-3 `ost` 예약 필드 + overrides{} 자유객체와 충돌. 스튜디오가 신규 overrides 키 쓰면 스키마위반으로 게이트 리젝. | overrides를 닫힌 열거 스키마로 정의(headline/image 좌표만) + 확장 예정 필드는 스키마에 명시 선언(null 기본). 자유 additionalProperties 구역 없음. |
| 13 | 중대 | pipeline_state ↔ selected 이중 상태 | 재개=출력파일 존재 스킵 + pipeline_state.json(§2.3), 재생성=gen_NN/selected(§4-3). 두 상태기가 어느 gen을 현재로 보는지 동기화 계약 없음 → 재개가 selected 아닌 옛 gen 파일 보고 스킵, 신 gen 미반영. | selected 포인터를 단일 상태원천으로 승격, pipeline_state는 selected 경유로만 파일 참조. 재개 스킵 판정을 selected 기준으로 계약. |
| 14 | 중대 | 렌더 결정론 게이트 경계 | G-V1이 "동일 입력 2회 렌더 해시 일치" 요구하나 TTS·이미지 생성은 본질 비결정. 해시 대상이 "asset 바이트 고정 후 컴포지션 렌더"임을 명시 안 하면 게이트가 asset 재생성마다 항상 실패. | G-V1 범위를 render-manifest+고정 asset → 컴포지션 HTML → 프레임 렌더로 한정 계약. asset 생성은 게이트 밖(입력 고정). |
| 15 | 경 | mood.speed vs audio 권위 | design-tokens moods{7종}의 `speed`가 audioDurationSec 유일권위(§2.1)와 경합 — 재생속도 변경 시 실측 길이 의미 소멸. 우선순위 미정. | speed를 애니메이션 이징 전용으로 격하, 오디오 길이 불변 명시. duration 파생은 audioDurationSec만. |

## 요약
- 진실원천 2계층 분리의 무효화 규칙이 통째로 비어 있다(#1·#11): render층 재생성 시 audio 실측(길이·words·itemSyncPoints)의 보존/재계산 경계가 어디에도 없어, 사소한 저작 편집이 전 타이밍을 흔들거나 정합을 깬다.
- 편집 동시성·버전 계약은 ArcReel/auto_kairos가 실제로 구현했는데 v1은 선언만 하고 스키마 위치가 없다(#2·#3·#13). "재생성 = gen_NN + selected"가 어느 파일에도 안 산다.
- 게이트 입력해시가 무정의라 stale PASS 재사용으로 불량 출고 가능(#4).
- deck-factory 연계는 durationMs 파생 불가·tokensRef 네임스페이스 불일치로 계약이 물리적으로 안 맞물린다(#8·#9).
