# video-factory-poc P0 게이트 증거 적대 감사

- 감사일: 2026-07-07 (재실측 04:00~04:10 KST)
- 감사 방식: 위조·부실·과장 가정 하 전수 재검증 — 게이트 스크립트 소스 정독 + 모든 mp4 ffprobe 재실측 + framemd5 재추출 대조 + evidence sha256/inputHash 전량 재계산 + 픽스처 소스 검사 + 독립 재렌더 실험 2회(p0c 폰트 실험, p0a 재현 시도)
- 대상: `~/video-factory-poc` — reports/P0{a,b,c,d}-report.json, fixtures/, scripts/, out/

## 종합 판정

| 게이트 | 보고 | 감사 판정 | 요지 |
|---|---|---|---|
| P0a | PASS | **CONFIRMED (유보 1)** | 전 수치 재실측 일치. 단 p0a.mp4 렌더 명령 미기록·결정론 프리체크 로그 부재 |
| P0b | PASS | **CONFIRMED + 부실 1** | 프레임 일치 전량 재확인·애니메이션 실재. 단 orphan 네거티브 체크는 절대 실패 불가능한 고무도장 — 실제로는 mount 강제 미작동이 확인됐는데 초록 |
| P0c | PASS | **부실 (핵심 주장 미검증)** | 폰트·TTS·OCR·mp4 출처는 전부 진짜로 실증. 그러나 "자막이 음성에 맞춰 정렬"은 렌더에 존재하지 않음 — 자막은 하드코딩 정적 텍스트, 나레이션 1행 자막은 영상에 아예 안 나옴 |
| P0d | PASS | **CONFIRMED + 경미 부실 2** | 선택적 재TTS·시프트·불변성·크로스페이드 전부 재실측 일치. 단 scene3 비교구간이 100% 정적이라 정렬 검증력 약함 + SSE 이벤트의 인과(터치→이벤트) 미증명 |

**위조 흔적: 발견되지 않음.** 50개 evidence sha256 전량 재계산 일치, 4개 inputHash 재계산 일치, framemd5 재추출 전량 일치, 크로스페이드 해시 3점 재실측 일치. 결정적으로 **p0c.mp4를 감사자가 독립 재렌더하여 바이트 동일(sha256 `d4a3fc1b…`) 재현** — 산출물이 해당 픽스처에서 실제로 렌더된 것임을 출처 수준에서 실증했다. 문제는 위조가 아니라 **"체크가 검증하는 것"과 "게이트가 주장하는 능력" 사이의 간극**(P0c 자막 정렬, P0b orphan)이다.

---

## P0a — 렌더 프로파일 게이트: CONFIRMED (유보 1)

### 1. 스크립트 실계산 여부 (`scripts/gate-p0a.mjs`)
- pass 하드코딩 없음. `pass = checks.every(...)`, exitCode 연동. ffprobe spawnSync 실행, faststart는 자체 MP4 atom 파서로 바이너리 스캔, evidence는 sha256 실계산.
- 유의: 게이트는 **렌더를 직접 수행하지 않음** — 이미 존재하는 out/p0a.mp4를 검사. p0a.mp4의 렌더 명령/인자는 어디에도 기록돼 있지 않다(report의 `command`는 게이트 실행 명령일 뿐).
- `doctor-critical`은 doctorOk:false여도 required 9종만 보므로 pass — 설계 의도이고 measured에 비치명 실패(whisper/kokoro/docker 등) 전부 공개돼 있어 정직함.

### 2. 재실측 결과

| 항목 | 리포트 | 재실측 | 판정 |
|---|---|---|---|
| codec/pix_fmt | h264 / yuv420p | ffprobe: h264 / yuv420p | 일치 |
| duration | 5.0 | 5.000000 | 일치 |
| 오디오 트랙 | 0 | 0 | 일치 |
| faststart | moov@32 < mdat@1475 | 독립 atom 스캔: ftyp(0,32)→moov(32,1435)→free(1467,8)→mdat(1475,73082) | 일치 |
| evidence sha256 6건 | — | 전량 재계산 일치 | 일치 |
| inputHash | b7bde2b6… | 알고리즘 재구현 재계산 일치 | 일치 |

