# アーキテクチャ詳細

## レンダリング方式: Hono SSG + Cloudflare Workers

### 概要
このプロジェクトはHono SSG (Static Site Generation)を使用した静的サイトです。ビルド時にHonoアプリが全ページの静的HTMLを生成し、実行時はCloudflare Workers上でHonoがルーティング処理を行いながら静的HTMLを配信します。

### アーキテクチャの特徴

**ハイブリッドアプローチ**:
- **ビルド時**: 静的HTMLを事前生成 (SSG)
- **実行時**: Honoのルーティング機能を活用 (Workers上で動作)

このアプローチにより以下が実現できます:
- 高速な配信 (事前生成済みHTML)
- 柔軟なルーティング (404処理、リダイレクト)
- 将来的なSSR対応の容易さ

---

## ビルド時(GitHub Actions / Node.js環境)

### Vite + Hono SSG によるビルド

```typescript
// vite.config.ts の概要

import { defineConfig } from 'vite'
import ssg from '@hono/vite-ssg'

export default defineConfig({
  plugins: [
    ssg({
      entry: 'src/index.ts'  // Honoアプリのエントリーポイント
    })
  ]
})
```

### ビルドフロー

```
1. Viteがビルド開始
   $ npm run build
   
2. src/index.ts (Honoアプリ)を読み込み
   import { Hono } from 'hono'
   const app = new Hono()
   
3. Markdownファイル読み込み
   - src/content/posts/*.md
   - フロントマター解析 (gray-matter)
   - draft: true を除外
   
4. コメントデータ読み込み
   - src/content/comments/legacy-comments.json
   
5. 各ルートで静的HTMLを生成
   app.get('/', ...) → dist/index.html
   app.get('/posts/:slug', ...) → dist/posts/{slug}.html
   app.get('/comments', ...) → dist/comments.html
   app.get('/tags/:tag', ...) → dist/tags/{tag}.html
   
6. Workersバンドル生成
   - TypeScriptをトランスパイル
   - dist/index.js (エントリーポイント)
   
7. ビルド完了
   dist/
   ├── index.html
   ├── posts/
   │   └── {slug}.html
   ├── comments.html
   ├── tags/
   │   └── {tag}.html
   └── index.js (Workersバンドル)
```

---

## 実行時(Cloudflare Workers)

### src/index.ts - Honoアプリ

Cloudflare Workers上で実際に動作するファイルです:

```typescript
import { Hono } from 'hono'
import { serveStatic } from 'hono/cloudflare-workers'

const app = new Hono()

// 静的ファイル配信
app.use('/*', serveStatic({ root: './' }))

// ルーティング定義
app.get('/', async (c) => {
  // ビルド時に生成済みのindex.htmlを返す
  return c.html(/* 静的HTML */)
})

app.get('/posts/:slug', async (c) => {
  const slug = c.req.param('slug')
  // ビルド時に生成済みのHTMLを返す
  return c.html(/* 静的HTML */)
})

app.get('/comments', async (c) => {
  // コメント一覧HTMLを返す
  return c.html(/* 静的HTML */)
})

app.get('/tags/:tag', async (c) => {
  const tag = c.req.param('tag')
  // タグ別記事HTMLを返す
  return c.html(/* 静的HTML */)
})

// 404ハンドリング
app.notFound((c) => {
  return c.html('<h1>404 Not Found</h1>', 404)
})

export default app
```

### Workers上での処理フロー

```
1. リクエスト受信
   GET /posts/docker-guide
   
2. Honoがルーティング処理
   app.get('/posts/:slug', ...)
   → slug = 'docker-guide'
   
3. 事前生成済みHTMLを取得
   dist/posts/docker-guide.html
   
4. レスポンス返却
   - Content-Type: text/html
   - Cache-Control: public, max-age=3600
   
5. ユーザーに配信
```

---

## アーキテクチャ図

### 全体フロー

