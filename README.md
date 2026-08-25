# TextareaVim

Chromium系ブラウザの複数行`textarea`を、ブラウザ内のCodeMirror 6でVim操作できるようにするManifest V3拡張です。
外部Neovim、Native Messaging、通信、OSクリップボード権限は使いません。

## 技術構成

- **WXT 0.21**：Viteベースの開発サーバー、Manifest生成、Chrome MV3ビルド、配布用ZIPを担当します。
- **TypeScript 7**：`strict`、`noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`を有効にしています。
- **CodeMirror 6**：入力欄の上へ重ねるエディターを提供します。
- **@replit/codemirror-vim**：Vimのモード、キーマップ、Exコマンドを処理します。
- **Vitestとjsdom**：対象判定、DOM同期、イベント遮断を単体テストします。
- **Playwright**：ビルド済み拡張をChromiumへ読み込み、実際の編集フローをE2Eテストします。
- **Biome**：TypeScript、JavaScript、JSONを一つの設定で検査、整形します。
- **GitHub Actions**：型検査、単体テスト、ビルド、バンドル検査、E2Eテストを継続的に実行します。

UIフレームワークは使っていません。
content scriptだけで完結する現在の規模では、Reactなどを読み込んでも利用者向けの機能は増えず、初期ロードと保守対象だけが増えるためです。

## 開発

Node.js 24以上とnpm 10以上が必要です。

```sh
npm ci
npm run dev
```

本番ビルドは`.output/chrome-mv3/`へ生成されます。

```sh
npm run build
```

Chromeの拡張機能管理画面でデベロッパーモードを有効にし、「パッケージ化されていない拡張機能を読み込む」から`.output/chrome-mv3/`を指定してください。

配布用ZIPは次のコマンドで生成できます。

```sh
npm run zip
```

## 検査

通常の変更では、静的検査から本番ビルドまでをまとめて実行します。

```sh
npm run check
```

`check`はBiome、TypeScript、Vitest、本番ビルド、生成Manifest、バンドル内の`eval`、`new Function`、外部URL参照、Chromeが拒否するUnicode非文字を検査します。

E2Eテストを初めて実行する前に、PlaywrightのChromiumを導入してください。

```sh
npm exec playwright install chromium
npm run test:e2e
```

E2Eテストは拡張をChromiumへ読み込み、`textarea`へフォーカスし、VimのINSERTモードで編集して、`Ctrl+Enter`で元要素へ同期するところまで確認します。

## 起動と終了

自動起動するのは、readonlyまたはdisabledではなく、見た目が複数行の`textarea`です。
`rows="1"`は対象外、`rows="2"`以上は対象になります。
`rows`が未指定または不正な場合は、line-height、font-size、上下padding、clientHeightから実寸を判定します。
`input`と`contenteditable`は対象外です。

対象へフォーカスすると、元要素の位置と寸法に合わせたCodeMirrorをShadow DOM内へ表示します。
元要素はレイアウトを保ったまま一時的に非表示になります。

CodeMirrorの初期モードはNORMALです。
`i`などでINSERTへ入り、`Esc`または設定したキー列でNORMALへ戻ります。
外側をクリックする、対象要素がDOMから外れる、`Ctrl+Enter`または`Cmd+Enter`を押すと、内容を同期して終了します。
ページ単位のONとOFFは`Alt+Shift+V`で切り替えます。

## 設定

拡張機能の詳細画面にある「拡張機能のオプション」から、INSERTモードを抜けるキー列を変更できます。
既定値は`jj`です。
空欄を保存すると追加マッピングを無効にできますが、通常の`Esc`は常に利用できます。
入力できるのは印字可能なASCII文字16文字以内です。
設定はブラウザの同期ストレージへ保存され、開いているエディターにも反映されます。

次のExコマンドも利用できます。

- `:w`：値を元要素へ同期し、編集を続けます。
- `:wq`：値を同期して終了します。
- `:q`：セッション開始時の値へ戻して終了します。

編集内容が変わると、ネイティブsetter経由で元要素へ書き戻し、bubblingかつcomposedな`input`イベントを発火します。
終了時には`change`イベントも一度発火します。
Reactなどのcontrolled inputで一般的な値変更経路を通すための実装です。

## 対応範囲

- Chromium系ブラウザを対象にしています。
- IMEのcompositionはCodeMirrorへ委ね、composition中のキーを文書側で奪いません。
- Vim互換エンジンの実装範囲はVim本体の全機能とは一致しません。
- ページ側がイベントを停止または独自に値を管理すると、同期結果が変わることがあります。
- `<all_urls>`でcontent scriptを実行しますが、通信や追加権限は要求しません。
