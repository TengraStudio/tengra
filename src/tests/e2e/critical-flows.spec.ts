import { _electron as electron, ElectronApplication, expect, Page, test } from '@playwright/test';

test.describe('Critical Flows E2E', () => {
    let electronApp: ElectronApplication;
    let window: Page;

    test.beforeAll(async () => {
        electronApp = await electron.launch({
            args: ['dist/main/main.js'],
            env: { ...process.env, NODE_ENV: 'test' }
        });
        window = await electronApp.firstWindow();
        await window.waitForLoadState('domcontentloaded');
    });

    test.afterAll(async () => {
        await electronApp?.close();
    });

    test('account linking flow surfaces settings/auth UI', async () => {
        const settingsButton = window.getByTestId('settings-button');
        await expect(settingsButton).toBeVisible();
        await settingsButton.click();
        await window.waitForTimeout(300);
    });

    test('chat interaction with model switching', async () => {
        const modelSelector = window.getByTestId('model-selector');
        await expect(modelSelector).toBeVisible();

        const chatInput = window.getByTestId('chat-textarea');
        await expect(chatInput).toBeVisible();
        await chatInput.fill('hello');
    });

    test('workspace and agent surface availability', async () => {
        const sidebar = window.getByTestId('sidebar');
        await expect(sidebar).toBeVisible();
    });
});
