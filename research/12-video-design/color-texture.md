# 영상 특화 색·질감 문법 — 웹 UI 팔레트 → 영상 팔레트 보정 가이드

> 리서치 일자: 2026-07-07. 대상: reelforge 프리셋(`fixtures/presets/`) 6종+α를 HTML→렌더→mp4(H.264/8-bit/4:2:0) 파이프라인에 태울 때의 색·질감·글로우·모션블러 문법.
> 핵심 전제: **웹에서 완벽한 HEX가 영상에서 죽는 3대 원인 = ① 8-bit 근흑(near-black) 밴딩+매크로블록, ② 4:2:0 크로마 서브샘플링의 채도 번짐, ③ 감마 태깅 불일치(워시아웃).**

---

## 0. 영상 파이프라인이 웹과 다른 물리 법칙 (요약)

| 법칙 | 내용 | 결과 |
|---|---|---|
| **8-bit 밴딩** | 채널당 256계조뿐. 어두운 영역은 실제 사용 계조가 수십 단계 | 근흑 그라데이션에 줄무늬(밴딩), YouTube 재인코딩 시 블록화 |
| **4:2:0 크로마 서브샘플링** | 색 해상도가 가로·세로 절반. 휘도만 풀해상도 | **고채도 색의 가는 획·경계가 번짐**. 레드/마젠타 최악. 웹(4:4:4)에서 선명하던 컬러 텍스트가 뭉개짐 |
| **채도-휘도 커플링** | 비디오 색공간에서 채도 허용량은 50% 그레이에서 최대, 휘도 0%/100%에 가까울수록 급감 | 아주 밝거나 아주 어두운 고채도색은 클리핑/뭉개짐 |
| **감마 시프트** | macOS QuickTime 1.96 vs Windows 2.2 vs 방송 2.4 | 태깅 없는 mp4는 플랫폼마다 밝기·대비가 다르게 보임 |
| **재인코딩 열화** | YouTube/Instagram이 다시 압축. 어두운 프레임일수록 비트레이트 배정이 박함 | 다크 테마 영상이 제일 크게 열화됨 |

**파이프라인 지시 (렌더 단계 공통):**
- ffmpeg 인코딩 시 반드시 색 메타데이터 태깅: `-color_primaries bt709 -color_trc bt709 -colorspace bt709` (+ `-vf format=yuv420p`). 미태깅이 감마 시프트의 근원.
- 다크 씬 비중이 크면 업로드 마스터는 고비트레이트(CRF 16~18) 또는 10-bit(H.265 Main10)로. 유튜브 재압축 전 여유를 확보.
- **모든 대형 그라데이션·근흑 배경에는 그레인을 얹는 것이 밴딩 억제(디더링) 그 자체다** — 미학이 아니라 기술적 필수 (§2).

---

## 1. 프리셋 6종 영상 보정판 권고

원칙: 웹 HEX를 바꾸는 게 아니라 **"영상 렌더 시 오버라이드 레이어"**를 프리셋에 추가한다(예: `videoSafe` 키). 아래 표의 "죽는 값"은 실측 근거(밴딩/크로마번짐/계조붕괴) 기준.

### 1-1. linear (`linear.json`, `linear-demo.json`) — 위험도 최상

다크 테마 = 영상 압축의 최악 조합. 근흑 캔버스 + 헤어라인 위계가 전부 압축에 갈려나간다.

