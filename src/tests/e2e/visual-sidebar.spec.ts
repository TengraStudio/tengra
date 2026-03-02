import { _electron as electron, ElectronApplication, expect, Page, test } from '@playwright/test';

test.describe('Sidebar Visual Regression', () => {
    let electronApp: ElectronApplication;
    let window: Page;

    test.beforeAll(async () => {
        electronApp = await electron.launch({
            args: ['dist/main/main.js'],
            env: { ...process.env, NODE_ENV: 'test' }
        });
        window = await electronApp.firstWindow();
        await window.waitForLoadState('domcontentloaded');
        await window.waitForTimeout(1000);
    });

    test.afterAll(async () => {
        await electronApp?.close();
    });

    test('sidebar expanded default state', async () => {
        const sidebar = window.getByTestId('sidebar');
        await expect(sidebar).toBeVisible();
        await expect(sidebar).toHaveScreenshot('sidebar-expanded.png', {
            maxDiffPixels: 200
        });
    });

    test('sidebar with new chat button visible', async () => {
        const newChatButton = window.getByTestId('new-chat-button');
        await expect(newChatButton).toBeVisible();
        await expect(newChatButton).toHaveScreenshot('sidebar-new-chat-button.png', {
            maxDiffPixels: 100
        });
    });

    test('sidebar footer with settings button', async () => {
        const settingsButton = window.getByTestId('settings-button');
        await expect(settingsButton).toBeVisible();
        await expect(settingsButton).toHaveScreenshot('sidebar-settings-button.png', {
            maxDiffPixels: 100
        });
    });

    test('sidebar after creating a new chat entry', async () => {
        const newChatButton = window.getByTestId('new-chat-button');
        await newChatButton.click();
        await window.waitForTimeout(500);

        const sidebar = window.getByTestId('sidebar');
        await expect(sidebar).toHaveScreenshot('sidebar-after-new-chat.png', {
            maxDiffPixels: 250
        });
    });
});
