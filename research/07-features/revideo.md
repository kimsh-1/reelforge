소스 코드 기준으로만 추출했습니다. README 요약은 근거로 쓰지 않았습니다.

| ID | 기능명 | 설명(1-2줄) | 근거(파일:라인) | 채택제안 | 검증방법 |
|---|---|---|---|---|---|
| RV-001 | 프로젝트 설정 계약 | 전역 `background/range/size`와 렌더링/프리뷰 설정을 분리한 계약. 씬 매니페스트 기본 스키마로 이식 가치가 큼. | `packages/core/src/app/Project.ts:39-86`; `packages/core/src/app/makeProject.ts:7-25` | P0(PoC필수) - 계약기반 핵심 | `pnpm test tests/manifest-settings.spec.ts`로 기본값/오버라이드 스냅샷 검증 |
| RV-002 | 렌더별 설정 오버라이드 | 프로젝트 설정과 CLI/API 렌더 설정을 병합해 범위, 배경, 크기, 익스포터를 렌더 단위로 바꿈. | `packages/core/src/app/project-settings.ts:7-23`; `packages/renderer/client/render.ts:19-79` | P0(PoC필수) - 부분재렌더 필요 | 동일 매니페스트를 서로 다른 range/size로 렌더해 출력 메타데이터 비교 |
| RV-003 | 멀티 워커 렌더 | 워커 수만큼 브라우저 페이지를 띄워 프레임 구간을 나누고 결과물을 합침. | `packages/renderer/server/render-video.ts:229-269`; `packages/renderer/server/render-video.ts:394-450` | P1(코어) - 장편속도 개선 | `pnpm test tests/render-workers.spec.ts`로 1/2/4워커 출력 duration 동등성 검증 |
| RV-004 | 부분 렌더 API | 특정 worker segment만 렌더해 `{audioFile, videoFile}`을 반환함. 브라우저 씬 편집 대시보드의 부분 재렌더에 직접 대응됨. | `packages/renderer/server/render-video.ts:453-490` | P0(PoC필수) - 부분렌더 핵심 | 수정된 씬 구간만 렌더 후 전체 합성 결과 해시 비교 |
| RV-005 | 워커 프레임 슬라이싱 | 전체 프레임 범위를 워커별로 나누며 두 번째 워커부터 1프레임 오프셋을 둬 중복 경계 프레임을 피함. | `packages/renderer/client/render.ts:84-126` | P1(코어) - 경계오류 방지 | 경계 프레임 타임코드 중복/누락을 ffprobe 프레임 카운트로 검증 |
| RV-006 | 헤드리스 Vite 렌더 서버 | Vite 서버와 Puppeteer 브라우저를 띄워 동일 프로젝트 코드를 브라우저에서 렌더함. | `packages/renderer/server/render-video.ts:80-127` | P0(PoC필수) - HTML렌더 기반 | CI에서 headless render smoke test 실행 |
| RV-007 | 렌더 URL 파라미터 계약 | 파일명, 워커 ID, 총 워커 수, hidden folder ID를 URL query로 전달함. | `packages/renderer/server/render-video.ts:64-75`; `packages/renderer/server/renderer-plugin.ts:57-82` | P1(코어) - 작업식별 필요 | URL 생성 함수를 단위 테스트하고 renderer bootstrap 인자 검증 |
| RV-008 | 렌더 진행률 브리지 | 브라우저 `window.logProgress`를 서버 callback과 콘솔 진행률로 연결함. | `packages/renderer/server/render-video.ts:129-200`; `packages/core/src/app/TimeEstimator.ts:40-89` | P0(PoC필수) - 대시보드 필수 | mock page에서 progress event 순서와 ETA 필드 검증 |
| RV-009 | 완료/실패 브라우저 콜백 | `onRenderComplete`, `onRenderFailed`, `browserError`로 서버 리소스를 닫고 promise를 resolve/reject함. | `packages/renderer/server/render-video.ts:202-223` | P0(PoC필수) - 실패복구 기본 | 실패 주입 테스트로 browser/server close 호출 검증 |
| RV-010 | 출력 포맷 하드게이트 | wasm/mp4 제한, ffmpeg format과 확장자 불일치, image sequence 서버 미지원 등을 사전 차단함. | `packages/renderer/server/validate-settings.ts:24-99` | P0(PoC필수) - 품질게이트 기본 | invalid render settings fixture를 전부 reject하는 테스트 |
| RV-011 | 워커별 무음 오디오 보정 | 구간 렌더에서 오디오가 없으면 silent wav를 생성해 후속 concat/merge를 안정화함. | `packages/renderer/server/render-video.ts:272-296`; `packages/ffmpeg/src/utils.ts:70-90` | P1(코어) - 합성안정성 확보 | 무음 씬 렌더 후 audio stream 존재 여부 ffprobe 검증 |
| RV-012 | 워커 결과 concat/merge | 워커별 비디오와 오디오를 각각 concat한 뒤 최종 오디오+비디오로 병합함. | `packages/renderer/server/render-video.ts:299-323`; `packages/ffmpeg/src/utils.ts:35-68` | P1(코어) - 병렬렌더 완성 | 워커 분할 렌더와 단일 렌더의 duration/hash 허용오차 비교 |
| RV-013 | 임시 파일 정리 | 워커 temp 디렉터리와 중간 산출물을 force 삭제하고 실패를 삼킴. | `packages/renderer/server/render-video.ts:325-370` | P1(코어) - 운영비용 절감 | 렌더 종료 후 temp path 잔존 여부 검사 |
| RV-014 | 스테이지 버퍼 합성 | current/previous/final canvas를 두고 배경, 색공간, 해상도 배율, previous-on-top 전환을 처리함. | `packages/core/src/app/Stage.ts:37-105` | P1(코어) - 씬합성 기반 | 전환 씬 fixture의 픽셀 스냅샷 비교 |
| RV-015 | 익스포터 생명주기 인터페이스 | `start/handleFrame/mergeMedia/generateAudio/stop/kill` 훅으로 렌더 출력 방식을 플러그인화함. | `packages/core/src/exporter/Exporter.ts:45-124` | P1(코어) - 출력확장 기반 | fake exporter로 hook 호출 순서 단위 테스트 |
| RV-016 | Abort 가능한 프레임 루프 | AbortSignal을 확인하며 프레임마다 exporter를 호출하고 `setTimeout(0)`으로 UI 응답성을 유지함. | `packages/core/src/app/Renderer.ts:295-325` | P1(코어) - 편집UX 필요 | 렌더 중 abort 시 partial artifact와 상태 복귀 검증 |
| RV-017 | 프레임별 미디어 에셋 프리패스 | 렌더 전 전체 프레임을 순회해 오디오/비디오 asset 사용 정보를 수집함. | `packages/core/src/app/Renderer.ts:386-422` | P0(PoC필수) - 오디오동기화 핵심 | asset timeline fixture에서 frame별 media map 스냅샷 검증 |
| RV-018 | 성공 시점 미디어 병합 | 비디오는 먼저 렌더하고, 성공한 경우에만 오디오 생성 결과와 merge함. | `packages/core/src/app/Renderer.ts:281-348` | P1(코어) - 실패격리 좋음 | 비디오 실패 주입 시 audio merge 미호출 검증 |
| RV-019 | 단일 프레임 렌더 | 특정 프레임을 seek 후 PNG snapshot으로 내보내는 기능. 씬 편집 대시보드 썸네일/검수에 유용함. | `packages/core/src/app/Renderer.ts:194-224` | P0(PoC필수) - 검수화면 필수 | manifest frame snapshot을 golden image와 비교 |
| RV-020 | 이미지 익스포트 백프레셔 | 이미지 시퀀스 내보내기에서 outstanding frame 수를 제한하고 ack를 기다림. | `packages/core/src/exporter/ImageExporter.ts:10-118` | P1(코어) - 메모리보호 필요 | 느린 writer mock에서 frame queue 상한 검증 |
| RV-021 | WebCodecs/WASM MP4 익스포터 | 브라우저에서 canvas frame을 WebCodecs `VideoFrame`으로 인코딩하고 mp4 blob을 업로드함. | `packages/core/src/exporter/WasmExporter.ts:20-66`; `packages/vite-plugin/src/partials/wasmExporter.ts:13-65` | P2(확장) - 경량렌더 옵션 | browser capability matrix에서 mp4 생성 smoke test |
| RV-022 | FFmpeg 이미지 파이프 익스포터 | canvas PNG를 pipe로 FFmpeg에 넣고 mp4/webm/proRes별 pix_fmt, faststart, fps를 설정함. | `packages/ffmpeg/src/ffmpeg-exporter-server.ts:56-116` | P1(코어) - 서버렌더 표준 | ffprobe로 codec/pix_fmt/fps/faststart 검증 |
| RV-023 | 프레임 기반 오디오 배치 | frame별 media asset을 start/end/currentTime으로 환산해 오디오 타임라인 위치를 계산함. | `packages/ffmpeg/src/generate-audio.ts:39-94` | P0(PoC필수) - 워드싱크 기반 | synthetic audio asset의 start/end 샘플 위치 검증 |
| RV-024 | 극단 playbackRate 보정 | FFmpeg `atempo` 한계를 넘는 재생속도를 여러 필터로 분해함. | `packages/ffmpeg/src/generate-audio.ts:96-122` | P1(코어) - 엣지케이스 처리 | 0.1x/8x/200x fixture의 필터 체인 스냅샷 검증 |
| RV-025 | 오디오 trim/pad/delay/volume | asset별 trim, apad, adelay, volume, sample rate 변환을 한 번에 적용함. | `packages/ffmpeg/src/generate-audio.ts:123-185` | P1(코어) - 믹싱품질 필요 | 출력 wav 파형 시작점/길이/볼륨 RMS 검증 |
| RV-026 | 다중 오디오 amix | 여러 준비된 track을 `amix`로 합치고 입력 수에 맞춰 volume 보정함. | `packages/ffmpeg/src/generate-audio.ts:188-213` | P1(코어) - 내레이션+BGM | TTS+BGM+SFX fixture의 peak/RMS 자동검사 |
| RV-027 | 무효 오디오 스킵 | playbackRate 0, volume 0, 오디오 스트림 없는 비디오 asset은 오디오 합성에서 제외함. | `packages/ffmpeg/src/generate-audio.ts:216-264` | P1(코어) - 실패감소 효과 | 무음/비디오-only asset fixture로 skip log와 결과 검증 |
| RV-028 | 에셋 경로 해석 | http/data URL은 그대로 쓰고 로컬 경로는 output 기준 public 경로로 해석함. | `packages/ffmpeg/src/utils.ts:10-22` | P1(코어) - 에셋계약 필요 | remote/data/local asset matrix 테스트 |
| RV-029 | FFmpeg 경로/로그 설정 | installer 기본 경로, env override, 런타임 setter로 ffmpeg/ffprobe/logLevel을 관리함. | `packages/ffmpeg/src/settings.ts:18-76`; `packages/renderer/server/renderer-plugin.ts:34-48` | P1(코어) - 배포환경 대응 | env override e2e에서 실제 binary path 사용 확인 |
| RV-030 | 비디오 asset chunk 다운로드 | 렌더 중 실제 필요한 비디오 구간만 추려 서버에 chunk 다운로드를 요청함. | `packages/core/src/exporter/download-videos.ts:3-58` | P1(코어) - 긴영상 최적화 | 긴 비디오 fixture에서 요청 range 최소화 검증 |
| RV-031 | FFmpeg 비디오 프레임 추출기 | 원본 비디오를 구간 chunk로 자르고 raw RGBA frame을 버퍼링해 canvas draw에 제공함. | `packages/ffmpeg/src/video-frame-extractor.ts:50-91`; `packages/ffmpeg/src/video-frame-extractor.ts:276-350` | P1(코어) - 결정론 디코딩 | 동일 timestamp 반복 추출 픽셀 해시 동등성 검증 |
| RV-032 | 디코더 seek 재생성 로직 | 요청 시간이 이전 frame이거나 chunk 범위를 벗어나면 extractor를 파기하고 새로 만듦. | `packages/vite-plugin/src/partials/ffmpegBridge.ts:203-277` | P1(코어) - 랜덤접근 안정 | 앞/뒤 scrub 시 frame mismatch 없는지 자동 픽셀 비교 |
| RV-033 | 비디오 디코더 자동 선택 | playback 상태, HLS, webm, 명시 decoder에 따라 fast/seeked/webcodec/ffmpeg를 선택함. | `packages/2d/src/lib/components/Video.ts:241-283` | P2(확장) - 입력호환성 확대 | mp4/webm/hls fixture별 decoder 선택 스냅샷 |
| RV-034 | 미디어 canplay 의존성 | `awaitCanPlay`와 DependencyContext로 이미지/오디오/비디오 준비 전 렌더 진행을 막음. | `packages/2d/src/lib/components/Media.ts:244-320`; `packages/2d/src/lib/components/Audio.ts:26-50` | P1(코어) - 비동기에셋 안정 | 느린 asset mock에서 첫 프레임 blank 방지 검증 |
| RV-035 | 프리뷰 볼륨 증폭 | 브라우저 제한을 넘는 volume은 WebAudio GainNode로 프리뷰에서만 증폭함. | `packages/2d/src/lib/components/Media.ts:166-215` | P2(확장) - 편집편의 기능 | preview-only gain이 export mix에 영향 없는지 검증 |
| RV-036 | reactive playbackRate 경고 | playbackRate를 동적으로 바꾸면 seek 동기화가 깨질 수 있어 구조화된 경고를 냄. | `packages/2d/src/lib/components/Media.ts:217-242` | P1(코어) - 동기화게이트 필요 | reactive rate fixture에서 경고 발생을 테스트 |
| RV-037 | 이미지 캐시 무효화 | HMR asset 변경 이벤트와 asset hash를 사용해 이미지 풀 캐시를 갱신함. | `packages/2d/src/lib/components/Img.ts:91-103`; `packages/2d/src/lib/components/Img.ts:171-186` | P1(코어) - 편집반영 필수 | 이미지 교체 후 snapshot이 즉시 바뀌는지 검증 |
| RV-038 | 이미지 로드 상세 오류 | 이미지 로드 실패 시 source와 remarks를 포함한 DetailedError를 던짐. | `packages/2d/src/lib/components/Img.ts:188-209`; `packages/core/src/utils/DetailedError.ts:3-40` | P0(PoC필수) - 품질게이트 핵심 | 깨진 asset fixture에서 오류 필드 스냅샷 검증 |
| RV-039 | 씬 설명 계약 | scene name, class, config runner, source stack, plugins를 SceneDescription으로 묶음. | `packages/core/src/scenes/Scene.ts:36-57`; `packages/2d/src/lib/scenes/makeScene2D.ts:5-15` | P0(PoC필수) - 매니페스트 대응 | JSON scene manifest를 내부 SceneDescription으로 변환 테스트 |
| RV-040 | 씬 타이밍 캐시 | first/last frame, duration, transitionDuration을 캐시해 seek와 timeline을 빠르게 함. | `packages/core/src/scenes/Scene.ts:88-96`; `packages/core/src/scenes/GeneratorScene.ts:197-232` | P1(코어) - 대시보드 성능 | 씬 수정 전후 캐시 무효화/재계산 테스트 |
| RV-041 | 씬 렌더 생명주기 이벤트 | cache/reload/recalculate/render/reset 및 Before/AfterRender 이벤트를 제공함. | `packages/core/src/scenes/Scene.ts:101-120`; `packages/core/src/scenes/GeneratorScene.ts:63-90` | P1(코어) - 플러그인기반 | lifecycle listener 호출 순서 검증 |
| RV-042 | 씬 변수 signal | 프로젝트 변수 변경을 씬별 signal로 반영하고 reset 시 초기화함. | `packages/core/src/scenes/Variables.ts:5-42`; `packages/core/src/app/Renderer.ts:356-365` | P0(PoC필수) - 템플릿자동화 핵심 | variable 변경 후 부분 재렌더 결과만 바뀌는지 검증 |
| RV-043 | 결정론 난수 API | seed 기반 Mulberry32, int/float/gauss, independent spawn을 제공함. 단 seed 저장을 강제해야 함. | `packages/core/src/scenes/Random.ts:10-108` | P1(코어) - 재현성 필요 | 동일 seed 렌더 두 번의 픽셀 해시 일치 검증 |
| RV-044 | 슬라이드/챕터 정지점 | scene:name ID로 slide를 등록하고 target/presenting 상태에 따라 재생을 멈춤. | `packages/core/src/scenes/Slides.ts:32-146`; `packages/core/src/app/Player.ts:396-441` | P2(확장) - 검수챕터 유용 | slide target seek와 pause 상태 e2e 테스트 |
| RV-045 | Generator 기반 동시성 DSL | `all`, `sequence`, `chain`, `waitFor`로 애니메이션 타임라인을 제어함. | `packages/core/src/flow/all.ts:21-26`; `packages/core/src/flow/sequence.ts:26-35`; `packages/core/src/flow/scheduling.ts:21-39` | P1(코어) - 씬작성 생산성 | DSL fixture에서 frame별 property 값 스냅샷 |
| RV-046 | 무한 루프 안전장치 | main thread에서 infinite loop 사용 시 구체적 오류 메시지로 차단함. | `packages/core/src/flow/loop.ts:96-118` | P1(코어) - 렌더멈춤 방지 | infinite loop fixture가 즉시 fail하는지 테스트 |
| RV-047 | Thread 취소/재사용 감지 | child thread cancel/drain과 generator 재사용 오류 감지를 제공함. | `packages/core/src/threading/Thread.ts:8-50`; `packages/core/src/threading/Thread.ts:132-194` | P1(코어) - 타임라인안정성 | cancel 후 후속 animation 미실행 검증 |
| RV-048 | 캐시 기반 seek | 되감기나 캐시된 scene 이전으로 이동 시 최적 scene부터 reset/progress해 seek함. | `packages/core/src/app/PlaybackManager.ts:83-109`; `packages/core/src/app/PlaybackManager.ts:182-192` | P1(코어) - 편집scrub 성능 | 긴 프로젝트 seek latency 벤치마크 테스트 |
| RV-049 | 프리뷰 Player 상태 제어 | loop, muted, volume, speed, range, variables, resize/reload를 중앙 Player가 관리함. | `packages/core/src/app/Player.ts:119-305` | P1(코어) - 대시보드기반 | dashboard player state transition 테스트 |
| RV-050 | FPS 변경 프레임 보존 | fps 변경 시 기존 초 단위 위치를 유지하도록 frame을 보정함. | `packages/core/src/app/Player.ts:164-196`; `packages/core/src/app/PlaybackStatus.ts:14-52` | P1(코어) - 타이밍정확성 | 24/30/60fps 변환 후 timestamp 오차 검증 |
| RV-051 | 구조화 로깅/프로파일링 | level, message, stack, object, duration, inspect를 가진 로그와 profile helper를 제공함. | `packages/core/src/app/Logger.ts:31-126`; `packages/core/src/app/Logger.ts:178-193` | P0(PoC필수) - 하드게이트 근거 | render log JSON schema와 error count gate 테스트 |
| RV-052 | 소스맵 기반 오류 UI | stack trace를 원본 source frame으로 매핑하고 에디터 열기 링크를 제공함. | `packages/ui/src/utils/sourceMaps.ts:45-176`; `packages/ui/src/components/console/SourceCodeFrame.tsx:13-41` | P2(확장) - 디버깅효율 개선 | thrown error fixture에서 원본 파일/라인 매핑 검증 |
| RV-053 | 콘솔 오류 패널 | 오류는 기본 펼침, remarks/object/stack/source frame/inspect 버튼을 UI로 보여줌. | `packages/ui/src/components/console/Log.tsx:21-92`; `packages/ui/src/utils/LoggerManager.ts:4-43` | P1(코어) - QA검수 필요 | Playwright로 error panel 필드 렌더 검증 |
| RV-054 | 편집 플러그인 슬롯 | tabs, provider, overlays, inspectors를 플러그인 config로 확장함. | `packages/ui/src/plugin/EditorPlugin.ts:21-120`; `packages/ui/src/contexts/panels.tsx:29-97` | P1(코어) - 대시보드확장 | dummy plugin tab/overlay/inspector 등록 e2e |
| RV-055 | 씬 그래프 선택 | 노드 트리에서 hover/select/open state를 관리하고 선택 시 자동 스크롤함. | `packages/2d/src/editor/tree/NodeElement.tsx:14-72`; `packages/2d/src/editor/Provider.tsx:10-60` | P1(코어) - 씬편집 기본 | Playwright로 node 선택과 inspector 동기화 검증 |
| RV-056 | 캔버스 오버레이 선택 | 뷰포트 좌표를 씬 좌표로 변환해 클릭한 노드를 선택하고 선택/hover outline을 그림. | `packages/2d/src/editor/PreviewOverlayConfig.tsx:17-67`; `packages/2d/src/lib/scenes/Scene2D.ts:82-133` | P1(코어) - 시각편집 기본 | overlay click hit-test와 선택 key 검증 |
| RV-057 | 노드 인스펙터 자동 필드 | inspectable signal을 읽어 key, source 이동, 숫자/벡터/배열/spacing 필드를 자동 렌더함. | `packages/2d/src/editor/NodeInspectorConfig.tsx:16-76`; `packages/ui/src/components/fields/AutoField.tsx:13-28` | P1(코어) - 편집폼 기반 | property 변경 후 scene variable patch 생성 검증 |
| RV-058 | Detached 노드 진단 | 부모에서 떨어진 노드를 별도 트리로 표시해 렌더 누락/메모리 누수를 찾음. | `packages/2d/src/editor/tree/DetachedRoot.tsx:7-23`; `packages/2d/src/lib/scenes/Scene2D.ts:160-164` | P2(확장) - 디버깅보조 | detached node fixture가 패널에 표시되는지 검증 |
| RV-059 | 타임라인 줌/스크럽 | timeline scale/offset을 저장하고 wheel zoom, drag scrub/pan, user range 밖 경고를 제공함. | `packages/ui/src/components/timeline/Timeline.tsx:31-290` | P1(코어) - 부분렌더UX 핵심 | Playwright로 scrub frame과 warning 표시 검증 |
| RV-060 | 씬/슬라이드 트랙 | 씬 clip, transition duration, slide clip을 표시하고 클릭 시 source/seek 이동을 지원함. | `packages/ui/src/components/timeline/SceneTrack.tsx:10-91`; `packages/ui/src/components/timeline/SlideTrack.tsx:13-61` | P1(코어) - 검수탐색 필요 | 씬 duration fixture로 timeline clip 위치 스냅샷 검증 |
| RV-061 | 뷰포트 줌/팬/그리드 | zoom-to-fit, custom zoom, pan, grid, 배경 색, overlay canvas를 지원함. | `packages/ui/src/components/viewport/EditorPreview.tsx:42-245`; `packages/ui/src/components/viewport/OverlayCanvas.tsx:13-50` | P1(코어) - 씬편집 필수 | desktop/mobile viewport screenshot regression |
| RV-062 | 좌표/컬러 픽커 | 씬 좌표 복사와 EyeDropper 기반 색상 복사를 제공함. | `packages/ui/src/components/viewport/Coordinates.tsx:13-59`; `packages/ui/src/components/viewport/ColorPicker.tsx:7-52` | P2(확장) - 편집편의 기능 | clipboard mock으로 좌표/색 복사 검증 |
| RV-063 | 렌더 UI와 Abort | 편집기에서 렌더 시작, 진행률/ETA 표시, Abort 버튼을 제공함. | `packages/ui/src/components/viewport/Viewport.tsx:29-125` | P0(PoC필수) - 대시보드필수 | 렌더 중 abort 클릭 시 상태/로그 검증 |
| RV-064 | 설정 JSON HMR | `.revideo/settings.json`을 virtual module로 읽고 변경 시 HMR invalidate와 파일 쓰기를 수행함. | `packages/vite-plugin/src/partials/settings.ts:6-66` | P1(코어) - 설정동기화 필요 | settings 파일 변경 후 preview state 갱신 검증 |
| RV-065 | 메타 파일 HMR | `.meta` 파일을 JSON 모듈로 변환하고 HMR write echo를 1초 억제함. | `packages/vite-plugin/src/partials/meta.ts:15-78` | P2(확장) - 편집상태 저장 | meta write/read race fixture 테스트 |
| RV-066 | 에셋 HMR | asset 변경 이벤트를 브라우저에 보내고 audio는 1초 지연으로 교체 안정성을 높임. | `packages/vite-plugin/src/partials/assets.ts:22-56` | P1(코어) - 실시간편집 필요 | asset 교체 후 HMR 이벤트와 preview 갱신 검증 |
| RV-067 | 프로젝트 glob 라우팅 | 여러 project file glob을 찾아 editor route와 build input으로 등록함. | `packages/vite-plugin/src/utils.ts:11-49`; `packages/vite-plugin/src/partials/editor.ts:11-83` | P2(확장) - 멀티프로젝트 대응 | glob fixture에서 project list와 route 생성 검증 |
| RV-068 | CLI 렌더 API | `/render`에서 callback 비동기 모드, SSE progress 모드, JSON 응답 모드를 지원함. | `packages/cli/src/server/render.ts:8-149`; `packages/cli/src/server/download.ts:5-21` | P1(코어) - 자동화연동 필요 | API contract test로 callback/SSE/download 검증 |
| RV-069 | 임시 결과 만료 | callback 렌더 결과 파일을 10분 뒤 삭제 예약함. | `packages/cli/src/utils.ts:3-15`; `packages/cli/src/server/render.ts:17-75` | P2(확장) - 저장소관리 보조 | fake timer로 cleanup unlink 호출 검증 |
| RV-070 | React/custom element 플레이어 | 외부 앱에서 project, variables, playing, currentTime, volume, fps, quality를 제어하는 player wrapper. | `packages/player-react/src/index.tsx:29-260`; `packages/player-react/src/internal.ts:38-294` | P2(확장) - 임베드배포 옵션 | React test로 prop 변경과 custom event 검증 |
| RV-071 | 텍스트 tween/폰트 대기 | 텍스트 변경 시 폰트 로딩을 기다리고 크기와 leaf text를 함께 tween함. | `packages/2d/src/lib/components/Txt.ts:101-184` | P1(코어) - 자막품질 필요 | 한국어 폰트 fixture에서 layout jump 없는지 screenshot 검증 |
| RV-072 | 코드/토큰 애니메이션 | 코드 selection, token diff, BBox 계산, append/replace tween을 제공함. | `packages/2d/src/lib/components/Code.ts:250-511`; `packages/2d/src/lib/code/CodeSignal.ts:50-306` | P2(확장) - 교육영상 유용 | 코드 하이라이트 fixture의 token bbox 스냅샷 검증 |
| RV-073 | Flex 레이아웃 엔진 | padding/gap/flex/textWrap/font loading/clip 등 HTML 유사 layout을 canvas 렌더에 적용함. | `packages/2d/src/lib/components/Layout.ts:58-194`; `packages/2d/src/lib/components/Layout.ts:925-1033` | P1(코어) - 자막/카드배치 | 한국어 긴 문장 wrapping screenshot regression |
| RV-074 | 노드 시각 노브 | position/rotation/scale/opacity/cache/composite/filter/shadow/shader 등 장면 요소의 핵심 노브를 제공함. | `packages/2d/src/lib/components/Node.ts:69-127`; `packages/2d/src/lib/components/Node.ts:352-443` | P1(코어) - 씬편집 범위 | manifest knobs를 렌더 결과 픽셀/속성으로 검증 |
| RV-075 | GLSL include와 소스맵 | shader include, sourcemap includeMap, circular dependency guard를 Vite transform으로 처리함. | `packages/vite-plugin/src/partials/webgl.ts:20-109` | P2(확장) - 고급비주얼 옵션 | circular include fixture와 shader sourcemap 테스트 |

## 이 레포에서 배우지 말 것

1. 입력 스키마 검증 없는 렌더 API  
   `packages/cli/src/server/render.ts:17-20`, `packages/cli/src/server/render.ts:77-80`에 request body 검증 TODO가 남아 있고, `packages/vite-plugin/src/partials/ffmpegBridge.ts:39-49`도 JSON parse 후 바로 처리합니다. 우리 프로젝트는 씬 매니페스트/렌더 설정/에셋 계약을 Zod 또는 JSON Schema로 하드게이트해야 합니다.

2. 비결정 난수 기본값  
   `packages/core/src/scenes/Random.ts:27-29`에서 seed 미지정 시 `Math.random()`을 씁니다. 결정론 렌더 프로젝트에서는 암묵 seed를 금지하고, seed를 매니페스트에 저장해야 합니다.

3. 조용히 틀릴 수 있는 포맷 추론  
   `packages/ffmpeg/src/video-frame-extractor.ts:111-113`의 `split(',')[-1]`은 JS에서 마지막 원소가 아니라 `undefined`가 되어 기본 `mp4`로 떨어질 수 있습니다. 포맷/코덱 추론은 침묵 기본값 대신 명시 검증과 실패를 선택해야 합니다.