| 토큰 | 웹 값 | 영상에서 죽는 이유 | 보정 권고 |
|---|---|---|---|
| `background` | `#010102` | 근흑 풀프레임 → YouTube 매크로블록·밴딩 1순위. 휘도 16 이하 limited-range 클램프 영역 | **`#0a0b0e`** (그레인 필수 동반). 브랜드 순흑 감성 유지하려면 최저 `#08090c` |
| `surface` `#0f1011` / `panel` `#141516` / `surface3` `#18191a` / `surface4` `#191a1b` | 4단 래더 | 단 간 Δ가 채널당 2~5 → 4:2:0+압축 후 **래더가 한 단으로 붕괴**. surface3↔surface4는 Δ1~2로 웹에서도 한계 | 단 간격을 채널당 **≥8**로 재배분: `#121317` / `#1a1b20` / `#22242a` / `#2b2d34`. 4단이 필요 없으면 2단으로 병합 |
| `hairline` `#23252a` (bg 위) | Δ휘도 ~13% | 1px 헤어라인 + 낮은 대비 → 스케일링·압축 후 소멸. "보더로 위계 짓는" Linear 문법이 통째로 사라짐 | 영상용 헤어라인은 **`#34363e` 이상 + 1.5~2px**. 또는 보더 대신 surface 단차로 위계 표현 |
| `accent` `#5e6ad2` | 저채도 라벤더 | ✅ 안전(채도 낮고 중간 휘도). 크로마번짐 거의 없음 | 유지 |
| `accentAlt` `#828fff` 글로우 | `0 0 34px` (demo) | 34px 글로우는 다크에서 블룸 과다 + 압축 시 글로우 경계 밴딩 | §3 상한 적용: 폰트 크기 0.5배 이하, 3층 분할 |
| `text` `#f7f8f8` | — | ✅ 순백 아님 → 할레이션 회피 잘됨 | 유지 |

**필수 동반 조치:** linear 렌더에는 grain 오버레이(§2, opacity 0.05±)를 디폴트 ON. 근흑+라벤더 글로우 조합은 그레인 없으면 100% 밴딩.

### 1-2. vercel (`vercel.json`) — 위험도 중 (포인트 컬러가 문제)

| 토큰 | 웹 값 | 죽는 이유 | 보정 권고 |
|---|---|---|---|
| `highlightPink` `#ff0080` | 순채도 마젠타 | **4:2:0 최악의 색**. 가는 텍스트·1px 요소에 쓰면 경계가 프린지처럼 번짐 | 텍스트/헤어라인 용도 금지. 대형 블록·그라데이션 스톱으로만. 텍스트에 꼭 쓰면 **`#f23d96`**(채도 -15%, 휘도 +6%) + 굵기 700↑, 크기 32px↑ |
| `error` `#ee0000` | 순적 | 레드는 크로마번짐 대표색. 작은 에러 배지·캡션이 뭉개짐 | 영상용 **`#e5484d`** (Radix red 계열: 채도 완화+휘도 상승) |
| 그라데이션 3종 (`#007cf0→#00dfd8`, `#7928ca→#ff0080`, `#ff4d4d→#f9cb28`) | 고채도 멀티스톱 | 스톱 간 장거리 보간에서 밴딩 + 시안 `#00dfd8`은 고휘도 고채도라 클리핑 경계 | 그라데이션 위 grain 필수. `#00dfd8`→**`#17cfc9`**. 각도 애니메이션 시 스텝 보간 말고 회전으로 |
| `background` `#fafafa` / `canvas` `#ffffff` | — | 풀프레임 `#ffffff`는 소비자 디스플레이에서 할레이션(번쩍임)·자막 대비 과다 | 풀프레임 배경은 `#fafafa` 통일, `#ffffff`는 카드 표면만 |
| `hairline` `#ebebeb` (on `#fafafa`) | Δ 6% | 압축 후 소멸 | 영상용 **`#dcdcdc`** |
| `accent` `#171717` (잉크 블랙) | — | ✅ 라이트 테마의 흑 텍스트는 안전 | 유지 |

### 1-3. stripe (`stripe.json`) — 위험도 중상 (메시 그라데이션이 관건)

| 토큰 | 웹 값 | 죽는 이유 | 보정 권고 |
|---|---|---|---|
| 상단 메시 그라데이션 (크림·오렌지·라벤더·인디고·루비) | 대면적 소프트 블렌드 | **메시 그라데이션 = 밴딩 발생기**. 완만한 색 전이가 8-bit에서 등고선화 | grain 오버레이 필수(opacity 0.04~0.06). 스톱 간 색차를 웹보다 약간 크게 잡아 전이 구간 축소 |
| `magenta` `#f96bee` | 고채도 마젠타 | 크로마번짐. 가는 요소 금지 | 대형 그라데이션 스톱 전용. 텍스트 금지 |
| `ruby` `#ea2261` | 고채도 적 | 소형 텍스트에서 번짐 | 텍스트는 **`#d9366b`**, 24px 미만 사용 금지 |
| `accent` `#533afd` | 고채도 인디고 | 블루 계열이라 레드보단 안전하나 다크 패널 위 가는 텍스트는 번짐 | CTA 블록·버튼은 유지. 본문 링크 텍스트는 `#5b4bec` |
| `shadow` `#003770` 블루 섀도 | `0 8px 24px` | ✅ 컬러 섀도는 영상에서 오히려 깊이감에 유리 | 유지, 단 blur 24px 상한 |
| `ink` `#0d253d` on `#ffffff` | — | ✅ | 풀프레임 배경만 `#fbfcfe`로 |

