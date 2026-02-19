import { getPostsForEnvironment } from '../src/utils/posts';
import type { Post } from '../src/types/post';
import * as fs from 'fs';
import * as path from 'path';

const POSTS_DIR = path.join(process.cwd(), 'src/content/posts');
const DIST_DIR = path.join(process.cwd(), 'dist');

/**
 * Markdownファイルを再帰的に取得
 */
function getAllMarkdownFiles(dir: string, excludeDirs: string[] = []): string[] {
    const files: string[] = [];

    function traverse(currentDir: string) {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });

        for (const entry of entries) {
            if (entry.isDirectory() && excludeDirs.includes(entry.name)) {
                continue;
            }

            const fullPath = path.join(currentDir, entry.name);

            if (entry.isDirectory()) {
                traverse(fullPath);
            } else if (entry.isFile() && entry.name.endsWith('.md')) {
                files.push(fullPath);
            }
        }
    }

    traverse(dir);
    return files;
}

const MORE_SEPARATOR = '<!-- more -->';

/**
 * Markdownの本文から <!-- more --> を区切りとして excerpt を抽出する
 * - <!-- more --> が存在する場合: その前の内容を excerpt とし、セパレータを除去したフルテキストを content とする
 * - <!-- more --> が存在しない場合: 最初の段落(空行区切り)を excerpt として使う
 */
function extractExcerpt(rawContent: string): { content: string; excerpt?: string } {
    const separatorIndex = rawContent.indexOf(MORE_SEPARATOR);
    if (separatorIndex === -1) {
        // フォールバック: 最初の段落を excerpt として使う
        const firstParagraph = rawContent.split(/\n\n+/)[0]?.trim();
        return {
            content: rawContent,
            excerpt: firstParagraph || undefined,
        };
    }

    const before = rawContent.slice(0, separatorIndex).trim();
    const after = rawContent.slice(separatorIndex + MORE_SEPARATOR.length).trim();

    return {
        content: [before, after].filter(Boolean).join('\n\n'),
        excerpt: before,
    };
}

/**
 * Markdownファイルからメタデータとコンテンツを抽出
 */
function parseMarkdownFile(filePath: string): Post {
    const content = fs.readFileSync(filePath, 'utf-8');

    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (!match) {
        throw new Error(`Invalid markdown file: ${filePath}`);
    }

    const [, frontmatterStr, bodyContent] = match;

    const metadata: any = {};
    const lines = frontmatterStr.split('\n');

    for (const line of lines) {
        const [key, ...valueParts] = line.split(':');
        const value = valueParts.join(':').trim();

        if (key && value) {
            const trimmedKey = key.trim();

            if (trimmedKey === 'tags') {
                metadata.tags = value
                    .replace(/^\[|\]$/g, '')
                    .split(',')
                    .map((tag: string) => tag.trim());
            } else if (trimmedKey === 'draft') {
                metadata.draft = value === 'true';
            } else {
                metadata[trimmedKey] = value;
            }
        }
    }

    const { content: parsedContent, excerpt } = extractExcerpt(bodyContent.trim());

    return {
        metadata,
        content: parsedContent,
        excerpt,
    };
}

/**
 * HTMLページを生成
 */
function generateHTML(title: string, body: string): string {
    return `<!DOCTYPE html>
        <html lang="ja">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${title}</title>
                <link rel="stylesheet" href="/styles.css">
            </head>
            <body>
                ${body}
            </body>
        </html>`;
}

/**
 * SSGビルドを実行
 */
async function build() {
    console.log('📦 Building static site...\n');

    // distディレクトリをクリーンアップ
    if (fs.existsSync(DIST_DIR)) {
        fs.rmSync(DIST_DIR, { recursive: true });
    }
    fs.mkdirSync(DIST_DIR, { recursive: true });

    // 記事を読み込む
    const excludeDirs = ['samples'];
    const markdownFiles = getAllMarkdownFiles(POSTS_DIR, excludeDirs);
    const allPosts = markdownFiles.map(parseMarkdownFile);

    // 本番環境用にフィルタリング
    const posts = getPostsForEnvironment(allPosts, 'production');

    console.log(`✓ Found ${posts.length} posts to build`);

    // インデックスページを生成
    const indexBody = `
        <h1>Tech Blog</h1>
        ${posts.length === 0 ? '<p>記事がありません</p>' : `
        <ul>
            ${posts.map((post: Post) => post.metadata ? `
            <li>
                <a href="/posts/${post.metadata.slug}.html">
                ${post.metadata.title}
                </a>
                <span class="post-list-date">
                (${post.metadata.date})
                </span>
                ${post.excerpt ? `<p class="post-list-excerpt">${post.excerpt}</p>` : ''}
            </li>
            ` : '').join('')}
        </ul>
        `}
    `;

    fs.writeFileSync(
        path.join(DIST_DIR, 'index.html'),
        generateHTML('Tech Blog', indexBody),
        'utf-8'
    );
    console.log('✓ Generated index.html');

    // 記事ページを生成
    const postsDir = path.join(DIST_DIR, 'posts');
    fs.mkdirSync(postsDir, { recursive: true });

    for (const post of posts) {
        if (!post.metadata) {
            console.warn(`⚠ Skipping post with missing metadata`);
            continue;
        }

        const postBody = `
            <article>
                <header>
                <h1>${post.metadata.title}</h1>
                <div class="post-meta">
                    <time>${post.metadata.date}</time>
                    ${post.metadata.tags && post.metadata.tags.length > 0 ? `
                    <span class="post-meta-tags">
                        タグ: ${post.metadata.tags.join(', ')}
                    </span>
                    ` : ''}
                </div>
                </header>
                <div>${post.content}</div>
            </article>
            <nav class="article-footer-nav">
                <a href="/">← 記事一覧に戻る</a>
            </nav>
        `;

        fs.writeFileSync(
            path.join(postsDir, `${post.metadata.slug}.html`),
            generateHTML(`${post.metadata.title} - Tech Blog`, postBody),
            'utf-8'
        );
        console.log(`✓ Generated posts/${post.metadata.slug}.html`);
    }

    console.log(`\n✅ Build complete! Generated ${posts.length + 1} pages in dist/`);
}

build().catch(console.error);
