# 技術ブログプロジェクト - Claude向け仕様書

このドキュメントは、Claude Desktopがこのプロジェクトを理解するための仕様書です。

---

## プロジェクト概要

### 基本情報
- **プロジェクト名**: diary-blog
- **目的**: XserverのWordPressブログをCloudflareに移行してコスト削減(月990円→0円)
- **移行元URL**: `https://diary.ateruimashin.com/blog/yyyy/MM/{slug}/`
- **新URL**: `https://diary.ateruimashin.com/posts/{slug}`
- **リポジトリ**: GitHub Private
- **環境**: Windows 10/11

### アーキテクチャ
```
Markdown記事 (src/content/posts/)
    ↓
GitHub Actions (CI/CD)
    ↓
Hono SSG (ビルド時に全HTML生成)
    ↓
Cloudflare Workers (Honoルーティング + 静的配信)
    ↓
ユーザー
```

---

## 技術スタック

### フレームワーク・ビルド
- **SSG**: Hono SSG (`@hono/vite-ssg`)
- **フレームワーク**: Hono (Workers上でルーティング処理)
- **ビルドツール**: Vite
- **言語**: TypeScript 5.x
- **ランタイム**: 
  - ビルド時: Node.js 18+
  - 実行時: Cloudflare Workers

### インフラ
- **ホスティング**: Cloudflare Workers
- **画像ストレージ**: Cloudflare R2
- **CI/CD**: GitHub Actions
- **デプロイ**: Wrangler CLI

### レンダリング方式
**Hono SSG (Static Site Generation with Routing)**
- ビルド時: Honoアプリでルーティング定義 → 全ページHTML生成
- 実行時: Honoが動的にルーティング処理 + 事前生成済みHTMLを配信

---

## ディレクトリ構造

```
diary_blog/
├── CLAUDE.md                       # このファイル(Claude向け仕様)
├── .claude/
│   └── architecture.md            # アーキテクチャ詳細
├── .github/workflows/
│   └── deploy.yml                 # GitHub Actions
├── src/
│   ├── index.ts                   # Honoアプリエントリーポイント (Workers上で動作)
│   ├── content/
│   │   ├── posts/                 # Markdown記事(Git管理)
│   │   │   ├── samples/          # サンプル記事
│   │   │   └── *.md              # 本番記事
│   │   └── comments/
│   │       └── legacy-comments.json  # 移行元コメント
│   ├── routes/                    # ルーティング定義
│   │   ├── index.ts              # トップページ
│   │   ├── posts.ts              # 記事詳細
│   │   ├── comments.ts           # コメント一覧
│   │   └── tags.ts               # タグ別記事
│   ├── components/               # JSXコンポーネント
│   ├── utils/
│   │   └── posts.ts              # 記事フィルタリング・ソート
│   └── types/
│       ├── post.ts               # 記事型定義
│       └── comment.ts            # コメント型定義
├── public/
│   └── images/                   # ローカル画像(R2にアップロード)
├── scripts/
│   └── prepare-commit.ts         # 画像アップロード＆パス置き換え
├── dist/                         # ビルド成果物(.gitignore)
├── package.json
├── tsconfig.json
└── wrangler.toml                 # Cloudflare Workers設定
```

**重要**: 
- `src/content/posts/`のMarkdownがビルド対象
- `src/index.ts`がCloudflare Workers上で実際に動作するファイル

---

## Markdown記事の仕様

### ファイル名規則
```
src/content/posts/{slug}.md
```

**例**: `src/content/posts/docker-compose-guide.md`

### フロントマター(必須)
```markdown
---
title: 記事タイトル
date: 2026-02-17 09:00
slug: docker-compose-guide
draft: false
tags: [Docker, Tutorial]
description: 記事の概要(150-200文字)
---

# 見出し

本文...
```

**必須フィールド**:
- `title`: 記事タイトル
- `date`: 公開日(YYYY-MM-DD)
- `slug`: URL用のスラッグ
- `draft`: true=下書き、false=公開

---

## URL設計

### 基本ルール
```
ファイル: src/content/posts/docker-guide.md
slug: docker-guide
    ↓
URL: /posts/docker-guide
```

### URL一覧
| ページ | URL | 説明 |
|--------|-----|------|
| トップ | `/` | 最新記事一覧 |
| 記事詳細 | `/posts/{slug}` | 個別記事 |
| コメント一覧 | `/comments` | 移行元コメント |
| タグ別記事 | `/tags/{tag}` | タグでフィルタ |
| 404 | その他 | Not Found |

---

## コメント機能

### 移行元コメントの管理

**データファイル**: `src/content/comments/legacy-comments.json`

**フォーマット**:
```json
[
  {
    "id": 1,
    "postSlug": "sample-post",
    "postTitle": "サンプル記事のタイトル",
    "author": "コメント者の名前",
    "date": "2024-01-01",
    "content": "コメント本文"
  }
]
```

**表示ページ**: `/comments` - 全コメントを一覧表示

**注意**: 
- JSONファイルはWordPressから手動エクスポート
- ビルド時に静的HTMLに変換
- 今後GitHub Discussionsへの移行を予定(実装時期未定)