### 1-4. notion (`notion.json`) — 위험도 중

| 토큰 | 웹 값 | 죽는 이유 | 보정 권고 |
|---|---|---|---|
| 파스텔 카드 틴트 8종 (`#ffe8d4` `#fde0ec` `#d9f3e1`…) | 인접 사용 시 | 고휘도 저채도 틴트는 4:2:0에서 **서로 구분이 뭉개져 "다 흰색"**으로 수렴 | 영상에서는 틴트 채도를 +10~15% 올린 진한 판 사용: peach `#ffd9b8`, rose `#fbcfe0`, mint `#c4ecd2`, lavender `#d9cfef`, sky `#c8e2f7`, yellow `#fdf0b4`. 또는 틴트 카드에 1.5px `hairlineStrong` 보더 강제 |
| `panel` `#0a1530` 딥네이비 히어로 | 근흑 네이비 대면적 | 밴딩+블록. 네이비→검정 비네트 조합이면 특히 | **`#0f1c3d`**로 리프트 + grain. `brandNavyDeep` `#070f24`는 영상 풀프레임 금지 |
| `brandPink` `#ff64c8` | 고채도 핑크 | 크로마번짐 | 소형 요소 금지, 대형 일러스트 면 전용 |
| `accentAlt` `#f9e79f` 볼드옐로 배너 | 고휘도 옐로 | ✅ 옐로는 휘도 성분이 커서 4:2:0에 강함 | 유지. 단 옐로 위 텍스트는 `#1a1a1a` 유지(navy 금지 — 압축 후 탁해짐) |
| `hairline` `#e5e3df` on `#ffffff` | Δ 8% | 소멸 위험 | 영상용 `#d8d5cf` |

### 1-5. apple (`apple.json`) — 위험도 중 (다크 타일 래더)

| 토큰 | 웹 값 | 죽는 이유 | 보정 권고 |
|---|---|---|---|
| `surfaceTile1/2/3` `#272729` `#2a2a2c` `#252527` | Δ 채널당 2~3 | **3단 타일 위계가 압축 후 완전 동일색**이 됨 | 병합해 1색(`#28282b`)으로 쓰거나, 구분이 필요하면 Δ≥8: `#232326` / `#2c2c30` / `#1c1c1f` |
| `surfaceBlack` `#000000` | 순흑 대면적 | limited-range 클램프 + 블록. 에지투엣지 순흑 타일이 옆 타일과 경계 붕괴 | **`#0a0a0c`** + grain |
| `accent` `#0066cc` / `#2997ff` | 중채도 블루 | ✅ 블루는 크로마번짐 내성 최상위 | 유지 |
| `bodyOnDark` `#ffffff` on `#272729` | 순백 텍스트 | 다크 위 순백 대형 타이포는 할레이션 + 압축 링잉(ringing) | 대형 디스플레이 타이포는 **`#f5f5f7`** |
| `dividerSoft` `#f0f0f0` on `#ffffff` | Δ 6% | 소멸 | `#e3e3e6` |

### 1-6. dark / light 픽스처 (`dark.json`, `light.json`) — 위험도 하 (원래 영상 지향적 설계)

