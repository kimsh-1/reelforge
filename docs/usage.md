# ReelForge CLI Usage

이 문서는 `node bin/vf`가 노출하는 모든 서브커맨드를 정리합니다. 예시는 레포 루트(`/home/seunghyeong/reelforge`)에서 실행하는 형태입니다.

## 기본 형태

```bash
node bin/vf <command> [...args]
```

`vf`가 PATH에 설치된 환경에서는 `vf <command>`로 줄여 쓸 수 있습니다. 이 레포에서는 충돌을 피하기 위해 문서 예시를 `node bin/vf`로 고정합니다.

## `gate`

게이트를 나열하거나 실행하고 `reports/<id>-report.json`을 생성합니다. 기본 모드는 P0 이관 증거를 다시 쓰지 않고 검증하는 `--replay`이며, 기본 프로파일은 `fast`입니다.

```bash
node bin/vf gate --list
node bin/vf gate list
node bin/vf gate --all [--profile fast|full] [--json] [--replay|--execute]
node bin/vf gate all [--profile fast|full] [--json] [--replay|--execute]
node bin/vf gate <id> [--profile fast|full] [--json] [--replay|--execute]
```

| 옵션 | 설명 |
|---|---|
| `--list` 또는 `list` | 등록 게이트의 id, title, kind, profile, script를 JSON으로 출력합니다. |
| `--all` 또는 `all` | 선택한 profile이 지원하는 모든 게이트를 실행합니다. |
| `--profile fast` | 빠른 검증 세트입니다. render 전용 full 게이트는 제외됩니다. |
| `--profile full` | render 게이트와 real smoke까지 포함하는 전체 검증 세트입니다. |
| `--json` | 리포트 객체를 stdout에 JSON으로 출력합니다. |
| `--replay` | legacy P0 보고서를 재생합니다. 기본값입니다. |
| `--execute` | legacy P0 스크립트를 실제 재실행합니다. 렌더 비용이 발생할 수 있습니다. |

예시:

```bash
node bin/vf gate list
node bin/vf gate --all --profile fast --replay
node bin/vf gate p0b --profile full --execute
```

## `verify-report`

생성된 게이트 리포트가 현재 입력과 일치하는지 재계산합니다. 필수 필드, pass/exitCode, canonical input hash, gate script hash, git commit, evidence hash, freshness를 확인합니다.

```bash
node bin/vf verify-report <report.json>
```

예시:

```bash
node bin/vf verify-report reports/p0a-report.json
```

주의: `gitCommit`도 비교하므로, 리포트 생성 이후 HEAD가 바뀌면 실패하는 것이 정상입니다.

## `write`

stdin의 JSON을 스키마와 의미 규칙으로 검증한 뒤 원자적으로 씁니다. 대상은 레포 내부 또는 `--project-root`/`VF_PROJECT_ROOTS`로 허용된 프로젝트 루트 내부여야 합니다.

```bash
node bin/vf write <file> [--project-root <dir>] --schema <auto|scene-specs|audio-meta|design-tokens|versions|render-manifest|pipeline-state>
```

| 옵션 | 설명 |
|---|---|
| `--schema auto` | 파일명에서 스키마를 추론합니다. 기본값입니다. |
| `--schema scene-specs` | `schemas/scene-specs.schema.json`과 의미 규칙으로 검증합니다. |
| `--schema audio-meta` | `schemas/audio-meta.schema.json`과 word/sourceHash 의미 규칙으로 검증합니다. |
| `--schema design-tokens` | `schemas/design-tokens.schema.json`으로 검증합니다. |
| `--schema versions` | `schemas/versions.schema.json`과 selected/entries 규칙으로 검증합니다. |
| `--schema render-manifest` | `schemas/render-manifest.schema.json`과 timing/subtitle 규칙으로 검증합니다. |
| `--schema pipeline-state` | pipeline state 스키마로 검증합니다. |
| `--project-root <dir>` | 레포 밖 프로젝트를 안전한 쓰기 루트로 추가합니다. |

예시:

```bash
mkdir -p tmp/write-demo
printf '%s\n' '{"version":"1.0.0","projectId":"write-demo","scenes":[{"sceneId":"s01","sceneNumber":1,"narration":"짧은 테스트입니다.","narration_tts":"짧은 테스트입니다.","altText":"테스트 장면.","layout":"headline_only","mood":"informative","reveal":"fade_in","emphasis":"keyword","headline":"테스트","items":[],"values":[],"unit":"","source":"usage","visual_kind":"none","kenBurns":{"enabled":false,"zoomFactor":1,"zoomDirection":"in","panDirection":"none"},"subtitleMode":"keyword"}],"transitions":[]}' \
  | node bin/vf write tmp/write-demo/scene_specs.json --schema scene-specs
```

