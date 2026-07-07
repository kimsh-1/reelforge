export const SCENE_SCHEMA_FALLBACK = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://video-factory.local/schemas/scene-specs.schema.json",
  type: "object",
  required: ["version", "projectId", "scenes", "transitions"],
  properties: {
    version: { type: "string", pattern: "^\\d+\\.\\d+\\.\\d+$" },
    projectId: { type: "string", pattern: "^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$" },
    scenes: { type: "array", items: { $ref: "#/$defs/scene" } },
    transitions: { type: "array", items: { $ref: "#/$defs/transition" } }
  },
  $defs: {
    sceneId: { type: "string", pattern: "^s\\d{2,}$" },
    safeTitleText: {
      type: "string",
      pattern: "^[^\\u0000-\\u001F\\u007F-\\u009F\\u180E\\u200B\\u200C\\u200D\\u2060\\uFEFF]*$"
    },
    percent: { type: "number", minimum: 0, maximum: 100 },
    layout: {
      type: "string",
      enum: ["bar", "pie", "line", "list", "numbered", "statistic", "compare", "quote", "headline_only"]
    },
    mood: {
      type: "string",
      enum: ["dramatic", "urgent", "somber", "informative", "contemplative", "suspense", "triumphant"]
    },
    reveal: {
      type: "string",
      enum: [
        "fade_in",
        "stagger",
        "stagger_then_flash",
        "cascade",
        "count_up",
        "typewriter",
        "spotlight",
        "split_reveal",
        "zoom_in",
        "build_up",
        "dramatic_pause",
        "parallel"
      ]
    },
    emphasis: {
      type: "string",
      enum: ["number", "keyword", "count", "contrast", "sequence", "person", "quote"]
    },
    visualKind: {
      type: "string",
      enum: ["generate_image", "search_image", "chart", "map_scene", "video", "none"]
    },
    imagePlacement: {
      type: "string",
      enum: ["fullscreen", "background", "center", "left", "right", "inline"]
    },
    kenBurns: {
      type: "object",
      additionalProperties: false,
      required: ["enabled", "zoomFactor", "zoomDirection", "panDirection"],
      properties: {
        enabled: { type: "boolean" },
        zoomFactor: { type: "number", minimum: 1 },
        zoomDirection: { type: "string", enum: ["in", "out"] },
        panDirection: { type: "string", enum: ["none", "left", "right", "up", "down"] }
      }
    },
    imageAsset: {
      type: "object",
      additionalProperties: false,
      required: ["prompt", "placement"],
      properties: {
        prompt: { type: "string", minLength: 1, maxLength: 1000 },
        placement: { $ref: "#/$defs/imagePlacement" }
      }
    },
    coordinateBox: {
      type: "object",
      additionalProperties: false,
      minProperties: 1,
      properties: {
        x: { $ref: "#/$defs/percent" },
        y: { $ref: "#/$defs/percent" },
        width: { $ref: "#/$defs/percent" },
        height: { $ref: "#/$defs/percent" }
      }
    },
    canvasOverrideNoFormat: {
      type: "object",
      additionalProperties: false,
      minProperties: 1,
      properties: {
        headline: { $ref: "#/$defs/coordinateBox" },
        image: { $ref: "#/$defs/coordinateBox" }
      }
    },
    formatOverrideMap: {
      type: "object",
      additionalProperties: false,
      minProperties: 1,
      properties: {
        "16:9": { $ref: "#/$defs/canvasOverrideNoFormat" },
        "9:16": { $ref: "#/$defs/canvasOverrideNoFormat" },
        "1:1": { $ref: "#/$defs/canvasOverrideNoFormat" }
      }
    },
    canvasOverride: {
      type: "object",
      additionalProperties: false,
      minProperties: 1,
      properties: {
        headline: { $ref: "#/$defs/coordinateBox" },
        image: { $ref: "#/$defs/coordinateBox" },
        byFormat: { $ref: "#/$defs/formatOverrideMap" }
      }
    },
    transition: {
      type: "object",
      additionalProperties: false,
      required: ["from", "to", "type", "duration"],
      properties: {
        from: { $ref: "#/$defs/sceneId" },
        to: { $ref: "#/$defs/sceneId" },
        type: {
          type: "string",
          enum: ["cut", "fade", "crossfade", "slide", "wipe", "slide_left", "slide_right", "wipe_left", "wipe_right"]
        },
        duration: { type: "number", minimum: 0, maximum: 10 }
      }
    },
    scene: {
      type: "object",
      additionalProperties: false,
      required: [
        "sceneId",
        "sceneNumber",
        "narration",
        "narration_tts",
        "altText",
        "layout",
        "mood",
        "reveal",
        "emphasis",
        "headline",
        "items",
        "values",
        "unit",
        "source",
        "visual_kind",
        "kenBurns",
        "subtitleMode"
      ],
      properties: {
        sceneId: { $ref: "#/$defs/sceneId" },
        sceneNumber: { type: "integer", minimum: 1 },
        narration: { type: "string", minLength: 1, maxLength: 2000 },
        narration_tts: { type: "string", minLength: 1, maxLength: 3000 },
        altText: { type: "string", minLength: 1, maxLength: 500 },
        caption: {
          allOf: [{ $ref: "#/$defs/safeTitleText" }, { type: "string", maxLength: 280 }]
        },
        layout: { $ref: "#/$defs/layout" },
        mood: { $ref: "#/$defs/mood" },
        reveal: { $ref: "#/$defs/reveal" },
        emphasis: { $ref: "#/$defs/emphasis" },
        headline: {
          allOf: [{ $ref: "#/$defs/safeTitleText" }, { type: "string", minLength: 1, maxLength: 180 }]
        },
        items: {
          type: "array",
          maxItems: 40,
          items: {
            allOf: [{ $ref: "#/$defs/safeTitleText" }, { type: "string", minLength: 1, maxLength: 200 }]
          }
        },
        values: {
          type: "array",
          maxItems: 40,
          items: {
            oneOf: [{ type: "number" }, { type: "string", maxLength: 120 }]
          }
        },
        unit: { type: "string", maxLength: 32 },
        source: { type: "string", maxLength: 256 },
        visual_kind: { $ref: "#/$defs/visualKind" },
        imageAsset: { $ref: "#/$defs/imageAsset" },
        kenBurns: { $ref: "#/$defs/kenBurns" },
        subtitleMode: { type: "string", enum: ["karaoke", "keyword"] },
        ost: { enum: [0, 1, 2, null], default: null },
        overrides: { $ref: "#/$defs/canvasOverride" }
      }
    }
  }
};
