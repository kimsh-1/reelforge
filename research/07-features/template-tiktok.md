| ID | 기능명 | 설명(1-2줄) | 근거(파일:라인) | 채택제안 | 검증방법 |
|---|---|---|---|---|---|
| TTK-001 | Remotion 루트 등록 | `registerRoot()`로 렌더러 엔트리를 명시한다. Hyperframes도 씬 레지스트리 진입점을 단일화할 때 참고 가능. | `src/index.ts:4-7` | P1 렌더 엔트리 표준 | `npm run build`로 엔트리 번들 성공 확인 |
| TTK-002 | 컴포지션 계약 등록 | 컴포지션 ID, 컴포넌트, 메타데이터 계산, 스키마를 한 곳에서 연결한다. | `src/Root.tsx:12-16` | P1 씬 계약 기본 | 컴포지션 레지스트리 단위 테스트 |
| TTK-003 | 입력 스키마 검증 | 영상 소스 입력을 `zod` 스키마로 최소 검증한다. | `src/CaptionedVideo/index.tsx:25-27` | P1 입력 검증 최소 | `captionedVideoSchema.safeParse()` 테스트 |
| TTK-004 | 원본 길이 기반 duration 계산 | 원본 영상 메타데이터에서 길이를 읽어 프레임 수를 계산한다. | `src/CaptionedVideo/index.tsx:29-38` | P0 길이 동기화 핵심 | `getVideoMetadata` mock으로 duration 스냅샷 테스트 |
| TTK-005 | 고정 FPS 타임베이스 | FPS를 30으로 고정해 자막과 영상 타임라인 계산 기준을 통일한다. | `src/CaptionedVideo/index.tsx:32-37` | P1 결정론 타임베이스 | 메타데이터 테스트에서 `fps === 30` 확인 |
| TTK-006 | 숏폼 세로 캔버스 | 1080x1920 9:16 캔버스를 기본 컴포지션 크기로 둔다. | `src/Root.tsx:17-18` | P1 숏폼 기본값 | 렌더 산출물 `ffprobe` 해상도 검사 |
| TTK-007 | 기본 샘플 소스 | `staticFile()`로 기본 입력 영상을 지정해 바로 실행 가능한 fixture를 둔다. | `src/Root.tsx:19-21` | P2 데모 편의 | 기본 props 렌더 smoke test |
| TTK-008 | JPEG 프레임 포맷 | Remotion 렌더 중간 이미지 포맷을 JPEG로 설정한다. | `remotion.config.ts:8` | P2 렌더 용량 노브 | 테스트 렌더 로그에서 이미지 포맷 확인 |
| TTK-009 | 출력 덮어쓰기 | 기존 결과물이 있어도 렌더 산출물을 덮어쓰도록 설정한다. | `remotion.config.ts:9` | P2 CI 편의 | 같은 경로로 두 번 렌더하는 통합 테스트 |
| TTK-010 | 브라우저 편집 UI 진입 | `remotion studio` 스크립트로 브라우저 기반 미리보기/편집 환경을 제공한다. | `package.json:5-7` | P2 편집 UI 참고 | `npm run dev` 후 Playwright 접속 테스트 |
| TTK-011 | 번들 빌드 스크립트 | 렌더 프로젝트를 번들링하는 표준 스크립트를 제공한다. | `package.json:7` | P1 배포 번들 기본 | `npm run build` CI 실행 |
| TTK-012 | 자막 생성 CLI | `node sub.mjs`를 npm script로 노출해 자막 생성 파이프라인을 실행한다. | `package.json:10` | P0 자막 파이프라인 입구 | `npm run create-subtitles -- public/sample-video.mp4` |
| TTK-013 | 정적 품질 게이트 | ESLint와 TypeScript 검사를 하나의 lint 스크립트로 묶는다. | `package.json:9`, `eslint.config.mjs:1-3` | P1 최소 품질선 | `npm run lint` CI 실행 |
| TTK-014 | 엄격 TypeScript 설정 | `strict`, `noUnusedLocals`, casing 검사를 켜서 기본 타입 품질을 강제한다. | `tsconfig.json:2-13` | P1 타입 품질선 | `tsc --noEmit` 실행 |
| TTK-015 | 렌더 대기 폰트 로딩 | 커스텀 폰트 로딩 전 렌더가 진행되지 않도록 `delayRender/continueRender`를 사용한다. | `src/load-font.ts:7-24` | P1 렌더 안정성 | 폰트 로드 mock으로 continue 순서 테스트 |
| TTK-016 | 폰트 로드 캐시 | `loaded` 플래그로 같은 폰트를 반복 로드하지 않는다. | `src/load-font.ts:5-14` | P2 렌더 비용 절감 | `FontFace.load` 호출 횟수 단위 테스트 |
| TTK-017 | 폰트 라이선스 동봉 | 폰트 파일과 라이선스 파일을 `public`에 함께 둔다. | `src/load-font.ts:16-19`, `public/theboldfont-license.rtf:14-15` | P1 라이선스 추적 | asset-license checker로 파일 존재 검사 |
| TTK-018 | 영상-자막 sidecar 규칙 | `.mp4/.mkv/.mov/.webm` 확장자를 `.json`으로 바꿔 자막 경로를 추론한다. | `src/CaptionedVideo/index.tsx:63-67` | P0 에셋 계약 단순화 | 확장자별 path 변환 단위 테스트 |
| TTK-019 | Caption JSON 로딩 | sidecar JSON을 fetch해 `Caption[]` 상태로 사용한다. | `src/CaptionedVideo/index.tsx:69-75` | P0 자막 로드 핵심 | fixture JSON으로 컴포넌트 렌더 테스트 |
| TTK-020 | 자막/폰트 준비 전 렌더 지연 | 자막 fetch와 폰트 로딩이 끝난 뒤 렌더를 계속한다. | `src/CaptionedVideo/index.tsx:59-75` | P0 결정론 보장 | fetch 지연 mock으로 frame render 차단 확인 |
| TTK-021 | 자막 로딩 실패 시 렌더 취소 | fetch 또는 font load 실패를 `cancelRender()`로 올린다. | `src/CaptionedVideo/index.tsx:76-78` | P1 실패 빠른 탐지 | fetch reject mock으로 cancel 호출 검사 |
| TTK-022 | 자막 파일 핫리로드 | `watchStaticFile()`로 자막 JSON 변경 시 다시 fetch한다. | `src/CaptionedVideo/index.tsx:81-91` | P1 편집 대시보드 연결 | JSON 수정 후 Studio 화면 갱신 테스트 |
| TTK-023 | 자막 누락 안내 오버레이 | 자막 파일이 없으면 생성 명령을 안내하는 화면을 띄운다. | `src/CaptionedVideo/index.tsx:41-47`, `src/CaptionedVideo/index.tsx:132`, `src/CaptionedVideo/NoCaptionFile.tsx:4-19` | P2 진단 UX | 자막 제거 후 screenshot diff |
| TTK-024 | TikTok식 자막 페이지네이션 | `createTikTokStyleCaptions()`로 단어 토큰을 1200ms 단위 페이지로 묶는다. | `src/CaptionedVideo/index.tsx:49-53`, `src/CaptionedVideo/index.tsx:93-98` | P1 자막 리듬 노브 | captions fixture 페이지 스냅샷 테스트 |
| TTK-025 | 페이지별 Sequence 배치 | 각 자막 페이지를 시작 프레임과 지속 프레임이 있는 `Sequence`로 배치한다. | `src/CaptionedVideo/index.tsx:110-127` | P0 타임라인 합성 핵심 | frame별 활성 Sequence 테스트 |
| TTK-026 | 다음 페이지 기준 종료 | 현재 페이지 종료를 다음 페이지 시작 또는 최대 표시 시간으로 clamp한다. | `src/CaptionedVideo/index.tsx:111-116` | P0 겹침 방지 핵심 | 인접 페이지 overlap 없음 검사 |
| TTK-027 | 0 이하 duration 방어 | 계산된 자막 길이가 0 이하이면 렌더하지 않는다. | `src/CaptionedVideo/index.tsx:117-120` | P1 엣지케이스 처리 | 비정상 timestamps fixture 테스트 |
| TTK-028 | OffthreadVideo 합성 | 원본 영상을 `OffthreadVideo`로 배치해 자막 레이어와 분리한다. | `src/CaptionedVideo/index.tsx:101-108` | P1 실영상 합성 기본 | 프레임 screenshot에서 영상 레이어 확인 |
| TTK-029 | cover 크롭 | 원본 영상을 세로 캔버스에 꽉 채우도록 `objectFit: cover`를 사용한다. | `src/CaptionedVideo/index.tsx:103-106` | P1 숏폼 화면 채움 | 다양한 비율 fixture screenshot 테스트 |
| TTK-030 | 흰색 배경 fill | 전체 배경을 흰색으로 채워 투명/빈 프레임을 방지한다. | `src/CaptionedVideo/index.tsx:100-102` | P2 빈 프레임 방지 | 영상 없는 mock에서 pixel 검사 |
| TTK-031 | 하단 자막 safe zone | 자막 컨테이너를 하단 350px, 높이 150px 영역에 고정한다. | `src/CaptionedVideo/Page.tsx:15-21` | P1 숏폼 레이아웃 기본 | 자막 bbox 위치 snapshot |
| TTK-032 | 텍스트 자동 맞춤 | `fitText()`로 페이지 텍스트가 화면 폭 90% 안에 들어오도록 크기를 계산한다. | `src/CaptionedVideo/Page.tsx:31-42` | P0 오버플로 방지 | 긴 문장 fixture screenshot diff |
| TTK-033 | 최대 폰트 크기 cap | 원하는 폰트 크기 120을 상한으로 둔다. | `src/CaptionedVideo/Page.tsx:23`, `src/CaptionedVideo/Page.tsx:41` | P1 스타일 노브 | 짧은/긴 문장 fontSize 단위 테스트 |
| TTK-034 | 대문자 변환 | 자막 텍스트를 uppercase로 렌더한다. 한국어 우선 프로젝트에서는 언어별 옵션화가 필요하다. | `src/CaptionedVideo/Page.tsx:34-39`, `src/CaptionedVideo/Page.tsx:55-57` | HOLD 한국어 이득 낮음 | 다국어 fixture 렌더 스냅샷 |
| TTK-035 | 굵은 외곽선 자막 | 흰 글자에 20px 검은 stroke와 `paintOrder`를 적용해 가독성을 높인다. | `src/CaptionedVideo/Page.tsx:47-50` | P1 가독성 강화 | 배경별 OCR/contrast screenshot 테스트 |
| TTK-036 | 활성 단어 하이라이트 | 현재 시간에 해당하는 토큰만 초록색으로 표시한다. | `src/CaptionedVideo/Page.tsx:67-82` | P0 워드싱크 표현 핵심 | token mid-frame 색상 검사 |
| TTK-037 | 프레임-밀리초 변환 | 현재 frame과 fps로 ms 시간을 계산해 토큰 타이밍과 비교한다. | `src/CaptionedVideo/Page.tsx:30-32`, `src/CaptionedVideo/Page.tsx:68-73` | P0 프레임 결정론 핵심 | 경계 프레임 token 활성 테스트 |
| TTK-038 | 토큰 공백 보존 | `whiteSpace: pre`로 단어 토큰 사이 공백을 보존한다. | `src/CaptionedVideo/Page.tsx:76-84` | P1 텍스트 충실도 | 공백 포함 fixture DOM snapshot |
| TTK-039 | 자막 등장 spring | 자막 페이지 진입 시 5프레임 spring 애니메이션을 적용한다. | `src/CaptionedVideo/SubtitlePage.tsx:15-22` | P2 모션 프리셋 후보 | frame 0/5 transform snapshot |
| TTK-040 | scale/translate 진입 모션 | 자막을 0.8배/50px 아래에서 원위치로 이동시킨다. | `src/CaptionedVideo/Page.tsx:51-54`, `src/CaptionedVideo/Page.tsx:61-64` | P2 숏폼 감성 요소 | computed style frame 테스트 |
| TTK-041 | 16k WAV 오디오 추출 | 영상에서 오디오를 16kHz WAV로 추출해 Whisper 입력으로 사용한다. | `sub.mjs:24-29` | P0 ASR 입력 표준화 | `ffprobe`로 temp WAV sample rate 검사 |
| TTK-042 | 다중 영상 확장자 처리 | `.mp4/.webm/.mkv/.mov`만 전사 대상으로 처리한다. | `sub.mjs:61-69` | P1 입력 포맷 범위 | 확장자별 fixture 처리 테스트 |
| TTK-043 | 이미 전사된 파일 스킵 | 대응 JSON이 있으면 재전사를 건너뛰어 재개와 캐시 효과를 낸다. | `sub.mjs:71-81` | P0 재개/캐시 핵심 | 기존 JSON mtime 불변 테스트 |
| TTK-044 | 임시 디렉터리 생성/삭제 | `temp`가 없으면 만들고 성공 후 제거한다. | `sub.mjs:82-100` | P1 작업 격리 | 성공 경로 후 temp 부재 검사 |
| TTK-045 | Whisper.cpp 자동 설치 | 지정 경로와 버전으로 Whisper.cpp를 설치한다. | `sub.mjs:118`, `whisper-config.mjs:3-7` | P1 로컬 ASR 재현성 | 설치 후 binary 존재 검사 |
| TTK-046 | Whisper 모델 자동 다운로드 | 설정된 모델을 Whisper 경로에 다운로드한다. | `sub.mjs:119`, `whisper-config.mjs:9-29` | P1 모델 캐시 | 모델 파일 checksum 검사 |
| TTK-047 | Whisper 버전 pin | Whisper.cpp 버전을 `1.6.0`으로 고정한다. | `whisper-config.mjs:6-7` | P1 결정론 버전 고정 | config assertion 테스트 |
| TTK-048 | 모델 선택 노브 | 모델명을 설정 파일에서 바꾸며, 주석에 용량/메모리 선택 정보를 둔다. | `whisper-config.mjs:9-29` | P2 운영 선택 UX | 허용 모델 enum 검사 |
| TTK-049 | 언어 선택 노브 | 전사 언어를 별도 설정값으로 둔다. 한국어 프로젝트에서는 `ko` 전환과 모델 호환 검사가 필요하다. | `whisper-config.mjs:31-37` | P1 한국어 전환 필요 | model/lang compatibility 테스트 |
| TTK-050 | 토큰 레벨 타임스탬프 | Whisper 전사에서 token-level timestamps를 켠다. | `sub.mjs:40-45` | P0 워드싱크 원천 | 출력 captions에 token timing 존재 검사 |
| TTK-051 | 단어 기준 분할 | `splitOnWord: true`로 단어 단위 자막 강조가 가능하게 한다. | `sub.mjs:48-50` | P0 단어 강조 필수 | 단어별 caption token 수 검사 |
| TTK-052 | 원어 보존 전사 | `translateToEnglish: false`로 번역 없이 원어 자막을 만든다. | `sub.mjs:46-48` | P1 원문 보존 | 한국어 fixture가 영어화되지 않음 검사 |
| TTK-053 | 조용한 Whisper 로그 | `printOutput: false`로 전사 로그를 억제한다. | `sub.mjs:46` | P2 로그 정숙성 | CLI stdout snapshot 테스트 |
| TTK-054 | Whisper 출력 변환 | Whisper.cpp 결과를 Remotion captions 계약으로 변환해 JSON 저장한다. | `sub.mjs:52-58` | P0 자막 계약 변환 | 생성 JSON schema 검증 |
| TTK-055 | public 상대경로 보존 | 입력 파일의 `public` 하위 경로를 계산해 자막 출력 위치에 반영한다. | `sub.mjs:93-97` | P1 에셋 위치 계약 | 중첩 폴더 fixture 출력 경로 테스트 |
| TTK-056 | webcam→subs 경로 매핑 | 원본 경로의 `webcam`을 `subs`로 바꿔 자막을 별도 폴더에 저장한다. | `sub.mjs:56-57`, `sub.mjs:77` | HOLD 경로 하드코딩 | path mapping 단위 테스트 |
| TTK-057 | 재귀 디렉터리 처리 | 디렉터리 안의 파일과 하위 디렉터리를 재귀적으로 전사한다. | `sub.mjs:103-115` | P1 일괄 처리 | tmp tree 통합 테스트 |
| TTK-058 | `.DS_Store` 무시 | macOS 메타 파일을 처리 대상에서 제외한다. | `sub.mjs:103-105` | P2 OS 잡음 처리 | `.DS_Store` fixture 무시 테스트 |
| TTK-059 | 전체 public 기본 처리 | CLI 인자가 없으면 `public` 전체를 처리한다. | `sub.mjs:121-126` | P1 기본 배치 작업 | 인자 없는 실행 통합 테스트 |
| TTK-060 | 파일/폴더 선택 처리 | CLI 인자로 파일 또는 디렉터리를 받아 부분 처리한다. | `sub.mjs:129-142` | P1 부분 재처리 기본 | 특정 fixture만 생성되는지 검사 |
| TTK-061 | 처리 진행 로그 | 오디오 추출과 파일 처리 시작을 콘솔에 출력한다. | `sub.mjs:87`, `sub.mjs:138` | P2 운영 가시성 | stdout snapshot 테스트 |
| TTK-062 | 산출물 git 제외 | `out`, `whisper.cpp`, `node_modules`, `.env` 등을 git에서 제외한다. | `.gitignore:1-8` | P1 산출물 관리 | 자막 생성 후 `git status` 정책 테스트 |

## 이 레포에서 배우지 말 것

1. 자막 JSON 무검증 캐스팅: `res.json()` 결과를 곧바로 `Caption[]`로 단언한다. 씬 매니페스트/자막 계약에는 zod 같은 런타임 검증이 필요하다. 근거: `src/CaptionedVideo/index.tsx:72-74`.

2. 매직 넘버가 컴포넌트에 흩어짐: 자막 전환 1200ms, 하단 350px, 높이 150px, 폰트 120, 색상 값이 매니페스트가 아니라 코드 상수다. 근거: `src/CaptionedVideo/index.tsx:49-53`, `src/CaptionedVideo/Page.tsx:15-24`.

3. 경로 규칙 하드코딩과 취약한 cleanup: `webcam`→`subs` 문자열 치환이 도메인 고정이고, 실패 시 temp 삭제가 `finally`로 보장되지 않는다. 근거: `sub.mjs:56-57`, `sub.mjs:77`, `sub.mjs:82-100`.