## `compile`

프로젝트 계약 파일을 읽어 `build/index.html`, `build/scenes/*.html`, `build/render-manifest.json`을 생성합니다. Composition HTML은 읽기 전용 빌드 산출물입니다.

```bash
node bin/vf compile <projectDir> [--preset <design-tokens.json>] [--fps <number>] [--json]
```

| 옵션 | 설명 |
|---|---|
| `--preset <design-tokens.json>` | 기본 디자인 토큰 대신 지정한 preset을 사용합니다. 기본값은 컴파일러의 `DEFAULT_PRESET`입니다. |
| `--fps <number>` | 렌더 타이밍 양자화 FPS를 지정합니다. 양수여야 합니다. |
| `--json` | buildDir, timing, scenes, render-lint, warnings를 JSON으로 출력합니다. |

예시:

```bash
node bin/vf compile fixtures/golden-specs/minimal-3scene --json
node bin/vf compile fixtures/golden-specs/full-8types --fps 29.97
```

## `pipeline run`

프로젝트를 TTS, images, compile, render, gate 순서로 실행합니다. 완료 상태와 입력 해시를 사용해 재개하며, 동시에 같은 프로젝트를 실행하지 못하도록 lock을 잡습니다.

```bash
node bin/vf pipeline run <projectDir> [--until <step>] [--only <step>] [--force] [--force-dirty] [--profile mock|real]
```

| 옵션 | 설명 |
|---|---|
| `--profile mock` | 기본값입니다. mock TTS/mock image 경로로 키 없이 실행합니다. |
| `--profile real` | real 어댑터를 허용합니다. 현재 검증된 real smoke는 edge-tts TTS 중심입니다. |
| `--until <step>` | 지정 단계까지 prefix만 실행합니다. step은 `tts`, `images`, `compile`, `render`, `gate` 중 하나입니다. |
| `--only <step>` | 지정 단계 하나만 실행합니다. `--until`과 같이 쓸 수 없습니다. |
| `--force` | 이전 completed state를 무시하고 선택 단계들을 다시 실행합니다. |
| `--force-dirty` | `versions.json dirty=true` 가드를 명시적으로 우회합니다. 경고가 출력됩니다. |

예시:

```bash
node bin/vf pipeline run tmp/demo --profile mock
node bin/vf pipeline run tmp/demo --until tts --profile real --force
node bin/vf pipeline run tmp/demo --only gate
```

파이프라인 산출물:

| 단계 | 주요 입력 | 주요 출력 |
|---|---|---|
| `tts` | `scene_specs.json` | `audio_meta.json`, `assets/audio/*.mp3` |
| `images` | `scene_specs.json`, `design-tokens.json` | `versions.json`, `image-manifest.json` |
| `compile` | scene/audio/version 계약, audio assets, compiler, blocks | `build/index.html`, `build/render-manifest.json`, `build/scenes/*.html` |
| `render` | `build/**` | `out/main.mp4` |
| `gate` | 계약, build, render output, repo gate inputs | `reports/pipeline-gate-report.json` |

## `studio`

로컬 Studio 서버를 시작합니다. 이 명령은 현재 존재하지만, P4에서 adapter, 권한, 편집 UX, 동시 편집 처리가 확정될 예정입니다. 공개 또는 신뢰할 수 없는 네트워크에 노출하지 마십시오.

```bash
node bin/vf studio <projectDir> [--port <number>]
```

| 옵션 | 설명 |
|---|---|
| `--port <number>` | 바인딩할 포트입니다. `0`을 주면 사용 가능한 포트를 시스템이 선택합니다. |

예시:

```bash
node bin/vf studio tmp/demo --port 3000
```

## 관련 npm scripts

| Script | 실제 명령 | 설명 |
|---|---|---|
| `npm run lint` | `node scripts/schema-lint.mjs && node scripts/readme-sync.mjs` | JSON parse lint와 README 섹션 키 동기화 검사 |
| `npm run gate` | `node bin/vf gate --all --profile fast --replay` | fast profile replay |
| `npm run gate:full` | `node bin/vf gate --all --profile full --replay` | full profile replay |
| `npm run gate:list` | `node bin/vf gate --list` | 게이트 목록 출력 |
| `npm run render` | `hyperframes render poc/fixtures/p0a ...` | P0a fixture 렌더 |

## 종료 코드

성공 시 exit code는 0입니다. 게이트 실패, 스키마/의미 검증 실패, 렌더 실패, stale report, dirty guard, lock 충돌은 non-zero로 종료합니다.
