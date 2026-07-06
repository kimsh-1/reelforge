<h3 align="center"><a href="README.md">한국어</a> | <a href="README-en.md">English</a> | 日本語</h3>

<h1 align="center">ReelForge</h1>

<p align="center">
  <a href="#"><img alt="CI placeholder" src="https://img.shields.io/badge/CI-placeholder-lightgrey"></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-Apache--2.0-blue"></a>
  <a href="#"><img alt="Docker placeholder" src="https://img.shields.io/badge/docker-placeholder-lightgrey"></a>
</p>

reelforge は、短いブリーフからナレーション契約、コンパイル、レンダー、ゲート検証までを監査可能な一本の経路で扱う決定論的な動画制作リポジトリです。デモ動画や大きなメディアはコミットせず、証拠と研究資料だけを追跡します。

## [overview] プロジェクト概要

reelforge は韓国語ナレーションを中心に、横長、縦長、正方形の動画生成を目標にします。レンダーエンジンは `hyperframes@0.7.26` に正確に固定し、編集は HTML を直接変更せず、`scene_specs` などの契約ファイルを変更して再コンパイルする単一経路で行います。

この T3 コミットは完成品ではなく、リポジトリの正本です。研究文書 00~10、P0 PoC の証拠、ゲートランナーの骨格、ライセンス方針、Codex 実行規則を一つの場所へ移管します。

## [architecture] 5層アーキテクチャ概要

| 層 | 役割 |
|---|---|
| L0 契約 | `scene_specs`、`audio_meta`、`design-tokens`、`versions`、`render-manifest` を真実のソースにします。 |
| L1 パイプライン | ブリーフを台本、シーン、音声、画像、コンパイラ入力へ変換します。 |
| L2 コンパイラ | 契約を読み、決定論的な hyperframes HTML と独自の render-lint 結果を生成します。 |
| L3 スタジオ | adapter-hosted プレビューとスキーマ駆動の編集パネルを提供します。 |
| L4 ゲート/パッケージング | `vf gate`、CI、ゴールデンフィクスチャ、回帰検証、最終スキルパッケージを担当します。 |

## [p0-results] P0 実証結果

| ゲート | 結果 | 移管された証拠 |
|---|---|---|
| P0a | 通過 | 環境 doctor、5秒 MP4、yuv420p、faststart、決定論的再レンダー記録 |
| P0b | 通過 | 3シーンのマウント、シーン単独レンダー、orphan レンダー成功の明示期待値、本文フレーム一致 |
| P0c | 通過 | edge-tts の単語出力、CJK フォントレンダー、OCR 陽性対照、20行ストレス実行 |
| P0d | 通過 | ナレーション編集、sourceHash 変化、選択的 re-TTS、全体再コンパイル、SSE 1回観測 |

正誤表の注記: P0c は単語同期字幕レンダーをまだ証明していません。現時点で証明済みなのは、words 生成、単調性、音声長の整合、静的な韓国語テキストレンダーです。

## [free-stack] 無料スタック

デフォルト経路はキー不要かつ無料です。韓国語 TTS は `edge-tts` を既定候補にし、文字起こし/整列は将来のゲートで `faster-whisper` に固定します。画像は codex-imagegen とキー不要のストックフォールバックを前提にし、BGM は検証済みの CC0 または CC-BY 出典だけを許可します。

禁止項目は `THIRD_PARTY_LICENSES.md` に固定されています。MusicGen、出典不明の BGM、再配布できない SFX、非商用ウェイトの TTS はデフォルトスタックから除外します。

## [roadmap] ロードマップ P1~P6

- P1: 5種類の契約スキーマ、検証器、ネガティブフィクスチャスイート。
- P2: 音声非依存コンパイラ、8種類のシーンブロック、トランジション、render-lint。
- P3: TTS、画像、バージョン、再開可能なパイプライン、実 TTS スモーク。
- P4: Studio adapter、フォーム生成器、編集影響クラス、同時編集処理。
- P5: 長尺動画メモリゲート、ゴールデン回帰、視覚判定ゲート。
- P6: スキルパッケージング、マルチフォーマット、deck-factory 連携、環境間ハッシュ。

## [installation] インストール

```bash
cd ~/reelforge
npm ci
npm run lint
npm run gate
node bin/vf gate list
```

レンダーゲートを実際に再実行する場合だけ、`node bin/vf gate p0b --execute` のように実行します。生成動画は `out/` 配下に置き、コミットしません。

## [disclaimer] ライセンスと免責

コードは Apache-2.0 です。メディア、フォント、BGM、SFX はそれぞれのライセンスに従い、生成物の利用責任はユーザーにあります。有料アダプターキーはすべて任意であり、デフォルト動作は認証情報を要求してはいけません。
