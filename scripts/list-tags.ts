import * as fs from "fs";
import * as path from "path";
import { flattenTagsWithPath } from "../src/utils/tags";

// ─── ANSI カラーコード ──────────────────────────────────────────────────────

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const GRAY = "\x1b[90m";
const WHITE = "\x1b[97m";
const BG_CYAN = "\x1b[46m";

// ─── タグ使用数集計 ─────────────────────────────────────────────────────────

const POSTS_DIR = path.join(process.cwd(), "src/content/posts");

function countTagUsage(): Map<string, number> {
    const counts = new Map<string, number>();
    if (!fs.existsSync(POSTS_DIR)) return counts;

    const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith(".md"));

    for (const file of files) {
        const content = fs.readFileSync(path.join(POSTS_DIR, file), "utf8");

        // frontmatter の tags: [...] を抽出
        const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
        if (!match) continue;

        const fm = match[1];

        // draft: true はスキップ
        if (/draft:\s*true/i.test(fm)) continue;

        // tags: [tag1, tag2] または tags:\n  - tag1 形式に対応
        const inlineMatch = fm.match(/tags:\s*\[([^\]]*)\]/);
        const blockMatch = fm.match(/tags:\s*\n((?:\s+-\s+\S+\n?)+)/);

        let tagKeys: string[] = [];

        if (inlineMatch) {
            tagKeys = inlineMatch[1]
                .split(",")
                .map((t) => t.trim().replace(/['"]/g, ""))
                .filter(Boolean);
        } else if (blockMatch) {
            tagKeys = blockMatch[1]
                .split("\n")
                .map((line) => line.replace(/^\s+-\s+/, "").trim())
                .filter(Boolean);
        }

        for (const key of tagKeys) {
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }
    }

    return counts;
}

// ─── メイン処理 ─────────────────────────────────────────────────────────────

function main() {
    const flatTags = flattenTagsWithPath();
    const usageCounts = countTagUsage();

    const totalTags = flatTags.length;
    const totalPosts = new Set(
        [...usageCounts.values()].flatMap((_, i) => i)
    ).size;

    // ヘッダー
    console.log();
    console.log(
        `${BG_CYAN}${BOLD}  タグ一覧  ${RESET}  ${GRAY}${totalTags} 件のタグが登録されています${RESET}`
    );
    console.log();

    // カラム幅を計算
    const maxLabelWidth = Math.max(...flatTags.map((t) => t.label.length * 2 + t.depth * 2));
    const maxKeyWidth = Math.max(...flatTags.map((t) => t.key.length));

    // 各タグを表示
    for (const tag of flatTags) {
        const indent = "  ".repeat(tag.depth);
        const isRoot = tag.depth === 0;
        const count = usageCounts.get(tag.key) ?? 0;

        // ツリー記号
        const treePrefix = isRoot ? `${CYAN}❯${RESET} ` : `  ${GRAY}›${RESET} `;

        // ラベル (ルートは太字)
        const labelColor = isRoot ? `${BOLD}${WHITE}` : WHITE;
        const label = `${labelColor}${tag.label}${RESET}`;

        // キー
        const keyStr = `${GRAY}[${tag.key}]${RESET}`;

        // 使用数バッジ
        const countBadge =
            count > 0
                ? `${GREEN}${count} 記事${RESET}`
                : `${DIM}${GRAY}0 記事${RESET}`;

        // 説明
        const desc = `${GRAY}${tag.description}${RESET}`;

        // 行を出力
        console.log(`${indent}${treePrefix}${label}  ${keyStr}  ${countBadge}`);
        console.log(`${indent}    ${GRAY}${RESET}  ${desc}`);
    }

    // フッター
    console.log();
    const publishedCount = [...usageCounts.values()].reduce((a, b) => a + b, 0);
    console.log(
        `${DIM}${GRAY}─────────────────────────────────────────────────────────────${RESET}`
    );
    console.log(
        `${GRAY}公開記事でのタグ使用数合計: ${YELLOW}${publishedCount}${RESET}`
    );
    console.log();
}

main();