| 토큰 | 값 | 판정 | 보정 |
|---|---|---|---|
| dark `background` `#0B1020` | 휘도 ~7% | 경계선. `#010102`보단 안전하나 grain 권장 | 유지 + grain 0.04 |
| dark `accent` `#FDE047` 옐로 | — | ✅ 자막 키워드 색으로 이상적(고휘도=luma 채널에 실림) | 유지 |
| dark `urgent` `#F43F5E` | 고채도 로즈 | 가는 캡션에 번짐 | 캡션 용도는 `#f0566c`, 스트로크 2px+ 동반 |
| dark 자막 스펙 (46px/800/스트로크 3px 흑) | — | ✅ 영상 자막 모범 수치 | 유지 |
| light `background` `#F8FAFC` | — | ✅ | 유지 |
| light `danger` `#B91C1C` | 어두운 적 | 휘도가 낮은 레드 → 다크 서피스 위에서 뭉개짐 | 라이트 배경 전용으로 한정 |

### 공통 보정 규칙 (프리셋 무관)

1. **근흑 바닥**: 풀프레임 배경 최저 휘도 `#0a0a0c`(RGB 10). `#000000`~`#070707`은 카드 내부 소면적만.
2. **순백 천장**: 풀프레임 `#ffffff` 금지 → `#fafafa`. 다크 위 대형 타이포 `#ffffff` → `#f5f7f8`.
3. **고채도 보정 공식**: HSL 기준 S>85% && (L<25% || L>75%) 색은 텍스트·1px 요소 금지. 써야 하면 S -15%p, L을 40~65% 밴드로 이동.
4. **레드·마젠타 계열**(H 330°~30°)은 한 단계 더 엄격: 24px 미만 텍스트 금지, 스트로크·글로우로 luma 경계 보강.
5. **인접 서피스 단차**: 채널당 Δ≥8 (휘도 Δ≥3%). 그 미만이면 병합하거나 보더로 구분.
6. **헤어라인**: 배경과 휘도차 ≥12% + 두께 ≥1.5px(1080p 기준). 못 지키면 그 헤어라인은 영상에 없는 것.

---

## 2. 텍스처/그레인 레시피 — 디지털 무균감 제거 (CSS/GSAP 구현 가능 범위)

트렌드 근거: 2025~26 그라데이션 문법은 "매끈한 메시"에서 **"grainy gradient(노이즈 얹은 필름 그레이드풍)"**로 이동 완료(Spotify Wrapped, Stripe 계열 리브랜딩들). 그레인은 미학인 동시에 §0의 밴딩 디더링 수단 — 다크 프리셋에서는 기술적 필수.

### 2-1. 표준 그레인 오버레이 (SVG feTurbulence) — 기본값

```html
<svg width="0" height="0" style="position:absolute">
  <filter id="grain">
    <feTurbulence type="fractalNoise" baseFrequency="0.8"
                  numOctaves="2" stitchTiles="stitch" seed="7"/>
    <feColorMatrix type="saturate" values="0"/> <!-- 모노 그레인: 컬러 노이즈는 4:2:0에서 얼룩됨 -->
  </filter>
</svg>
```
```css
.grain-overlay{
  position:absolute; inset:-50%;           /* 지터 여유분 */
  width:200%; height:200%;
  filter:url(#grain);
  opacity:.05;                              /* 다크 .05~.08, 라이트 .03~.05 */
  mix-blend-mode:overlay;                   /* 대안: soft-light(더 순함) */
  pointer-events:none;
}
```
- **baseFrequency**: 0.6~0.9 = 파인 필름 그레인. 0.2 이하 = 얼룩(금지). 1.2 이상 = 모니터 먼지 느낌.
- **numOctaves**: 2~3. 4 이상은 렌더 비용만 늘고 차이 없음.
- **반드시 `saturate 0`으로 모노화** — 컬러 그레인은 크로마 채널에 실려 압축 후 얼룩이 된다.

### 2-2. 그레인 애니메이션 (정지 그레인 = "더러운 화면") — GSAP

정지 그레인은 화면 얼룩으로 읽힌다. 영상에서는 **8~12fps로 지터**해야 필름 그레인으로 읽힌다 (24fps 풀 지터는 지글거려서 과함).

