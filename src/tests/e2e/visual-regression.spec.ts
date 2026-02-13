import { _electron as electron, ElectronApplication, expect, Page, test } from '@playwright/test';

test.describe('Visual Regression', () => {
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

    test('main window baseline screenshot', async () => {
        await expect(window).toHaveScreenshot('main-window.png', {
            maxDiffPixels: 200
        });
    });

    test('settings visual baseline', async () => {
        const settingsButton = window.getByTestId('settings-button');
        await settingsButton.click();
        await window.waitForTimeout(300);
        await expect(window).toHaveScreenshot('settings-window.png', {
            maxDiffPixels: 250
        });
    });
});
