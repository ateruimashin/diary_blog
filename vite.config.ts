import { defineConfig } from 'vite';
import devServer from '@hono/vite-dev-server';
import ssg from '@hono/vite-ssg';

export default defineConfig({
    plugins: [
        devServer({
            entry: 'src/index.ts',
            exclude: [
                /^\/images\/.*/,
                /^\/styles\.css$/,
                /^\/@.*/,
                /^\/node_modules\/.*/,
            ],
        }),
        ssg({
            entry: 'src/index.ts',
        }),
    ],
});
