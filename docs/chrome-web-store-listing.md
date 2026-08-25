# Chrome Web Store 掲載情報

TextareaVim 1.0.0をChrome Web Storeへ初めて提出するときの入力内容です。

## ストアの掲載情報

**名前**

TextareaVim

**概要**

ブラウザの複数行入力欄を、CodeMirror上のVim操作で編集できます。

**詳細な説明**

TextareaVimは、Webページの複数行入力欄をVimのキーバインドで編集できるChrome拡張機能です。
対象の入力欄へフォーカスすると、同じ位置にCodeMirrorエディターが開きます。

主な機能：

- NORMALモードとINSERTモードを使ったVim操作
- `jj`または`Esc`によるNORMALモードへの復帰
- `:w`、`:wq`、`:q`のExコマンド
- `Ctrl+Enter`または`Cmd+Enter`による保存と終了
- 拡張機能全体の有効または無効の切り替え
- ブラックリストまたはホワイトリストによるURLごとの適用設定
- SPAでURLが変わった場合の設定追従

編集はブラウザ内で完結します。
TextareaVimは入力内容を保存または外部送信せず、外部Neovim、Native Messaging、分析サービス、広告サービスも使いません。

現在は複数行の`textarea`に対応しています。
一行入力欄と`contenteditable`は対象外です。

**カテゴリ**

仕事効率化

**言語**

日本語

**ホームページURL**

https://github.com/luvpame/textarea-vim

**サポートURL**

https://github.com/luvpame/textarea-vim/issues

## プライバシー

**単一用途**

Webページの複数行入力欄を、ブラウザ内のVimキーバインドで編集できるようにします。

**`storage`権限を使う理由**

拡張機能を有効にするかどうかと、URLごとの適用設定をChromeの同期ストレージへ保存するために使います。

**ホスト権限を使う理由**

利用者が開いたWebページの`textarea`を検出し、フォーカスされた入力欄にVim編集機能を提供するために使います。
ページの内容や入力内容を外部へ送信する処理はありません。

**リモートコード**

使用しません。
拡張機能が実行するJavaScriptは、すべて提出するZIPファイルに含まれています。

**データの取り扱い**

拡張機能は、編集対象の`textarea`の内容を機能提供のためにブラウザ内で一時的に扱いますが、収集、保存、外部送信はしません。
同期ストレージには、有効または無効の設定とURLパターンだけを保存します。
広告、分析、追跡、第三者提供には使いません。

データ種別では、実際の機能に合わせて「ウェブサイトのコンテンツ」と「ウェブ履歴」を申告します。
前者は`textarea`の内容を編集するため、後者は現在のURLと利用者が保存したURLパターンを照合するためにブラウザ内で使います。
どちらも開発者のサーバーへ送信しません。

Limited Useに関する認証項目は、すべて実装と一致することを確認して選択します。

**プライバシーポリシーURL**

https://github.com/luvpame/textarea-vim/blob/main/PRIVACY.md

## 審査担当者向けのテスト手順

1. 任意のWebページで、複数行の`textarea`へフォーカスします。
2. 入力欄と同じ位置にTextareaVimのエディターが表示されることを確認します。
3. `i`を押してINSERTモードへ入り、文字を入力します。
4. `Esc`または`jj`を押してNORMALモードへ戻ります。
5. `:wq`または`Ctrl+Enter`を押し、編集結果が元の入力欄へ反映されることを確認します。
6. ツールバーの拡張機能アイコンを押し、全体の有効設定とURL設定を変更できることを確認します。

ログイン情報や外部サービスは必要ありません。

## 配布

**公開範囲**

一般公開

**地域**

すべての地域

**価格**

無料

## 提出ファイル

- 拡張機能ZIP：`.output/textarea-vim-1.0.0-chrome.zip`
- ストアアイコン：`public/icons/128.png`
- スクリーンショット：`store-assets/screenshot-editor.png`
- スクリーンショット：`store-assets/screenshot-settings.png`
- 小型プロモーション画像：`store-assets/promo-small.png`