```js
// 방법 A: 위치 지터 (렌더 비용 최소, 결정론적 — HyperFrames seek-safe)
gsap.to(".grain-overlay", {
  x: "random(-80, 80, 1)", y: "random(-80, 80, 1)",
  duration: 0.1,                    // 10fps 그레인
  ease: "steps(1)",
  repeat: -1, repeatRefresh: true
});
```
```js
// 방법 B: seed 스왑 (SMIL/JS로 feTurbulence seed를 프레임마다 교체 — 3~4개 순환이면 충분)
const turb = document.querySelector("#grain feTurbulence");
gsap.to({s:0}, { s:3, duration:0.4, ease:"steps(4)", repeat:-1,
  onUpdate(){ turb.setAttribute("seed", Math.floor(this.targets()[0].s)); }});
```
- 대면적 feTurbulence는 페인트 비용이 크다. 실시간 프리뷰가 무거우면 **256×256 노이즈 PNG 타일**(canvas로 1회 생성)로 대체하고 같은 지터를 적용.

```js
// 노이즈 PNG 1회 생성 (canvas)
const c = Object.assign(document.createElement("canvas"), {width:256, height:256});
const ctx = c.getContext("2d"), img = ctx.createImageData(256,256);
for (let i=0; i<img.data.length; i+=4){
  const v = 128 + (Math.random()*2-1)*40;          // ±40 진폭 = 온화한 그레인
  img.data[i]=img.data[i+1]=img.data[i+2]=v; img.data[i+3]=255;
}
ctx.putImageData(img,0,0);
document.querySelector(".grain-overlay").style.background =
  `url(${c.toDataURL()}) repeat`;                   // filter:url(#grain) 대신
```

### 2-3. Grainy gradient (CSS-Tricks 계열 정석 — 그라데이션이 노이즈로 디더링되며 소멸)

```css
.grainy-hero{ position:relative; overflow:hidden; }
.grainy-hero::before{
  content:""; position:absolute; inset:0;
  background:
    linear-gradient(20deg, rgba(83,58,253,.85), transparent 60%),   /* stripe 인디고 */
    radial-gradient(at 80% 10%, rgba(234,34,97,.5), transparent 55%),
    #f6f9fc;
}
.grainy-hero::after{
  content:""; position:absolute; inset:0;
  filter:url(#grain) contrast(140%) brightness(115%);  /* contrast 부스트가 디더 입자를 세움 */
  opacity:.35; mix-blend-mode:soft-light;
}
```
- 원 레시피의 `contrast(170%) brightness(1000%)`는 웹용 극단값 — 영상에서는 인코더가 그 입자를 다시 뭉개므로 **contrast 130~150% 선**이 결과가 좋다.

### 2-4. 필름 그레이드 마감 3종 세트 (그레인과 함께 쓰는 보조 텍스처)

```css
/* ① 비네트 — 프레임 응집력. 다크 프리셋 기본 ON */
.vignette::after{
  content:""; position:absolute; inset:0; pointer-events:none;
  background:radial-gradient(ellipse 120% 90% at 50% 45%,
    transparent 55%, rgba(0,0,0,.28) 100%);   /* .35 초과 금지 */
}
/* ② 헤일레이션 워시 — 다크 씬 상단에 아주 옅은 색 안개 (필름 룩 신호) */
.halation::before{
  content:""; position:absolute; inset:0; pointer-events:none;
  background:radial-gradient(ellipse 80% 40% at 50% 0%,
    rgba(94,106,210,.08), transparent 70%);   /* 프리셋 accent를 8% 이하로 */
}
/* ③ 미세 스캔 텍스처 — 좌우 1px 리듬. 레트로 아닌 프리셋엔 OFF */
.scan::after{
  content:""; position:absolute; inset:0; pointer-events:none; opacity:.04;
  background:repeating-linear-gradient(0deg, #fff 0 1px, transparent 1px 3px);
}
```

### 2-5. 글로우 레시피 (다크 프리셋용 — 절제선 내장)

