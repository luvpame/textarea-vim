import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const outputPath = process.env.WXT_OUTPUT_DIR
  ? path.resolve(process.env.WXT_OUTPUT_DIR)
  : fileURLToPath(new URL('../.output/chrome-mv3/', import.meta.url));

try {
  await access(path.join(outputPath, 'manifest.json'));
} catch {
  throw new Error(
    `WXTのChrome MV3出力がありません: ${outputPath}。先に npm run build を実行してください`,
  );
}

const manifest = JSON.parse(await readFile(path.join(outputPath, 'manifest.json'), 'utf8'));
if (manifest.manifest_version !== 3) {
  throw new Error(
    `Chrome MV3 manifestではありません: manifest_version=${manifest.manifest_version}`,
  );
}
if (!Array.isArray(manifest.content_scripts) || manifest.content_scripts.length === 0) {
  throw new Error('生成manifestにcontent_scriptsがありません');
}

async function listFiles(directory, extension) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async function visit(entry) {
      const entryPath = path.join(directory, entry.name);
      return entry.isDirectory() ? listFiles(entryPath, extension) : [entryPath];
    }),
  );
  return files.flat().filter(function hasExtension(file) {
    return file.endsWith(extension);
  });
}

const htmlFiles = await listFiles(outputPath, '.html');
for (const htmlFile of htmlFiles) {
  const html = await readFile(htmlFile, 'utf8');
  if (/\brel\s*=\s*["']modulepreload["']/i.test(html)) {
    throw new Error(
      `${path.relative(outputPath, htmlFile)}にmodulepreloadリンクがあります。` +
        'Chrome拡張ページではmodulepreloadを無効にしてください',
    );
  }
}

const checks = [
  [/\beval\s*\(/, 'eval'],
  [/\bnew\s+Function\b/, 'new Function'],
  [/\bhttps?:\/\//, 'remote URL'],
];

function findUnicodeNoncharacter(source) {
  for (const character of source) {
    const codePoint = character.codePointAt(0);
    if (
      codePoint !== undefined &&
      ((codePoint >= 0xfdd0 && codePoint <= 0xfdef) || (codePoint & 0xffff) >= 0xfffe)
    ) {
      return codePoint;
    }
  }
  return null;
}

const bundleFiles = await listFiles(outputPath, '.js');
if (bundleFiles.length === 0) {
  throw new Error(`生成出力にJavaScriptバンドルがありません: ${outputPath}`);
}
for (const bundleFile of bundleFiles) {
  const bundle = await readFile(bundleFile, 'utf8');
  const noncharacter = findUnicodeNoncharacter(bundle);
  if (noncharacter !== null) {
    throw new Error(
      `${path.relative(outputPath, bundleFile)}にChromeが拒否するUnicode非文字U+${noncharacter
        .toString(16)
        .toUpperCase()}があります`,
    );
  }
  const withoutSvgNamespace = bundle.replaceAll('http://www.w3.org/2000/svg', '');
  for (const [pattern, label] of checks) {
    const source = label === 'remote URL' ? withoutSvgNamespace : bundle;
    if (pattern.test(source)) {
      throw new Error(`${path.relative(outputPath, bundleFile)}に禁止された${label}参照があります`);
    }
  }
}

console.log(
  `bundle scan: ${bundleFiles.length} files contain no executable strings, remote URLs, or Unicode noncharacters`,
);
