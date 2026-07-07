# Scene Authoring Reference

Use this reference when drafting or repairing ReelForge `scene_specs.json`.

## Scene Skeleton

Each scene is closed-schema and must use only contract fields:

```json
{
  "sceneId": "s01",
  "sceneNumber": 1,
  "narration": "사용자에게 보일 수 있는 문장입니다.",
  "narration_tts": "티 티 에스가 읽을 문장입니다.",
  "altText": "장면의 핵심 시각 정보를 설명한다.",
  "layout": "statistic",
  "mood": "informative",
  "reveal": "count_up",
  "emphasis": "number",
  "headline": "핵심 수치",
  "items": ["평균 응답 시간", "목표 대비 개선"],
  "values": [184, 16],
  "unit": "ms",
  "source": "brief:user",
  "visual_kind": "none",
  "kenBurns": {
    "enabled": false,
    "zoomFactor": 1,
    "zoomDirection": "in",
    "panDirection": "none"
  },
  "subtitleMode": "karaoke"
}
```

Never add `duration` to a scene. Only transition edges own `duration`.

## Items And Values

| Layout | Use for | `items` | `values` | Notes |
|---|---|---|---|---|
| `bar` | ranked quantities | category labels | numbers | 2-6 bars read best; include `unit`. |
| `pie` | share of whole | slice labels | numbers | Prefer percentages or clean proportions. |
| `line` | time sequence | time labels | numbers | Keep chronological order. |
| `list` | checklist/status | bullet labels | strings or numbers | Use short status values such as `진행`, `대기`, `완료`. |
| `numbered` | ordered steps | step labels | step numbers | Values should match the order. |
| `statistic` | one dominant metric | metric labels | numbers or short strings | Put the hero metric first. |
| `compare` | before/after or A/B | paired labels | paired values | Keep order symmetrical: old/new, old/new. |
| `quote` | cited voice or insight | source and quote | context strings | Keep the quote concise enough for one card. |

General limits: `items` and `values` max 40 entries; item text max 200 chars; string values max 120 chars. Keep most production scenes far below those limits.

## Visual Fields

Use `visual_kind` deliberately:

- `chart`: data-driven layouts such as `bar`, `pie`, `line`, or metric comparisons.
- `generate_image`: needs `imageAsset.prompt` and `imageAsset.placement`; the pipeline will create selected assets through `image-manifest.json` and `versions.json`.
- `search_image`: reserved for stock/search-backed visuals.
- `map_scene`: reserved for geographic scenes.
- `video`: reserved for external clip placement.
- `none`: text, chartless, or pure layout scenes.

Allowed `imageAsset.placement`: `fullscreen`, `background`, `center`, `left`, `right`, `inline`.

Use `kenBurns.enabled=true` only when an image or visual plate benefits from slow motion. Keep `zoomFactor >= 1`; use `panDirection` from `none`, `left`, `right`, `up`, `down`.

## Mood And Reveal Pairing

| Intent | Mood | Reveal | Emphasis |
|---|---|---|---|
| Neutral explanation | `informative` | `stagger` or `fade_in` | `keyword` |
| Urgent next step | `urgent` | `stagger_then_flash` or `cascade` | `count` or `sequence` |
| Serious cost/risk | `somber` | `cascade` or `dramatic_pause` | `contrast` |
| Reflective user insight | `contemplative` | `typewriter` or `fade_in` | `quote` |
| Suspense before result | `suspense` | `split_reveal` or `dramatic_pause` | `contrast` |
| Win or growth | `triumphant` | `build_up` or `zoom_in` | `number` |
| Big metric | `dramatic` | `count_up` or `spotlight` | `number` |

Available reveals are `fade_in`, `stagger`, `stagger_then_flash`, `cascade`, `count_up`, `typewriter`, `spotlight`, `split_reveal`, `zoom_in`, `build_up`, `dramatic_pause`, and `parallel`.

## Transitions

Create scene-to-scene edges only:

```json
{ "from": "s01", "to": "s02", "type": "fade", "duration": 0.2 }
```

Allowed types: `cut`, `fade`, `crossfade`, `slide`, `wipe`, `slide_left`, `slide_right`, `wipe_left`, `wipe_right`.

Use `cut` with `duration: 0`. For other transitions, use 0.2-0.25 seconds by default. Do not attach transition fields to scenes.

## Korean TTS Preprocessing

Author `narration_tts` for speech clarity, not typography.

- Expand symbols: `%` -> `퍼센트`, `ms` -> `밀리초`, `/` -> context-specific words.
- Spell numbers naturally when pronunciation matters: `37%` -> `삼십칠 퍼센트`, `184ms` -> `백팔십사 밀리초`.
- Remove invisible or control characters. Headlines reject zero-width characters.
- Avoid emoji, Markdown bullets, bracket labels like `[DRAFT]`, and dense punctuation in `narration_tts`.
- Keep each scene to one strong sentence when possible. Split long Korean explanations into multiple scenes instead of forcing long audio.
- Preserve `narration_tts` exactly once audio exists unless the change is intentional; it drives `audio_meta.scenes[].sourceHash`.

Use `subtitleMode: "karaoke"` when word timing matters and `subtitleMode: "keyword"` when the scene is dense or list-like.

## Accessibility

Write `altText` as visual description:

- Mention chart type and the important values for data scenes.
- Mention layout and visible relation for comparison scenes.
- Mention quote/source treatment for quote scenes.
- Do not copy narration verbatim unless it truly describes the visual.

Good: `막대 차트가 검색 유입 6200명, 추천 유입 4800명, 광고 유입 3100명을 비교한다.`

Weak: `지난주 신규 가입은 검색 유입이 가장 컸다.`
