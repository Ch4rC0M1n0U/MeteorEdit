import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
  plugins: [vue()],
  define: {
    'process.env': {},
  },
  resolve: {
    alias: {
      '@excalidraw/excalidraw/index.css': path.resolve(
        __dirname,
        'node_modules/@excalidraw/excalidraw/dist/prod/index.css'
      ),
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', '@excalidraw/excalidraw'],
  },
});
