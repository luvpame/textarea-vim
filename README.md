# TextareaVim

Chromium系ブラウザの複数行textareaを、外部Neovimを起動せずにVim操作で編集するManifest V3拡張です。
textareaの上にCodeMirror 6をShadow DOM内で重ね、Vim互換エンジン`@replit/codemirror-vim`へキー処理を委譲します。
ページとの通信、Native Messaging、OSクリップボード権限は使いません。

## ビルド

Node.jsとnpmが必要です。

```sh
npm install
npm run build
```

検査をまとめて実行する場合は次のコマンドを使います。

```sh
npm run check
```

`build`は`src/content.js`とDOM操作用の`src/target.js`をesbuildで単一ファイルへ束ね、`extension/content.js`を生成します。
依存は`package-lock.json`に固定しています。

## 拡張機能の読み込み

1. `chrome://extensions`（またはChromium系ブラウザの拡張機能管理画面）を開きます。
2. デベロッパーモードを有効にします。
3. 「パッケージ化されていない拡張機能を読み込む」を選び、このプロジェクトの`extension/`ディレクトリを指定します。
4. コードを変更したときは`npm run build`後、拡張機能管理画面の再読み込みボタンを押します。

## 起動と終了

自動起動対象は、readonly・disabledではない`textarea`のうち、見た目が複数行のものだけです。
`rows="1"`は対象外、`rows="2"`以上は対象です。`rows`が未指定または不正な場合は、line-height・font-size・上下padding・clientHeightから実寸を判定します。
`input`と`contenteditable`は対象外です。Google検索欄のような単行表示の`textarea`も対象外になります。
対象へフォーカスすると、元要素の位置と寸法に固定配置したCodeMirrorエディターを表示します。
元要素はレイアウトを保ったまま一時的に`visibility:hidden`になります。

CodeMirrorの初期モードはVimと同じNORMALです。
`i`などでINSERTへ入り、`Esc`でNORMALへ戻します。
INSERT中に`jj`を入力してもNORMALへ戻れます。
外側をクリックする、対象要素がDOMから切断される、`Ctrl+Enter`／`Cmd+Enter`を押すと内容を同期して終了します。
ページ単位のON/OFFは`Alt+Shift+V`です。
エディター起動中は、ページ側のキーボードショートカットへキーボードイベントを渡しません。

VimのExコマンドも入力できます。

- `:w`：値を元要素へ同期して編集を継続
- `:wq`：同期して終了
- `:q`：セッション開始時の値へ戻して終了

終了時には元要素へ`change`イベントを一度発火します。
編集途中のCodeMirror更新では、値が変わったときにネイティブsetter経由で元要素へ書き戻し、bubbling/composedな`input`イベントを発火します。
Reactなどのcontrolled inputで一般的な値変更経路を通すための実装です。

## 対応範囲と制約

- readonly・disabledのtextareaは対象外です。
- 対象textareaではCodeMirrorの行折り返しを使います。
- IMEのcompositionはCodeMirrorへ委ね、composition中のキーを文書側で奪いません。
- `rows`未指定・不正値でDOM計測できない場合は、`textarea.rows`（既定値2）へフォールバックします。
- ブラウザやページがイベントを停止する場合、ページ側の実装により同期結果が変わることがあります。
- Vim互換エンジンの実装範囲は本物のVim全機能ではありません。

## テスト

DOMから分離したtextarea判定、rows属性、複数行の実寸判定をNode標準テストで検証します。

```sh
npm test
npm run check
```

`check`ではバンドル、テスト、生成JavaScriptの構文、Manifest JSONを検査します。
生成物に`eval`・`new Function`や`http(s)`のリモート参照が含まれないことも確認できます。
