import type { LegacyComments } from '../types/comment';
import * as fs from 'fs';
import * as path from 'path';

/**
 * legacy-comments.jsonを読み込む
 */
export function loadLegacyComments(commentsFilePath: string): LegacyComments {
    if (!fs.existsSync(commentsFilePath)) {
        return [];
    }

    const fileContent = fs.readFileSync(commentsFilePath, 'utf-8');
    return JSON.parse(fileContent);
}