```
┌─────────────────────┐
│ Markdown記事        │
│ (src/content/posts) │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ ビルド時処理        │
│ (GitHub Actions)    │
│                     │
│ Vite + Hono SSG    │
│ 1. MD読み込み      │
│ 2. draft除外       │
│ 3. HTML生成        │
│ 4. バンドル生成    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ ビルド成果物        │
│ (dist/)             │
│                     │
│ - 静的HTML         │
│ - index.js         │
│   (Workersバンドル)│
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Cloudflare Workers  │
│                     │
│ src/index.ts が動作│
│ Honoルーティング   │
│ + 静的HTML配信     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ ユーザー            │
└─────────────────────┘
```

### ファイル依存関係

```
src/
├── index.ts ──────────────┐ (Workers上で動作)
│   ├── routes/           │
│   │   ├── index.ts      │
│   │   ├── posts.ts      │
│   │   ├── comments.ts   │
│   │   └── tags.ts       │
│   ├── content/          │
│   │   ├── posts/*.md ───┤ (ビルド時に読み込み)
│   │   └── comments/     │
│   │       └── legacy-   │
│   │           comments. │
│   │           json ─────┤
│   ├── components/       │
│   ├── utils/            │
│   └── types/            │
                          ▼
                     Vite + Hono SSG
                          │
                          ▼
                       dist/
                       ├── index.html
                       ├── posts/*.html
                       ├── comments.html
                       ├── tags/*.html
                       └── index.js (バンドル)
```

---

## データフロー

### 記事作成から公開まで

```
1. 開発者がMarkdownを作成
   src/content/posts/docker-guide.md
   ---
   draft: true
   ---
   
2. Git push
   git push origin main
   
3. GitHub Actions起動
   トリガー: mainブランチへのpush
   
4. ビルド実行 (Node.js環境)
   npm run build
   → Vite + Hono SSG 実行
   
5. draft: true なので除外
   → HTMLは生成されない
   
6. 記事完成後、公開
   draft: false に変更
   git push origin main
   
7. 再ビルド
   → dist/posts/docker-guide.html 生成
   → dist/index.js (Workersバンドル) 生成
   
8. Workersにデプロイ
   wrangler deploy
   
9. 公開完了
   https://diary.ateruimashin.com/posts/docker-guide
   
10. Workers上でHonoが処理
    GET /posts/docker-guide
    → Honoルーティング
    → 静的HTML配信
```

---

## Cloudflare構成

### wrangler.toml

```toml
name = "diary-blog"
main = "dist/index.js"              # Workersバンドル
compatibility_date = "2024-01-01"

[[r2_buckets]]
binding = "IMAGES"
bucket_name = "diary-blog-images"    # 画像用R2バケット

[env.production]
routes = [
  { pattern = "diary.ateruimashin.com/*", zone_name = "ateruimashin.com" }
]
```

### Workersの役割

```
Honoアプリケーション (src/index.ts) が提供:
✓ ルーティング処理
✓ 静的HTML配信
✓ 404ハンドリング
✓ リダイレクト処理
✓ カスタムヘッダー設定
✓ 将来的なSSR対応

行わないこと:
✗ Markdownの解析 (ビルド時に完了)
✗ HTMLの動的生成 (事前生成済み)
✗ データベース処理
```

---

## パフォーマンス

### レスポンスタイム

```
リクエスト → Workers (Hono) → 静的HTML → レスポンス

内訳:
- Honoルーティング: < 1ms
- 静的ファイル取得: < 5ms
- ネットワーク: 5-30ms
──────────────────────────
合計TTFB: 10-50ms
```

### キャッシュ戦略

```typescript
// src/index.ts
app.get('/*', (c, next) => {
  c.header('Cache-Control', 'public, max-age=3600')
  return next()
})
```

- Cloudflare CDN: 1時間キャッシュ
- ブラウザ: 1時間キャッシュ
- 2回目以降のアクセス: < 10ms

### ビルド時間

```
記事数とビルド時間の関係:
- 10記事: 約10秒
- 50記事: 約20秒
- 100記事: 約35秒

処理内容:
- Markdown読み込み: O(n)
- HTML生成: O(n)
- Workersバンドル: O(1)
```

