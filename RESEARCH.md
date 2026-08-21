# ブラウザ内Vimエンジンの比較

確認日：2026-08-21

## 結論

この拡張には、CodeMirror 6と`@replit/codemirror-vim`を組み合わせ、入力欄の上へ一時的なエディタを重ねる構成が合う。
Vim本体をWebAssemblyで動かす方法もあるが、任意のWebページで文章を編集する用途には実装負担が大きい。

## CodeMirror Vim

`@replit/codemirror-vim`はCodeMirror 6用のVimキーバインド実装である。
リポジトリには、CodeMirror 6向けパッケージ、CodeMirror 5向けパッケージ、両者が共有するエディタ非依存のVimエンジンとテスト群が含まれる。
モード、Visual選択、Exコマンド、キーマッピングを扱える。

2026-08-21時点でnpmの最新版は6.4.0で、調査時点の21日前に公開されていた。
今回比較した候補では、保守状況と組み込みやすさの釣り合いが最もよい。

- [replit/codemirror-vim](https://github.com/replit/codemirror-vim)
- [@replit/codemirror-vim on npm](https://www.npmjs.com/package/@replit/codemirror-vim)

## Monaco Vim

`monaco-vim`はMonaco EditorとCodeMirror由来のVim実装をつなぐアダプターである。
npmの最新版は0.4.4で、調査時点の9か月前に公開されていた。
公式READMEも、追加入力を伴うExコマンドや検索、置換では不具合が残る可能性を明記している。

Monaco Editor自体がコード編集向けの大きなエディタなので、短いフォーム入力へ重ねる用途には重い。
コード補完や言語機能まで必要なら候補になるが、今回の文章入力にはCodeMirrorのほうが扱いやすい。

- [brijeshb42/monaco-vim](https://github.com/brijeshb42/monaco-vim)
- [monaco-vim on npm](https://www.npmjs.com/package/monaco-vim)

## vim.wasm

`vim.wasm`はVimのCソースをEmscriptenでWebAssemblyへコンパイルした実際のVimである。
Web Worker上でVimを実行し、SharedArrayBufferでキー入力を渡し、Canvasへ画面を描画する。
Vim script、text object、レジスタなど、Vim本体の機能を広く利用できる。

ただし、移植されているVimは8.2.0055で、リポジトリ自身が実験的で不具合がある段階だと説明している。
ブラウザ拡張へ組み込む場合は、Wasmとランタイムの同梱、Canvas UI、IME、フォーカス、クリップボード、仮想ファイル、ページとの値同期まで管理する必要がある。

- [rhysd/vim.wasm](https://github.com/rhysd/vim.wasm)

## NeovimのWebAssembly版

NeovimにはWebAssemblyへクロスコンパイルする実験的な手順がある。
しかし、公式の追跡課題は2026-08-21時点でも未完了で、ブラウザ向けCI成果物と正式なWeb UIは用意されていない。
追跡課題は`status:blocked-external`で、3項目中1項目の完了にとどまる。

したがって、現在の拡張へ組み込める安定した公式Neovimランタイムはまだない。

- [Neovim BUILD.mdのWebAssembly手順](https://github.com/neovim/neovim/blob/master/BUILD.md)
- [NeovimのWASM追跡課題 #35567](https://github.com/neovim/neovim/issues/35567)

## 入力欄への組み込み方

CodeMirror、Monaco、vim.wasmは、それぞれ独自のテキストモデルと表示層を持つ。
既存の`textarea`へキーハンドラーだけを装着するAPIではない。

そのため、ブラウザ拡張では次の流れにする。

1. 対象の入力欄から文字列、位置、寸法を読む。
2. 入力欄の上にCodeMirrorを重ねる。
3. `@replit/codemirror-vim`へキー処理と編集履歴を任せる。
4. `:w`、フォーカス移動、専用ショートカットのいずれかで内容を元の入力欄へ戻す。
5. `input`イベントを発火し、Reactなどのフォーム状態へ変更を伝える。

この構成なら、現在の独自Vim状態機械を削除しながら、外部プロセスを起動せずに済む。