### 3. 결정론 프리체크 (`reports/determinism-precheck.txt`)
- 파일 내용은 **6바이트 "MATCH\n"이 전부.** 두 렌더의 명령·로그 미기록.
- 실검사: `cmp out/p0a.mp4 out/p0a-second.mp4` → 바이트 동일 (sha `2cfebb16…`), mtime 03:20:40 vs 03:23:09 (2분 29초 간격, 재렌더 시간으로 그럴듯).
- 한계: 바이트 동일 + mtime 상이만으로는 재렌더와 `cp` 구분 불가. **간접 보강**: 감사자 독립 실험에서 hyperframes 렌더가 이 머신에서 바이트 결정론임을 확인(아래 P0c — 다른 디렉토리명 픽스처 사본 렌더가 원본 mp4와 바이트 동일). 따라서 "2회 렌더 MATCH" 주장은 물리적으로 자연스러움.
- 감사자 p0a 재렌더 시도(`--quality=high`, crf 미지정): **바이트 불일치, 전 150프레임 해시 상이하나 PSNR 60.4dB** (동일 콘텐츠, 인코딩 파라미터 차이). 원본 렌더 인자가 미기록이라 바이트 재현은 불가했다.

**판정: CONFIRMED.** 부실 지점 — (a) p0a.mp4 렌더 명령 미기록으로 재현 불가, (b) 프리체크가 결과 한 단어만 남김(명령·타임스탬프·해시 로그 없음).

---

## P0b — 씬 합성/프레임 일치 게이트: CONFIRMED + 부실 1

### 1. 스크립트 실계산 여부 (`scripts/gate-p0b.mjs`)
- **자체 실행형**: 시작 시 산출물 전부 `rmSync` 후 lint→validate→풀렌더(15s)→scene2 단독 렌더(5s)→orphan 렌더→framemd5 추출→비교를 게이트가 직접 spawnSync로 수행. 측정값 전부 실명령 유래. `--crf=0`(무손실)이라 프레임 해시 비교가 유의미.
- **결함(고무도장)**: `negative-orphan-recorded`의 pass 조건이 `negativeRender.exitCode !== null` — exitCode는 구현상(`result.status ?? (signal?128:1)`) **절대 null이 될 수 없어 이 체크는 어떤 경우에도 실패 불가능**하다.

### 2. 재실측 결과

| 항목 | 리포트 | 재실측 | 판정 |
|---|---|---|---|
| p0b-full.mp4 | 15.0s h264 yuv420p | ffprobe 15.000000 h264 yuv420p | 일치 |
| p0b-scene2.mp4 | 5.0s | 5.000000 | 일치 |
| framemd5 재추출 | — | full trim 5..10 / scene2 trim 0..5 재추출 → 저장본과 **완전 동일** | 일치 |
| body-frame-match | 150/150 일치, mismatch 0 | 교차 diff 재실행: 150/150 해시 열 완전 일치 | 일치 |
| evidence sha256 | 6건 | 전량 재계산 일치 (full/scene2/orphan mp4 + framemd5 2종) | 일치 |
| hyperframes lint | exit 0 | 감사 시점 재실행 exit 0, errorCount 0 | 일치 |

### 3. 픽스처 치팅 검사 — 정지 프레임 조작 여부
- `scenes/scene-02.html`: 실제 GSAP `fromTo(#panel, {opacity:0,x:-72,scale:.97}→{…}, duration 0.8, power3.out)` @0.25s → 예측 애니메이션 구간 = 프레임 7.5~31.5.
- framemd5 프레임별 분산 실측: **해시 변화가 정확히 프레임 8~32에서 발생** (엔트런스와 프레임 단위로 부합), 이후 118프레임은 단일 해시(정적 홀드).
- 즉 **움직이는 25프레임 구간에서도 full-렌더와 단독-렌더가 해시 일치** — 정지 프레임으로 일치를 쉽게 만든 조작이 아님. 다만 씬의 79%(118/150)가 정적 홀드라 비교 난도 자체는 낮은 편(엔트런스-온리 씬).

