export interface PostMetadata {
    title: string;
    date: string;
    slug: string;
    tags?: string[];
    description?: string;
    draft?: boolean;  // true = 下書き、false or undefined = 公開
    image?: string;   // OGP画像など
}

export interface Post {
    metadata: PostMetadata | null;
    content: string;
    excerpt?: string;
}
