# 영화 타이틀 시퀀스·트레일러 그래픽 문법 — 브랜드 인트로(d3)급 임팩트 재료

> 리서치 산출물 (2026-07-07). 목적: reelforge 브랜드 인트로/타이틀 카드에 이식할 "시네마틱 문법"을
> GSAP 구현 가능 수준의 수치로 정리. 출처는 문서 말미.

---

## 0. 핵심 테제

트레일러/타이틀 시퀀스의 임팩트는 **화려함이 아니라 리듬 대비**에서 나온다.
공통 공식: **정적(침묵·검정·여백) → 압축(빌드) → 해방(히트+타이틀) → 여운(홀드)**.
웹 인트로에 이식할 때 가장 자주 틀리는 지점 3가지:

1. **침묵 구간을 안 만든다** — 히트 직전 0.3–0.8s의 "stopdown"(모든 모션 정지·화면 어둡게)이 없으면 히트가 안 산다.
2. **타이틀을 너무 빨리 치운다** — 텍스트 카드는 3–5s 홀드가 업계 관례. 등장 0.6–1.2s + 홀드 2–3s + 퇴장 0.4s.
3. **효과를 동시에 다 켠다** — 글리치·글로우·파티클은 "한 번에 하나, 짧게"가 프로 문법 (§3).

---

## 1. (a) 명작 타이틀 시퀀스 문법 — Art of the Title 계열 분석

### 1.1 문법 표

| 작품 | 핵심 기법 | 추출 가능한 문법 | 웹 이식 포인트 |
|---|---|---|---|
| **Se7en** (1995, Kyle Cooper) | 손으로 긁은 타이포 + Helvetica 혼용, 필름 지터·프레임 어긋남, 스타카토 편집 | "모든 것이 미세하게 어긋남" — 정렬·베이스라인·타이밍을 의도적으로 1–3px/1–2프레임 흐트러뜨림 | jitter: x/y ±1–2px, 2–3프레임(66–100ms) 간격 랜덤 스냅(`steps()`), opacity 플리커 0.85–1.0 |
| **True Detective** (2014) | 이중노출(인물 실루엣 안에 풍경), 느린 크로스디졸브, 광활한 네거티브 스페이스 | 실루엣 = 마스크. 타이포도 마찬가지로 "글자 안에 세계"가 가능 | `background-clip: text` + 배경 슬로우 팬(scale 1.08→1.0, 8s linear) |
| **007 시리즈** | 타이포와 그래픽 요소의 물리적 결합, 단색 실루엣 + 원색 | 단일 도형 모티프(총구/원)를 타이틀 등장의 "무대"로 사용 | 원형 clip-path 확장으로 타이틀 리빌 |
| **Zombieland / Fincher 계열** | 텍스트가 장면의 물리 요소와 상호작용 | 타이포 = 환경의 일부 (충돌·파편·가려짐) | 텍스트 위로 지나가는 오브젝트에 z-index 오클루전 |
| **2001 / Alien 계열** | 극단적 트래킹 확장 + 초슬로우 등장, 검정 배경 | "글자가 먼 곳에서 응결되는" 느낌 — 넓은 자간에서 좁혀오거나, 좁은 데서 벌어짐 | §5 P1 트래킹 패턴 |
| **Marvel/블록버스터 로고** | 3D 금속 질감 + 플래시 → 하지만 핵심은 "빛 스윕 1회" | 과한 3D 없이 **light sweep** 한 번이면 프리미엄 느낌 | 그라디언트 마스크 x: -120%→120%, 1.1s, power2.inOut |

### 1.2 타이틀 시퀀스 공통 원칙 (분석에서 증류)

- **1카드 1아이디어**: 한 화면에 텍스트 덩어리 하나. 부제·크레딧은 시차를 두고.
- **네거티브 스페이스가 주인공**: 화면의 60–80%는 비워둔다. 타이틀은 중앙 or 하단 1/3 라인.
- **타이포가 곧 캐릭터**: 폰트·자간·무게가 서사를 예고 (Se7en의 손글씨 = 살인자의 정신). 브랜드 인트로에서는 "폰트 선택 = 톤 선언"으로 치환.
- **리듬은 음악이 아니라 편집이 만든다**: 컷의 길이 변화(긴→짧→긴)가 긴장 곡선. 모든 컷을 비트에 맞추지 않아도 된다(Derek Lieu) — 히트 순간만 정확히 맞추면 된다.

---

