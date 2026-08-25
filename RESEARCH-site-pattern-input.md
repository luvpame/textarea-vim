# サイト指定入力の調査

確認日：2026-08-25

## 既存ノートの規約

リポジトリにはルートの `RESEARCH.md` があり、調査日、結論、本文、出典を一つの Markdown ファイルへまとめている。

今回も同じルートの命名規約に合わせ、このファイルへ記録する。

## 結論

ブラウザの拡張機能は、内部では厳密な match pattern を使いながら、利用者向けのサイト追加 UI では scheme とパスを省略できる入力を受け付け、保存時に `*://host/*` の形へ正規化している。

TextareaVim もこの二層構造を採用すると、`https://github.com` と `github.com` を受け入れつつ、上級者が `https://github.com/foo*` のような厳密なパターンを使える。

入力を保存する前に、変換後のパターンと対象範囲を表示する必要がある。

パスを含む入力は、ブラウザの site access と同じホスト単位へ潰さず、TextareaVim の URL ポリシーでは match pattern のパス意味を保持する。

## 公式仕様が定める match pattern

Chrome と Firefox の WebExtensions は、match pattern を `<scheme>://<host><path>` の三部分で定義している。[Chrome の仕様](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns) と [Mozilla の仕様](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Match_patterns) は、いずれも scheme、host、path の順序を要求する。

Chrome が受け付ける scheme は `http`、`https`、`file`、`*` であり、`*` は HTTP と HTTPS に対応する。[Chrome の match pattern 仕様](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns) は、scheme の wildcard をこの意味に限定している。

