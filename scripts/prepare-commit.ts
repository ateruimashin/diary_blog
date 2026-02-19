import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import * as fs from "fs";
import * as path from "path";
import { glob } from "glob";

const S3 = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
});

const BUCKET_NAME = "diary-blog-images";
const R2_DOMAIN = "https://r2.diary.ateruimashin.com";
const IMAGE_DIR = path.join(process.cwd(), "public/images");
const CONTENT_DIR = path.join(process.cwd(), "src/content/posts");

// R2に画像が既に存在するかチェック
async function existsInR2(key: string): Promise<boolean> {
    try {
        const command = new HeadObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
        });
        await S3.send(command);
        return true;
    } catch (error: any) {
        if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
            return false;
        }
        throw error;
    }
}

// 画像をR2にアップロード
async function uploadImage(filePath: string): Promise<string> {
    const relativePath = path.relative(IMAGE_DIR, filePath).replace(/\\/g, "/");
    const key = relativePath;

    // 既にアップロード済みかチェック
    if (await existsInR2(key)) {
        console.log(`⏭  Skipped (already exists): ${key}`);
        return `${R2_DOMAIN}/${key}`;
    }

    const fileContent = fs.readFileSync(filePath);
    const contentType = getContentType(filePath);

    const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: fileContent,
        ContentType: contentType,
    });

    await S3.send(command);
    console.log(`✓ Uploaded: ${key}`);

    return `${R2_DOMAIN}/${key}`;
}

function getContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const types: Record<string, string> = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
    };
    return types[ext] || "application/octet-stream";
}

// Markdown内の画像パスを置き換え
async function replaceImagePaths(mdPath: string, imageMap: Map<string, string>) {
    let content = fs.readFileSync(mdPath, "utf-8");
    let modified = false;

    // ![alt](./images/...) または ![alt](../images/...) 形式を検出
    const imageRegex = /!\[([^\]]*)\]\((\.\.?\/images\/[^)]+)\)/g;

    content = content.replace(imageRegex, (match, alt, imagePath) => {
        // 相対パスを正規化
        const normalizedPath = imagePath.replace(/^\.\.?\/images\//, "");
        const r2Url = imageMap.get(normalizedPath);

        if (r2Url) {
            modified = true;
            console.log(`  ${imagePath} → ${r2Url}`);
            return `![${alt}](${r2Url})`;
        }
        return match;
    });

    if (modified) {
        fs.writeFileSync(mdPath, content, "utf-8");
        console.log(`✓ Updated: ${path.basename(mdPath)}`);
    }
}

// Markdown内の未アップロード画像だけを検出
async function getUnprocessedImages(): Promise<string[]> {
    const mdFiles = await glob("**/*.md", {
        cwd: CONTENT_DIR,
        absolute: true,
    });

    const imagePathsInMarkdown = new Set<string>();

    for (const mdPath of mdFiles) {
        const content = fs.readFileSync(mdPath, "utf-8");
        const imageRegex = /!\[([^\]]*)\]\((\.\.?\/images\/[^)]+)\)/g;

        let match;
        while ((match = imageRegex.exec(content)) !== null) {
            const imagePath = match[2].replace(/^\.\.?\/images\//, "");
            imagePathsInMarkdown.add(imagePath);
        }
    }

    // 実際にファイルが存在する画像のみを返す
    const existingImages: string[] = [];
    for (const imagePath of imagePathsInMarkdown) {
        const fullPath = path.join(IMAGE_DIR, imagePath);
        if (fs.existsSync(fullPath)) {
            existingImages.push(fullPath);
        }
    }

    return existingImages;
}

async function main() {
    console.log("📤 Checking images to upload...\n");

    // Markdown内で参照されている画像のみを対象にする
    const imageFiles = await getUnprocessedImages();

    if (imageFiles.length === 0) {
        console.log("ℹ️  No images to process.");
        return;
    }

    // 画像をアップロードしてマッピングを作成
    const imageMap = new Map<string, string>();
    let uploadCount = 0;
    let skipCount = 0;

    for (const imagePath of imageFiles) {
        const relativePath = path.relative(IMAGE_DIR, imagePath).replace(/\\/g, "/");
        const exists = await existsInR2(relativePath);
        const r2Url = await uploadImage(imagePath);
        imageMap.set(relativePath, r2Url);

        if (exists) {
            skipCount++;
        } else {
            uploadCount++;
        }
    }

    console.log(`\n📊 Upload summary: ${uploadCount} uploaded, ${skipCount} skipped`);
    console.log("\n📝 Updating markdown files...\n");

    // 全てのMarkdownファイルを取得
    const mdFiles = await glob("**/*.md", {
        cwd: CONTENT_DIR,
        absolute: true,
    });

    // Markdownファイル内のパスを置き換え
    for (const mdPath of mdFiles) {
        await replaceImagePaths(mdPath, imageMap);
    }

    console.log("\n✅ Done! You can now commit your changes.");
}

main().catch(console.error);
