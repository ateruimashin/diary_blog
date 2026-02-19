import { defineConfig } from 'vite';
import devServer from '@hono/vite-dev-server';
import ssg from '@hono/vite-ssg';

export default defineConfig({
    plugins: [
        devServer({
            entry: 'src/index.ts',
        }),
        ssg({
            entry: 'src/index.ts',
        }),
    ],
});