---

## ビルドプロセス

### Hono SSG のビルドフロー
```
1. Viteがビルド開始
2. src/index.ts (Honoアプリ)を読み込み
3. 各ルートで静的HTMLを生成:
   - /              → dist/index.html
   - /posts/{slug}  → dist/posts/{slug}.html
   - /comments      → dist/comments.html
   - /tags/{tag}    → dist/tags/{tag}.html
4. Workersバンドルを生成:
   - dist/index.js (エントリーポイント)
5. ビルド完了
```

**処理対象**: 
- Markdownファイル: `src/content/posts/`配下
- コメントデータ: `src/content/comments/legacy-comments.json`

**draft: true の扱い**:
- ビルド時に除外
- 静的HTMLは生成されない

---

## Cloudflare Workers での動作

### src/index.ts の役割

Cloudflare Workers上で実際に動作するファイルです:

```typescript
import { Hono } from 'hono'

const app = new Hono()

// ルーティング定義
app.get('/', (c) => { /* 記事一覧 */ })
app.get('/posts/:slug', (c) => { /* 記事詳細 */ })
app.get('/comments', (c) => { /* コメント一覧 */ })
app.get('/tags/:tag', (c) => { /* タグ別記事 */ })
app.notFound((c) => { /* 404ページ */ })

export default app
```

**実行時の処理**:
- リクエストを受け取る
- Honoがルーティング処理
- 事前生成済みの静的HTMLを返却
- 404ハンドリング、リダイレクトなど

---

## 下書き管理

### draft: true の動作
```markdown
---
draft: true              # 下書き
---
```

1. GitHubにpush可能(Privateなので安全)
2. ビルド時に自動除外
3. サイトには表示されない
4. 複数デバイスで編集可能

### 公開・非公開の切り替え
```
下書き: draft: true → push
公開: draft: false → push → 自動デプロイ
再非公開: draft: true → push → サイトから消える
```

---

## デプロイフロー

### GitHub Actions
```yaml
トリガー: mainブランチへのpush
処理:
  1. checkout
  2. npm ci
  3. npm run build (Vite + Hono SSG)
     - 静的HTML生成
     - Workersバンドル生成
  4. wrangler deploy
     - Workersにデプロイ
所要時間: 1-2分
```

### Cloudflare Workers での配信
```
リクエスト受信
    ↓
Honoルーティング処理
    ↓
静的HTML配信
```

---

## 開発ワークフロー

### 新規記事作成
```powershell
# 手動作成
notepad src/content/posts/docker-guide.md
```

### 下書き作成
```markdown
---
title: 新しい記事
date: 2026-02-17
slug: new-article
draft: true              # 下書き
---
```

```powershell
git add src/content/posts/new-article.md
git commit -m "Draft: 新しい記事の下書き"
git push origin main
```

### 公開
```markdown
draft: false             # true → false
```

```powershell
git add src/content/posts/new-article.md
git commit -m "Publish: 新しい記事を公開"
git push origin main
```

---

## コミットメッセージ規則

```
Draft: 下書きの追加・更新
Publish: 記事を公開
Update: 公開済み記事の更新
Fix: 修正
Unpublish: 記事を非公開に戻す
```

---

## コスト(月10,000 PV想定)

| 項目 | 使用量 | 無料枠 | コスト |
|------|--------|--------|--------|
| Workers | 10,000回 | 100,000/日 | 無料 |
| R2 画像配信 | 10,000回 | 1M/月 | 無料 |
| R2 ストレージ | 50MB | 10GB | 無料 |
| GitHub Actions | 40分 | 2,000分/月 | 無料 |
| **合計** | - | - | **¥0** |

年間節約: 11,880円(990円×12ヶ月)

---

## 制約事項

### 技術的制約
- 記事更新にはビルドが必要(1-2分)
- コメント機能は静的表示のみ(新規受付はGitHub Discussions予定)

### ビルド時間
- 10記事: 約10秒
- 50記事: 約20秒
- 100記事: 約35秒

---

## 今後の拡張予定

- [ ] GitHub Discussions連携(コメント機能)
- [ ] タグ別記事一覧
- [ ] 全文検索(Algolia)
- [ ] OGP画像自動生成
- [ ] KaTeX数式レンダリング
- [ ] ダークモード

---

## 関連ドキュメント

### プロジェクト内
- `.claude/architecture.md` - アーキテクチャ詳細

### 外部
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Cloudflare R2](https://developers.cloudflare.com/r2/)
- [Hono](https://hono.dev/)
- [Hono SSG](https://github.com/honojs/vite-plugins/tree/main/packages/ssg)

---

## Claudeへの指示

### 記事作成時
- ファイル名は `{slug}.md` 形式
- フロントマターの必須フィールドを含める
- 下書きは `draft: true`

### コード修正時
- コメントは必ず半角括弧 `()` を使用
- PowerShellスクリプトは Windows環境を前提

### 質問への回答時
- 仕様に基づいて回答
- 不明点は `.claude/architecture.md` を参照

---

**最終更新**: 2026-02-17
