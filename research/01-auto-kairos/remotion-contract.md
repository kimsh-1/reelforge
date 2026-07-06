분석을 완료했습니다. Remotion 렌더 레이어가 매니페스트를 소비하는 방식을 스키마 수준으로 정리합니다.

---

# auto_kairos Remotion 렌더 레이어 → hyperframes 포팅을 위한 계약 분석

## 0. 먼저 알아야 할 구조적 사실: **렌더 경로가 2개다**

레포에 Remotion 프로젝트가 두 벌 있고, **같은 `SceneManifest` 계약**을 소비하지만 내부 렌더 트리가 다릅니다.

| 경로 | 위치 | 등록 컴포지션 ID | 씬 렌더 방식 | 자막 방식 |
|---|---|---|---|---|
| **A. 모던 (활성)** | `auto_agent/remotion_template/` | `SimpleVideo` (`src/Root.tsx:144`) | `SceneRendererInner` + `CreativeScene`(4548줄, `layout` 기반) | 씬 Sequence 내부 `SubtitleOverlay` |
| **B. 레거시** | 최상위 `remotion/` 및 `KairosVideo.tsx` | `KairosVideo` | `SceneSequencer` → `VisualizationRenderer`(`vizType` switch) | 독립 `SubtitleTrack` 트랙 |

- Python 렌더 브릿지(`auto_agent/tools/remotion_bridge.py:390`)는 **`KairosVideo` (경로 B)** 를 최상위 `remotion/` 디렉토리에서 렌더합니다.
- 하지만 `remotion_template`의 Root는 **`SimpleVideo` (경로 A)** 만 등록합니다. 즉 두 프로젝트가 병존하며, 대시보드/스튜디오 프리뷰는 A, CLI 렌더 브릿지는 B를 가리킵니다.
- **포팅 권고**: 계약(매니페스트)은 하나이므로 그것만 재현하면 됩니다. 비주얼 리치니스는 경로 A(`CreativeScene`)가 압도적으로 크므로, 실제 "화면"을 재현하려면 A를 기준 삼되, 시각화 슬라이드 종류 매핑은 B의 `VisualizationRenderer`(`vizType`→컴포넌트)가 가장 깔끔한 인벤토리입니다.

핵심 계약 파일: `auto_agent/remotion_template/src/types/manifest.ts` (350줄, 주석에 "Python 파이프라인과 Remotion 사이의 인터페이스 계약"이라 명시).

---

## 1. 렌더러가 소비하는 계약 (스키마)

### 1.1 최상위 매니페스트 — `SceneManifest`
근거: `manifest.ts:52-69`

```
SceneManifest {
  meta: {
    topic: string
    resolution: { width, height }      // 예: 1920×1080
    fps: number                        // 30
    subtitleFont: string               // 폰트 family 이름
    vizFont: string
    designTokens?: DesignTokens        // 색/타이포/레이아웃 토큰 (1.5 참조)
    videoTheme?: "dark" | "white"
    artStyle?: string                  // accent 색 결정
    designPreset?: DesignPresetOverride
  }
  scenes: SceneEntry[]                 // 순차 재생 (오프셋 누적)
  bgm: BGMConfig | null
}
```

**타이밍 권위(중요)**: 씬 길이는 매니페스트에 duration 필드가 없다. 오직 `audioDurationSec`를 fps로 올림해서 프레임을 구하고, 씬들을 누적 오프셋으로 이어붙인다.
- `SceneSequencer.tsx:22` / `SimpleVideo.tsx:52-58` / `SubtitleTrack.tsx:26-29`: `dur = ceil(audioDurationSec * fps)`, 최소 프레임 = (audio 있으면 1, 없으면 90).
- 전체 프레임 계산 시 씬마다 2% 패딩(최소 3프레임) 추가: `Root.tsx:122-133`.
- **hyperframes 포팅 시**: 나레이션 오디오 길이가 곧 씬 길이. 씬 간 명시적 duration이 없으므로, 각 씬 클립의 `data-duration`을 오디오 길이에서 파생시켜야 함.

### 1.2 씬 엔트리 — `SceneEntry`
근거: `manifest.ts:87-133`

