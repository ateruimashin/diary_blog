# Diary Blog

日記ブログのリポジトリ - Hono SSG + Cloudflare Workers

## 概要

XserverのWordPressブログをCloudflare Workersに移行し、コストを月990円から0円に削減するプロジェクトです。

- **フレームワーク**: Hono SSG
- **ホスティング**: Cloudflare Workers
- **画像ストレージ**: Cloudflare R2
- **CI/CD**: GitHub Actions

## アーキテクチャ

- **ビルド時**: Vite + Hono SSGで全ページの静的HTMLを生成
- **実行時**: Cloudflare Workers上でHonoがルーティング処理 + 静的HTML配信

詳細は [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) を参照してください。

## ディレクトリ構造

```
diary_blog/
├── CLAUDE.md                  # Claude向け仕様書
├── docs/                      # ドキュメント
│   ├── IMPLEMENTATION.md      # 実装ガイド
│   └── WRITING.md             # 記事執筆ガイド
├── .github/workflows/
│   └── deploy.yml             # GitHub Actions デプロイ設定
├── src/
│   ├── index.ts               # Honoアプリ (Workers上で動作)
│   ├── content/
│   │   ├── tags.json          # タグ定義
│   │   ├── posts/            # Markdown記事
│   │   │   ├── samples/      # サンプル記事
│   │   │   └── *.md          # 本番記事
│   │   └── comments/
│   │       └── legacy-comments.json  # 移行元コメント
│   ├── utils/
│   │   ├── posts.ts          # 記事処理ユーティリティ
│   │   ├── comments.ts       # コメント処理ユーティリティ
│   │   └── tags.ts           # タグ処理ユーティリティ
│   └── types/
│       ├── post.ts           # 記事型定義
│       ├── comment.ts        # コメント型定義
│       └── tag.ts            # タグ型定義
├── public/
│   ├── styles.css             # グローバルスタイル
│   └── images/               # ローカル画像 (R2にアップロード)
├── scripts/
│   ├── new-post.ts           # 新規記事作成
│   ├── add-tag.ts            # タグ追加
│   ├── build-ssg.ts          # SSGビルドスクリプト
│   └── prepare-commit.ts     # 画像アップロード＆パス置き換え
├── package.json
├── tsconfig.json
├── vite.config.ts            # Vite設定
└── wrangler.toml             # Cloudflare Workers設定
```

## セットアップ

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.example` をコピーして `.env` を作成:

```bash
cp .env.example .env
```

必要な値を設定:
- `R2_ACCESS_KEY_ID` - Cloudflare R2アクセスキー
- `R2_SECRET_ACCESS_KEY` - Cloudflare R2シークレットキー
- `R2_ACCOUNT_ID` - Cloudflare アカウントID
- `NODE_ENV` - 環境 (development / production)

### 3. Cloudflareにログイン

```bash
npx wrangler login
```

### 4. R2バケットを作成

```bash
npx wrangler r2 bucket create diary-blog-images
```

## 開発

### ローカル開発サーバー起動

```bash
npm run dev
```

http://localhost:5173 でアクセスできます。

開発環境では `draft: true` の記事も表示されます。

### ビルド

```bash
npm run build
```

`dist/` ディレクトリに以下が生成されます:
- 静的HTMLファイル
- `index.js` (Workersバンドル)

## 記事作成

### 記事ファイルの作成

スクリプトを使用して、対話形式でフロントマター付きのMarkdownファイルを自動生成します:

```bash
npm run new
```

実行すると以下を順番に入力します:

```
=== 新規記事作成 ===

タイトル: Docker Composeで開発環境を構築する
スラッグ (Enter でデフォルト: docker-compose): docker-compose-guide
日付 (YYYY-MM-DD、Enter でデフォルト: 2026-02-18): 2024-03-01
タグ (カンマ区切り、省略可): Docker, Tutorial
概要 (150-200文字推奨、省略可): Docker Composeを使って...
下書きとして作成? (Y/n): Y

作成しました: src/content/posts/2024-03-01_docker-compose-guide.md
ステータス: 下書き (draft: true)
```

**入力の省略ルール**:
- スラッグ: Enterでタイトルから自動生成
- 日付: Enterで今日の日付 (過去の日付も指定可能)
- タグ・概要: 省略可
- 下書き: デフォルトYes (`n` と入力すると `draft: false` で作成)

## タグ管理

### タグの追加

対話形式で `src/content/tags.json` に新しいタグを追加します:

```bash
npm run add-tag
```

実行すると以下を順番に入力します:

```
=== タグ追加 ===