### 4. 부실 지점
- **negative-orphan-recorded**: 실측 기록 자체가 "orphan 렌더 exit 0 — mount enforcement was not applied"(orphan.mp4 188KB 실존). 즉 네거티브 시나리오는 **사실상 실패**(고아 씬이 막히지 않고 렌더됨)했는데, 체크는 "기록했다"는 이유로 초록. measured에 정직하게 공개돼 있으나 게이트 PASS 집계에 초록 1표로 들어가 과장 효과. "recorded"로 이름을 바꿔 통과시킨 설계.

**판정: CONFIRMED** (프레임 일치·렌더 실재·애니메이션 실재 모두 재실측 확인) — 단 orphan 체크는 **부실(검증력 0인 항상-참 체크 + 실질 네거티브 실패의 초록 처리)**.

---

## P0c — 한국어 TTS/폰트/자막 게이트: 부실 (핵심 주장 미검증)

### 1. 스크립트 실계산 여부 (`scripts/gate-p0c.mjs`)
- 게이트 실행 시간 **53ms** (18:42:26.783→.836). 렌더·OCR·TTS·스트레스를 게이트가 수행하지 않음 — 사전 산출물(reports/p0c-ocr.json, p0c-stress.json, out/p0c.mp4, 프레임 PNG)을 읽고 정합성만 검사.
- `ocr-positive`는 **p0c-ocr.json의 `pass:true` 필드를 그대로 신뢰** — 이 JSON을 만든 OCR 스크립트는 repo에 없음. 스트레스 스크립트·픽스처 TTS 생성 스크립트도 부재. → 증거 생성 체인 재현 불가.
- 자체 계산하는 것: sourceHash(나레이션 sha256) 재계산 대조, 폰트 sha256 대조, ffprobe A/V duration, words 단조성 검사. 이 부분은 실계산.

### 2. 재실측 — 진짜로 확인된 것

| 항목 | 재실측 | 판정 |
|---|---|---|
| scene-01.mp3 | ffprobe 7.344000s == meta 7.344 (실제 mp3) | 진짜 |
| p0c.mp4 A/V | video h264 + audio aac, 7.381s vs 7.344 (delta 0.037 ≤ 0.3) | 일치 |
| 폰트 무결성 | woff2 매직 `wOF2`, sha256 == font-integrity.json (`9599f12f…`, Pretendard 1.3.9) | 진짜 |
| **폰트 실사용 실험** | @font-face 제거 사본 재렌더 → mid 프레임 **PSNR 29.4dB로 확연히 상이**. 폰트 포함 사본 재렌더 → **원본 p0c.mp4와 바이트 동일**(sha `d4a3fc1b…`) | **Pretendard 실사용 확정 + mp4 출처 확정** |
| 증거 PNG 3장 | 픽셀 md5가 p0c.mp4 framemd5 목록에 실존(mid=15회 등장 프레임, random 2장 각 1회) | 실제 비디오 프레임 |
| OCR 실재성 | .venv-tts에 easyocr 1.7.2 + korean_g2 모델 실설치; 결과의 오인식("맛취/되니다")은 실제 OCR 특성 | 날조 아님 |
| 스트레스 20건 | mp3 20개 전부 sha 고유, 실오디오 4.3~4.5s; mtime이 동시성 4의 5개 웨이브 패턴(03:35:53.2→55.1) | 실행 흔적 정합 |
| evidence/inputHash | 전량 재계산 일치 | 일치 |

### 3. 치명 결함 — 자막-음성 정렬은 존재하지 않는다
- `fixtures/p0c/index.html`의 자막은 **하드코딩된 정적 `<p id="p0c-subtitle">모든 자막은 실제 음성에 맞춰 정렬됩니다</p>`**. audio_meta의 words[] 10개 타이밍은 **렌더에서 아무것도 구동하지 않음**. 타임라인 객체도 시각 효과 없는 스텁(seek해도 화면 불변).
- 프레임 실측: 1.5s(나레이션 1행 "시작했습니다" 발화 중) 프레임과 2.9s(행간 무음) 프레임이 **바이트 동일** — 둘 다 2행 텍스트를 표시. **나레이션 1행("영상 공장이 가동을 시작했습니다")의 자막은 영상 전체에서 한 번도 등장하지 않는다.**
- OCR 3프레임(mid/random-01/random-02)이 모두 같은 텍스트인 이유 = 영상이 사실상 정적이기 때문. "random" 프레임의 타임스탬프·시드 미기록이라 표본의 무작위성도 검증 불가(정적 영상이라 무의미하긴 함).
- 화면에 쓰인 문구 "모든 자막은 실제 음성에 맞춰 정렬됩니다"는 **구현되지 않은 자기 주장**이다. 게이트의 `tts-words-valid`는 메타데이터(단조성·해시)만 검증했고, 정렬이 렌더에 반영됐는지는 어떤 체크도 보지 않았다.
- 부수: 스트레스 elapsedSec 2.265(요청당 ~0.45s)는 edge-tts 기준 공격적으로 빠른 수치 — mtime 웨이브 패턴과는 정합하나 스크립트 부재로 재현 검증 불가.