```
SceneEntry {
  sceneNumber: number
  imagePath: string                    // 켄번즈 배경 이미지
  audioPath: string                    // 씬 나레이션 (씬당 1개)
  audioDurationSec: number             // ← 타이밍 권위

  subtitles: SubtitleEntry[]           // 1.3
  visualization: VisualizationData | null  // 있으면 이미지 대신 차트/슬라이드 렌더
  kenBurns: KenBurnsConfig             // 1.4
  transition: TransitionConfig         // 1.4
  vizAnimation?: VizAnimationConfig    // 시각화 등장 애니메이션 타이밍

  imageMode?: "cover" | "contain"      // contain = 원본비율+그리드배경(레퍼런스용)
  imageAsset?: {                       // 이미지 배치
    placement: "fullscreen"|"background"|"center"|"left"|"right"|"inline"
    opacity, offsetX(0~100), offsetY, scale, itemImages
  }
  overrides?: CanvasOverrides          // 캔버스 에디터 직접조작(headline x/y/fontSize, image x/y/w/h)
  vizBackgroundPath?: string           // 하이브리드 viz 배경
  trailerVideoPath?: string; trailerClip?: {startSec,endSec}  // mp4 클립 씬
  videoThumbPath?: string
  mapScene?: MapSceneData | null       // 지도 씬 (1.6)
  overlays?: OverlayItem[]             // GIF/Lottie (1.4)
}
```

씬 렌더 우선순위 분기 (경로 B `SceneSequencer.tsx:42-71`):
`trailerVideoPath` → `SceneVideo` / `mapScene` → `MapSceneRenderer` / `visualization` → `VisualizationRenderer` / else → `SceneImage`(켄번즈).

경로 A(`SceneRenderer.tsx:264-370`)는 `videoAsset`/`imageAsset.placement`(fullscreen/center/left/right/background) 기반으로 더 세분화 분기하고, 항상 `CreativeScene`을 콘텐츠 레이어로 얹는다.

### 1.3 자막 — `SubtitleEntry` (질문 3)
근거: `manifest.ts:135-141`, 렌더: `SubtitleOverlay.tsx`

```
SubtitleEntry {
  text: string
  startSec, endSec: number             // 씬 시작 기준 상대초
  keywords?: string[]                  // 하이라이트 단어
  words?: { word, start, end }[]       // 워드 단위 타이밍 (있으면 카라오케 모드)
}
```

렌더 규칙 (`SubtitleOverlay.tsx`):
- **활성 자막 선택**: `currentTimeSec`가 `[startSec, endSec)` 안인 것 하나. 마지막 자막만 1프레임 여유(`+ 1/fps`) 허용, 임의 1초 연장 금지 (`:22-28`).
- **워드 하이라이트 모드** (`words` 있을 때, `:73-104`): 각 단어가 `isPast`(지남)/`isCurrent`(현재)/미래로 3분류. 현재 단어 = `keywordColor` + `keywordStrokeColor`, 미래 단어 = opacity 0.5. `transition: color 0.1s, opacity 0.1s`. → 카라오케식 진행.
- **키워드 모드** (`words` 없을 때, `:106-138`): 정규식으로 `keywords` 매칭한 조각만 `keywordColor`로 칠함.
- **등장 애니메이션 없음** (즉시 표시, `:32` 주석 명시).

### 1.4 애니메이션/전환 설정 구조체
근거: `manifest.ts:274-343`

```
KenBurnsConfig { enabled, zoomFactor, zoomDirection?:"in"|"out",
                 panDirection?:"none"|"left"|"right"|"up"|"down", panX?, panY?, easing? }
TransitionConfig { type: crossfade|cut|fade|slide|wipe|slide_left|slide_right|wipe_left|wipe_right,
                   durationFrames, easing? }
VizAnimationConfig { stagger?, itemDuration?, easing?, titleFadeIn?, titleSlideUp?,
                     itemSyncPoints?:[{itemIndex,label,startSec,timeSec}], exitFadeOut?, exitDirection? }
OverlayItem { type:"gif"|"lottie", assetId, position(9방위+custom), x?,y?,scale?,opacity?,
              enterFrame?, exitFrame?, loop? }
```

- 켄번즈 구현: `SceneImage.tsx:24-57` — zoomDirection에 따라 scale 보간 시작/끝 스왑, panX/panY %로 translate, panDirection이 transformOrigin 결정.
- 전환 구현: `TransitionEffect.tsx` — slide=translateX ±100%, wipe=clip-path inset, fade/crossfade=opacity min(fadeIn,fadeOut). enter는 [0,dur], exit는 [total-dur,total] 구간.
- `itemSyncPoints`: 시각화 항목을 나레이션 특정 초에 맞춰 등장시키는 오디오-싱크 장치.

