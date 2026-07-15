<p align="center"><a href="README.md">한국어</a> | <a href="README-en.md">English</a> | 日本語</p>

<p align="center"><img src="docs/assets/hero.gif" alt="ReelForge demo highlights" width="720"></p>

<p align="center"><strong>ReelForge は、一行のブリーフをフルブリードのモーショングラフィックス動画に変える、キー不要の AI 動画生成ループです。</strong></p>

成果物はスライドではなく動画です。
キネティックタイポグラフィ、ムードに基づくカラーシステム、常時動き続けるモーションを基本言語とし、
すべてのシーンはエージェント（または人間）が直接著述する HTML モーショングラフィックスのフラグメントです。

## [loop] コアループ (v6)

```
一行のブリーフ
  → 1. ディレクション固定    まず感覚を契約にする: frame（パレット・タイポグラフィ・ムードアーク）+ コピー + ストーリーボード
  → 2. シーンスウォーム      シーンごとにワーカー 1 人が free HTML フラグメントを直接著述（並列）
  → 3. 組み立て・検証        薄いマニフェスト → コンパイル → 決定論的 lint（wall-clock・非決定論コードを遮断）
  → 4. レンダー              ヘッドレス Chrome による決定論的レンダー（マルチワーカー・GPU オプション）
  → 5. ストリップ QC         1fps の全数ストリップ機械検査 + 視聴者審査 → 失敗したシーンだけを局所的に再著述
```

設計原則: データ契約ではなく、まずディレクション（感覚）。
シーンは自動生成されるレイアウトではなく著作物であり、エンジンが所有するのはタイミング・字幕・トランジション・トークン・検証だけです。
全体設計と、v5 から何をなぜ捨てたかは [docs/v6-architecture.md](docs/v6-architecture.md) にあります。

## [quick-start] Quick Start

エージェント経路（推奨）: Claude Code でこのリポジトリを開き、`skills/reelforge/SKILL.md` をスキルとして登録したうえで、
「ReelForge で 30 秒のブランドイントロを作って」のように依頼します。
スキルがディレクション固定からストリップ QC まで、上記のループをそのまま実行します。

ローカルスモーク（パイプライン確認用）:

```bash
cd <repo>
npm ci
./node_modules/.bin/hyperframes doctor

PROJECT_DIR="tmp/smoke-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$PROJECT_DIR"
cp fixtures/golden-specs/minimal-3scene/scene_specs.json "$PROJECT_DIR/scene_specs.json"

node bin/vf pipeline run "$PROJECT_DIR" --profile mock
node bin/vf studio "$PROJECT_DIR" --port 4317
```

最終動画は `$PROJECT_DIR/out/main.mp4` に生成されます。

## [features] 主な機能

### free シーン — モーショングラフィックスの著述単位
1 つのシーンが、そのまま著述された HTML フラグメントです（`layout: "free"` + `sourceHtml`）。
GSAP の paused タイムラインと CSS のリビングループは決定論的な seek レンダーに安全で、
プリセットトークン（`--rf-*`）だけで色を消費するため、どのプリセットでも同じシーンを再レンダーできます。

### デザインプリセット 17 種
linear、vercel、stripe、apple からダークハイプ（dark-hype）、韓国の放送／バラエティ調まで。
surface の階段、hairline、ムードごとのアクセント・グロー、字幕トークンを 1 つのプリセットで制御し、
コントラストの下限はコンパイル段階で強制されます。カタログは [docs/design-presets.md](docs/design-presets.md) を参照してください。

### 決定論的レンダーと検証
レンダーは seek ベースで決定論的なので、同じ入力なら同じピクセルになります。
render-lint は fetch、Math.random、Date.now、performance.now、一時停止されていないタイムラインを拒否し、
1fps ストリップの機械検査（空白・低コントラスト・モーション停止）が QC ループの土台を支えます。

### オーディオを権威とするタイミング
シーン長の唯一の権威はオーディオメタデータです。
ナレーションがあれば TTS が、音楽中心ならビートグリッドまたは無音 mock がシーン境界を決定します。
基本スタックは mock TTS、ローカルの Chrome/ffmpeg で、API キーなしに再現できます。

### Studio 編集ループ
`vf studio` でシーンプレビューと編集の影響範囲（E1 表現、E2 セリフ、E3 構造）を確認しながら磨き上げます。

### 付録 — データブロック 8 種（任意）
定量データのシーンが 1 つだけ本当に必要なときに使う選択肢です（bar、pie、line、list、
numbered、statistic、compare、quote — フルブリードレンダー）。デフォルトはブロック 0 個であり、
本文シーンをブロックから始めません。

## [demos] デモ

| デモ | 用途 | リリース |
|---|---|---|
| D1 Usage | 利用フローのチュートリアル | [d1-usage.mp4](https://github.com/kimsh-1/reelforge/releases/download/v0.1.0/reelforge-d1-usage.mp4) |
| D2 Engine | コンパイル・決定論・ゲートの紹介 | [d2-engine.mp4](https://github.com/kimsh-1/reelforge/releases/download/v0.1.0/reelforge-d2-engine.mp4) |
| D3 Intro | ブランド／製品イントロ | [d3-intro.mp4](https://github.com/kimsh-1/reelforge/releases/download/v0.1.0/reelforge-d3-intro.mp4) |

現行リリースは v5 パイプラインの成果物です。v6 ループで生成したデモが準備でき次第、置き換えられます。

## [reference] 設定リファレンス

CLI オプションと設定は [docs/usage.md](docs/usage.md)、Studio の詳細は [docs/studio.md](docs/studio.md)、
パイプラインの再開／dirty guard は [docs/pipeline.md](docs/pipeline.md)、コンパイラ契約（ブロック・free インターフェース）は
[docs/compiler.md](docs/compiler.md) を参照してください。

## [validation] プロジェクトの検証方法

P0〜P3 の実証結果、ゲート詳細、アーキテクチャ記録は [docs/build-journey.md](docs/build-journey.md) にあります。

## [license-disclaimer] ライセンスと免責

コードは Apache-2.0 です。フォント、音源、画像、TTS の成果物は、それぞれのライセンスとサービス条件に従い、
公開配布または商用利用前には、プロジェクトごとの provenance を確認する必要があります。
