import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'TextareaVim',
    version: '0.4.0',
    description: 'ブラウザの入力欄をCodeMirror上のVim操作で編集する拡張機能',
  },
  vite: function configureVite() {
    return {
      build: {
        minify: 'esbuild',
        target: 'es2020',
      },
      esbuild: {
        charset: 'ascii',
        legalComments: 'none',
      },
    };
  },
});
