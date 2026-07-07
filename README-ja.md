<p align="center"><a href="README.md">한국어</a> | <a href="README-en.md">English</a> | 日本語</p>

<!-- HERO: /mnt/d/reelforge-output/hero — 데모 완성 후 GIF+릴리스 링크 삽입 -->
<p align="center">
  <img src="docs/images/studio-scenes.png" alt="ReelForge Studio scene editor" width="900">
</p>

<p align="center"><strong>ReelForge は、`scene_specs.json` を書き、ローカルパイプラインを実行し、Studio ですぐ直すキー不要の AI 動画制作ループです。</strong></p>

## [quick-start] Quick Start(3分で最初の動画)

リポジトリルートからそのまま実行します。`vf` 関数は、このシェル内だけで使う短いローカル CLI 名です。

```bash
cd ~/reelforge
npm ci
./node_modules/.bin/hyperframes doctor

PROJECT_DIR="tmp/quickstart-reel-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$PROJECT_DIR"
cp fixtures/golden-specs/minimal-3scene/scene_specs.json "$PROJECT_DIR/scene_specs.json"

vf() { node bin/vf "$@"; }
vf pipeline run "$PROJECT_DIR" --profile mock
vf studio "$PROJECT_DIR" --port 4317
```

端末に `studio: http://127.0.0.1:4317/panel/` が表示されたら、ブラウザで開いてシーン文、レイアウト、字幕モードを編集します。レンダー済み動画は `$PROJECT_DIR/out/main.mp4` に出力されます。

## [features] 主な機能

### Studio 編集ループ
`vf studio` はシーン一覧、プレビュー、スキーマ駆動フォーム、バージョン状態を 1 つのローカル画面に表示します。
文言/レイアウト変更は E1、TTS 文変更は E2、シーン順やトランジション変更は E3 として、必要な再実行範囲を示します。
<!-- SCREENSHOT: docs/images/studio-scenes.png -->

### 8 種類のシーンブロック
`scene_specs.json` の `layout` で `bar`、`pie`、`line`、`list`、`numbered`、`statistic`、`compare`、`quote` を選びます。
タイトル/締め用に `headline_only` も使えますが、本文シーンは 8 つの主要ブロックから始める方が速いです。
<!-- SCREENSHOT: docs/images/blocks-8.png — デモレンダー後にブロックギャラリーを挿入 -->

### マルチフォーマット
コンパイラは `16:9`、`9:16`、`1:1` のキャンバスに対応し、フォーマット別の字幕セーフゾーンと override を反映します。
例: `vf compile "$PROJECT_DIR" --format 9:16 --json`。
<!-- SCREENSHOT: docs/images/multiformat.png — 16:9/9:16/1:1 比較を挿入 -->

### 無料キー不要スタック
標準経路は mock TTS、mock image、ローカル Chrome/ffmpeg、`hyperframes@0.7.26` を使い、API キーなしで再現できます。
real TTS/image runner は任意で、権利とサービス条件はプロジェクト別 provenance で確認します。
<!-- SCREENSHOT: docs/images/keyless-stack.png — ローカル成果物フローを挿入 -->

## [demos] 3 つのデモ

| デモ | 用途 | スペック | リリース |
|---|---|---|---|
| D1 Usage | インストール、パイプライン実行、Studio 確認までのチュートリアル動画 | `demos/d1-usage/scene_specs.json` | [リリースリンク予定](#) |
| D2 Engine | HTML コンパイル、seek 決定論、ゲート構造を短く説明するエンジン紹介 | `demos/d2-engine/scene_specs.json` | [リリースリンク予定](#) |
| D3 Intro | ReelForge を初めて見る人向けのブランド/製品イントロ | `demos/d3-intro/scene_specs.json` | [リリースリンク予定](#) |

## [skill] Claude Code で SKILL を使う

Claude Code でこのリポジトリを開き、`skills/reelforge/SKILL.md` をプロジェクトスキルとして登録または参照します。
依頼は「ReelForge スキルでこのブリーフを `scene_specs.json` にして mock パイプラインまで実行して」のように始めます。
スキルはブリーフ確認、シーン作成、`vf pipeline run`、ゲート確認、Studio レビューの順に案内します。

## [reference] 設定リファレンス

CLI オプションと設定は [docs/usage.md](docs/usage.md) にあります。Studio の詳細は [docs/studio.md](docs/studio.md)、再開と dirty guard は [docs/pipeline.md](docs/pipeline.md) を参照してください。

## [validation] プロジェクトの検証方法

P0~P3 の実証結果、ゲート詳細、アーキテクチャ記録は [docs/build-journey.md](docs/build-journey.md) に移しました。

## [license-disclaimer] ライセンスと免責

コードは Apache-2.0 です。フォント、音声、画像、TTS 出力はそれぞれのライセンスとサービス条件に従います。公開配布または商用利用前にプロジェクト別 provenance を確認してください。
