import { Hono } from 'hono';
import { ssgParams } from 'hono/ssg';
import * as path from 'path';
import {
    loadAllPosts,
    filterPublishedPosts,
    sortPostsByDate,
    markdownToHtml
} from './utils/posts';
import { loadLegacyComments } from './utils/comments';
import { findTagByKey, flattenTagsWithPath } from './utils/tags';
import rawTags from './content/tags.json';
import type { Post } from './types/post';
import type { LegacyComments } from './types/comment';

const app = new Hono();

// 日付をyyyy/MM/dd HH:mm形式にフォーマット
function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    const yyyy = d.getFullYear();
    const MM = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const HH = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}/${MM}/${dd} ${HH}:${mm}`;
}

// 共通ナビゲーション
function navHtml(): string {
    return `<nav>
                <a href="/">ホーム</a>
                <a href="/tags">タグ一覧</a>
                <a href="/comments">コメント</a>
            </nav>`;
}

// タグキーのリストをリンク付きHTMLに変換
function tagsToLinksHtml(tagKeys: string[]): string {
    return tagKeys
        .map((key) => {
            const def = findTagByKey(key);
            const label = def ? def.label : key;
            return `<a href="/tags/${key}" class="tag-link">${label}</a>`;
        })
        .join(' ');
}

// 右サイドバーHTML生成
function sidebarHtml(): string {
    // タグ一覧 (記事数カウント)
    const tagCount = new Map<string, number>();
    for (const post of posts) {
        if (post.metadata?.tags) {
            for (const key of post.metadata.tags) {
                tagCount.set(key, (tagCount.get(key) ?? 0) + 1);
            }
        }
    }
    const flatTags = flattenTagsWithPath();
    const tagsHtml = flatTags
        .map((tag) => {
            const count = tagCount.get(tag.key) ?? 0;
            return `<li class="sidebar-tag-item" style="padding-left: ${tag.depth * 1}em">
                <a href="/tags/${tag.key}" class="tag-link">${tag.label}</a>
                <span class="tag-count">(${count})</span>
            </li>`;
        })
        .join('');

    // 最新記事 10件
    const recentPosts = posts.slice(0, 10);
    const recentHtml = recentPosts
        .map((post) => {
            if (!post.metadata) return '';
            return `<li class="sidebar-recent-item">
                <a href="/posts/${post.metadata.slug}">${post.metadata.title}</a>
                <span class="sidebar-recent-date">${formatDate(post.metadata.date)}</span>
            </li>`;
        })
        .join('');

    return `<aside class="sidebar">
        <section class="sidebar-section">
            <h2 class="sidebar-heading">最新記事</h2>
            <ul class="sidebar-recent-list">
                ${recentHtml || '<li>記事がありません</li>'}
            </ul>
        </section>
        <section class="sidebar-section">
            <h2 class="sidebar-heading">タグ一覧</h2>
            <ul class="sidebar-tag-list">
                ${tagsHtml || '<li>タグがありません</li>'}
            </ul>
        </section>
    </aside>`;
}

// 2ペインレイアウトでbodyコンテンツをラップ
function twoColumnLayout(mainContent: string): string {
    return `<div class="two-column">
        <main class="main-content">
            ${mainContent}
        </main>
        ${sidebarHtml()}
    </div>`;
}

// 環境変数から環境を取得 (デフォルトはproduction)
const ENV = process.env.NODE_ENV || 'development';

// ビルド時に記事とコメントを読み込み
const POSTS_DIR = path.join(process.cwd(), 'src/content/posts');
const COMMENTS_FILE = path.join(process.cwd(), 'src/content/comments/legacy-comments.json');

let allPosts: Post[] = [];
let legacyComments: LegacyComments = [];

// Node.js環境でのみファイルを読み込み (ビルド時)
if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    allPosts = loadAllPosts(POSTS_DIR);
    legacyComments = loadLegacyComments(COMMENTS_FILE);
}

// 環境に応じて記事をフィルタリング
const posts = ENV === 'development'
    ? sortPostsByDate(allPosts)
    : sortPostsByDate(filterPublishedPosts(allPosts));

// トップページ - 記事一覧
app.get('/', async (c) => {
    const postsHtml = (await Promise.all(posts.map(async post => {
        if (!post.metadata) return '';
        // excerpt (<!-- more --> より前の内容) があれば優先表示し、「続きを読む」リンクを追加
        // なければ description にフォールバック
        let excerptHtml = '';
        if (post.excerpt) {
            const excerptRendered = await markdownToHtml(post.excerpt);
            excerptHtml = `<div class="excerpt">${excerptRendered}</div><a class="read-more" href="/posts/${post.metadata.slug}">続きを読む</a>`;
        } else if (post.metadata.description) {
            excerptHtml = `<p>${post.metadata.description}</p>`;
        }
        return `
            <article class="post-list-item">
                <h2><a href="/posts/${post.metadata.slug}">${post.metadata.title}</a></h2>
                <time>${formatDate(post.metadata.date)}</time>
                ${post.metadata.tags ? `<div class="tags">${tagsToLinksHtml(post.metadata.tags)}</div>` : ''}
                ${excerptHtml}
            </article>
        `;
    }))).join('');

    return c.html(`
        <!DOCTYPE html>
        <html lang="ja">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Tech Blog</title>
            <link rel="stylesheet" href="/styles.css">
        </head>
        <body>
            ${navHtml()}
            ${twoColumnLayout(`
                <h1>Tech Blog</h1>
                <div>
                    ${postsHtml || '<p>記事がありません</p>'}
                </div>
            `)}
        </body>
        </html>
    `);
});

// 記事詳細ページ
app.get('/posts/:slug', async (c) => {
    const slug = c.req.param('slug');
    const post = posts.find(p => p.metadata && p.metadata.slug === slug);

    if (!post || !post.metadata) {
        return c.html('<h1>404 Not Found</h1>', 404);
    }

    const contentHtml = await markdownToHtml(post.content);

    return c.html(`
        <!DOCTYPE html>
        <html lang="ja">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${post.metadata.title} - Tech Blog</title>
            ${post.metadata.description ? `<meta name="description" content="${post.metadata.description}">` : ''}
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
            <link rel="stylesheet" href="/styles.css">
        </head>
        <body>
            ${navHtml()}
            ${twoColumnLayout(`
                <article>
                    <header>
                        <h1>${post.metadata.title}</h1>
                        <time>${formatDate(post.metadata.date)}</time>
                        ${post.metadata.tags ? `<div class="tags">${tagsToLinksHtml(post.metadata.tags)}</div>` : ''}
                    </header>
                    <div>
                        ${contentHtml}
                    </div>
                </article>
                <nav class="article-footer-nav">
                    <a href="/">← 記事一覧に戻る</a>
                </nav>
            `)}
        </body>
        </html>
