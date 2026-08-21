import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'TextareaVim',
    version: '0.4.0',
    description: 'ブラウザの入力欄をCodeMirror上のVim操作で編集する拡張機能',
    icons: {
      '16': 'icons/16.png',
      '32': 'icons/32.png',
      '48': 'icons/48.png',
      '128': 'icons/128.png',
    },
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
