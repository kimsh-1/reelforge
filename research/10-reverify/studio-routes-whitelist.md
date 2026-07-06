# Studio Routes Whitelist

소스 기준: `/mnt/d/deck-factory/vendor/hyperframes`, hyperframes `0.7.26`.

전제:
- `hyperframes preview`에는 Studio UI 억제/headless API-only 플래그가 없다.
- read-only proxy를 만들려면 UI/static/SPА fallback을 proxy에서 차단하고, 아래 API 중 허용/조건부 라우트만 통과시킨다.
- "조건부"는 HTTP method만 보면 read처럼 보이지만 cache write, ID persist, render artifact 접근, local filesystem disclosure, in-memory mutation 등 부작용/권한 판단이 필요한 라우트다.

## 엄격 read-only 추천 allowlist

| 메서드 | 경로 | 조건 |
|---|---|---|
| GET | `/__hyperframes_config` | preview config 노출 허용 시 |
| GET | `/api/runtime.js` | runtime JS 필요 시 |
| GET | `/api/events` | SSE file-change 수신 필요 시 |
| GET | `/api/projects` | project 목록 필요 시 |
| GET | `/api/resolve-session/:sessionId` | session resolve 필요 시 |
| GET | `/api/projects/:id` | file tree/read model 필요 시 |
| GET | `/api/projects/:id/storyboard` | storyboard read 필요 시 |
| GET | `/api/projects/:id/files/*` | project file read 필요 시 |
| GET | `/api/projects/:id/lint` | lint read 필요 시 |
| GET | `/api/projects/:id/gsap-animations/*` | GSAP animation inspection 필요 시 |
| GET | `/api/projects/:id/preview/comp/*` | subcomposition preview 필요 시 |
| GET | `/api/projects/:id/preview/*` | static asset serving 필요 시 |
| GET | `/api/registry/blocks` | registry catalog read 필요 시 |

기본 차단:
- 모든 UI/static route: `/assets/*`, `/icons/*`, `/favicon.svg`, `GET *`
- 모든 write/mutation method: `PUT`, `PATCH`, `DELETE`, 대부분의 `POST`
- GET이지만 파일을 쓸 수 있는 `/api/projects/:id/preview`, `/api/projects/:id/thumbnail/*`, `/api/projects/:id/waveform/*`는 엄격 read-only에서는 차단한다.

## CLI wrapper routes

| 메서드 | 경로 | 기능 | 소스 | 판정 |
|---|---|---|---|---|
| GET | `/__hyperframes_config` | Studio client config JSON | `packages/cli/src/server/studioServer.ts:541-553` | 허용 |
| GET | `/api/runtime.js` | project runtime JS 제공 | `packages/cli/src/server/studioServer.ts:556-568` | 허용 |
| GET | `/api/telemetry-identity` | telemetry identity JSON | `packages/cli/src/server/studioServer.ts:575-577` | 조건부 |
| GET | `/api/events` | SSE event stream. event name은 `file-change`, data는 relative path | `packages/cli/src/server/studioServer.ts:579-589` | 허용 |
| POST | `/api/projects/:id/render` | render preflight 후 shared render route로 전달 | `packages/cli/src/server/studioServer.ts:596-605` | 차단 |
| ALL | `/api/*` | shared Studio API mount | `packages/cli/src/server/studioServer.ts:611-622` | 내부 mount |
| GET | `/assets/*` | Studio UI static assets | `packages/cli/src/server/studioServer.ts:624-635` | 차단 |
| GET | `/icons/*` | Studio UI icons | `packages/cli/src/server/studioServer.ts:624-635` | 차단 |
| GET | `/favicon.svg` | Studio UI favicon | `packages/cli/src/server/studioServer.ts:624-635` | 차단 |
| GET | `*` | Studio SPA fallback HTML | `packages/cli/src/server/studioServer.ts:653-721` | 차단 |

## Shared API routes

Shared API 등록 위치:
- `packages/studio-server/src/createStudioApi.ts:21-36`

