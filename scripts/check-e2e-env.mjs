import { constants } from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const outputPath = process.env.WXT_OUTPUT_DIR
  ? path.resolve(process.env.WXT_OUTPUT_DIR)
  : path.resolve('.output/chrome-mv3');
const manifestPath = path.join(outputPath, 'manifest.json');

try {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (manifest.manifest_version !== 3) {
    throw new Error(`manifest_version=${manifest.manifest_version}`);
  }
} catch (error) {
  throw new Error(
    `E2E対象のChrome MV3出力を読めません: ${manifestPath}。先に npm run build を実行してください`,
    { cause: error },
  );
}

const configuredExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const executablePath = configuredExecutable || chromium.executablePath();
try {
  await access(executablePath, constants.X_OK);
} catch (error) {
  const source = configuredExecutable
    ? 'PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH'
    : 'Playwright管理のChromium';
  throw new Error(
    `${source}が見つからないか実行できません: ${executablePath}。` +
      '依存を導入していない場合は npm exec playwright install chromium を実行してください',
    { cause: error },
  );
}

console.log(`e2e environment: ${outputPath} with Chromium ${executablePath}`);