`);
});

// コメント一覧ページ
app.get('/comments', (c) => {
    const commentsHtml = legacyComments.map(comment => `
        <article class="comment-item">
            <div class="comment-meta">
                <strong>${comment.author}</strong> - 
                <time>${formatDate(comment.date)}</time>
            </div>
            <div class="comment-post-link">
                記事: <a href="/posts/${comment.postSlug}">${comment.postTitle}</a>
            </div>
            <div>
                ${comment.content}
            </div>
        </article>
    `).join('');

    return c.html(`
        <!DOCTYPE html>
        <html lang="ja">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>コメント一覧 - Tech Blog</title>
            <link rel="stylesheet" href="/styles.css">
        </head>
        <body>
            ${navHtml()}
            ${twoColumnLayout(`
                <h1>コメント一覧</h1>
                <div>
                    ${commentsHtml || '<p>コメントがありません</p>'}
                </div>
            `)}
        </body>
        </html>
    `);
});

// タグ一覧ページ
app.get('/tags', (c) => {
    // 各タグの記事数を集計
    const tagCount = new Map<string, number>();
    for (const post of posts) {
        if (post.metadata?.tags) {
            for (const key of post.metadata.tags) {
                tagCount.set(key, (tagCount.get(key) ?? 0) + 1);
            }
        }
    }

    const flatTags = flattenTagsWithPath();
    // 記事が1件以上あるタグのみ表示 (件数0でも定義済みタグは表示)
    const tagsHtml = flatTags
        .map((tag) => {
            const count = tagCount.get(tag.key) ?? 0;
            const indent = '　'.repeat(tag.depth);
            return `
                <li class="tag-list-item" style="padding-left: ${tag.depth * 1.5}em">
                    <a href="/tags/${tag.key}" class="tag-link">${tag.label}</a>
                    <span class="tag-count">(${count}件)</span>
                    ${tag.description ? `<span class="tag-description"> - ${tag.description}</span>` : ''}
                </li>
            `;
        })
        .join('');

    return c.html(`
        <!DOCTYPE html>
        <html lang="ja">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>タグ一覧 - Tech Blog</title>
            <link rel="stylesheet" href="/styles.css">
        </head>
        <body>
            ${navHtml()}
            ${twoColumnLayout(`
                <h1>タグ一覧</h1>
                <ul class="tag-list">
                    ${tagsHtml || '<li>タグがありません</li>'}
                </ul>
            `)}
        </body>
        </html>
    `);
});

// タグ別記事ページ
app.get(
    '/tags/:tag',
    ssgParams(() => (rawTags as { key: string }[]).map((t) => ({ tag: t.key }))),
    (c) => {
    const tagKey = c.req.param('tag');
    const tagDef = findTagByKey(tagKey);
    const tagLabel = tagDef ? tagDef.label : tagKey;

    const taggedPosts = posts.filter(post =>
        post.metadata && post.metadata.tags && post.metadata.tags.includes(tagKey)
    );

    const postsHtml = taggedPosts.map(post => {
        if (!post.metadata) return '';
        return `
            <article class="post-list-item">
                <h2><a href="/posts/${post.metadata.slug}">${post.metadata.title}</a></h2>
                <time>${formatDate(post.metadata.date)}</time>
                ${post.metadata.tags ? `<div class="tags">${tagsToLinksHtml(post.metadata.tags)}</div>` : ''}
                ${post.metadata.description ? `<p>${post.metadata.description}</p>` : ''}
            </article>
        `;
    }).join('');

    return c.html(`
        <!DOCTYPE html>
        <html lang="ja">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>タグ: ${tagLabel} - Tech Blog</title>
            <link rel="stylesheet" href="/styles.css">
        </head>
        <body>
            ${navHtml()}
            ${twoColumnLayout(`
                <p class="breadcrumb"><a href="/tags">タグ一覧</a> &rsaquo; ${tagLabel}</p>
                <h1>タグ: ${tagLabel}</h1>
                ${tagDef?.description ? `<p class="tag-description">${tagDef.description}</p>` : ''}
                <div>
                    ${postsHtml || '<p>記事がありません</p>'}
                </div>
            `)}
        </body>
        </html>
    `);
});

// 404ページ
app.notFound((c) => {
    return c.html(`
        <!DOCTYPE html>
        <html lang="ja">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>404 Not Found - Tech Blog</title>
            <link rel="stylesheet" href="/styles.css">
        </head>
        <body class="not-found-body">
            ${navHtml()}
            <h1>404 Not Found</h1>
            <p>ページが見つかりません</p>
            <p><a href="/">ホームに戻る</a></p>
        </body>
        </html>
    `, 404);
});

export default app;
