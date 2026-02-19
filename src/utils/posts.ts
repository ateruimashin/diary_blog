import type { Post, PostMetadata } from '../types/post';
import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';
import markedKatex from 'marked-katex-extension';
import { createHighlighter } from 'shiki';
import markedShiki from 'marked-shiki';

/**
 * 記事が公開可能かチェック(本番環境用)
 */
export function isPublished(post: Post): boolean {
    // metadata が null の場合は非公開
    if (!post.metadata) {
        return false;
    }

    // draft が true の場合は非公開
    if (post.metadata.draft === true) {
        return false;
    }

    return true;
}

/**
 * 公開記事のみをフィルタリング(本番環境用)
 */
export function filterPublishedPosts(posts: Post[]): Post[] {
    return posts.filter(isPublished);
}

/**
 * 記事を日付順にソート(新しい順)
 */
export function sortPostsByDate(posts: Post[]): Post[] {
    return [...posts].sort((a, b) => {
        // metadata が null の場合は最後に配置
        if (!a.metadata) return 1;
        if (!b.metadata) return -1;

        const dateA = new Date(a.metadata.date);
        const dateB = new Date(b.metadata.date);
        return dateB.getTime() - dateA.getTime();
    });
}

/**
 * 環境に応じて適切な記事を取得
 * - 開発環境: すべての記事(下書き含む)
 * - 本番環境: 公開記事のみ(draft: false または未指定)
 */
export function getPostsForEnvironment(posts: Post[], environment: string): Post[] {
    if (environment === 'development') {
        // 開発環境ではすべての記事を表示(下書きも含む)
        return sortPostsByDate(posts);
    } else {
        // 本番環境では公開記事のみ(draft: true を除外)
        return sortPostsByDate(filterPublishedPosts(posts));
    }
}

/**
 * 記事が下書きかどうかをチェック
 */
export function isDraft(post: Post): boolean {
    if (!post.metadata) {
        return false;
    }
    return post.metadata.draft === true;
}

/**
 * Markdownファイルを再帰的に取得
 */
export function getAllMarkdownFiles(dir: string, excludeDirs: string[] = []): string[] {
    const files: string[] = [];

    function traverse(currentDir: string) {
        if (!fs.existsSync(currentDir)) {
            return;
        }

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
export function extractExcerpt(rawContent: string): { content: string; excerpt?: string } {
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
export function parseMarkdownFile(filePath: string): Post {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const { data, content } = matter(fileContent);

    const { content: parsedContent, excerpt } = extractExcerpt(content);

    return {
        metadata: data as PostMetadata,
        content: parsedContent,
        excerpt,
    };
}

/**
 * MarkdownをHTMLに変換 (KaTeX数式レンダリング + Shikiシンタックスハイライト対応)
 */
export async function markdownToHtml(markdown: string): Promise<string> {
    const highlighter = await createHighlighter({
        themes: ['github-dark'],
        langs: [
            'typescript', 'javascript', 'tsx', 'jsx',
            'html', 'css', 'json', 'yaml', 'toml',
            'bash', 'sh', 'shell',
            'python', 'rust', 'go', 'cpp', 'c',
            'markdown', 'sql', 'dockerfile',
        ],
    });

    marked.use(markedKatex({ throwOnError: false }));
    marked.use(markedShiki({
        highlight(code, lang, props) {
            return highlighter.codeToHtml(code, {
                lang: lang || 'text',
                theme: 'github-dark',
                meta: { __raw: props.join(' ') },
            });
        },
    }));

    return await marked(markdown);
}

/**
 * すべての記事を読み込む
 */
export function loadAllPosts(postsDir: string, excludeDirs: string[] = ['samples']): Post[] {
    const markdownFiles = getAllMarkdownFiles(postsDir, excludeDirs);
    return markdownFiles.map(parseMarkdownFile);
}