## 2. (b) 트레일러 텍스트 카드 문법 — 임팩트 컷·플래시·타이밍

### 2.1 3막 구조 (업계 표준 타이밍)

| 막 | 길이 | 모션 밀도 | 텍스트 카드 역할 |
|---|---|---|---|
| Act 1 — Setup | 15–30s (전체의 ~20%) | 최소. 느린 페이드, 긴 홀드 | 분위기 카드 ("IN A WORLD…" 계열). 페이드인 1–2s |
| Act 2 — Escalation | 20–60s | 점증. 컷 간격이 점점 짧아짐 | 짧은 구문 카드 연타. dip-to-black 사이클 |
| Act 3 — Climax | 15–30s | 최대 → **stopdown** → 타이틀 | 메인 타이틀 카드 + 히트. 이후 버튼(짧은 유머/스팅) |

웹 인트로(3–8s)로 압축 시: **Act1 20% / Act2 45% / Act3 35%** 비율 유지가 요점.
예: 5s 인트로 = 1s 정적 → 2.2s 빌드 → 0.4s 스톱다운 → 히트+타이틀 1.4s.

### 2.2 사운드-비주얼 싱크 문법 (사운드 없이도 "들리게" 하는 법)

트레일러 음악의 요소를 **시각 이벤트로 번역**:

| 사운드 요소 | 역할 | 시각 번역 (GSAP) |
|---|---|---|
| **Riser** (상승음) | "뭔가 온다" 예고, 1–3s | scale 1→1.04 slow zoom + 배경 밝기 서서히 상승 + 요소 미세 진동 증폭 |
| **Braam** (금관 히트) | 임팩트 순간 | 플래시 프레임(§2.3) + scale 펀치(1.12→1.0, 0.5s, power4.out) + 화면 셰이크 |
| **Stopdown** (완전 침묵) | 히트 직전 0.3–0.8s | 모든 트윈 pause, 화면 dim(brightness 0.6) 또는 완전 블랙 |
| **Drop** (음악 재개) | 해방감 | 멈췄던 요소 전부 동시 재개 + 타이틀 등장 |
| **Whoosh** | 전환 | 모션 블러 흉내: skewX 4deg + x 이동 0.25s |
| **Sub-boom 여운** | 히트 후 잔향 | 비네팅 순간 진해졌다 회복(0.8s), 미세 scale 1.01→1.0 |

**규칙: 히트 프레임은 정확히 1프레임에 모든 것이 동시에 일어난다.** 플래시·펀치·타이틀 opacity 1이 같은 tick. 1–2프레임만 어긋나도 "싱크 나갔다"로 느껴진다.

### 2.3 플래시 컷 수치 (30fps 기준)

| 기법 | 지속 | 구현 |
|---|---|---|
| **화이트 플래시** | 2–4프레임 (66–133ms) | 풀스크린 `#fff` 오버레이 opacity 0→1(즉시)→0(120ms, power3.out). 순백 대신 `#fff7ea`(웜 화이트)가 시네마틱 |
| **블랙 플래시 (임팩트 컷)** | 1–2프레임 (33–66ms) | 장면 사이 검정 삽입. 연속 3–5회 반복하면 "몽타주 연타" |
| **Dip-to-black** | 페이드아웃 0.3–0.5s + 검정 홀드 0.2–0.4s + 페이드인 0.3s | 아이디어 전환의 "눈 깜빡임". 카드 연타의 기본 골격 |
| **플리커 연타** | 60–90ms 간격 3연타, 점점 밝게 | 최종 히트 직전 예열용 |
| **화면 셰이크** | 150–250ms | x/y ±3–6px, `steps(3)` 또는 rough ease, 감쇠형 (첫 진폭의 100%→40%→10%) |

### 2.4 텍스트 카드 홀드 타임

- 단어 1–3개 카드: **1.2–2s** (트레일러 연타용) / 웹에선 0.8–1.5s
- 문장 카드: **3–5s** (읽기 시간 확보 — 업계 표준)
- 메인 타이틀: **최소 2.5s 홀드** + 여운 퇴장(느린 scale 1.0→1.03 하며 페이드)

---

## 3. (c) 게임/테크 트레일러 — 글리치·글로우·파티클 절제법

### 3.1 절제의 3원칙

