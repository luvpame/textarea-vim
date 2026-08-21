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

async function closeBrowser(runningBrowser: RunningBrowser | undefined): Promise<void> {
  if (!runningBrowser) {
    return;
  }
  try {
    await runningBrowser.browser.close();
  } finally {
    if (runningBrowser.childProcess.exitCode === null) {
      runningBrowser.childProcess.kill();
    }
    await rm(runningBrowser.userDataDirectory, { force: true, recursive: true });
  }
}

test.beforeAll(async function startFixtureServer(): Promise<void> {
  server = createServer(function serveFixture(_request, response): void {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(`<!doctype html>
      <html lang="ja">
        <body>
          <label for="editor">本文</label>
          <textarea id="editor" rows="4">hello</textarea>
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
    const browserSession = await runningBrowser.browser.newBrowserCDPSession();
    await browserSession.send('Extensions.loadUnpacked', {
      path: extensionPath,
      enableInIncognito: false,
    });
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
