| ID | 기능명 | 설명(1-2줄) | 근거(파일:라인) | 채택제안 | 검증방법 |
|---|---|---|---|---|---|
| MC-001 | 프로젝트 계약 객체 | 프로젝트가 scenes, plugins, logger, audio, variables, experimentalFeatures를 단일 설정 계약으로 받는다. | packages/core/src/app/Project.ts:7 | P0 - 매니페스트 기본 | `manifest-schema.test.ts`로 필수/선택 필드 검증 |
| MC-002 | 전역 렌더 메타 노브 | background, range, resolution, audioOffset, preview/render fps, scale, colorSpace, exporter를 런타임 메타로 가진다. | packages/core/src/app/ProjectMetadata.ts:15 | P0 - 렌더 계약 핵심 | `render-settings.schema.test.ts`로 기본값/직렬화 검증 |
| MC-003 | 앱 기본 설정 메타 | UI accent color, 좌표 표시, 기본 배경/해상도를 프로젝트 밖 전역 설정으로 관리한다. | packages/core/src/app/SettingsMetadata.ts:13 | P1 - 편집 환경 | `settings-persistence.test.ts`로 기본값 병합 검증 |
| MC-004 | 프리셋 기반 설정 | scale, color space, file type, FPS를 enum/preset 옵션으로 제한한다. | packages/core/src/app/presets.ts:4 | P1 - 노브 표준화 | `settings-presets.test.ts`로 허용값만 통과 |
| MC-005 | 메타파일 브리지 | 런타임 MetaField 변경을 HMR 메시지로 실제 `.meta` JSON 파일에 저장하고 ack를 기다린다. | packages/core/src/meta/MetaFile.ts:35 | P0 - JSON 왕복 | `meta-roundtrip.e2e.ts`로 UI 수정 후 파일 반영 확인 |
| MC-006 | 씬 메타 계약 | 씬별 timeEvents와 seed를 별도 메타로 가진다. | packages/core/src/scenes/SceneMetadata.ts:8 | P0 - 씬 결정론 | `scene-meta.schema.test.ts`로 seed/timeEvents 검증 |
| MC-007 | 씬 설명/리로드 계약 | SceneDescription에 klass/config/plugins/meta를 두고 reload는 size/resolution/config/stack만 갱신한다. | packages/core/src/scenes/Scene.ts:39 | P0 - 부분 재계산 | `scene-reload.test.ts`로 config 변경 범위 검증 |
| MC-008 | 씬 캐시 타이밍 | firstFrame, lastFrame, transitionDuration, duration을 캐시해 씬 길이를 재계산한다. | packages/core/src/scenes/GeneratorScene.ts:208 | P0 - 부분 렌더 | `scene-cache.test.ts`로 재계산 후 프레임 범위 확인 |
| MC-009 | 비동기 리소스 렌더 반복 | render 중 DependencyContext promise를 최대 10회 소비해 비동기 노드 준비를 반영한다. | packages/core/src/scenes/GeneratorScene.ts:168 | P1 - 에셋 안정성 | `async-assets-render.test.ts`로 지연 이미지 렌더 확인 |
| MC-010 | 준비 전 비동기 속성 오류 | 노드 준비 전 async property 접근을 감지해 inspect 가능한 에러를 남긴다. | packages/core/src/scenes/GeneratorScene.ts:269 | P1 - 품질 게이트 | `async-property-gate.test.ts`로 에러 로그 검증 |
| MC-011 | 캐시 기반 seek 최적화 | seek 시 캐시된 씬과 transitionDuration을 이용해 가장 가까운 씬부터 진행한다. | packages/core/src/app/PlaybackManager.ts:83 | P0 - 부분 재렌더 | `seek-cache.test.ts`로 중간 프레임 seek 비용 측정 |
| MC-012 | 범위 렌더러 | renderer가 settings.range를 frame 범위로 변환하고 exporter lifecycle로 프레임을 넘긴다. | packages/core/src/app/Renderer.ts:180 | P0 - 렌더 파이프라인 | `range-render.e2e.ts`로 지정 구간 프레임 수 검증 |
| MC-013 | 단일 프레임 스냅샷 | 현재 time을 프레임으로 seek한 뒤 PNG still로 export한다. | packages/core/src/app/Renderer.ts:147 | P1 - QA 스냅샷 | `snapshot-frame.e2e.ts`로 특정 프레임 PNG 비교 |
| MC-014 | 렌더 abort 상태 | RendererState Working/Aborting과 AbortController로 장시간 렌더 중단을 지원한다. | packages/core/src/app/Renderer.ts:25 | P1 - 운영 안정성 | `render-abort.e2e.ts`로 abort 후 상태 복귀 확인 |
| MC-015 | Exporter 플러그인 계약 | custom exporter가 configuration/start/handleFrame/stop 훅을 구현한다. | packages/core/src/app/Exporter.ts:9 | P0 - 확장 핵심 | `exporter-contract.test.ts`로 mock exporter 호출 순서 검증 |
| MC-016 | 이미지 시퀀스 exporter | fileType, quality, groupByScene 옵션과 256프레임 backpressure를 가진다. | packages/core/src/app/ImageExporter.ts:35 | P1 - 기본 산출물 | `image-exporter.e2e.ts`로 파일명/품질/그룹 검증 |
| MC-017 | FFmpeg exporter 옵션 | fastStart, includeAudio, audioSampleRate를 영상 exporter 메타로 노출한다. | packages/ffmpeg/client/FFmpegExporterClient.ts:60 | P1 - MP4 산출 | `ffmpeg-options.test.ts`로 옵션 전달 검증 |
| MC-018 | raw RGBA 프레임 전송 | Canvas ImageData를 octet-stream으로 서버에 보내 ffmpeg rawvideo 입력으로 처리한다. | packages/ffmpeg/client/FFmpegExporterClient.ts:122 | P1 - 서버 렌더 | `ffmpeg-stream.e2e.ts`로 프레임 byte length 검증 |
| MC-019 | 오디오 ffmpeg 믹싱 | 메인 오디오와 sound를 trim, resample, gain, asetrate, adelay, amix filter graph로 합친다. | packages/ffmpeg/server/FFmpegExporterServer.ts:74 | P1 - TTS 믹스 | `audio-mix-golden.test.ts`로 filter graph snapshot |
| MC-020 | 프레임 스트림 큐 | 서버 ImageStream이 frame/end 큐로 raw frame 순서를 보존한다. | packages/ffmpeg/server/ImageStream.ts:13 | P1 - 순서 보장 | `image-stream.test.ts`로 순서/EOF 검증 |
| MC-021 | ETA 산출기 | completion, elapsed, eta를 계산하고 렌더 UI에 노출한다. | packages/core/src/app/TimeEstimator.ts:25 | P2 - UX 보강 | `time-estimator.test.ts`로 ETA 수식 검증 |
| MC-022 | Stage 3중 버퍼 | current/previous/final canvas를 두고 배경, colorSpace, resolutionScale, transition 합성을 처리한다. | packages/core/src/app/Stage.ts:7 | P0 - 합성 핵심 | `stage-composite.test.ts`로 이전/현재 씬 합성 비교 |
| MC-023 | 플레이어 상태 노브 | paused, loop, muted, volume, speed와 range/fps/size/audioOffset을 플레이어 설정으로 관리한다. | packages/core/src/app/Player.ts:18 | P1 - 검수 재생 | `player-state.test.ts`로 상태 전이 검증 |
| MC-024 | 오디오 싱크 보정 | MAX_AUDIO_DESYNC 기준으로 애니메이션 frame과 audio currentTime을 상호 seek한다. | packages/core/src/app/Player.ts:459 | P0 - 자막 싱크 | `audio-sync.e2e.ts`로 드리프트 허용치 검증 |
| MC-025 | 오디오 클립 제어 | AudioManager가 offset, trim, playbackRate, pitch preserve, mute/volume을 처리한다. | packages/core/src/media/AudioManager.ts:54 | P1 - TTS 제어 | `audio-manager.test.ts`로 time 변환 검증 |
| MC-026 | waveform peak 추출 | 오디오를 decode해 min/max peaks, absoluteMax, sampleRate, duration을 계산한다. | packages/core/src/media/AudioResourceManager.ts:87 | P1 - 싱크 UI | `waveform-peaks.test.ts`로 fixture peak 비교 |
| MC-027 | 씬 효과음 빌더 | sound(audio).trim().gain().detune().playbackRate().play() 형태로 씬 시점 효과음을 등록한다. | packages/core/src/scenes/Sounds.ts:19 | P2 - 사운드 확장 | `scene-sounds.test.ts`로 offset/realPlaybackRate 검증 |
| MC-028 | 편집 가능 타임 이벤트 | time event offset을 바꾸면 preserveTiming 옵션에 따라 후속 targetTime을 보존/재계산한다. | packages/core/src/scenes/timeEvents/EditableTimeEvents.ts:33 | P0 - 워드싱크 보정 | `time-event-edit.test.ts`로 shift 보정 검증 |
| MC-029 | named waitUntil/useDuration | `useDuration(name)`이 timeline event를 등록하고 `waitUntil`이 해당 duration만큼 대기한다. | packages/core/src/utils/useDuration.ts:28 | P0 - 자막 타임코드 | `named-timing.test.ts`로 event duration 반영 |
| MC-030 | 슬라이드 체크포인트 | beginSlide/Slides가 named slide를 등록하고 발표/탐색 시 해당 지점에서 대기한다. | packages/core/src/scenes/Slides.ts:69 | P2 - 장면 검수 | `slide-checkpoint.test.ts`로 slide seek 검증 |
| MC-031 | 프로젝트 변수 signal | 외부 variables가 scene signal로 주입되고 리셋 시 초기화된다. | packages/core/src/scenes/Variables.ts:19 | P1 - 템플릿 주입 | `scene-variables.test.ts`로 변수 갱신 검증 |
| MC-032 | seed 기반 랜덤 | scene meta seed로 Random을 만들고 reset 때 같은 seed로 재생성한다. | packages/core/src/scenes/Random.ts:20 | P0 - 결정론 핵심 | `random-determinism.test.ts`로 동일 seed 비교 |
| MC-033 | Vite 프로젝트/씬 가상 모듈 | `?project`, `?scene`으로 meta 생성, bootstrap, scene replacement HMR을 구성한다. | packages/vite-plugin/src/partials/scenes.ts:11 | P1 - 개발 루프 | `vite-virtual-modules.test.ts`로 생성 코드 snapshot |
| MC-034 | `.meta` 파일 HMR 저장 | meta 변경 ws 이벤트를 JSON 파일로 쓰고 자체 저장 직후 hot update는 무시한다. | packages/vite-plugin/src/partials/meta.ts:42 | P0 - 편집 저장 | `meta-hmr.e2e.ts`로 저장/ack/무한루프 방지 |
| MC-035 | 전역 settings 파일 | `~/.motion-canvas/settings.json`을 virtual module로 읽고 변경 시 파일과 module cache를 갱신한다. | packages/vite-plugin/src/partials/settings.ts:6 | P1 - 사용자 설정 | `settings-file.test.ts`로 invalid/valid 파일 처리 |
| MC-036 | buffered asset 서빙 | 지정 regex asset은 메모리에서 stream하고 audio asset HMR은 지연 후 browser에 알린다. | packages/vite-plugin/src/partials/assets.ts:13 | P1 - 에셋 안정성 | `asset-hmr.test.ts`로 audio reload 이벤트 검증 |
| MC-037 | CORS proxy 검증 | remote asset proxy가 GET만 허용하고 host allowlist, MIME allowlist, protocol을 검사한다. | packages/vite-plugin/src/partials/corsProxy.ts:103 | P2 - 원격 에셋 | `cors-proxy.test.ts`로 host/MIME 차단 검증 |
| MC-038 | GLSL include 처리 | `.glsl`의 `#include`를 재귀 resolve하고 source map/includeMap과 순환 의존성 감지를 제공한다. | packages/vite-plugin/src/partials/webgl.ts:74 | P2 - 고급 효과 | `glsl-include.test.ts`로 순환 감지 검증 |
| MC-039 | 런타임 플러그인 훅 | plugin이 settings/project/player/presenter/renderer/exporters 단계에 개입한다. | packages/core/src/plugin/Plugin.ts:13 | P1 - 모듈화 핵심 | `plugin-hooks.test.ts`로 훅 호출 순서 검증 |
| MC-040 | 편집기 플러그인 슬롯 | sidebar tab, inspector, preview/presenter overlay, shortcut을 플러그인으로 추가한다. | packages/ui/src/plugin/EditorPlugin.ts:98 | P1 - 대시보드 확장 | `editor-plugin.spec.ts`로 tab/overlay mount 검증 |
| MC-041 | Video Settings 패널 | shared/preview/rendering meta를 자동 표시하고 Render/Present/Abort/Open Output 액션을 제공한다. | packages/ui/src/components/sidebar/VideoSettings.tsx:10 | P1 - 운영 UI | `video-settings.spec.ts`로 버튼 상태 검증 |
| MC-042 | 줌 가능한 타임라인 | timeline이 frame/second/pixel 변환, zoom, virtual visible frame 범위를 계산한다. | packages/ui/src/components/timeline/Timeline.tsx:75 | P1 - 편집 핵심 | `timeline-geometry.test.ts`로 좌표 변환 검증 |
| MC-043 | 렌더 범위 드래그 | range selector가 start/end frame을 drag/drop, double-click reset, shortcut으로 갱신한다. | packages/ui/src/components/timeline/RangeSelector.tsx:17 | P0 - 부분 렌더 | `range-selector.spec.ts`로 drag 후 meta 확인 |
| MC-044 | 타임 라벨 드래그 | label clip을 drag해 time event offset을 수정하고 더블클릭으로 소스 위치를 연다. | packages/ui/src/components/timeline/Label.tsx:27 | P0 - 싱크 수동보정 | `label-drag.spec.ts`로 offset 저장 검증 |
| MC-045 | waveform 타임라인 | main audio와 scene sounds를 waveform clip으로 그리고 main audio offset을 drag로 수정한다. | packages/ui/src/components/timeline/AudioTrack.tsx:39 | P1 - 나레이션 QA | `waveform-ui.spec.ts`로 offset drag 검증 |
| MC-046 | 씬 클립 트랙 | scene duration/transition을 timeline clip으로 표시하고 middle click으로 range를 씬 단위로 설정한다. | packages/ui/src/components/timeline/SceneTrack.tsx:26 | P1 - 씬 단위 렌더 | `scene-track.spec.ts`로 씬 range 설정 |
| MC-047 | 프레임 단위 재생 컨트롤 | 속도, 볼륨, mute, loop, first/prev/next/last frame, snapshot을 제공한다. | packages/ui/src/components/playback/PlaybackControls.tsx:21 | P1 - 검수 조작 | `playback-controls.spec.ts`로 단축키/버튼 검증 |
| MC-048 | viewport pan/zoom/grid | 미리보기에서 zoom-to-fit, custom zoom, pan, recenter, grid, color picker, coordinates를 제공한다. | packages/ui/src/components/viewport/EditorPreview.tsx:42 | P1 - 시각 QA | `viewport-controls.spec.ts`로 pan/zoom/grid 검증 |
| MC-049 | overlay canvas 훅 | 플러그인 drawHook을 preview matrix와 함께 overlay canvas에 그린다. | packages/ui/src/components/viewport/OverlayCanvas.tsx:13 | P1 - QA 오버레이 | `overlay-hook.spec.ts`로 bbox overlay pixel 비교 |
| MC-050 | 구조화 콘솔 | log level filter, remarks/object/stack/duration/inspect 버튼을 UI에서 제공한다. | packages/ui/src/components/console/Log.tsx:19 | P0 - 하드게이트 UX | `quality-log.spec.ts`로 실패 로그 표시 검증 |
| MC-051 | source map 원본 이동 | stack trace를 source map으로 원본 파일/라인으로 변환하고 editor open endpoint를 호출한다. | packages/ui/src/utils/sourceMaps.ts:45 | P1 - 수정 루프 | `source-map-open.test.ts`로 원본 위치 resolve |
| MC-052 | Inspectable 씬 인터페이스 | scene이 hit test, attribute 조회, overlay drawing, mouse transform을 구현할 수 있다. | packages/core/src/scenes/Inspectable.ts:25 | P1 - 요소 검수 | `inspectable-contract.test.ts`로 hit/attrs 검증 |
| MC-053 | 씬 그래프 탐색 | node tree가 selection, hover, expand, detached nodes, keyboard navigation을 제공한다. | packages/2d/src/editor/tree/NodeElement.tsx:13 | P2 - DOM 트리 UI | `scene-graph.spec.ts`로 키보드 탐색 검증 |
| MC-054 | 노드 인스펙터 | 선택 노드의 inspectable signal 값과 key, source jump를 표시한다. | packages/2d/src/editor/NodeInspectorConfig.tsx:16 | P1 - 요소 디버깅 | `node-inspector.spec.ts`로 속성 표시 검증 |
| MC-055 | JSX 씬 그래프 | JSX runtime이 class component Node를 생성하고 ref/children을 연결한다. | packages/2d/src/lib/jsx-runtime.ts:25 | P2 - 저작 DSL 참고 | `jsx-scene.test.ts`로 ref/children 생성 검증 |
| MC-056 | 노드 캐시/효과 합성 | opacity, composite, filters, shadow, shaders가 있으면 cache canvas로 렌더 후 효과를 적용한다. | packages/2d/src/lib/components/Node.ts:1348 | P2 - 효과 품질 | `node-cache-render.test.ts`로 효과 pixel 비교 |
| MC-057 | 브라우저 flex 레이아웃 | Layout이 hidden DOM element에 flex/font style을 적용하고 boundingClientRect로 canvas 배치를 계산한다. | packages/2d/src/lib/components/Layout.ts:950 | P1 - HTML 기반 적합 | `layout-render.spec.ts`로 DOM/canvas 좌표 비교 |
| MC-058 | 이미지 에셋 캐시/프록시 | Img가 crossOrigin image pool, asset-hash cache busting, proxy URL, DetailedError를 사용한다. | packages/2d/src/lib/components/Img.ts:150 | P1 - 에셋 관리 | `image-asset.test.ts`로 reload/error 검증 |
| MC-059 | 비디오 프레임 seek | Video가 playback state에 따라 fast seek/정밀 seek를 나누고 seeked promise를 수집한다. | packages/2d/src/lib/components/Video.ts:196 | P2 - 영상 소스 | `video-seek.test.ts`로 특정 time frame 비교 |
| MC-060 | 코드/수식/SVG 모핑 | Code는 range/diff/highlighter, SVG는 transform diff, Latex는 sub-tex 단위로 구조적 전환을 만든다. | packages/2d/src/lib/components/Code.ts:323 | P2 - 설명영상 확장 | `structured-morph.test.ts`로 diff 전환 snapshot |

## 이 레포에서 배우지 말 것

1. 원격 에셋 proxy를 allowlist 없이 열어두는 기본 동작은 피해야 한다. `allowListHosts`가 비면 모든 hostname을 허용한다. 근거: packages/vite-plugin/src/partials/corsProxy.ts:91, packages/vite-plugin/src/partials/corsProxy.ts:175

2. 손상된 설정 JSON을 조용히 무시하는 방식은 품질 하드게이트와 맞지 않는다. invalid settings를 catch 후 무시한다. 근거: packages/vite-plugin/src/partials/settings.ts:27, packages/vite-plugin/src/partials/settings.ts:46

3. exporter 종료 시 pending frame을 모두 drain하지 않는 패턴은 위험하다. FFmpeg client는 `concurrentFrames >= EXPORT_FRAME_LIMIT`일 때만 기다려 1~255개 pending frame이 남을 수 있다. 근거: packages/ffmpeg/client/FFmpegExporterClient.ts:134, packages/ffmpeg/client/FFmpegExporterClient.ts:143