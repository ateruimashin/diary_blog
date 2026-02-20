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
 * 旅程ブロックのテキストをHTMLに変換
 *
 * 書式:
 *   HH:MM発 駅名  ... 出発駅
 *   HH:MM着 駅名  ... 到着駅
 *   路線名 | 所要時間 ... 乗車路線(所要時間は | で区切る、省略可)
 *   ->駅名        ... 直通中間駅
 *   (空行)         ... 乗り換え区切り
 */
function buildItineraryHtml(text: string): string {
    const lines = text.trim().split('\n');
    let html = '<div class="itinerary">\n';

    for (const line of lines) {
        const trimmed = line.trim();

        if (!trimmed) {
            // 空行 = 乗り換え区切り
            html += '<hr class="itinerary-sep">\n';
        } else if (/^\d{2}:\d{2}(発|着)/.test(trimmed)) {
            // 駅行 : "HH:MM発 駅名" or "HH:MM着 駅名"
            const match = trimmed.match(/^(\d{2}:\d{2}(?:発|着))\s+(.+)$/);
            if (match) {
                html += `<div class="itinerary-station"><span class="it-time">${match[1]}</span><span class="it-name">${match[2]}</span></div>\n`;
            }
        } else if (trimmed.startsWith('->')) {
            // 直通中間駅 : "->駅名"
            const stationName = trimmed.slice(2).trim();
            html += `<div class="itinerary-through"><span class="it-through-label">（直通）</span><span class="it-through-name">${stationName}</span></div>\n`;
        } else {
            // 路線行 : "路線名 | 所要時間" or "路線名"
            const pipeIndex = trimmed.indexOf('|');
            if (pipeIndex !== -1) {
                const routeName = trimmed.slice(0, pipeIndex).trim();
                const duration = trimmed.slice(pipeIndex + 1).trim();
                html += `<div class="itinerary-route">${routeName}<br>${duration}</div>\n`;
            } else {
                html += `<div class="itinerary-route">${trimmed}</div>\n`;
            }
        }
    }

    html += '</div>\n';
    return html;
}

/**
 * Markdown内の ```itinerary ブロックをHTMLに変換するプリプロセッサ
 */
function processItineraryBlocks(markdown: string): string {
    return markdown.replace(/```itinerary\n([\s\S]*?)```/g, (_, content: string) => {
        return buildItineraryHtml(content);
    });
}

/**
 * MarkdownをHTMLに変換 (KaTeX数式レンダリング + Shikiシンタックスハイライト対応)
 */
export async function markdownToHtml(markdown: string): Promise<string> {
    // itinerary ブロックを先にHTMLへ変換(shikiに渡す前に処理する)
    const preprocessed = processItineraryBlocks(markdown);
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

    return await marked(preprocessed);
}

/**
 * すべての記事を読み込む
 */
export function loadAllPosts(postsDir: string, excludeDirs: string[] = ['samples']): Post[] {
    const markdownFiles = getAllMarkdownFiles(postsDir, excludeDirs);
    return markdownFiles.map(parseMarkdownFile);
}
