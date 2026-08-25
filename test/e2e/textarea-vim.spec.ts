import { type ChildProcess, spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { type Browser, type BrowserContext, expect, test } from '@playwright/test';
import { chromium } from 'playwright';

let server: Server;
let pageUrl: string;

type RunningBrowser = {
  browser: Browser;
  context: BrowserContext;
  childProcess: ChildProcess;
  userDataDirectory: string;
};

async function reservePort(): Promise<number> {
  const portServer = createServer();
  await new Promise<void>(function listen(resolve, reject): void {
    portServer.once('error', reject);
    portServer.listen(0, '127.0.0.1', resolve);
  });
  const address = portServer.address();
  await new Promise<void>(function close(resolve, reject): void {
    portServer.close(function handleClose(error): void {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
  if (!address || typeof address === 'string') {
    throw new Error('Could not reserve a TCP port for Chromium');
  }
  return address.port;
}

async function waitForCdpEndpoint(port: number, childProcess: ChildProcess): Promise<string> {
  const endpoint = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (childProcess.exitCode !== null) {
      throw new Error(`Chromium exited before CDP became ready: ${childProcess.exitCode}`);
    }
    try {
      const response = await fetch(`${endpoint}/json/version`);
      if (response.ok) {
        return endpoint;
      }
    } catch {
      await delay(50);
    }
  }
  throw new Error('Chromium CDP endpoint did not become ready');
}

async function launchBrowser(): Promise<RunningBrowser> {
  const executablePath =
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? chromium.executablePath();
  const userDataDirectory = await mkdtemp(path.join(tmpdir(), 'textarea-vim-e2e-'));
  const port = await reservePort();
  const childProcess = spawn(
    executablePath,
    [
      '--headless=new',
      '--no-first-run',
      '--no-default-browser-check',
      '--enable-unsafe-extension-debugging',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDirectory}`,
    ],
    { stdio: 'ignore' },
  );

  try {
    const browser = await chromium.connectOverCDP(await waitForCdpEndpoint(port, childProcess));
    const context = browser.contexts()[0];
    if (!context) {
      throw new Error('Chromium did not expose its default browser context');
    }
    return { browser, context, childProcess, userDataDirectory };
  } catch (error) {
    childProcess.kill();
    await rm(userDataDirectory, { force: true, recursive: true });
    throw error;
  }
}

async function waitForProcessExit(childProcess: ChildProcess): Promise<void> {
  if (childProcess.exitCode !== null || childProcess.signalCode !== null) {
    return;
  }

  await new Promise<void>(function wait(resolve): void {
    childProcess.once('exit', function handleExit(): void {
      resolve();
    });
    childProcess.once('error', function handleError(): void {
      resolve();
    });
  });
}

async function closeBrowser(runningBrowser: RunningBrowser | undefined): Promise<void> {
  if (!runningBrowser) {
    return;
  }
  try {
    await runningBrowser.browser.close();
  } finally {
    if (
      runningBrowser.childProcess.exitCode === null &&
      runningBrowser.childProcess.signalCode === null
    ) {
      runningBrowser.childProcess.kill();
    }
    await waitForProcessExit(runningBrowser.childProcess);
    await rm(runningBrowser.userDataDirectory, {
      force: true,
      maxRetries: 3,
      recursive: true,
      retryDelay: 100,
    });
  }
}

async function loadExtension(browser: Browser, extensionPath: string): Promise<string> {
  const browserSession = await browser.newBrowserCDPSession();
  const result = await browserSession.send('Extensions.loadUnpacked', {
    path: extensionPath,
    enableInIncognito: false,
  });
  if (!result || typeof result !== 'object' || !('id' in result) || typeof result.id !== 'string') {
    throw new Error('Chromium did not return the unpacked extension ID');
  }
  return result.id;
}

test.beforeAll(async function startFixtureServer(): Promise<void> {
  server = createServer(function serveFixture(_request, response): void {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(`<!doctype html>
      <html lang="ja">
        <style>
          #placeholder-editor {
            box-sizing: border-box;
            width: 450px;
            height: 208px;
            padding: 16px 12px 18px 20px;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            font: 28px/1.2 Arial, sans-serif;
            color: #5b6572;
            background: transparent;
            visibility: visible !important;
          }
        </style>
        <body>
          <label for="editor">本文</label>
          <textarea id="editor" rows="4">hello</textarea>
          <textarea id="placeholder-editor" rows="4" placeholder="Add your comment here..."></textarea>
          <script>
            window.inputCount = 0;
            window.changeCount = 0;
            const editor = document.querySelector('#editor');
            editor.addEventListener('input', () => { window.inputCount += 1; });
            editor.addEventListener('change', () => { window.changeCount += 1; });
          </script>
        </body>
      </html>`);
  });

  await new Promise<void>(function listen(resolve, reject): void {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('E2E fixture server did not expose a TCP port');
  }
  pageUrl = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async function stopFixtureServer(): Promise<void> {
  await new Promise<void>(function close(resolve, reject): void {
    server.close(function handleClose(error): void {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
});

test('textareaをVimで編集して元要素へ同期する', async function testEditingFlow(): Promise<void> {
  const extensionPath = path.resolve('.output/chrome-mv3');
  let runningBrowser: RunningBrowser | undefined;

  try {
    runningBrowser = await launchBrowser();
    await loadExtension(runningBrowser.browser, extensionPath);
    const page = await runningBrowser.context.newPage();
    await page.goto(pageUrl);
    await page.waitForLoadState('networkidle');

    const textarea = page.locator('#editor');
    await textarea.focus();
    await expect(page.locator('[aria-label="TextareaVim editor"]')).toBeVisible();

    await page.keyboard.press('i');
    await page.keyboard.type('X');
    await page.keyboard.press('Control+Enter');

    await expect(textarea).toHaveValue('Xhello');
    await expect(page.locator('[aria-label="TextareaVim editor"]')).toHaveCount(0);
    await expect
      .poll(async function readEventCounts(): Promise<{ input: number; change: number }> {
        return page.evaluate(function getEventCounts() {
          const state = window as unknown as Window & { inputCount: number; changeCount: number };
          return { input: state.inputCount, change: state.changeCount };
        });
      })
      .toEqual({ input: 1, change: 1 });
  } finally {
    await closeBrowser(runningBrowser);
  }
});

test('textareaのpaddingとplaceholderをCodeMirrorへ同期する', async function testPlaceholderAlignment(): Promise<void> {
  const extensionPath = path.resolve('.output/chrome-mv3');
  let runningBrowser: RunningBrowser | undefined;

  try {
    runningBrowser = await launchBrowser();
    await loadExtension(runningBrowser.browser, extensionPath);
    const page = await runningBrowser.context.newPage();
    await page.goto(pageUrl);
    await page.waitForLoadState('networkidle');

    const textarea = page.locator('#placeholder-editor');
    await textarea.focus();
    await expect(page.locator('[aria-label="TextareaVim editor"]')).toBeVisible();

    const alignment = await page.evaluate(function readPlaceholderAlignment() {
      const target = document.querySelector<HTMLTextAreaElement>('#placeholder-editor');
      const host = document.querySelector<HTMLDivElement>('[aria-label="TextareaVim editor"]');
      const shadow = host?.shadowRoot;
      const placeholder = shadow?.querySelector<HTMLElement>('.cm-placeholder');
      const cursor = shadow?.querySelector<HTMLElement>('.cm-fat-cursor.cm-cursor-primary');
      if (!target || !host || !shadow || !placeholder || !cursor) {
        throw new Error('TextareaVim placeholder or cursor was not rendered');
      }

      const targetStyle = getComputedStyle(target);
      const targetRect = target.getBoundingClientRect();
      const expectedLeft =
        targetRect.left +
        Number.parseFloat(targetStyle.borderLeftWidth) +
        Number.parseFloat(targetStyle.paddingLeft);
      const expectedTop =
        targetRect.top +
        Number.parseFloat(targetStyle.borderTopWidth) +
        Number.parseFloat(targetStyle.paddingTop);
      const placeholderRect = placeholder.getBoundingClientRect();
      const cursorRect = cursor.getBoundingClientRect();

      return {
        targetVisibility: targetStyle.visibility,
        placeholderText: placeholder.textContent,
        expectedLeft,
        expectedTop,
        placeholderLeft: placeholderRect.left,
        placeholderTop: placeholderRect.top,
        cursorLeft: cursorRect.left,
        cursorTop: cursorRect.top,
      };
    });

    expect(alignment.targetVisibility).toBe('hidden');
    expect(alignment.placeholderText).toBe('Add your comment here...');
    expect(Math.abs(alignment.placeholderLeft - alignment.expectedLeft)).toBeLessThanOrEqual(1);
    expect(Math.abs(alignment.placeholderTop - alignment.expectedTop)).toBeLessThanOrEqual(1);
    expect(Math.abs(alignment.cursorLeft - alignment.expectedLeft)).toBeLessThanOrEqual(1);
    expect(Math.abs(alignment.cursorTop - alignment.expectedTop)).toBeLessThanOrEqual(1);

    await page.keyboard.press('i');
    await page.keyboard.type('X');
    const inputAlignment = await page.evaluate(function readInputAlignment() {
      const target = document.querySelector<HTMLTextAreaElement>('#placeholder-editor');
      const host = document.querySelector<HTMLDivElement>('[aria-label="TextareaVim editor"]');
      const line = host?.shadowRoot?.querySelector<HTMLElement>('.cm-line');
      if (!target || !host?.shadowRoot || !line) {
        throw new Error('TextareaVim input line was not rendered');
      }

      const targetStyle = getComputedStyle(target);
      const targetRect = target.getBoundingClientRect();
      const expectedLeft =
        targetRect.left +
        Number.parseFloat(targetStyle.borderLeftWidth) +
        Number.parseFloat(targetStyle.paddingLeft);
      const expectedTop =
        targetRect.top +
        Number.parseFloat(targetStyle.borderTopWidth) +
        Number.parseFloat(targetStyle.paddingTop);
      const lineRect = line.getBoundingClientRect();
      return {
        text: line.textContent,
        left: lineRect.left,
        top: lineRect.top,
        expectedLeft,
        expectedTop,
      };
    });

    expect(inputAlignment.text).toBe('X');
    expect(Math.abs(inputAlignment.left - inputAlignment.expectedLeft)).toBeLessThanOrEqual(1);
    expect(Math.abs(inputAlignment.top - inputAlignment.expectedTop)).toBeLessThanOrEqual(1);
  } finally {
    await closeBrowser(runningBrowser);
  }
});

test('設定画面からINSERT終了キー列を変更する', async function testInsertExitKeySequenceSetting(): Promise<void> {
  const extensionPath = path.resolve('.output/chrome-mv3');
  let runningBrowser: RunningBrowser | undefined;

  try {
    runningBrowser = await launchBrowser();
    const extensionId = await loadExtension(runningBrowser.browser, extensionPath);
    const optionsPage = await runningBrowser.context.newPage();
    await optionsPage.goto(`chrome-extension://${extensionId}/options.html`);

    const keySequenceInput = optionsPage.locator('#insert-exit-key-sequence');
    await expect(keySequenceInput).toHaveValue('jj');
    await keySequenceInput.fill('jk');
    await optionsPage.getByRole('button', { name: '保存' }).click();
    await expect(optionsPage.locator('#settings-status')).toHaveText('保存しました。');

    const page = await runningBrowser.context.newPage();
    await page.goto(pageUrl);
    await page.waitForLoadState('networkidle');
    const textarea = page.locator('#editor');
    await textarea.focus();
    await page.keyboard.press('i');
    await page.keyboard.press('j');
    await page.keyboard.press('k');
    await page.keyboard.press('x');
    await page.keyboard.press('Control+Enter');
    await expect(textarea).toHaveValue('ello');

    await optionsPage.getByRole('button', { name: '既定値に戻す' }).click();
    await expect(keySequenceInput).toHaveValue('jj');
    await expect(optionsPage.locator('#settings-status')).toHaveText('既定値に戻しました。');

    await textarea.focus();
    await expect(page.locator('[aria-label="TextareaVim editor"]')).toBeVisible();
    await page.keyboard.press('i');
    await page.keyboard.press('j');
    await page.keyboard.press('j');
    await page.keyboard.press('x');
    await page.keyboard.press('Control+Enter');
    await expect(textarea).toHaveValue('llo');
  } finally {
    await closeBrowser(runningBrowser);
  }
});
