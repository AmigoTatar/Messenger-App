import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
    ],
    build: {
        minify: 'esbuild',
        sourcemap: false,
        rollupOptions: {
            input: {
                main: './index.html',
                sw: './public/firebase-messaging-sw.js',
            },
            output: {
                entryFileNames: (chunkInfo) => {
                    if (chunkInfo.name === 'sw') {
                        return '[name].js';
                    }
                    return 'assets/[name]-[hash].js';
                },
            },
        },
    },
    esbuild: {
        drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
    },
});