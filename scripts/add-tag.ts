import * as fs from "fs";
import * as path from "path";
import input from "@inquirer/input";
import select from "@inquirer/select";
import confirm from "@inquirer/confirm";
import { flattenTagsWithPath } from "../src/utils/tags";
import type { TagDefinition } from "../src/types/tag";

const TAGS_FILE = path.join(process.cwd(), "src/content/tags.json");

function loadTags(): TagDefinition[] {
    const raw = fs.readFileSync(TAGS_FILE, "utf8");
    return JSON.parse(raw) as TagDefinition[];
}

function saveTags(tags: TagDefinition[]): void {
    fs.writeFileSync(TAGS_FILE, JSON.stringify(tags, null, 4) + "\n", "utf8");
}

function nextId(tags: TagDefinition[]): number {
    return tags.length === 0 ? 1 : Math.max(...tags.map((t) => t.id)) + 1;
}

function isKeyDuplicate(tags: TagDefinition[], key: string): boolean {
    return tags.some((t) => t.key === key);
}

function toKebab(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

/**
 * 親タグをグラフィカルに選択させる。
 * "なし (ルートタグとして追加)" を先頭に追加する。
 */
async function selectParent(tags: TagDefinition[]): Promise<number | undefined> {
    const flatTags = flattenTagsWithPath();

    const NO_PARENT = "__none__";

    const choice = await select({
        message: "親タグを選択してください:",
        choices: [
            {
                name: "(なし) ルートタグとして追加",
                value: NO_PARENT,
                description: "親タグを持たないトップレベルのタグとして追加します",
            },
            ...flatTags.map((tag) => ({
                name: `${"  ".repeat(tag.depth)}${tag.displayPath}`,
                value: String(tag.id),
                description: tag.description,
            })),
        ],
        pageSize: 20,
    });

    if (choice === NO_PARENT) return undefined;
    return Number(choice);
}

async function main() {
    console.log("\n=== タグ追加 ===\n");

    const tags = loadTags();

    const label = await input({
        message: "タグ名 (表示名):",
        validate: (v) => v.trim() !== "" || "タグ名は必須です。",
    });

    const suggestedKey = toKebab(label);
    const key = await input({
        message: "キー (frontmatter 用):",
        default: suggestedKey,
        validate: (v) => {
            if (v.trim() === "") return "キーは必須です。";
            if (!/^[a-z0-9-]+$/.test(v)) return "キーは小文字英数字とハイフンのみ使用できます。";
            if (isKeyDuplicate(tags, v)) return `キー "${v}" は既に存在します。`;
            return true;
        },
    });

    const description = await input({
        message: "説明:",
        default: "",
        validate: (v) => v.trim() !== "" || "説明は必須です。",
    });

    const parentId = await selectParent(tags);

    // 確認
    console.log("\n--- 追加内容の確認 ---");
    console.log(`  タグ名  : ${label}`);
    console.log(`  キー    : ${key}`);
    console.log(`  説明    : ${description}`);
    if (parentId !== undefined) {
        const parent = tags.find((t) => t.id === parentId);
        console.log(`  親タグ  : ${parent?.label ?? parentId} (id: ${parentId})`);
    } else {
        console.log("  親タグ  : なし (ルートタグ)");
    }
    console.log();

    const ok = await confirm({
        message: "このタグを追加しますか?",
        default: true,
    });

    if (!ok) {
        console.log("\nキャンセルしました。");
        process.exit(0);
    }

    // 新規タグを末尾に追加
    const newTag: TagDefinition = {
        id: nextId(tags),
        key,
        label,
        description,
        ...(parentId !== undefined ? { parentId } : {}),
    };

    tags.push(newTag);
    saveTags(tags);

    console.log(`\n追加しました: "${label}" (key: ${key}, id: ${newTag.id})`);
    if (parentId !== undefined) {
        const parent = tags.find((t) => t.id === parentId);
        console.log(`親タグ: ${parent?.label ?? parentId}`);
    }
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
