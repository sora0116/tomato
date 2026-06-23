Linuxデスクトップ向けのポモドーロタイマーを実装してください。

## 技術要件

- Tauri v2
- Frontend: Svelte + TypeScript
- Backend: Rust
- Linuxを主対象とする
- Wayland/X11双方で最低限動作すること
- UIは軽量にする
- Electronは使用しない
- タスク管理、作業ログ、クラウド同期、アカウント機能は実装しない

## 機能要件

### UI

- メインウィンドウとシステム・トレイ常駐の両方を実装する
- メインウィンドウには以下を表示する
  - 現在のモード: Focus / Short Break / Long Break
  - 残り時間 `MM:SS`
  - 現在選択中のプリセット名
  - Start / Pause / Resume / Skip / Reset 操作
  - ブラウンノイズの有効/無効
  - ブラウンノイズ音量
- ウィンドウを閉じた場合は終了せず、トレイへ隠す
- 明示的な Quit 操作でのみアプリを終了する

### トレイ

トレイメニューには以下を置く。

- 状態表示: `Focus 18:42`、`Break 04:12`、`Paused`、`Idle`
- Start
- Pause または Resume
- Skip
- Reset
- Show / Hide
- Quit

トレイの状態表示は少なくとも1秒ごとに更新する。

### ポモドーロ仕様

- Focus、Short Break、Long Breakを持つ
- Focus完了後は自動的に休憩を開始する
- Short Break完了後は自動的にFocusを開始する
- Long Break完了後は自動的にFocusを開始する
- `long_break_interval` 回のFocus完了ごとにLong Breakへ遷移する
- Skipは現在のセッションを終了し、次のモードへ遷移する
- ResetはIdle状態に戻し、残り時間を現在モードの初期値へ戻す
- Pause中は残り時間を固定する
- Resume時はPause時の残り時間から再開する
- タスク入力、作業ログ、完了履歴は実装しない

### タイマー実装要件

- `setInterval` による単純な秒数デクリメントを真の時刻源にしない
- セッション開始時に終了時刻を保存し、残り時間は現在時刻との差分から計算する
- UI表示は1秒ごとに更新してよい
- システム負荷、バックグラウンド化、スリープ復帰後でも可能な限り正しい残り時間を表示する
- Pause時には残り秒数を保存し、Resume時に終了時刻を再計算する
- タイマー状態は以下を基本形とする

```ts
type TimerMode = "focus" | "short_break" | "long_break"
type TimerStatus = "idle" | "running" | "paused"

type TimerState = {
  mode: TimerMode
  status: TimerStatus
  presetName: string
  completedFocusCount: number
  endsAtMs: number | null
  pausedRemainingMs: number | null
}
````

### ブラウンノイズ

* ブラウンノイズはFocus実行中のみ再生する
* Pause、Short Break、Long Break、Idle、Reset、Skip、アプリ終了時には即停止する
* 停止時のフェードアウトは不要
* Focus開始時のみフェードインする
* ブラウンノイズは音声ファイルではなくWeb Audio APIで生成する
* `AudioBufferSourceNode` と `GainNode` を使う
* ループ再生する
* 音量を設定画面またはメイン画面から変更可能にする
* 音量は `0.0` から `1.0` の範囲で保存する
* デフォルト音量は `0.18`
* フェードイン時間は設定可能にし、デフォルトは500ms
* AudioContextの自動再生制限を考慮し、最初のStart操作などユーザー操作のタイミングで初期化またはresumeする
* ブラウンノイズ生成はfrontend側に閉じる
* Rust側で音声再生ライブラリを導入しない

### 通知

* Focus終了時、Short Break終了時、Long Break終了時にデスクトップ通知を出す
* 通知時に通知音を鳴らす
* 通知内容の例:

  * Focus終了: `Focus complete. Starting short break.`
  * Long Break開始: `Focus cycle complete. Starting long break.`
  * Break終了: `Break complete. Starting focus session.`
* 通知はTauri v2対応の通知プラグインを使用する
* Linuxの通知デーモン差異を考慮し、通知失敗時にアプリ全体が停止しないようにする
* 独自の通知音ファイルは同梱しない。可能な範囲でOS/通知機構の標準音を使う

### 設定

設定ファイルは以下に保存する。

```text
$XDG_CONFIG_HOME/pomodoro-timer/config.toml
```

`XDG_CONFIG_HOME` が未設定の場合は以下を使用する。

```text
~/.config/pomodoro-timer/config.toml
```

設定例:

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

要件:

* 初回起動時にデフォルト設定を生成する
* プリセットの追加、編集、削除、選択をUIから行えるようにする
* `active_preset` を変更できるようにする
* 設定変更は即時に `config.toml` に保存する
* 実行中セッションに対するプリセット変更の適用仕様を明確にする

  * 推奨: 実行中セッションには適用せず、次のセッションから適用する
* TOMLの読み書きはRust側で行う
* 設定の破損・パース失敗時はアプリがクラッシュしないこと

  * 破損設定はバックアップし、デフォルト設定で起動する
  * ユーザーに設定が初期化されたことを表示する

### 起動

* OSログイン時の自動起動は実装しない
* 通常のアプリ起動のみを対象とする
* アプリ再起動後に実行中タイマーを復元する必要はない
* 起動時はIdle状態とする

## 実装方針

* Tauri v2を使う
* Svelte + TypeScriptを使う
* Rust側は以下を担当する

  * config.tomlの読み書き
  * XDG設定ディレクトリ解決
  * トレイ生成と更新
  * ウィンドウの表示/非表示
  * デスクトップ通知
  * アプリ終了処理
* frontend側は以下を担当する

  * タイマー状態管理
  * UI
  * ブラウンノイズ生成・再生
  * 残り時間表示
* frontendとRust側の通信はTauri command/eventを使う
* 状態の二重管理を避ける。タイマー状態の正本はfrontend側とする
* Rust側トレイ表示更新に必要な状態だけfrontendからイベントで送る
* 依存パッケージは必要最小限にする

## ファイル構成の目安

```text
src/
  App.svelte
  lib/
    timer.ts
    timerStore.ts
    audio/
      brownNoise.ts
    config.ts
    notifications.ts
    tray.ts
  components/
    TimerDisplay.svelte
    TimerControls.svelte
    PresetSelector.svelte
    AudioControls.svelte
    SettingsDialog.svelte

src-tauri/
  src/
    main.rs
    config.rs
    tray.rs
    notification.rs
    commands.rs
```

## 品質要件

* TypeScriptはstrict modeを有効にする
* Rustは`clippy`で重大な警告が出ない状態にする
* timer状態遷移はユニットテストを書く
* config.tomlの読み書きと破損設定復旧のテストを書く
* ブラウンノイズの開始・停止が重複して複数再生されないことを保証する
* Start/Pause/Resume/Skip/Resetの連続操作で状態が壊れないことを確認する
* Linux上でのビルド手順と実行手順をREADMEに書く
* `cargo tauri dev` と `cargo tauri build` で動作確認できる状態にする

## 実装前に行うこと

1. Tauri v2、Svelte、通知プラグイン、トレイAPIの現行仕様を公式ドキュメントで確認する
2. 使用する依存関係とバージョンを列挙する
3. 状態遷移表を作る
4. config.tomlのスキーマを定義する
5. 実装計画を提示する
6. その後に実装する

古いTauri v1 API、非推奨API、古いSvelte記法を使わないこと。

```