```css
/* 표준 3층 글로우: 코어(백)–타이트–헤일로. 층별 opacity 하강이 핵심 */
.glow-text{
  color:#f7f8f8;
  text-shadow:
    0 0 2px  rgba(255,255,255,.9),      /* 코어 */
    0 0 .18em var(--accent-60),          /* 타이트: 폰트 대비 상대단위 */
    0 0 .45em var(--accent-25);          /* 헤일로: 최외곽은 25% 이하 */
}
/* linear 예시: --accent-60: rgba(94,106,210,.6); --accent-25: rgba(94,106,210,.25); */

.glow-card{
  box-shadow:
    0 0 0 1px rgba(130,143,255,.28),     /* 경계 정의 — 글로우가 번져도 형태 유지 */
    0 0 18px rgba(94,106,210,.22),
    0 0 48px rgba(94,106,210,.10);       /* 최외곽 10% — 이 이상이면 '게이밍 UI' */
}
```
```js
// GSAP 글로우 펄스 — 진폭을 작게, 주기를 길게 (아마추어 티 = 큰 진폭 + 빠른 주기)
gsap.fromTo(".glow-card",
  { boxShadow:"0 0 0 1px rgba(130,143,255,.28), 0 0 18px rgba(94,106,210,.18), 0 0 44px rgba(94,106,210,.08)" },
  { boxShadow:"0 0 0 1px rgba(130,143,255,.34), 0 0 22px rgba(94,106,210,.26), 0 0 56px rgba(94,106,210,.13)",
    duration:2.4, ease:"sine.inOut", yoyo:true, repeat:-1 });   // 진폭 ≈ +20%, 주기 ≥2s
```

### 2-6. 모션 블러 근사 (CSS엔 네이티브 모션 블러가 없음 — 180° 셔터 환산)

필름 표준 = 180° 셔터 = **프레임당 이동량의 50%만큼 블러**. 이 비율을 넘으면 뭉개지고, 0이면 스타카토.

```js
// 이동 tween에 속도 비례 blur를 걸었다 풀기 (수평 이동 예)
const SHUTTER = 0.5;                              // 180° 고정. 0.7 초과 금지
gsap.to(".flying-card", {
  x: 900, duration: 0.6, ease: "power3.out",
  onUpdate() {
    const v = Math.abs(this.ratio - (this._prev ?? 0)) * 900; // px/tick 근사
    this._prev = this.ratio;
    const blur = Math.min(v * SHUTTER, 14);       // 캡 14px
    this.targets()[0].style.filter = blur > 3 ? `blur(${blur}px)` : "none";
  },                                              // 3px 미만 블러는 걸지 않음(연산 낭비+물러짐)
  onComplete(){ this.targets()[0].style.filter = "none"; }
});
```
- 방향성 블러가 필요하면 `blur()` 대신 잔상 클론 2개(opacity .35/.15, 이동 지연 1~2프레임)가 압축에 더 강하다.
- **정지 상태에서 blur가 남아 있으면 무조건 버그** — onComplete에서 반드시 제거.

---

## 3. 금지 수치 목록 (하드 룰)

### 색
| # | 금지 | 이유 |
|---|---|---|
| C1 | 풀프레임 배경 `#000000`~`#070707` | 밴딩·매크로블록·limited-range 클램프. 바닥 = `#0a0a0c` |
| C2 | 풀프레임 배경 `#ffffff` | 할레이션·자막 대비 과다. 천장 = `#fafafa` |
| C3 | S>85% && (L<25% or L>75%) 색을 텍스트/1px 요소에 | 채도-휘도 커플링 + 4:2:0 번짐 |
| C4 | 순채도 레드·마젠타(`#ff0000` `#ff0080` `#ee0000` 등) 24px 미만 텍스트 | 크로마 서브샘플링 최악 피해색 |
| C5 | 인접 서피스 채널 Δ<8 (예: apple `#2a2a2c` vs `#272729`) | 압축 후 동일색으로 붕괴 |
| C6 | 배경 대비 휘도차 <12%의 1px 헤어라인 | 스케일+압축 후 소멸 |
| C7 | 컬러 노이즈/컬러 그레인 | 크로마 채널 얼룩. 그레인은 모노만 |
| C8 | 색 메타데이터 미태깅 mp4 출고 | 플랫폼별 감마 시프트(워시아웃/떡짐) |