Firefox の一般仕様には `ws`、`wss`、`ftp`、`data`、`file`、拡張機能 scheme も記載されているが、ブラウザごとに対応状況が異なる。[Mozilla の scheme 表](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Match_patterns#scheme) は、この差を明記している。

host の `*` は任意の host を意味し、`*.example.com` のように先頭へ置いた wildcard は `example.com` 自身とそのすべての subdomain を含む。[Mozilla の host 表](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Match_patterns#host) と [Tampermonkey の `@match` 説明](https://www.tampermonkey.net/documentation.php?q=include) が同じ解釈を示している。

host の wildcard は先頭以外へ置けないため、`example.*` や `*ample.com` は match pattern として不正である。[Mozilla の不正パターン表](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Match_patterns#invalid_or_unmatched_patterns) は、これらを明示的に invalid としている。

path は `/` から始める必要があり、path 内の `*` は途中や末尾にも置ける。[Mozilla の path 仕様](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Match_patterns#path) は、host の wildcard よりも path の wildcard を柔軟に定義している。

path は URL の query string も含めて照合し、fragment は照合対象から除外される。[Mozilla の path 仕様](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Match_patterns#path) は、`?` を含む query string の扱いと、`#` を含む pattern が失敗することを説明している。

したがって、厳密な match pattern では次のようになる。

| 入力 | 仕様上の扱い | 意味 |
| --- | --- | --- |
| `https://github.com` | 不正。path がない | scheme が HTTPS、host が `github.com` であることだけでは足りない |
| `https://github.com/` | 正しい | ルート path だけ |
| `https://github.com/*` | 正しい | `github.com` の全 path と query |
| `https://github.com/foo` | 正しい | `/foo` という path だけ。query は別扱い |
| `https://github.com/foo*` | 正しい | `/foo` から始まる path と query |
| `https://*.github.com/*` | 正しい | `github.com` 自身とその subdomain の全 path |

`https://github.com` が invalid になることと、`https://github.com/foo` が valid になることは同じ仕様から生じる。[Mozilla の例と invalid パターン表](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Match_patterns#examples) は、path なしを invalid とし、path 付きの完全一致を例示している。

## Tampermonkey と Greasemonkey

Tampermonkey の `@match` は、protocol、domain、path の三部分を受け付け、protocol の `*` は HTTP と HTTPS、`*.tmnk.net` は base domain と subdomain、path の `*` は任意の path を意味する。[Tampermonkey の公式 `@match` 説明](https://www.tampermonkey.net/documentation.php?q=include) は、`@match *://*/*`、`@match https://*/*`、`@match https://*.tampermonkey.net/foo*` を例示している。

Tampermonkey は `<all_urls>` を `@match` でまだサポートせず、scheme に `http*://` も受け付けると説明している。[Tampermonkey の公式説明](https://www.tampermonkey.net/documentation.php?q=include) にある独自拡張であり、Chrome と Firefox の共通入力へそのまま持ち込むべきではない。

Tampermonkey の `@include` は `*` を URL の任意の位置へ置け、正規表現も受け付ける。[Tampermonkey の `@include` 説明](https://www.tampermonkey.net/documentation.php?q=include) は、glob、正規表現、scheme separator を含む場合の特別解釈を記載している。

Greasemonkey の公式 wiki は、`@match` を `@include` より安全な厳格 wildcard と説明し、Chrome の match pattern 仕様との互換性を目標にしている。[Greasemonkey の metadata block 説明](https://wiki.greasespot.net/Metadata_Block#@match) にこの位置付けがある。

Greasemonkey の `@include` は glob と正規表現を許し、include が一つもない場合は `@include *` として扱う。[Greasemonkey の include/exclude 規則](https://wiki.greasespot.net/Include_and_exclude_rules) は、include と exclude の優先関係、glob、正規表現、既定値を定義している。

TextareaVim で `@include` 型の正規表現を既定の入力へ混ぜると、利用者が URL と正規表現を区別しにくくなるため、match pattern の subset に限定する方針が安全である。

## Chrome の site access UI

Chrome の利用者向け UI は、拡張機能の site access を「拡張機能を選択したとき」「特定のサイト」「すべてのサイト」の三段階で切り替えられる。[Chrome ヘルプ](https://support.google.com/chrome/answer/2664769?hl=en#zippy=%2Clet-extensions-read-and-change-site-data) は、それぞれの動作を説明している。

拡張機能の詳細画面では「On specific sites」を選ぶと、許可サイトを追加または削除できる。[Chrome ヘルプのサイト追加手順](https://support.google.com/chrome/answer/2664769?hl=en#zippy=%2Cadd-or-remove-access-to-a-specific-site) は、許可サイトのリストと Add、Remove の操作を示している。

Chromium の現在の拡張機能 UI の文字列は、入力欄を `Site`、追加操作を `Add a site`、不正入力を `Not a valid web address` と呼ぶ。[Chromium の公式文字列定義](https://chromium.googlesource.com/chromium/src/+/main/chrome/app/extensions_strings.grdp) には、`Site`、`Add a site`、`Not a valid web address`、`includes subdomains` が定義されている。

Chromium の runtime host dialog は、入力の scheme を省略でき、`*.example.com` の subdomain 指定を受け付け、host の後ろは `/` または `/*` だけを許可する。[Chromium の dialog 実装](https://chromium.googlesource.com/chromium/src/+/a72439959b4afa840f953575315402f8272a41fe/chrome/browser/resources/extensions/runtime_hosts_dialog.ts) の `patternRegExp` がこの入力規則を実装している。

同じ実装は、scheme が省略された場合に `*://` を補い、path を常に `/*` へ置き換えて保存する。[Chromium の `getPatternFromSite`](https://chromium.googlesource.com/chromium/src/+/a72439959b4afa840f953575315402f8272a41fe/chrome/browser/resources/extensions/runtime_hosts_dialog.ts) は、`scheme = res[1] || '*://'` と `path = '/*'` を使っている。

この実装に従うと、site access UI の入力は次のように解釈される。

| 入力 | Chromium の site access dialog が保存する値 |
| --- | --- |
| `https://github.com` | `https://github.com/*` |
| `github.com` | `*://github.com/*` |
| `*.github.com` | `*://*.github.com/*` |
| `https://*.github.com` | `https://*.github.com/*` |
| `https://github.com/` | `https://github.com/*` |
| `https://github.com/foo` | dialog の入力規則では不正。path は `/` または `/*` だけ |

ここでの `github.com` は、厳密な match pattern ではなく、利用者向け site shorthand である。

Chrome の host permission は host 単位の権限であり、Chromium の内部仕様では explicit host の path component を無視する。[Chromium の Extension Permissions 文書](https://chromium.googlesource.com/chromium/src/+/HEAD/extensions/docs/permissions.md#explicit-hosts) は、explicit host の path が現在無視されると説明している。

そのため、Chrome の site access UI をそのまま path filter の設計へ移植すると、`https://github.com/foo` を入力しても host 全体へ広がる可能性がある。

Chromium は runtime host permissions で、拡張機能が要求した狭い pattern より広い `https://google.com/*` を利用者が付与できるようにしている。[Chromium の runtime host permissions 文書](https://chromium.googlesource.com/chromium/src/+/HEAD/extensions/docs/permissions.md#runtime-host-permissions) は、この方が利用者が正確な pattern を考えずに済み、後から同じ host の追加要求を自動的に許可できると説明している。

これは site access UI を host 単位で単純化する根拠になる一方、TextareaVim の URL ポリシーが持つ path 単位の制御を捨てる根拠にはならない。

## Firefox の利用者向け UI

Firefox は、拡張機能が現在のサイトで権限を必要とすると拡張機能ボタンへ通知 dot を表示し、利用者は拡張機能の gear menu から許可を選べる。[Firefox の拡張機能ボタン説明](https://support.mozilla.org/en-US/kb/extensions-button?redirectlocale=en-US&redirectslug=unified-extensions-redirect-2) は、MV3 の website permission notification と manage 操作を説明している。

Firefox の Add-ons Manager では、拡張機能の Permissions から optional permission を個別に on/off できる。[Firefox の optional permissions 説明](https://support.mozilla.org/en-US/kb/manage-optional-permissions-extensions) は、インストール後に権限を変更できることと、その導線を示している。

Firefox のインストール時の permission message は、すべてのサイト、named domain、specific site、複数サイトを自然言語で分類して表示する。[Firefox の permission message 説明](https://support.mozilla.org/en-US/kb/permission-request-messages-firefox-extensions) は、これらの表示区分と、各権限で可能になる操作を説明している。

Firefox の利用者向け UI は、match pattern の構文を直接入力させるより、権限範囲を自然言語で示して許可を切り替える設計である。

## 入力例から見える差

次の表は、厳密な match pattern、Chrome の site access shorthand、TextareaVim の提案を並べたものである。

| 利用者の入力 | 厳密な match pattern | Chrome の site access UI | TextareaVim の提案 |
| --- | --- | --- | --- |
| `https://github.com` | invalid。path がない | `https://github.com/*` | `https://github.com/*` として保存し、HTTPS、`github.com`、全 path と表示 |
| `github.com` | invalid。scheme と path がない | `*://github.com/*` | `*://github.com/*` として保存し、HTTP と HTTPS、`github.com`、全 path と表示 |
| `https://github.com/foo` | valid。`/foo` の完全一致 | site access dialog では invalid。host permission は path を無視する | `https://github.com/foo` をそのまま保存し、「`/foo` のみ」と表示 |
| `https://github.com/foo*` | valid。`/foo` 接頭辞 | site access dialog では invalid | 高度な match pattern として保存し、「`/foo` から始まる path」と表示 |
| `*.github.com` | scheme と path がないため invalid | `*://*.github.com/*` | `*://*.github.com/*` として保存し、「base domain と subdomain」と表示 |
| `https://*.github.com/*` | valid | valid | そのまま保存 |

`https://github.com/foo` の提案を完全一致とするのは、raw match pattern の意味を保ち、入力より広い範囲へ黙って拡張しないためである。

`/foo` 以下を指定したい利用者は `https://github.com/foo*` または `https://github.com/foo/*` を明示する。

前者は `/foobar` も含むため、ディレクトリ単位を意図する場合は後者を選ぶという説明が必要である。[Mozilla の path wildcard の例](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Match_patterns#examples) は、path の wildcard が文字列として照合されることを示している。

## TextareaVim へ採用する最小設計

### 入力と保存を二層に分ける

入力欄は「サイトまたは URL パターン」と表示し、通常のサイト shorthand と advanced match pattern の両方を受け付ける。

保存値は常に canonical な match pattern とし、scheme、host、path を省略したまま保存しない。

入力中の文字列はそのまま保持し、保存前に変換後の値を横または下へプレビューする。

この構成なら、初心者は `github.com` と入力でき、上級者は `*://*.example.com/*` をそのまま使える。

### 正規化の規則

1. 前後の空白を取り除く。
2. `<all_urls>` は既存の高度なパターンとして保持する。
3. `http://`、`https://`、`*://`、`file://` で始まる入力は、まず厳密な match pattern として検証する。
4. scheme と host はあるが path がない入力は、path に `/*` を補う。
5. scheme がない host shorthand は、scheme に `*://`、path に `/*` を補う。
6. `*.` は入力された位置を保ち、base domain と subdomain を含むパターンへ変換する。
7. path が存在する入力は、`/*` を自動追加せず、厳密な path として保持する。
8. `#` を含む入力、host 内部の wildcard、未知の scheme、空 host はエラーにする。

Chrome の site access dialog は scheme と path を自動補完するため、4、5、6 の正規化は既存 UI と対応する。[Chromium の dialog 実装](https://chromium.googlesource.com/chromium/src/+/a72439959b4afa840f953575315402f8272a41fe/chrome/browser/resources/extensions/runtime_hosts_dialog.ts) がその補完を行っている。

7 は Chrome の host permission と異なる。

TextareaVim は content script の起動範囲を自分の URL ポリシーで絞るため、path を無視すると利用者が設定した allowlist の意味が変わる。

### 表示と説明

入力欄の例には、次の三つを常に含める。

```text
github.com             → http/https の github.com 全体
https://github.com     → HTTPS の github.com 全体
https://*.github.com/* → github.com と subdomain の全 path
```

入力行ごとに、保存値と対象範囲を表示する。

`https://github.com` を `https://github.com/*` へ変換した場合は、「末尾の `/*` を補いました」と表示する。

`github.com` を `*://github.com/*` へ変換した場合は、「HTTP と HTTPS を対象にします」と表示する。

`*.github.com` を入力した場合は、「base domain と subdomain を対象にします」と表示する。

Chrome の UI も `includes subdomains` という説明を表示しており、wildcard の意味を構文だけへ委ねていない。[Chromium の文字列定義](https://chromium.googlesource.com/chromium/src/+/main/chrome/app/extensions_strings.grdp) がこの文言を定義している。

### エラー回復

入力中は空行をエラーにせず、未入力として保存対象から外す。

不正行は行番号、入力内容、直し方をまとめて表示し、valid な他の行と入力テキストを保持する。

保存ボタンは不正行がある間だけ無効にし、利用者が入力を修正して再検証できるようにする。

Chromium の dialog も空入力では赤い invalid 表示を出さずに送信ボタンを無効化し、構文エラーや API の拒否時だけ invalid 状態を設定する。[Chromium の dialog 実装](https://chromium.googlesource.com/chromium/src/+/a72439959b4afa840f953575315402f8272a41fe/chrome/browser/resources/extensions/runtime_hosts_dialog.ts) の `validate_`、`computeSubmitButtonDisabled_`、`addPermission_` がこの流れを実装している。

エラー文は `Invalid match pattern` だけにせず、入力者が次に取る操作を示す。

```text
path がありません。サイト全体なら末尾に /* を付けるか、そのまま保存して自動補完してください。
host の wildcard は先頭の * または *.domain の形だけ使えます。
fragment (#...) は指定できません。fragment を削除してください。
```

### 既存設定との互換性

既存の canonical match pattern はそのまま読み込み、shorthand を保存時に canonical pattern へ変換する。

canonical pattern 同士の重複だけでなく、`https://github.com/*` が `https://github.com/foo` を包含するような包含関係も検出できるが、最小実装では重複除去だけに留める。

Chrome の permission warning も、広い host pattern が狭い pattern を包含する場合は重複表示を抑制している。[Chromium の permission collapsing](https://chromium.googlesource.com/chromium/src/+/HEAD/extensions/docs/permissions.md#permission-collapsing) はこの考え方を示している。

## 採用しない設計

`@include` の正規表現を既定の入力として受け付けない。

`http*://` のような Tampermonkey 固有構文を Chrome と Firefox の共通構文として宣伝しない。

`https://github.com/foo` を自動で `https://github.com/*` へ広げない。

入力の意味が変わる正規化を行う場合は、変換後の pattern と scope を表示して利用者に確認させる。

## 参照した公式資料

- [Chrome for Developers: Match patterns](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns)
- [Mozilla MDN: Match patterns](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Match_patterns)
- [Chrome Help: Install and manage extensions](https://support.google.com/chrome/answer/2664769?hl=en)
- [Chrome for Developers: Declare permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions)
- [Chromium source: runtime_hosts_dialog.ts](https://chromium.googlesource.com/chromium/src/+/a72439959b4afa840f953575315402f8272a41fe/chrome/browser/resources/extensions/runtime_hosts_dialog.ts)
- [Chromium source: extensions_strings.grdp](https://chromium.googlesource.com/chromium/src/+/main/chrome/app/extensions_strings.grdp)
- [Chromium docs: Extension Permissions](https://chromium.googlesource.com/chromium/src/+/HEAD/extensions/docs/permissions.md)
- [Firefox Help: Manage optional permissions for Firefox extensions](https://support.mozilla.org/en-US/kb/manage-optional-permissions-extensions)
- [Firefox Help: Manage extensions using the extensions button](https://support.mozilla.org/en-US/kb/extensions-button?redirectlocale=en-US&redirectslug=unified-extensions-redirect-2)
- [Firefox Help: About permission request messages](https://support.mozilla.org/en-US/kb/permission-request-messages-firefox-extensions)
- [Tampermonkey Documentation: `@match` and `@include`](https://www.tampermonkey.net/documentation.php?q=include)
- [Greasemonkey Wiki: Metadata Block](https://wiki.greasespot.net/Metadata_Block)
- [Greasemonkey Wiki: Include and exclude rules](https://wiki.greasespot.net/Include_and_exclude_rules)
