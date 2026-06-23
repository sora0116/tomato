# Pomodoro Timer

Linux デスクトップ向けの軽量ポモドーロタイマーです。Tauri v2 + Svelte 5 + TypeScript + Rust で構成し、メインウィンドウとシステムトレイ常駐の両方を実装しています。

## 実装概要

- メインウィンドウ:
  - Focus / Short Break / Long Break 表示
  - 残り時間 `MM:SS`
  - Start / Pause / Resume / Skip / Reset
  - ブラウンノイズ有効化と音量調整
  - プリセット選択
  - プリセット編集ダイアログ
- システムトレイ:
  - `Focus 18:42` / `Break 04:12` / `Paused` / `Idle`
  - Start / Pause or Resume / Skip / Reset / Show or Hide / Quit
- タイマー:
  - `endsAtMs` と現在時刻の差分で残り時間を計算
  - Focus 完了で自動休憩
  - Short Break / Long Break 完了で自動 Focus
  - `long_break_interval` ごとの Long Break
  - Pause 時は残り時間固定、Resume 時は再計算
- ブラウンノイズ:
  - Focus 実行中のみ再生
  - Web Audio API の `AudioBufferSourceNode` + `GainNode`
  - フェードインあり、停止時フェードアウトなし
  - 多重再生防止
- 設定:
  - Rust 側で `config.toml` を読み書き
  - 破損時はバックアップ退避後にデフォルト再生成
  - 実行中にプリセットを変更しても現在セッションには適用せず、次セッションから反映
- 通知:
  - Tauri v2 notification plugin を使用
  - 失敗してもアプリ全体は継続

## 依存バージョン

フロントエンド:

- `svelte` `^5.55.5`
- `vite` `^8.0.12`
- `typescript` `~6.0.2`
- `@sveltejs/vite-plugin-svelte` `^7.1.2`
- `@tauri-apps/api` `^2`
- `@tauri-apps/plugin-notification` `^2`
- `@tauri-apps/cli` `^2`
- `vitest` `^3.2.4`

Rust:

- `tauri` `2.11.2`
- `tauri-build` `2.6.2`
- `tauri-plugin-notification` `2`
- `toml` `0.8`
- `serde` `1`
- `anyhow` `1`
- `tempfile` `3` for tests

Nix 開発シェル:

- `cargo`, `rustc`, `clippy`, `rustfmt`
- `cargo-tauri`
- `nodejs`
- `pkg-config`
- `webkitgtk_4_1`, `gtk3`, `glib`, `openssl`
- `libayatana-appindicator`, `librsvg`, `xdotool`

## 設定ファイル

保存先:

- `$XDG_CONFIG_HOME/pomodoro-timer/config.toml`
- `XDG_CONFIG_HOME` 未設定時は `~/.config/pomodoro-timer/config.toml`

例:

```toml
active_preset = "default"

[presets.default]
focus_minutes = 25
short_break_minutes = 5
long_break_minutes = 15
long_break_interval = 4

[presets.deep_work]
focus_minutes = 50
short_break_minutes = 10
long_break_minutes = 30
long_break_interval = 3

[audio]
brown_noise_enabled = true
volume = 0.18
fade_in_ms = 500

[notification]
desktop_notification = true
sound_enabled = true
```

## 状態遷移

基本状態:

- `idle`
- `running`
- `paused`

遷移:

| 現在状態 | 操作/イベント | 次状態 |
| --- | --- | --- |
| Idle | Start | 現在モードを `running` |
| Running | Pause | 同一モードの `paused` |
| Paused | Resume | 同一モードの `running` |
| Running / Paused | Skip | 次モードの `running` |
| Running / Paused | Reset | 現在モードの `idle` |
| Focus Running | 自然終了 | Short Break または Long Break の `running` |
| Break Running | 自然終了 | Focus の `running` |

補足:

- Focus を `Skip` した場合、完了回数は加算しません
- `Reset` はサイクル数を 0 に戻します
- プリセット変更は現在の `running` / `paused` セッションには適用しません

## 開発手順

### Nix シェル

```bash
nix develop
```

### NixOS / Flake 利用

`flake.nix` に実行可能パッケージを追加しています。

```bash
nix build .#default
nix run .#default
```

NixOS の `environment.systemPackages` には次のように入れられます。

```nix
{
  environment.systemPackages = [
    inputs.pomodoro-timer.packages.${pkgs.system}.default
  ];
}
```

`libayatana-appindicator` のようなトレイ用ライブラリはラッパーで `LD_LIBRARY_PATH` に追加しています。

### 開発起動

```bash
nix develop --command cargo tauri dev
```

GUI を伴うため、実際の Linux デスクトップセッション上で実行してください。

### 本番ビルド

```bash
nix develop --command cargo tauri build
```

### フロントエンドのみ

```bash
nix develop --command npm run dev
```

## 検証コマンド

実行済み:

```bash
nix develop --command npm run check
nix develop --command npm test
nix develop --command cargo check --manifest-path src-tauri/Cargo.toml
nix develop --command cargo test --manifest-path src-tauri/Cargo.toml
nix develop --command cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
nix develop --command npm run build
nix develop --command cargo tauri build --debug --config src-tauri/tauri.conf.json
```

ビルド成果物確認:

- デバッグ実行ファイル: `src-tauri/target/debug/pomodoro-timer`
- Debian パッケージ: `src-tauri/target/debug/bundle/deb/Pomodoro Timer_0.1.0_amd64.deb`

## 既知の注意点

- Linux の通知音は通知デーモン実装依存です。アプリ側では通知失敗を握り潰し、クラッシュしないようにしています
- Web Audio の自動再生制限により、最初のブラウンノイズ開始はメインウィンドウ上のユーザー操作後が最も確実です
- トレイの左クリックイベントは Tauri 公式ドキュメント上でも Linux では制約があります。メニュー操作は利用できます
- Nix 環境では AppImage バンドルが linker 環境と衝突しやすく、RPM もビルド時間が長いため、現状の `cargo tauri build` は `deb` のみを生成対象にしています
- 生の `src-tauri/target/debug/pomodoro-timer` を直接実行する場合、システム側に `libayatana-appindicator` が無いとトレイは無効化されます。`.deb` での利用を推奨します