### 그레인·텍스처
| # | 금지 | 이유 |
|---|---|---|
| T1 | grain opacity > 0.12 | "더러운 화면". 다크 .05~.08, 라이트 .03~.05 |
| T2 | grain opacity < 0.02 | 인코더가 지워버림 — 넣으나 마나 + 디더 효과 상실 |
| T3 | 정지 그레인 (지터 없음) | 화면 얼룩/센서 먼지로 읽힘. 8~12fps 지터 필수 |
| T4 | baseFrequency < 0.3 (그레인 용도) | 입자가 아니라 얼룩 |
| T5 | 비네트 최암부 alpha > 0.35 | "터널 시야" — 아마추어 시그니처 |
| T6 | 다크 프리셋 대면적 그라데이션에 그레인 생략 | 밴딩 방치 = 렌더 결함 |

### 글로우·블룸
| # | 금지 | 이유 |
|---|---|---|
| G1 | 텍스트 글로우 blur 반경 > 폰트 크기 0.5배 | 글자가 뭉개지고 '바셀린 스크린'(블룸 과용의 고전적 실패) |
| G2 | 글로우 최외곽 층 opacity > 0.3 | 게이밍/사이버펑크 티. 코어→타이트→헤일로 하강 필수 |
| G3 | 단층(1개) 대형 글로우 `0 0 40px <원색>` | 층 분리 없는 글로우 = 스티커 느낌. 현 프리셋 moods.glow 다수가 이 패턴 — 3층 분해 필요 |
| G4 | 글로우 펄스 진폭 > +25% 또는 주기 < 1.2s | 경보등. 진폭 ~20%/주기 2s+ |
| G5 | 라이트 배경 위 글로우 | 물리적으로 안 보임 + 압축 시 지저분한 링만 남음 |
| G6 | 4개 이상 요소 동시 글로우 | 초점 붕괴. 프레임당 글로우 주체는 1~2개 |

### 모션 블러·모션
| # | 금지 | 이유 |
|---|---|---|
| M1 | 셔터 환산 > 180° (이동량 50% 초과 블러) | 뭉개짐·취함. SHUTTER 계수 0.5, 절대 상한 0.7 |
| M2 | blur() 캡 없는 속도 비례 블러 | 순간 최고속에서 프레임 전체가 뭉개짐. 캡 12~14px |
| M3 | 3px 미만 이동 블러 | 효과 없이 소프트해지기만 함 — 걸지 않는다 |
| M4 | 정지 후 잔류 블러/글로우 | 렌더 결함으로 인식됨 |
| M5 | 배경 그라데이션 각도 회전 속도 > 6°/s | 배경이 주인공을 잡아먹음 + 대면적 재인코딩 비트 낭비(전경 화질 하락) |

---

## 4. 적용 우선순위 제안 (reelforge 관점)

1. **grain 오버레이를 렌더 데코레이터로 표준화** — 다크 프리셋(linear, apple 다크타일, dark) 디폴트 ON, 라이트 그라데이션 히어로(stripe, vercel 그라데이션) ON, 플랫 라이트 캔버스는 OFF 가능.
2. **프리셋 스키마에 `videoSafe` 오버라이드 블록 추가** — §1 표의 보정 HEX를 기계가 읽는 형태로. 렌더러가 프리셋 로드 시 자동 스왑.
3. **moods.glow 3층 분해** — 현재 전 프리셋의 `"0 0 26px #F97316"` 식 단층 글로우를 §2-5 3층 포맷으로 마이그레이션 (G3 위반 일괄 해소).
4. **린트 게이트** — §3 금지 수치를 프리셋/컴포지션 정적 검사로: C1~C6은 HEX 파싱만으로 검출 가능.

---

## 출처