### 1.5 디자인 토큰 — `DesignTokens` (선택적 스타일 계약)
근거: `manifest.ts:10-50`. `style`(background/border/text/subtitle/source/grid/colors[]/gradients[]/cardBg/cardShadow/cardRadius/accentIndex/semantic{positive,negative}), `typo`(title/hero/subtitle/label/value/caption의 size/weight/letterSpacing), `layout`(topMargin/sourceHeight/titleHeight/chartHeight/safeZoneHeight/sidePadding), `vizFont`/`vizTitleFont`. 별도로 `meta.designPreset`(아트스타일 프리셋 오버라이드; 프리셋 정의는 `src/design/presets/*.ts` — semoji, semoji_3D, stickman_cute, lego, quirky_cartoon).

### 1.6 지도 씬 — `MapSceneData`
근거: `manifest.ts:239-272`. `mapType`(location_reveal/route_animation/territory_overlay/fly_through), `mapStyle`(11종), `camera.keyframes[]`(frame/center[lng,lat]/zoom/bearing/pitch), `markers`/`route`/`territories`/`labels`, 프리렌더 배경(`prerenderedBg.imagePath` + cameraState). → Mapbox/GL 기반 별도 서브시스템(`src/map/` 15파일). **hyperframes 포팅 시 가장 무겁고 이질적인 부분** — 프리렌더 정적 이미지 배경으로 대체하는 경로(`prerenderedBg`)가 이미 있으니 그 경로만 지원해도 됨.

---

## 2. 씬 비주얼 컴포넌트 인벤토리 (질문 2)

### 2.1 씬 레벨 렌더러 (배경/무대)
| 컴포넌트 | 파일 | 소비하는 매니페스트 필드 | 역할 |
|---|---|---|---|
| `SceneImage` | `components/SceneImage.tsx` | `imagePath`, `kenBurns`, `imageMode` | 켄번즈 이미지 (scale/pan 보간), contain 모드는 그리드배경+원본비율 |
| `SceneVideo` | `components/SceneVideo.tsx` | `trailerVideoPath`, `trailerClip` | mp4 클립 씬 (`OffthreadVideo`) |
| `SceneRendererInner` | `components/SceneRenderer.tsx` | `imageAsset.placement`, `videoAsset`, `vizBackgroundPath` | placement 분기(fullscreen/center/left/right/background) + 콘텐츠 레이어 조립 |
| `ImageBg`/`VideoBg`/`SideLayout`/`CenterLayout`/`TextureOverlay` | 동 파일 내부 | offsetX/Y, scale, opacity, fit | 배치 헬퍼. SideLayout=40% 이미지+마스크 그라데이션, mood radial-gradient 배경 |
| `MapSceneRenderer` | `map/MapSceneRenderer.tsx` | `mapScene` | 지도 씬 디스패치 |
| `CanvasScene` | `simple/CanvasScene.tsx` | `scene._canvas.layers` | 프리미어식 캔버스 오버라이드 렌더 |

### 2.2 시각화 슬라이드 컴포넌트 (경로 B `VisualizationRenderer.tsx:80-144`가 `vizType`으로 디스패치)
모두 `{ data: VisualizationData, durationInFrames, fps, vizAnimation }` props를 받음. 위치: `src/visualizations/`.

| `vizType` | 컴포넌트 | 주 소비 필드 |
|---|---|---|
| bar_chart / graph | `BarChart` | items[], values[], unit, source |
| line_chart | `LineChart` | items[], values[] |
| pie_chart | `PieChart` | items[], values[], chartStyle(pie/donut) |
| tech_tree | `TechTree` | items[], relations[], descriptions[] |
| timeline | `Timeline` | items[], values[] |
| table | `TableView` | items[], values[] |
| compare / diagram / slide_compare | `Compare` | left{label,items}, right{label,items} |
| slide_list | `SlideList` | items[], itemIcons[] |
| slide_numbered | `SlideNumbered` | items[] |
| slide_highlight | `SlideHighlight` | value, subtitle, chapter |
| slide_statistic | `SlideStatistic` | value, unit, source |
| slide_proscons | `SlideProscons` | left/right, semantic 색 |
| slide_definition | `SlideDefinition` | descriptions[] |
| slide_summary | `SlideSummary` | items[] |
| slide_profile | `SlideProfile` | profileName, profileSubtitle, imagePath |
| slide_ranking | `SlideRanking` | items[], values[] |
| slide_process | `SlideProcess` | items[] |
| slide_checklist | `SlideChecklist` | items[] |
| slide_qna | `SlideQna` | items[] |
| slide_countdown | `SlideCountdown` | value |
| impact_count/dramatic_number/counter_wall/icon_stat/slide_bignum | → `SlideStatistic` (폴백) | value |
| reveal_sequence | → `SlideNumbered` | items[] |
| split_contrast | → `Compare` | left/right |
| spotlight_reveal/title_card | → `SlideHighlight` | value/chapter |
| narrative_build/word_cascade/icon_grid | → `SlideList` | items[] |
| (default) | → `BarChart` | — |

