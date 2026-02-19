// 移行元コメントの型定義

export interface Comment {
    id: number;
    postSlug: string;
    postTitle: string;
    author: string;
    date: string; // YYYY-MM-DD形式
    content: string;
}

// legacy-comments.json の型
export type LegacyComments = Comment[];