- [Larry Jordan — Broadcast Safe: Keep Video Levels Legal](https://larryjordan.com/articles/broadcast-safe-keep-video-levels-legal/) · [The Broadcast Safe Effect Isn't Just for Broadcast](https://larryjordan.com/articles/the-broadcast-safe-effect-isnt-just-for-broadcast/) — 순흑/순백 무채도 제약, 채도-휘도 커플링, IRE 0~100
- [FileMender — Broadcast Safe Colours Guide](https://filemender.com/blog/broadcast-safe-colours-guide) · [Medialooks — Color Grading for Broadcast](https://medialooks.com/articles/understanding-color-grading-for-broadcast-content/)
- [VideoHelp — How to avoid banding in a gradient on a YouTube video](https://forum.videohelp.com/threads/317183-How-to-avoid-banding-in-a-gradient-on-a-youtube-video) · [Sonnati — Defeat Banding](https://sonnati.wordpress.com/2020/01/12/defeat-banding-part-i/) · [UniFab — Color Banding](https://unifab.ai/resource/what-is-color-banding) — 8-bit 밴딩, 근흑 압축 블록, 디더/그레인 해법, 10-bit 권고
- [CineD — QuickTime Gamma Shift Bug](https://www.cined.com/quicktime-gamma-shift-bug-what-is-it-and-how-to-combat-it/) · [Adobe — Washed out Premiere exports](https://helpx.adobe.com/premiere-pro/using/why-do-my-premiere-pro-exports-look-washed-out.html) · [Knut Erik Evensen — Avoiding Gamma Shift in Resolve](https://www.knuterikevensen.com/2021/06/22/avoiding-gamma-shift-when-exporting-from-resolve-17-2/) — 감마 1.96/2.2/2.4, Rec.709-A 태깅
- [Wikipedia — Chroma subsampling](https://en.wikipedia.org/wiki/Chroma_subsampling) · [DisplayNinja — 4:4:4 vs 4:2:2 vs 4:2:0](https://www.displayninja.com/chroma-subsampling/) · [NearStream — 4:2:2 vs 4:2:0](https://www.nearstream.us/blog/the-science-of-color-chroma-subsampling-422-vs-420-capture-cards) — 레드/고채도 번짐, 텍스트 에지 열화
- [CSS-Tricks — Grainy Gradients](https://css-tricks.com/grainy-gradients/) · [freeCodeCamp — Grainy CSS Backgrounds Using SVG Filters](https://www.freecodecamp.org/news/grainy-css-backgrounds-using-svg-filters/) · [Codrops — Creating Texture with feTurbulence](https://tympanus.net/codrops/2019/02/19/svg-filter-effects-creating-texture-with-feturbulence/) · [MDN — feTurbulence](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feTurbulence) · [ibelick — Grainy backgrounds with CSS](https://ibelick.com/blog/create-grainy-backgrounds-with-css) · [Frontend Masters — Grainy Gradients](https://frontendmasters.com/blog/grainy-gradients/) — baseFrequency/numOctaves/블렌드 수치, 성능(PNG 타일 대체)
- [Learn UI Design — Mesh Gradients Deep Dive](https://www.learnui.design/blog/mesh-gradients.html) · [Colors Hunter — CSS Gradient Trends 2026](https://colorshunter.com/blog/gradient-design-trends) · [Design Magazine — How Gradients Got Rough](https://designmagazine.com.au/how-gradients-got-rough/) — mesh→grainy 전환 트렌드, Spotify 사례
- [Wikipedia — Bloom (shader effect)](https://en.wikipedia.org/wiki/Bloom_(shader_effect)) · [Gangles — Bloom Disasters](https://gangles.ca/2008/07/18/bloom-disasters/) · [LearnOpenGL — Bloom](https://learnopengl.com/Advanced-Lighting/Bloom) — 블룸 과용 실패 사례("바셀린 스크린"), 절제 원칙
- [CSS-Tricks — How to Create Neon Text](https://css-tricks.com/how-to-create-neon-text-with-css/) · [CSSTools — Neon Text Effect](https://csstools.io/blog/css-neon-text-effect) — 3층(코어/타이트/헤일로) 글로우 구조
- [Wipster — Debunking the 180-degree shutter rule](https://www.wipster.io/blog/debunking-the-180-degree-shutter-rule) · [ExpertPhotography — 180 Degree Shutter Rule](https://expertphotography.com/photography-180-degree-rule/) · [ProVideo Coalition — Cinematic Motion Blur in After Effects](https://www.provideocoalition.com/tip_create_cinematic_motion_blur_in_after_effects_and_in_life/) — 50% 노출 원칙, 과다 시 뭉개짐/과소 시 스타카토