| 메서드 | 경로 | 기능 | 소스 | 판정 |
|---|---|---|---|---|
| GET | `/api/projects` | project 목록 | `packages/studio-server/src/routes/projects.ts:24-29` | 허용 |
| GET | `/api/resolve-session/:sessionId` | session id로 project resolve | `packages/studio-server/src/routes/projects.ts:31-40` | 허용 |
| GET | `/api/projects/:id` | project details/file tree | `packages/studio-server/src/routes/projects.ts:42-49` | 허용 |
| GET | `/api/projects/:id/storyboard` | storyboard read | `packages/studio-server/src/routes/storyboard.ts:42-79` | 허용 |
| GET | `/api/projects/:id/files/*` | file content read | `packages/studio-server/src/routes/files.ts:1585-1598` | 허용 |
| PUT | `/api/projects/:id/files/*` | file overwrite, snapshot 후 write | `packages/studio-server/src/routes/files.ts:1602-1617` | 차단 |
| POST | `/api/projects/:id/files/*` | new file create | `packages/studio-server/src/routes/files.ts:1621-1634` | 차단 |
| DELETE | `/api/projects/:id/files/*` | file/dir delete | `packages/studio-server/src/routes/files.ts:1638-1655` | 차단 |
| POST | `/api/projects/:id/file-mutations/remove-element/*` | DOM element remove 후 write | `packages/studio-server/src/routes/files.ts:1657-1677` | 차단 |
| POST | `/api/projects/:id/file-mutations/split-element/*` | DOM split 후 write | `packages/studio-server/src/routes/files.ts:1679-1727` | 차단 |
| POST | `/api/projects/:id/file-mutations/patch-element/*` | DOM patch 후 write | `packages/studio-server/src/routes/files.ts:1729-1777` | 차단 |
| POST | `/api/projects/:id/file-mutations/wrap-elements/*` | DOM wrap 후 write | `packages/studio-server/src/routes/files.ts:1779-1846` | 차단 |
| POST | `/api/projects/:id/file-mutations/unwrap-elements/*` | DOM unwrap 후 write | `packages/studio-server/src/routes/files.ts:1848-1882` | 차단 |
| POST | `/api/projects/:id/file-mutations/probe-element/*` | element probe/read-only analysis | `packages/studio-server/src/routes/files.ts:1884-1900` | 조건부 |
| PATCH | `/api/projects/:id/files/*` | rename/move와 reference update | `packages/studio-server/src/routes/files.ts:1904-1928` | 차단 |
| POST | `/api/projects/:id/duplicate-file` | file copy/write | `packages/studio-server/src/routes/files.ts:1932-1956` | 차단 |
| POST | `/api/projects/:id/upload` | uploaded files write | `packages/studio-server/src/routes/files.ts:1962-1986`, `packages/studio-server/src/routes/files.ts:1569` | 차단 |
| GET | `/api/projects/:id/gsap-animations/*` | GSAP animation info read | `packages/studio-server/src/routes/files.ts:1990-2009` | 허용 |
| POST | `/api/projects/:id/gsap-mutations/*` | GSAP mutation/bootstrap write | `packages/studio-server/src/routes/files.ts:2013-2095` | 차단 |
| GET | `/api/projects/:id/preview` | project preview HTML. 필요 시 `data-hf-id` persist write 발생 | `packages/studio-server/src/routes/preview.ts:241-321`, `packages/studio-server/src/helpers/hfIdPersist.ts:13-38` | 조건부 |
| GET | `/api/projects/:id/preview/comp/*` | subcomposition preview HTML | `packages/studio-server/src/routes/preview.ts:324-352` | 허용 |
| GET | `/api/projects/:id/preview/*` | preview asset serving | `packages/studio-server/src/routes/preview.ts:356-420` | 허용 |
| GET | `/api/projects/:id/lint` | project lint result | `packages/studio-server/src/routes/lint.ts:7-35` | 허용 |
| POST | `/api/projects/:id/render` | render job start, output path/renders artifact 생성 | `packages/studio-server/src/routes/render.ts:49-124` | 차단 |
| GET | `/api/render/:jobId/progress` | render progress SSE | `packages/studio-server/src/routes/render.ts:126-149` | 조건부 |
| GET | `/api/render/:jobId/view` | render artifact view | `packages/studio-server/src/routes/render.ts:163-199` | 조건부 |
| GET | `/api/render/:jobId/download` | render artifact download | `packages/studio-server/src/routes/render.ts:163-199` | 조건부 |
| DELETE | `/api/render/:jobId` | render output files delete | `packages/studio-server/src/routes/render.ts:201-216` | 차단 |
| GET | `/api/projects/:id/renders/file/*` | render file serving | `packages/studio-server/src/routes/render.ts:218-243` | 조건부 |
| GET | `/api/projects/:id/renders` | render list. on-disk renders를 memory job map에 register | `packages/studio-server/src/routes/render.ts:245-293` | 조건부 |
| GET | `/api/projects/:id/thumbnail/*` | thumbnail read/generate. `.thumbnails` cache write 가능 | `packages/studio-server/src/routes/thumbnail.ts:12-124` | 조건부 |
| GET | `/api/projects/:id/selection` | current selection read | `packages/studio-server/src/routes/selection.ts:103-111` | 허용 |
| PUT | `/api/projects/:id/selection` | selection state update, in-memory mutation | `packages/studio-server/src/routes/selection.ts:113-140` | 조건부 |
| GET | `/api/projects/:id/waveform/*` | waveform data read/generate. `.waveform-cache` write 가능 | `packages/studio-server/src/routes/waveform.ts:8-45` | 조건부 |
| GET | `/api/fonts` | local/system font list | `packages/studio-server/src/routes/fonts.ts:123-125` | 조건부 |
| GET | `/api/fonts/google` | Google font list | `packages/studio-server/src/routes/fonts.ts:123-125` | 조건부 |
| GET | `/api/fonts/file` | local font file read | `packages/studio-server/src/routes/fonts.ts:128-171` | 조건부 |
| GET | `/api/registry/blocks` | registry blocks list | `packages/studio-server/src/routes/registry.ts:5-11` | 허용 |
| POST | `/api/projects/:id/registry/install` | registry item install into project dir | `packages/studio-server/src/routes/registry.ts:14-33`, `packages/cli/src/server/studioServer.ts:504-530` | 차단 |

## SSE watcher exclusions

| 항목 | 소스 | 결론 |
|---|---|---|
| Event name | `packages/cli/src/server/studioServer.ts:579-589` | `file-change` |
| Data payload | `packages/cli/src/server/studioServer.ts:579-589` | `{"path": "<relative path>"}` |
| Excluded dirs | `packages/cli/src/server/fileWatcher.ts:11-23` | `.cache`, `.git`, `.hyperframes`, `.next`, `.vite`, `build`, `coverage`, `dist`, `node_modules`, `outputs`, `renders` |
| Exclusion predicate | `packages/cli/src/server/fileWatcher.ts:26-30` | path segment가 excluded set에 있으면 skip |
| `compositions/` | `packages/cli/src/server/fileWatcher.ts:11-23` | 제외 아님 |
