import { readFile } from 'node:fs/promises';

const bundle = await readFile(new URL('../extension/content.js', import.meta.url), 'utf8');
const withoutSvgNamespace = bundle.replaceAll('http://www.w3.org/2000/svg', '');
const checks = [
  [/\beval\s*\(/, 'eval'],
  [/\bnew\s+Function\b/, 'new Function'],
  [/\bhttps?:\/\//, 'remote URL'],
];

for (const [pattern, label] of checks) {
  if (pattern.test(label === 'remote URL' ? withoutSvgNamespace : bundle)) {
    throw new Error(`禁止された${label}参照が生成バンドルにあります`);
  }
}

console.log('bundle scan: no eval, new Function, or remote URL reference');