공통 shell: `visualizations/VizShell.tsx`, 스타일 토큰 `vizStyles.ts`, 폰트 `FONT_DEFS`(JS FontFace API로 `delayRender`까지 로드 — CSS @font-face는 렌더서버 404난다고 명시, `VisualizationRenderer.tsx:37-64`), i18n `vizI18n.ts`, 배경 컨텍스트 `VizBackgroundContext`.

### 2.3 Creative Direction 레이어 (경로 A `CreativeScene.tsx`, 4548줄)
`VisualizationData.creative`(`CreativeDirection`: concept/layout/reveal/emphasis/headline/mood — `manifest.ts:143-154`)와 `cinematicOverlay`(speech_bubble/emotion/caption + position)를 소비. `resolvedLayout`으로 분기: quote/quote_portrait/cinematic/items_grid/items_list/bar_horizontal/donut/bar/pie/line/hero_with_context 등. `reveal` 애니메이션 종류(`CreativeScene.tsx:544-573`): fade_in, parallel, zoom_in, stagger, typewriter, cascade, build_up, stagger_then_flash, count_up, dramatic_pause, spotlight, split_reveal. `emphasis`: number/keyword/count/contrast/sequence/person/quote. 엔트런스 모션: bounce/scale/spring/overshoot + shake/pulse/glitch 강조. → **이 파일이 실제 "예쁜 화면"의 대부분**이며 포팅 비용이 가장 큰 단일 컴포넌트.

### 2.4 오버레이 레이어
| 컴포넌트 | 파일 | 소비 필드 |
|---|---|---|
| `OverlayLayer` | `components/OverlayLayer.tsx` | `scene.overlays[]` (씬 오프셋으로 Sequence 배치) |
| `GifOverlay` | `components/GifOverlay.tsx` | OverlayItem (assetId→`overlays/gifManifest.ts`) |
| `LottieOverlay` | `components/LottieOverlay.tsx` | OverlayItem (assetId→`overlays/lottieManifest.ts`) |
| `TextureOverlay` | SceneRenderer 내부 | preset.texture{src,blendMode,opacity,topLayer} — 최상위 blend 레이어 |

에셋 ID 해석은 `overlays/resolveOverlay.ts` + `gifManifest.ts`/`lottieManifest.ts`(카탈로그).

---

## 3. 오디오 트랙 합성 (질문 4)

Remotion은 **모든 `<Audio>` 태그를 자동 믹싱**한다 — 별도 ffmpeg 믹스/mux 단계 없음. 구조:

- **나레이션**: 씬마다 `<Audio src={audioPath} />`를 그 씬의 `Sequence` 안에 배치 (`SceneSequencer.tsx:74`, `SimpleVideo.tsx:117`). Sequence 오프셋 = 씬 시작 프레임 → 순차 재생.
- **BGM**: 단일 `<Audio src loop volume>` (`BGMLayer.tsx:14-20`, `SimpleVideo.tsx:125-131`). `BGMConfig { path, volume, loop }` (`manifest.ts:345`).
- **BGM 볼륨**: 정적 상수. Python 브릿지 기본값 `bgm_volume: float = 0.1` (`remotion_bridge.py:144`), 매니페스트에 그대로 박힘(`:271`). 코드 폴백 0.15 (`SimpleVideo.tsx:128`).
- **더킹(ducking) 없음**: 나레이션이 말할 때 BGM을 자동으로 낮추는 로직이 **코드에 존재하지 않음**. `duck` 키워드 grep 결과 0건. BGM은 전체 구간 고정 볼륨. → hyperframes 포팅 시 더킹은 신규 기능으로 추가하거나 그대로 고정볼륨 유지.
- **씬 비디오 오디오**: `SceneVideo`/`VideoBg`는 기본 `volume=0`/`muted`(`SceneRenderer.tsx:79,96`) — 클립 사운드는 기본 죽이고 나레이션+BGM만.

**포팅 요약**: 2트랙(순차 나레이션 + 루프 BGM) 정적 믹스. hyperframes 오디오 엔진(`scripts/audio.mjs`)의 나레이션 순차 배치 + BGM 언더레이 + (선택)더킹으로 매핑.

---

## 4. 최종 렌더 명령과 출력 스펙 (질문 5)

