import type { TagDefinition } from '../types/tag';
import rawTags from '../content/tags.json';

const TAG_DEFINITIONS: TagDefinition[] = rawTags as TagDefinition[];

/** id (連番) → TagDefinition のマップ */
const TAG_MAP = new Map<number, TagDefinition>(
    TAG_DEFINITIONS.map((tag) => [tag.id, tag])
);

/**
 * id (連番) からタグ定義を取得する
 */
export function findTagById(id: number): TagDefinition | undefined {
    return TAG_MAP.get(id);
}

/**
 * key (frontmatter 文字列) からタグ定義を取得する
 */
export function findTagByKey(key: string): TagDefinition | undefined {
    return TAG_DEFINITIONS.find((tag) => tag.key === key);
}

/**
 * key が有効かどうかを検証する
 */
export function isValidTagKey(key: string): boolean {
    return TAG_DEFINITIONS.some((tag) => tag.key === key);
}

/**
 * 無効な key の一覧を返す
 */
export function getInvalidTagKeys(keys: string[]): string[] {
    return keys.filter((k) => !isValidTagKey(k));
}

/**
 * key のリストから表示名のリストに変換する
 * (未定義の key はそのまま返す)
 */
export function tagKeysToLabels(keys: string[]): string[] {
    return keys.map((k) => findTagByKey(k)?.label ?? k);
}

// ─── ツリー表示用 ───────────────────────────────────────────────────────────

export interface FlatTagWithPath extends TagDefinition {
    displayPath: string;
    depth: number;
}

/**
 * 親子関係を id 参照で解決しながら DFS でツリー順に展開する。
 * children を持たないタグは children 参照元から再帰的に辿る。
 * ルートタグ = 他のどのタグの children にも含まれていないタグ。
 */
export function flattenTagsWithPath(): FlatTagWithPath[] {
    // ルートタグ (parentId を持たないもの)
    const roots = TAG_DEFINITIONS.filter((tag) => tag.parentId === undefined);

    // parentId ごとの子リスト
    const childrenMap = new Map<number, TagDefinition[]>();
    for (const tag of TAG_DEFINITIONS) {
        if (tag.parentId !== undefined) {
            const siblings = childrenMap.get(tag.parentId) ?? [];
            siblings.push(tag);
            childrenMap.set(tag.parentId, siblings);
        }
    }

    const result: FlatTagWithPath[] = [];

    function traverse(tag: TagDefinition, parentPath: string, depth: number) {
        const displayPath = parentPath ? `${parentPath} > ${tag.label}` : tag.label;
        result.push({ ...tag, displayPath, depth });
        for (const child of childrenMap.get(tag.id) ?? []) {
            traverse(child, displayPath, depth + 1);
        }
    }

    for (const root of roots) {
        traverse(root, '', 0);
    }

    return result;
}
