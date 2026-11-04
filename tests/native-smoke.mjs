// Windows-only smoke test against the built app, using a fresh process-local data directory.
// CDP is enabled only for this test process; normal application launches do not enable it.
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { resolve, join, dirname } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium, expect } from '@playwright/test';

if (process.platform !== 'win32') throw new Error('Native smoke currently supports Windows only.');
const exe = resolve(process.argv[2] ?? 'src-tauri/target/release/session-harbor.exe');
await mkdir('.tools', { recursive: true });
const data = await mkdtemp(resolve('.tools/native-smoke-'));
const server = createServer();
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
await new Promise(r => server.close(r));

async function launch() {
  const child = spawn(exe, [], {
    cwd: dirname(exe), windowsHide: true, stdio: 'ignore',
    env: { ...process.env, APPDATA: data, WEBVIEW2_USER_DATA_FOLDER: join(data, 'webview'),
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port} --remote-debugging-address=127.0.0.1` },
  });
  let launchError;
  child.on('error', error => { launchError = error; });
  let browser;
  try {
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      if (launchError) throw launchError;
      if (child.exitCode !== null) throw new Error(`Application exited before WebView attached: ${child.exitCode}`);
      try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout: 1_000 }); break; }
      catch { await delay(300); }
    }
    if (!browser) throw new Error('WebView2 remote debugging endpoint did not become ready.');
    const context = browser.contexts()[0];
    const page = context.pages()[0] ?? await context.waitForEvent('page', { timeout: 10_000 });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    return { child, browser, page };
  } catch (error) { await browser?.close(); child.kill(); throw error; }
}

async function stop(session) {
  await session.browser.close();
  session.child.kill();
  await delay(1_000);
}

let session = await launch();
try {
  const page = session.page;
  await expect(page.getByText('浏览器预览', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '添加账号档案', exact: true }).first().click();
  await page.getByRole('textbox', { name: /账号别名/ }).fill('Native smoke test');
  await page.getByRole('button', { name: '保存档案' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: '记录接续预检' }).click();
  await expect(page.getByText('接续预检已阻塞', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '检测环境', exact: true }).click();
  await expect(page.getByText(/最近检测/)).toBeVisible();
  await page.screenshot({ path: join(data, 'native-workbench.png'), fullPage: true });
  await stop(session);
  session = await launch();
  await expect(session.page.getByRole('button', { name: /Native smoke test.*身份未核验/ })).toBeVisible();
  await expect(session.page.getByText('接续预检已阻塞', { exact: true })).toBeVisible();
  await session.page.getByRole('button', { name: '删除档案', exact: true }).click();
  await session.page.getByRole('dialog').getByRole('button', { name: '删除档案', exact: true }).click();
  await expect(session.page.getByText('为你的第一个账号留个位置')).toBeVisible();
  await session.page.getByRole('button', { name: '接续记录', exact: true }).click();
  await expect(session.page.getByText('已取消', { exact: true })).toHaveCount(1);
  console.log('PASS: native IPC, SQLite persistence across process restart, blocked handoff, cancellation on delete, environment inspection.');
  console.log(`Isolated test evidence: ${data}`);
} finally { await stop(session); }