1. **글리치는 "이벤트"지 "상태"가 아니다** — 지속형 글리치는 3초 만에 싸구려가 된다. 등장/전환 순간에만 60–120ms 버스트로.
2. **글로우는 단일 색상** — 시안(#00f7ff)이든 마젠타든 **한 색만**. 두 색 글로우가 공존하면 즉시 테마파크 느낌.
3. **파티클은 배경 레이어에 가둔다** — 전경(타이포)과 절대 경쟁하지 않게. opacity ≤ 0.35, blur 1–2px, 개수 < 40.

### 3.2 수치 레시피

| 효과 | 파라미터 | 값 |
|---|---|---|
| **RGB 스플릿 글리치** | 채널 오프셋 | ±2–4px (넘으면 과함). red left / cyan right |
| | 버스트 길이 | 60–90ms × 2–3회, 간격 랜덤 100–300ms |
| | 구현 | 텍스트 복제 2장, `color: #f0f`/`#0ff` + `mix-blend-mode: screen`, x 오프셋 트윈 `steps(2)` |
| **슬라이스 글리치** | 슬라이스 수 | 3–5개 (`clip-path: inset()` 가로 밴드) |
| | x 오프셋 | ±6–12px, 각 슬라이스 독립 랜덤, 1버스트 80ms |
| **네온 글로우** | text-shadow 3겹 | `0 0 4px {hue}, 0 0 12px {hue}66, 0 0 32px {hue}33` |
| | 플리커 | 켜질 때만: opacity 0→1을 `steps()`로 4–6회 깜빡, 총 0.5–0.8s. 켜진 뒤엔 **정지** |
| **스캔라인** | | `repeating-linear-gradient(0deg, transparent 0 2px, rgba(0,0,0,.12) 2px 3px)`, 정적 or 아주 느린 y스크롤 |
| **파티클 (먼지/엠버)** | 개수 | 20–40개, 크기 1–3px |
| | 모션 | y 드리프트 -20~-60px/8s, opacity 0.1–0.35 사이 사인 진동. 절대 화려한 궤적 금지 |
| **디코드 텍스트** | | 랜덤 글리프 → 실제 글자 확정, 글자당 3–5회 스왑, 총 0.6–1.0s, 왼→오 순차 |

### 3.3 게임 트레일러 편집 교훈 (Derek Lieu)

- **빠른 컷을 흉내내지 마라** — 헐리우드식 연타는 대부분의 소재에 과잉. 긴 홀드가 오히려 프리미엄.
- **텐션의 보류와 해방**이 컷 속도보다 중요. 웹 번역: 요소 등장을 "예상보다 한 박자 늦게".
- 더 많은 편집 ≠ 더 좋은 편집. 모션 레이어 수를 줄이는 것이 상급 기술.

---

## 4. (d) 시네마틱 색 문법 — 실HEX 레시피

### 4.1 틸-오렌지 (블록버스터 표준)

원리: 그림자·미드톤 → 틸, 하이라이트·피부톤 → 오렌지. 보색 대비로 피사체 분리 + 깊이.

```
셰도우:      #0d2b32  (딥 틸-블랙)
미드 틸:     #1d4e56 / #2e6b74
하이라이트:  #ff8c42  (임팩트 오렌지) / #ffb36b (소프트)
피부/웜 뉴트럴: #e8a06b
페이퍼 화이트: #fff3e4  (순백 금지 — 웜 화이트)
```
웹 구현: 배경은 틸-블랙 그라디언트, 액센트·CTA·타이틀 키워드만 오렌지. 오렌지 면적 < 10%.

### 4.2 레퍼런스 필름 팔레트 (실측 계열)

| 필름 | 팔레트 | 용도 |
|---|---|---|
| **Blade Runner 2049** | `#010215`(베이스 블랙) `#23ae9c`(틸 네온) `#f78b04`(더스트 앰버) `#a30502`(딥 레드) `#153a42`(스틸 블루) | 테크 느와르 프리셋 베이스 |
| **Mad Max: Fury Road** | `#f8c6a1`(사막 스킨) `#fe6e62`(코럴 히트) `#153a42`역대비 나이트 블루 | 고채도 액션 |
| **Matrix 계열** | `#0a0f0a` + `#00ff41`(터미널 그린, 단독 사용) | 해커/터미널 톤 — 그린은 글로우 §3.2 규칙 적용 |
| **Sin City / 느와르** | `#0a0a0a` `#f5f2ea` + 단색 액센트 1개 (`#e10600` 레드) | §7 mono-impact 프리셋 |

### 4.3 모노크롬 + 단색 액센트 문법

- 베이스: 순흑 대신 `#0a0a0a`–`#111`, 순백 대신 `#f5f2ea`(웜) or `#eef1f4`(쿨).
- 액센트는 **한 색, 한 요소에만** (타이틀의 한 단어, 밑줄, 마침표). 면적 < 3%.
- 액센트 후보: 시네마 레드 `#e10600`, 블러드 오렌지 `#ff4d00`, 일렉트릭 시안 `#00e5ff`, 골드 `#d4af37`.

### 4.4 비네팅·그레인 (CSS 구현치)

```css
/* 비네팅 — 항상 켜두는 기본 레이어 */
.vignette {
  background: radial-gradient(ellipse 120% 90% at 50% 45%,
              transparent 55%, rgba(0,0,0,.45) 100%);
}
/* 히트 순간엔 .45 → .65로 0.1s 만에 진해졌다 0.8s에 걸쳐 복귀 */

/* 필름 그레인 — SVG feTurbulence 타일 */
.grain {
  opacity: .06;               /* .04–.09 범위. .1 넘으면 지저분 */
  mix-blend-mode: overlay;
  /* 애니메이션: background-position을 steps(1)로 8fps 랜덤 점프
     (부드럽게 움직이면 그레인이 아니라 노이즈 흐름으로 보임) */
}

/* 레터박스 — 시네마 선언 장치 */
.letterbox { /* 상하 검정 바, 화면 높이의 각 7–12% */ }
/* 인트로 시작 시 0 → 목표높이로 0.8s power3.inOut 슬라이드인 하면 "영화 시작" 신호 */
```

---

## 5. 타이포 진입 패턴 — GSAP 구현 스펙

공통 전제: 폰트는 컨덴스드 대문자 계열(Anton, Oswald, Archivo Expanded/Condensed, Bebas Neue),
`text-transform: uppercase`, 기본 자간 `letter-spacing: .02em~.08em`.

### P1. 트래킹 확장 (Tracking Expansion) — 정통 시네마틱

```js
// 등장: 좁은 자간+투명 → 넓게 벌어지며 응결
gsap.fromTo(title,
  { letterSpacing: "-0.04em", opacity: 0, filter: "blur(6px)" },
  { letterSpacing: "0.32em",  opacity: 1, filter: "blur(0px)",
    duration: 2.4, ease: "power2.out" });
// opacity는 앞 20%에서 완결되게 별도 트윈(duration 0.6)으로 분리하면 더 고급
// 홀드 중에도 letterSpacing 0.32em → 0.36em을 6s linear로 미세 지속(살아있는 느낌)
```
- 변형: 반대로 0.5em → 0.28em 수축형은 "압축·긴장" 톤.
- 주의: letterSpacing 트윈은 레이아웃 리플로우 유발 — 타이틀 1개에만. 여러 요소면 글자 분할 후 x 트랜스폼으로.

### P2. 마스크 리빌 (Mask Reveal) — 라인 단위 등장

```js
// 래퍼: overflow:hidden (또는 clip-path:inset(0))
gsap.from(".line-inner", {
  yPercent: 115, duration: 0.9, ease: "power4.out",
  stagger: 0.12,                       // 여러 줄일 때
  skewY: 4, clearProps: "skewY"        // 스큐 3–6deg 넣으면 "무게" 추가
});
// 수평 와이프 변형: clip-path "inset(0 100% 0 0)" → "inset(0 0% 0 0)", 1.1s power3.inOut
// 와이프 엣지에 2px 액센트색 라인을 같이 이동시키면 프리미엄
```

### P3. 블러 인 (Blur-In) — 몽환/미스터리 톤

```js
gsap.from(title, {
  opacity: 0, filter: "blur(14px)", scale: 1.06,
  duration: 1.4, ease: "power2.out"
});
// scale은 1.03–1.08 사이. 1.1 넘으면 줌 효과로 읽혀버림
// 글자별 stagger 0.05 + 랜덤 순서(rand)면 True Detective식 "응결"
```

### P4. 플래시 컷 진입 (Flash-Cut) — 최대 임팩트, 히트 전용

```js
const tl = gsap.timeline();
tl.to(".flash", { opacity: 1, duration: 0 })            // 히트 프레임: 전부 동시
  .set(title,  { opacity: 1, scale: 1.12 }, "<")
  .to(".flash", { opacity: 0, duration: 0.12, ease: "power3.out" }, "<")
  .to(title,   { scale: 1, duration: 0.5, ease: "power4.out" }, "<")
  .fromTo(".stage", { x: 5, y: -3 },                     // 감쇠 셰이크 200ms
    { x: 0, y: 0, duration: 0.2, ease: "rough({strength: 3, points: 8})" }, "<");
// 등장 트윈이 없다 — 타이틀은 "이미 거기 있었던 것처럼" 풀 opacity로 스냅. 이게 핵심.
```

### P5. 글리치 디코드 (Glitch Decode) — 테크 톤 전용

```js
// 1) 글자 스크램블(랜덤 글리프 3–5스왑, 좌→우, 총 0.8s) — TextPlugin or 수동 interval
// 2) 확정 직후 RGB 스플릿 버스트 1회:
tl.to([".r", ".c"], { x: (i) => i ? 3 : -3, duration: 0.04 })
  .to([".r", ".c"], { x: 0, duration: 0.05 })
  .to([".r", ".c"], { x: (i) => i ? -2 : 2, duration: 0.03, delay: 0.15 })
  .to([".r", ".c"], { x: 0, duration: 0.04 });
// 이후 완전 정지. 글리치 총 예산: 등장당 1회, 300ms 이내
```

### P6. 레터 캐스케이드 (Letter Cascade) — 리듬 강조

```js
gsap.from(chars, {                      // SplitText 등으로 글자 분할
  yPercent: 60, opacity: 0, duration: 0.55, ease: "back.out(1.4)",
  stagger: { each: 0.045, from: "start" }   // 0.03–0.08. 중앙 기점 "center"도 유효
});
// 카드 연타 문법과 결합: 단어카드1(P6) → dip-to-black → 단어카드2(P6) → … → 타이틀(P4)
```

### 진입 패턴 선택 가이드

| 톤 | 1순위 | 히트 결합 |
|---|---|---|
| 프레스티지/럭셔리 | P1 트래킹 | 히트 없이 리시 스웰만 |
| 에디토리얼/모던 | P2 마스크 | 소프트 히트 (셰이크 없음) |
| 미스터리/드라마 | P3 블러 | 저역 붐 (비네팅 펄스) |
| 블록버스터/스포츠 | P4 플래시 | 풀 히트 (플래시+셰이크+펀치) |
| 테크/게임 | P5 디코드 | 글리치 버스트 = 히트 |
| 캠페인/속도감 | P6 캐스케이드 | 카드 연타 마지막에 P4 |

---

## 6. 통합 타이밍 문법 표 (30fps, 5s 인트로 기준 예시)

| t | 이벤트 | 수치 |
|---|---|---|
| 0.0–1.0s | 정적 진입: 레터박스 슬라이드인, 배경 페이드 | letterbox 0.8s power3.inOut |
| 1.0–3.2s | 빌드: 슬로우 줌 + 카드 1–2장 dip-to-black 연타 | zoom scale 1→1.05 linear, 카드 홀드 0.9s |
| 3.2–3.6s | **스톱다운**: 화면 dim, 모든 모션 정지 | brightness 1→0.55, 0.15s / 홀드 0.25s |
| 3.6s | **히트 프레임**: 플래시+타이틀+셰이크+비네팅 펄스 동시 | §5 P4 |
| 3.6–5.0s | 타이틀 홀드+여운: 미세 트래킹 지속, 서브카피 지연 등장 | 서브카피 +0.5s 후 P2로, 0.6s |

---

## 7. 프리셋 후보 2종

### Preset A — `cinematic-trailer`

- **톤**: 블록버스터 트레일러. 어둡고 크고 정확한 히트.
- **팔레트**: 베이스 `#0d2b32`→`#010215` 그라디언트 / 타이틀 `#fff3e4` / 액센트 `#ff8c42` (키워드 1개·라인) / 플래시 `#fff7ea`
- **타이포**: Anton/Archivo Black 대문자, letter-spacing 최종 `0.3em`, 타이틀 `clamp(3rem, 9vw, 8rem)`
- **레이어**: 레터박스(높이 9%) + 비네팅(.45) + 그레인(.06 overlay) 상시
- **타임라인** (5s): §6 그대로. 카드 연타 = P6, 메인 타이틀 = P4 플래시 컷 + 등장 후 P1 미세 트래킹 지속(0.30→0.34em/6s)
- **모션 예산**: 글리치 0회, 파티클 = 엠버 더스트 25개(opacity ≤ .3), 히트 1회

### Preset B — `mono-impact`

- **톤**: 느와르/캠페인. 흑백 하드컷, 단어 연타, 단색 액센트.
- **팔레트**: `#0a0a0a` / `#f5f2ea` + 액센트 `#e10600` (마침표·한 단어·밑줄에만, 면적 <3%)
- **타이포**: Bebas Neue/Oswald 초대형(뷰포트 폭 90% 채움), 자간 타이트 `-0.01em`
- **문법**: dip-to-black 없이 **하드 컷** — 단어카드 0.5–0.8s 홀드 × 4–6장, 배경 흑↔백 반전 교차. 각 카드 진입은 P2 마스크(0.5s, stagger 없음, 즉물적). 마지막 카드에서 블랙 플래시 2연타(각 50ms) 후 로고+액센트 레드 등장, 2.5s 홀드.
- **모션 예산**: 셰이크·글리치·파티클 전부 0. 임팩트는 오로지 컷 리듬과 스케일 대비로.
- **변형 축**: 액센트를 `#00e5ff`로 바꾸면 테크, `#d4af37`이면 럭셔리.

*(3안 예비: `neon-decode` — BR2049 팔레트 `#010215`+`#23ae9c`, P5 디코드 + 스캔라인, 글리치 예산 등장당 1버스트. Preset B의 테크 변형으로 흡수 가능.)*

---

## 8. 출처

- [Se7en — Art of the Title](https://www.artofthetitle.com/title/se7en/) / [True Detective — Art of the Title](https://www.artofthetitle.com/title/true-detective/)
- [The Most Iconic Movie Title Sequences — Frame.io](https://blog.frame.io/2018/06/04/iconic-movie-title-sequences/) / [The Art of Film Title Design — Smashing Magazine](https://www.smashingmagazine.com/2010/10/the-art-of-the-film-title-throughout-cinema-history/)
- [The Dip to Black — Derek Lieu](https://www.derek-lieu.com/blog/2019/3/27/the-dip-to-black) / [More Trailer Editing is not Better — Derek Lieu](https://www.derek-lieu.com/blog/2023/4/23/more-trailer-editing-is-not-better-trailer-editing) / [Trailer Editing Essays — Derek Lieu](https://www.derek-lieu.com/essays)
- [Three-Act Structure in Trailer Music — Nathan Fields](https://www.nathanfieldsmusic.com/blog/three-act-structure-trailer-music) / [Trailer Music Structure — Rare Form Audio](https://www.rareformaudio.com/blog/how-production-music-reveals-trailer-structure) / [Anatomy of an Epic Score — Tonal Chaos](https://tonalchaostrailers.com/blog/what-makes-great-trailer-music/) / [Trailer Pacing — Epikton](https://epikton.net/a-quick-guide-to-pacing-in-trailers/)
- [Anatomy of a Trailer: Fade to Black — TrailerMadeTV](https://medium.com/@TrailerMadeTV/anatomy-of-a-trailer-fade-to-black-41c33fee48e0)
- [Movie Title Cards Guide — Dark Skies](https://darkskiesfilm.com/how-to-make-a-movie-title-card/) / [Typography in Film — Letterhend](https://www.letterhend.com/blog/typography-in-film-how-fonts-orchestrate-emotion-in-storytelling/) / [Typographic Trends in Title Sequences — Envato](https://elements.envato.com/learn/typographic-trends-in-title-sequences)
- [Text Tracking Animation — Juno School](https://www.junoschool.org/article/after-effects-text-tracking-animation/) / [Cinematic Titles in After Effects — Miracamp](https://www.miracamp.com/learn/after-effects/create-cinematic-titles) / [Text Reveals — Motion Array](https://motionarray.com/learn/after-effects/how-to-create-5-awesome-text-animations-in-after-effects/)
- [Teal & Orange — PetaPixel](https://petapixel.com/2017/02/23/orange-teal-look-popular-hollywood/) / [Teal and Orange Guide — passionfuelsambition](https://www.passionfuelsambition.com/glossary-what-is-teal-and-orange/) / [Teal-Orange 기법 — Maurizio Mercorella](https://www.mauriziomercorella.com/color-grading-blog/teal-and-orange-look-modern-color-grading)
- [BR2049 Palette — color-hex](https://www.color-hex.com/color-palette/67679) / [BR2049 Poster Palette — color-hex](https://www.color-hex.com/color-palette/71647) / [Mad Max Palette — color-hex](https://www.color-hex.com/color-palette/1069541)
- [Cyberpunk Glitch CSS Breakdown — Ahmod Musa](https://ahmodmusa.com/create-cyberpunk-glitch-effect-css-tutorial/)
