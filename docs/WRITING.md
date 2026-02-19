# 記事の書き方・記法一覧

このドキュメントでは、記事Markdownファイルで使用できる記法を説明します。

---

## フロントマター

記事ファイルの先頭に必ず記述します。

```markdown
---
title: "記事タイトル"
date: 2026-02-18
slug: my-article
draft: false
tags: ["TypeScript", "Web"]
description: "記事の概要 (150-200文字推奨)"
---
```

| フィールド    | 必須 | 説明                                     |
|-------------|------|------------------------------------------|
| `title`     | ✅   | 記事タイトル                              |
| `date`      | ✅   | 公開日 (YYYY-MM-DD)                      |
| `slug`      | ✅   | URL用の識別子 (例: `/posts/my-article`)   |
| `draft`     | ✅   | `true` = 下書き / `false` = 公開         |
| `tags`      | -    | タグキーの配列 (`src/content/tags.json` 参照) |
| `description` | -  | メタ概要 (SEO用)                         |

---

## 見出し

```markdown
# H1 見出し
## H2 見出し
### H3 見出し
#### H4 見出し
```

> 記事タイトルは `title` フロントマターで設定するため、本文内の `#` は H2 (`##`) から始めることを推奨します。

---

## テキスト装飾

```markdown
**太字**
*イタリック*
~~取り消し線~~
```

---

## リンク

```markdown
[リンクテキスト](https://example.com)
```

---

## インラインコード

バッククォートで囲みます。

```markdown
`Set` や `Map` のような書き方ができます。
```

---

## コードブロック

言語名を指定するとシンタックスハイライトが適用されます。

````markdown
```typescript
const greet = (name: string): string => {
    return `Hello, ${name}!`;
};
```
````

よく使う言語指定: `typescript`, `javascript`, `python`, `bash`, `json`, `yaml`, `markdown`, `cpp`

---

## 数式 (KaTeX)

### インライン数式

`$...$` で囲みます。

```markdown
質量とエネルギーの関係式は $E = mc^2$ です。

計算量は $O(\log N)$ です。
```

### ブロック数式

`$$...$$` で囲みます。

```markdown
$$
x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}
$$
```

```markdown
$$
\sum_{i=1}^{n} i = \frac{n(n+1)}{2}
$$
```

KaTeX でサポートされている記法は [KaTeX サポート一覧](https://katex.org/docs/support_table) を参照してください。

---

## 画像

```markdown
![代替テキスト](./images/image.png)
```

`public/images/` に配置した画像はコミット時に自動で Cloudflare R2 にアップロードされます (`npm run prepare`)。

---

## リスト

### 箇条書き

```markdown
- 項目1
- 項目2
  - 入れ子項目
```

### 番号付きリスト

```markdown
1. 手順1
2. 手順2
3. 手順3
```

---

## 引用

```markdown
> これは引用文です。
> 複数行にわたる場合も同様です。
```

---

## 水平線

```markdown
---
```

---

## テーブル

```markdown
| 列1     | 列2     | 列3     |
|---------|---------|---------|
| セル1   | セル2   | セル3   |
| セル4   | セル5   | セル6   |
```

アライメント指定:

```markdown
| 左寄せ  | 中央揃え | 右寄せ  |
|:--------|:--------:|--------:|
| テキスト | テキスト | テキスト |
```

---

## 続きを読む (excerpt 区切り)

トップページの記事一覧で表示する excerpt の範囲を制御できます。

```markdown
ここがトップページに表示される導入文です。

<!-- more -->

ここ以降は記事詳細ページでのみ表示されます。
```

`<!-- more -->` がない場合は最初の段落が自動的に excerpt として使われます。