---

## セキュリティ

### 静的サイトのメリット

```
✅ サーバーサイド脆弱性なし (事前生成)
✅ SQLインジェクション不可
✅ XSS攻撃面の縮小
✅ DDoS耐性 (Cloudflare CDN)
✅ 情報漏洩リスク低
```

### Workersでのセキュリティ

```typescript
// セキュリティヘッダー設定例
app.use('/*', async (c, next) => {
  await next()
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-Frame-Options', 'DENY')
  c.header('X-XSS-Protection', '1; mode=block')
})
```

---

## スケーリング

### 水平スケーリング

```
Cloudflareの特性:
- Workers: 自動スケール
- CDN: グローバル分散
- 無制限同時リクエスト処理

アクセス増加時:
1. CDNキャッシュヒット率向上
2. Workersが自動スケール
→ 追加設定不要
```

### 記事数の増加

```
100記事まで:
- 現状維持
- ビルド時間: 約35秒

100-300記事:
- インクリメンタルビルド検討
- ビルド時間: 1-2分

300-500記事:
- 差分ビルド最適化
- ビルドキャッシュ活用

500記事以上:
- マイクロフロントエンド検討
- ビルドパイプライン最適化
```

---

## コスト構造

### 無料枠

```
Cloudflare Workers:
- リクエスト: 100,000/日
- CPU時間: 10ms/リクエスト
- メモリ: 128MB

Cloudflare R2 (画像):
- ストレージ: 10GB
- Class A操作: 1M/月
- Class B操作: 10M/月
- データ転送: 無制限

GitHub Actions (Private):
- ビルド時間: 2,000分/月
```

### 実コスト(月10,000 PV)

```
Workers: 10,000回/月 → 無料
R2 画像配信: 10,000回 → 無料
R2 ストレージ: 50MB → 無料
GitHub Actions: 40分 → 無料

合計: ¥0
```

---

## Honoを採用した理由

### 技術的メリット

1. **Cloudflare Workers最適化**
   - Workers向けに設計された軽量フレームワーク
   - 最小限のオーバーヘッド

2. **柔軟なルーティング**
   - 動的ルーティング対応
   - ミドルウェア機能
   - 404ハンドリング

3. **SSG対応**
   - `@hono/vite-ssg`による公式SSGサポート
   - ビルド時HTML生成 + 実行時ルーティング

4. **将来の拡張性**
   - 必要に応じてSSRに切り替え可能
   - APIエンドポイント追加が容易

### 実装例

```typescript
// SSGとSSRの切り替えが容易

// 現在: SSG (ビルド時生成)
app.get('/posts/:slug', (c) => {
  return c.html(preGeneratedHTML)
})

// 将来: SSR (動的生成) に簡単に変更可能
app.get('/posts/:slug', async (c) => {
  const slug = c.req.param('slug')
  const post = await fetchPost(slug)  // 動的取得
  return c.html(renderPost(post))     // 動的レンダリング
})
```

---

## 制約事項と対策

### 技術的制約

```
できないこと:
- リアルタイム更新 (ビルド必要)
- ユーザー認証
- データベース処理

対処法:
- 外部サービス連携 (GitHub Discussions)
- クライアントサイドJS
- サードパーティAPI
```

### 運用上の制約

```
- 更新に1-2分かかる (push → build → deploy)
- ビルド失敗時は手動対応
- 大規模更新はビルド時間増加

対策:
- GitHub Actionsのログ監視
- ビルドキャッシュ活用
- インクリメンタルビルド導入
```

---

## 今後の改善案

### 機能追加

```
- GitHub Discussions連携 (コメント機能)
- 全文検索 (Algolia)
- タグページ充実
- KaTeX数式レンダリング
- ダークモード
```

### パフォーマンス最適化

```
- 画像最適化 (WebP変換)
- CSS最小化
- プリロード/プリフェッチ
- Service Worker
```

### ビルド最適化

```
- 差分ビルド実装
- 並列処理
- ビルドキャッシュ強化
```

---

**最終更新**: 2026-02-17