### 4.1 CLI 렌더 (본편) — `remotion_bridge.py:388-395`
```
npx remotion render KairosVideo <output.mp4> \
  --props <manifest.json 절대경로> \
  --codec h264 \
  --crf <self.crf, 기본 18> \
  --concurrency <기본 2>
```
- 실행 디렉토리: `self.remotion_dir` (기본 = repo/`remotion/`, `:66`). `node_modules` 없으면 `npm install` 선행(`:327-330`).
- props 매니페스트는 렌더 전 `public/manifest.json`으로 복사, BGM/에셋 경로를 `_to_public_relative`로 public 상대경로 변환(`:362-386`).
- 타임아웃 1800초, `env=node_env`(`get_env_with_node`).
- **출력 스펙**: 해상도/fps는 매니페스트 `meta.resolution`/`meta.fps`가 `calculateMetadata`로 컴포지션에 주입(`Root.tsx:159-167`). 기본 1920×1080 @ 30fps. 코덱 h264, CRF 18. pixelFormat/audioCodec은 미지정(Remotion 기본 = yuv420p / aac).

### 4.2 씬별 프리뷰 렌더 (스토리보드) — `render_scene.js:105-112`
```js
renderMedia({ composition, serveUrl: bundled, codec: "h264",
              outputLocation: `scene_NNN.mp4`, inputProps, concurrency: 2 })
// selectComposition으로 id별 composition 로드 (:95-99)
```
씬별 mp4 개별 출력 + `render_results.json` 결과 기록.

### 4.3 멀티포맷 컴포지션 (`Root.tsx:214-267`, Folder "Formats")
| ID | 해상도 | fps | 용도 |
|---|---|---|---|
| SimpleVideo | 1920×1080 (매니페스트 override) | 30 | 본편 |
| Scene-1..80 | 1920×1080 | 30 | 씬 개별 편집 |
| Thumbnail | 1920×1080 | 30 (1프레임) | 썸네일 |
| Shorts | 1080×1920 | 30 | 세로 쇼츠 |
| CardNews | 1080×1080 | 30 (1프레임) | 정사각 카드뉴스 |

---

## 5. hyperframes 포팅 개념 체크리스트 (무엇을 옮겨야 하나)

1. **매니페스트 스키마 재현** — `SceneManifest`/`SceneEntry`/`SubtitleEntry` (`types/manifest.ts`)를 hyperframes 입력 계약으로 1:1 매핑. 특히 **씬 길이 = `audioDurationSec` 파생**이라는 타이밍 규칙.
2. **씬 배경 4종** — 켄번즈 이미지 / mp4 클립 / 시각화 슬라이드 / 지도(프리렌더 배경 경로만 지원 권장).
3. **자막 2모드** — 워드 단위 카라오케(`words[]`) + 키워드 하이라이트(`keywords[]`). 스타일 옵션은 `SubtitleConfig`(fontSize/weight/color/stroke/keywordColor/bottomOffset/maxWidth/lineHeight/backgroundColor/borderRadius — `manifest.ts:307-323`) 전부 포팅.
4. **전환/켄번즈** — crossfade/cut/fade/slide/wipe + zoom/pan 보간. hyperframes GSAP/CSS 어댑터로 대체.
5. **시각화 슬라이드 ~20종** (`visualizations/*`) — 차트(bar/line/pie/table/timeline/compare/techtree) + 슬라이드(list/numbered/highlight/statistic/proscons/definition/summary/profile/ranking/process/checklist/qna/countdown). `vizType`→컴포넌트 매핑(§2.2)이 포팅 매트릭스.
6. **Creative Direction 레이어**(`CreativeScene.tsx`) — reveal/emphasis/mood/motion 프리셋. 가장 큰 재작성 대상.
7. **오버레이** — GIF/Lottie(`OverlayItem` + 카탈로그 매니페스트) + 텍스처 blend.
8. **오디오** — 순차 나레이션 + 루프 BGM 정적 믹스(더킹 없음, BGM vol 0.1).
9. **디자인 프리셋/토큰** — `design/presets/*.ts`(5종) + `DesignTokens`.
10. **출력 스펙** — 1920×1080@30 h264 CRF18(본편) + 1080×1920 쇼츠 + 1080×1080 카드뉴스.

**최대 리스크**: `CreativeScene.tsx`(4548줄)와 `map/`(15파일 Mapbox) 서브시스템. 이 둘이 포팅 노력의 대부분을 차지하며, 나머지는 선언적 매니페스트라 비교적 기계적으로 옮길 수 있습니다.