**판정: 부실.** 개별 체크가 잰 값은 전부 진짜였으나(위조 아님), 게이트가 표방하는 능력("자막을 실제 음성에 맞춰 정렬")은 렌더에 구현·검증된 바 없다. 증거 생성 스크립트(OCR·스트레스·TTS) 미보존으로 재현성도 결여.

---

## P0d — 편집 루프 게이트: CONFIRMED + 경미 부실 2

### 1. 스크립트 실계산 여부 (`scripts/gate-p0d.mjs`, `scripts/compile-p0d.mjs`)
- **자체 실행형 전체 파이프라인**: 픽스처 초기화(rmSync)→base spec 기입→컴파일→lint/validate→렌더v1→s02 나레이션 편집→재컴파일→렌더v2→framemd5 4종 추출·비교→크로스페이드 3점 해시→preview 서버 SSE 실측. pass 하드코딩 없음.
- compile-p0d.mjs의 TTS는 **실제 edge-tts**(.venv-tts python, `Communicate(...).stream()`의 WordBoundary 오프셋 수집) + **ffprobe로 실측한 오디오 길이**로 durationFrames 산출. sourceHash 기반 재사용 판정 → 선택적 재TTS 로직 실재.

### 2. 재실측 결과

| 항목 | 리포트 | 재실측 | 판정 |
|---|---|---|---|
| 씬2만 재TTS (mtime) | s01/s03 불변, s02만 갱신 | 파일시스템 실검사: s01 03:57:57.345 / s03 03:57:58.285 유지, **s02만 03:58:46.595**(+48.8s, v1 렌더 직후·v2 렌더 직전). 리포트 mtimeMs와 소수점까지 일치 | 일치 |
| mp3 실재 | s01 8.424 / s02 17.04 / s03 5.952 | ffprobe 동일값, 편집된 긴 나레이션의 words 30개("sourceHash를" 토큰 포함) 실존 | 진짜 |
| scene1 불변성 | 120프레임 mismatch 0 | v1/v2에서 0~4s 재추출 → 저장본과 동일 + v1==v2 재확인. **고유 해시 18개 = 엔트런스 애니메이션 구간 포함 비교** | 일치 |
| scene3 시프트 | 90프레임 mismatch 0, 13.17s→25.0s | 재추출(14.167s/26.0s 창) → 저장본 동일 + v1==v2 재확인 | 일치 |
| shift-recompile | s02 157→512프레임, s03 시작 395→750(+355) | manifest·index.html(data-start 25) 정합 | 일치 |
| 크로스페이드 | before e2125e… / mid d06ab5… / after a95df7… (3자 상이) | v2 프레임 237/245/254 해시 재실측 → **3값 모두 리포트와 동일** | 일치 |
| v1/v2 duration | frameDelta ≤ 1 | v1 19.157s, v2 31.000s — manifest 기대치와 1프레임 이내 | 일치 |
| evidence/inputHash | 26건 | 전량 재계산 일치 | 일치 |

