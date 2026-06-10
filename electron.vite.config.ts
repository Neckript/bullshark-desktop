import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  main: { build: { rollupOptions: { input: resolve('src/main/index.ts') } } },
  preload: {
    build: {
      rollupOptions: {
        input: {
          shell: resolve('src/preload/shell.ts'),
          bridge: resolve('src/preload/bridge.ts')
        }
      }
    }
  },
  renderer: {
    root: 'src/renderer',
    build: { rollupOptions: { input: resolve('src/renderer/index.html') } },
    plugins: [react()]
  }
});
