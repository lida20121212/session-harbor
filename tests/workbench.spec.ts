import { expect, test } from '@playwright/test';

test('account lifecycle, blocked handoff and retained history', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByText('浏览器预览', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/workbench-empty.png', fullPage: true });
  await page.getByRole('button', { name: '添加账号档案', exact: true }).first().click();
  await page.getByRole('textbox', { name: /账号别名/ }).fill('日常开发');
  await page.getByRole('textbox', { name: /备注/ }).fill('无秘密的界面测试档案');
  await page.getByRole('button', { name: '保存档案' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /日常开发.*身份未核验/ })).toBeVisible();
  await page.getByRole('button', { name: '编辑档案' }).click();
  await page.getByRole('textbox', { name: /账号别名/ }).fill('个人开发');
  await page.getByRole('button', { name: '保存档案' }).click();
  await page.getByRole('button', { name: '记录接续预检' }).click();
  await expect(page.getByText('接续预检已阻塞', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '等待 Desktop 适配验证' })).toBeDisabled();
  await page.screenshot({ path: 'test-results/workbench-account.png', fullPage: true });
  await page.getByRole('button', { name: '取消这次预检' }).click();
  await expect(page.getByRole('button', { name: '记录接续预检' })).toBeEnabled();
  await page.getByRole('button', { name: '记录接续预检' }).click();
  await page.getByRole('button', { name: '删除档案', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '删除档案', exact: true }).click();
  await expect(page.getByText('为你的第一个账号留个位置')).toBeVisible();
  await page.getByRole('button', { name: '接续记录', exact: true }).click();
  await expect(page.getByText('已取消', { exact: true })).toHaveCount(2);
  await expect(page.getByText('个人开发', { exact: true })).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('duplicate validation, keyboard cancel, preview clears on refresh', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '添加账号档案', exact: true }).first().click();
  await page.getByRole('textbox', { name: /账号别名/ }).fill('Work');
  await page.getByRole('button', { name: '保存档案' }).click();
  await page.getByRole('button', { name: '添加账号档案', exact: true }).click();
  await page.getByRole('textbox', { name: /账号别名/ }).fill('work');
  await page.getByRole('button', { name: '保存档案' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toHaveText('这个账号名称已存在。');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '添加账号档案', exact: true })).toBeFocused();
  await page.reload();
  await expect(page.getByText('为你的第一个账号留个位置')).toBeVisible();
});

test('mobile layout and honest browser environment result', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: '记录接续预检' })).toBeDisabled();
  await page.getByRole('button', { name: '检测环境', exact: true }).click();
  await expect(page.getByText('浏览器预览无法检测本机安装，请在桌面应用中检查。')).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/workbench-mobile.png', fullPage: true });
});

test.describe('timezone consistency in browser preview', () => {
  test.use({ timezoneId: 'Asia/Shanghai' });

  test('shows the observation source, validates expectation, and clears it on refresh', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '本机环境' }).click();
    await page.getByRole('button', { name: '检测环境', exact: true }).click();
    await expect(page.getByText('Asia/Shanghai', { exact: true })).toBeVisible();
    await expect(page.getByText('当前浏览器报告的本地时区', { exact: false })).toBeVisible();
    await expect(page.getByText('UTC+08:00', { exact: true })).toBeVisible();
    const expected = page.getByRole('textbox', { name: /你期望使用的时区/ });
    await expected.fill('Invalid/Zone');
    await expect(page.getByText('输入无效', { exact: true })).toBeVisible();
    await expected.fill('Europe/London');
    await expect(page.getByText('不一致', { exact: true })).toBeVisible();
    await expected.fill('Asia/Shanghai');
    await expect(page.getByText('一致', { exact: true })).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: '本机环境' }).click();
    await expect(page.getByRole('textbox', { name: /你期望使用的时区/ })).toHaveValue('');
    await expect(page.getByText('未判定', { exact: true })).toBeVisible();
  });
});

test.describe('native IPC failure boundary', () => {
  test.use({ timezoneId: 'Asia/Shanghai' });

  test('keeps independently observed timezone visible while reporting an installation IPC error', async ({ page }) => {
    await page.addInitScript(() => {
      Object.assign(window, {
        isTauri: true,
        __TAURI_INTERNALS__: {
          invoke: (command: string) => Promise.reject(new Error(`IPC ${command} failed`)),
        },
      });
    });
    await page.goto('/');
    await page.getByRole('button', { name: '本机环境' }).click();
    await page.getByRole('button', { name: '检测环境', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('IPC inspect_environment failed');
    await expect(page.getByText('Asia/Shanghai', { exact: true })).toBeVisible();
    await expect(page.getByText('UTC+08:00', { exact: true })).toBeVisible();
    await expect(page.getByText('浏览器预览', { exact: true })).toHaveCount(0);
  });
});