### 3. 부실 지점 (경미)
1. **scene3 비교 구간의 검증력**: safe offset +1s가 엔트런스(변별력 있는 유일한 구간)를 건너뛰어, 비교된 90프레임이 **전부 단일 해시(완전 정적)**. 정적 구간끼리의 일치는 ±수 프레임의 시프트 오정렬도 통과시킬 수 있어 "내용이 그대로 뒤로 밀렸다"의 프레임 정밀 증명으로는 약함(씬 색상 자체가 다르므로 조 단위 오배치는 잡힘).
2. **SSE 인과 미증명**: 체크는 scene_specs.json을 touch하고 임의의 `file-change` 이벤트를 기다리는데, 수신된 이벤트는 `{"path":"index.html"}`. preview 서버가 기동 중 index.html에 data-hf-id를 주입·재작성한 사실이 확인됨(fixtures/p0d/index.html mtime 03:59:45가 SSE 창 내, 현재 파일에 data-hf-id 잔존). 즉 이벤트가 터치가 아니라 **서버 자신의 파일 수정에서 왔을 개연성**이 높다. SSE 스트림·파일감시가 작동한다는 사실 자체는 실증됐으나 "편집→감지" 인과는 미증명.
3. (부수) inputHash가 preview의 index.html 재작성 **이후에** 계산돼, 리포트의 inputHash는 렌더에 실제 사용된 입력의 해시가 아님. 또 manifest의 subtitles/words/itemSyncPoints는 P0c와 마찬가지로 렌더에서 미사용(다만 P0d의 클레임은 편집 루프이므로 판정에 미반영).

**판정: CONFIRMED.** 편집 루프의 핵심 주장(선택적 재TTS, 시프트 재컴파일, 씬1 프레임 불변, 크로스페이드 실재)은 전부 독립 재실측으로 확인. 위 2건은 보강 권고 수준.

---

## 감사 재실측 로그 (주요 명령)

```
# evidence/inputHash 전량 재계산 (node, 알고리즘 재구현) → 50/50 일치, 4/4 일치
# ffprobe 전체 mp4 8종 → 리포트와 전부 일치
cmp out/p0a.mp4 out/p0a-second.mp4                        # 바이트 동일
python3 atom-scan out/p0a.mp4                             # ftyp→moov(32)→free→mdat(1475)
ffmpeg trim 5..10 / 0..5 framemd5 재추출                   # 저장본과 diff 없음, 교차 150/150 일치
awk framemd5 분산: scene2 해시변화 = 프레임 8~32 (GSAP 0.25+0.8s 예측과 일치), 이후 118프레임 단일 해시
ffmpeg -ss 1.5 / 2.9 / 5.0 p0c.mp4 프레임 추출             # 1.5s==2.9s 바이트 동일, 자막 정적 확인
hyperframes render fixtures/audit-p0c-copy   → sha == out/p0c.mp4 (바이트 재현, 출처 확정)
hyperframes render fixtures/audit-p0c-nofont → mid 프레임 PSNR 29.4dB (폰트 실사용 확정)
hyperframes render fixtures/p0a (인자 추정)   → PSNR 60.4dB, 바이트 불일치 (원 렌더 인자 미기록)
ffmpeg select=eq(n,237|245|254) p0d-v2.mp4    # 크로스페이드 해시 3점 리포트와 동일
stat fixtures/p0d/audio/*.mp3                 # s02만 재생성된 mtime 패턴 확인
sha256sum out/p0c-stress/*.mp3                # 20개 전부 고유
```

## 권고 (게이트 신뢰도 회복용)

1. **P0b**: `negative-orphan-recorded`의 pass 조건을 `failedAsExpected === true`로 교체하거나 체크를 게이트 집계에서 제외(informational로 강등). 현재는 mount 미강제가 확인된 상태.
2. **P0c**: words[] 타이밍으로 자막을 실제 구동(행 전환)하는 픽스처로 교체하고, OCR을 "1행 구간 프레임 → 1행 텍스트, 2행 구간 → 2행 텍스트, 전환 검증"으로 재설계. OCR·스트레스·TTS 생성 스크립트를 repo에 보존. 추출 프레임의 타임스탬프 기록.
3. **P0a**: 산출물 렌더 명령을 리포트에 기록, 결정론 프리체크를 두 렌더의 명령·sha256·타임스탬프 로그로 대체.
4. **P0d**: scene3 비교 창에 엔트런스 구간(비정적 프레임) 포함, SSE 체크는 이벤트 path가 터치한 파일과 일치하는지 확인, inputHash를 렌더 직후에 스냅숏.
