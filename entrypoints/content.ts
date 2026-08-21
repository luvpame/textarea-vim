import { defineContentScript } from 'wxt/utils/define-content-script';
import { initializeTextareaVim } from '../src/content';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    initializeTextareaVim();
  },
});
