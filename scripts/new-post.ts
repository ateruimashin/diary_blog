import * as fs from "fs";
import * as path from "path";
import input from "@inquirer/input";
import checkbox from "@inquirer/checkbox";
import confirm from "@inquirer/confirm";
import { flattenTagsWithPath } from "../src/utils/tags";

const POSTS_DIR = path.join(process.cwd(), "src/content/posts");

/**
 * タグ一覧をチェックボックス UI (fzf ライク検索付き) で複数選択させる
 */
async function selectTags(): Promise<string[]> {
    const allTags = flattenTagsWithPath();

    const selected = await checkbox({
        message: "タグを選択 (Space で選択・解除、/ で絞り込み検索、Enter で確定)",
        choices: allTags.map((tag) => ({
            name: `${"  ".repeat(tag.depth)}${tag.displayPath}`,
            value: tag.key,
            description: tag.description,
        })),
        pageSize: 20,
    });

    return selected;
}

function toSlug(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

function today(): string {
    const d = new Date();
    const yyyy = d.getFullYear();
    const MM = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const HH = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}-${MM}-${dd} ${HH}:${mm}`;
}

function isValidDate(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value) && !isNaN(Date.parse(value));
}

async function main() {
    console.log("\n=== 新規記事作成 ===\n");

    const title = await input({
        message: "タイトル:",
        validate: (v) => v.trim() !== "" || "タイトルは必須です。",
    });

    const suggestedSlug = toSlug(title);
    const slug = await input({
        message: "スラッグ:",
        default: suggestedSlug,
    });

    const date = await input({
        message: "日付 (YYYY-MM-DD HH:mm):",
        default: today(),
        validate: (v) => isValidDate(v) || "日付の形式が正しくありません (YYYY-MM-DD HH:mm)。",
    });

    const tags = await selectTags();

    const description = await input({
        message: "概要 (150-200文字推奨、省略可):",
        default: "",
    });

    const draft = await confirm({
        message: "下書きとして作成しますか?",
        default: true,
    });

    // フロントマター生成
    const tagsYaml =
        tags.length > 0
            ? `tags: [${tags.map((t) => `"${t}"`).join(", ")}]`
            : "tags: []";

    const descLine = description ? `description: "${description}"` : `description: ""`;

    const frontmatter = `---
title: "${title}"
date: ${date}
slug: ${slug}
draft: ${draft}
${tagsYaml}
${descLine}
---

`;

    // ファイルパス: {yyyy-MM-dd}_{slug}.md
    const dateOnly = date.split(" ")[0];
    const fileName = `${dateOnly}_${slug}.md`;
    const filePath = path.join(POSTS_DIR, fileName);

    if (fs.existsSync(filePath)) {
        console.error(`\nエラー: ファイルが既に存在します: ${filePath}`);
        process.exit(1);
    }

    fs.mkdirSync(POSTS_DIR, { recursive: true });
    fs.writeFileSync(filePath, frontmatter, "utf8");

    console.log(`\n作成しました: src/content/posts/${fileName}`);
    console.log(`ステータス: ${draft ? "下書き (draft: true)" : "公開 (draft: false)"}`);
}

main().catch((err) => {
    // Ctrl+C による強制終了は正常終了として扱う
    if (err?.name === "ExitPromptError") {
        console.log("\nキャンセルしました。");
        process.exit(0);
    }
    console.error(err);
    process.exit(1);
});