タグ名 (表示名): Kubernetes
キー (frontmatter 用): kubernetes
説明: Kubernetes に関する記事
親タグを選択してください: (カーソルキーで選択)
  (なし) ルートタグとして追加
  プログラミング
    TypeScript
    JavaScript
    Python
> インフラ
    Docker
      Docker Compose
    Cloudflare
    Linux
  ...

--- 追加内容の確認 ---
  タグ名  : Kubernetes
  キー    : kubernetes
  説明    : Kubernetes に関する記事
  親タグ  : インフラ (id: 5)

このタグを追加しますか? (Y/n): Y

追加しました: "Kubernetes" (key: kubernetes, id: 17)
親タグ: インフラ
```

**入力の説明**:
- タグ名: 画面表示に使われる名前
- キー: frontmatterの `tags:` に記述する識別子 (小文字英数字とハイフンのみ)。Enterでタグ名から自動生成
- 説明: タグの説明文 (必須)
- 親タグ: カーソルキーで選択。先頭の「(なし)」を選ぶとルートタグとして追加

### ファイル名規則

```
src/content/posts/{date}_{slug}.md
```

例: `src/content/posts/2024-03-01_docker-compose-guide.md`

### 記事のフォーマット

```markdown
---
title: "記事タイトル"
date: 2024-02-17
slug: docker-guide
tags: [Docker, Tutorial]
description: "記事の概要"
draft: false
---

# 見出し

記事本文...
```

### メタデータ項目

- `title` - 記事タイトル (必須)
- `date` - 公開日 (必須、YYYY-MM-DD形式)
- `slug` - URL用のスラッグ (必須、英数字とハイフン)
- `tags` - タグのリスト (オプション)
- `description` - 記事の概要 (オプション)
- `draft` - 下書き設定 (オプション)
  - `true`: 開発環境のみ表示、本番環境では非表示
  - `false` または省略: 本番環境でも表示

### 下書きと公開

```markdown
# 下書きとして作成
draft: true

# 公開する
draft: false
```

## 画像の扱い

### 画像の配置

```bash
# public/images/ に配置
cp image.jpg public/images/
```

### 記事内で参照

```markdown
![説明](./images/image.jpg)
```

### コミット前の処理

```bash
# 画像をR2にアップロード＆パス置き換え
npm run prepare
```

## デプロイ

### 自動デプロイ (推奨)

`main` ブランチにpushすると自動的にデプロイされます:

```bash
git add .
git commit -m "Add: new post"
git push origin main
```

GitHub Actionsが自動的に:
1. ビルド実行
2. Cloudflare Workersにデプロイ

### 手動デプロイ

```bash
npm run deploy
```

## URL設計

| ページ | URL | 説明 |
|--------|-----|------|
| トップ | `/` | 最新記事一覧 |
| 記事詳細 | `/posts/{slug}` | 個別記事 |
| コメント一覧 | `/comments` | 移行元コメント |
| タグ別記事 | `/tags/{tag}` | タグでフィルタ |

## コメント機能

WordPress から移行したコメントは `src/content/comments/legacy-comments.json` で管理されます。

フォーマット:
```json
[
  {
    "id": 1,
    "postSlug": "sample-post",
    "postTitle": "サンプル記事",
    "author": "コメント者",
    "date": "2024-01-01",
    "content": "コメント本文"
  }
]
```

`/comments` ページで全コメントを一覧表示します。

## コスト

月10,000 PV想定:

| 項目 | コスト |
|------|--------|
| Cloudflare Workers | 無料 |
| R2 画像配信 | 無料 |
| R2 ストレージ | 無料 |
| GitHub Actions | 無料 |
| **合計** | **¥0** |

年間節約: 11,880円 (990円×12ヶ月)

## トラブルシューティング

### ビルドエラー

```bash
# 依存パッケージを再インストール
rm -rf node_modules package-lock.json
npm install
```

### 型エラー

```bash
# TypeScript型チェック
npx tsc --noEmit
```

### デプロイエラー

```bash
# Wrangler設定を確認
npx wrangler whoami
```

## ドキュメント

- [docs/WRITING.md](docs/WRITING.md) - 記事の書き方・記法一覧
- [docs/CLAUDE.md](docs/CLAUDE.md) - Claude向け仕様書
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - アーキテクチャ詳細
- [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md) - 実装ガイド

## 参考リンク

- [Hono](https://hono.dev/)
- [Hono SSG](https://github.com/honojs/vite-plugins/tree/main/packages/ssg)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Cloudflare R2](https://developers.cloudflare.com/r2/)
- [Vite](https://vitejs.dev/)

## ライセンス

MIT
