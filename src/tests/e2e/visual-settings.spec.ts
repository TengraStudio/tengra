import { _electron as electron, ElectronApplication, expect, Page, test } from '@playwright/test';

test.describe('Settings Panel Visual Regression', () => {
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

    test('settings panel opened via button', async () => {
        const settingsButton = window.getByTestId('settings-button');
        await settingsButton.click();
        await window.waitForTimeout(500);

        await expect(window).toHaveScreenshot('settings-panel-default.png', {
            maxDiffPixels: 250
        });
    });

    test('settings general tab', async () => {
        const generalTab = window.getByRole('tab', { name: /general/i }).first();
        if (await generalTab.isVisible()) {
            await generalTab.click();
            await window.waitForTimeout(300);
        }
        await expect(window).toHaveScreenshot('settings-general-tab.png', {
            maxDiffPixels: 250
        });
    });

    test('settings appearance tab', async () => {
        const appearanceTab = window.getByRole('tab', { name: /appearance|theme/i }).first();
        if (await appearanceTab.isVisible()) {
            await appearanceTab.click();
            await window.waitForTimeout(300);
        }
        await expect(window).toHaveScreenshot('settings-appearance-tab.png', {
            maxDiffPixels: 250
        });
    });

    test('settings models tab', async () => {
        const modelsTab = window.getByRole('tab', { name: /model/i }).first();
        if (await modelsTab.isVisible()) {
            await modelsTab.click();
            await window.waitForTimeout(300);
        }
        await expect(window).toHaveScreenshot('settings-models-tab.png', {
            maxDiffPixels: 250
        });
    });

    test('settings accounts tab', async () => {
        const accountsTab = window.getByRole('tab', { name: /account/i }).first();
        if (await accountsTab.isVisible()) {
            await accountsTab.click();
            await window.waitForTimeout(300);
        }
        await expect(window).toHaveScreenshot('settings-accounts-tab.png', {
            maxDiffPixels: 250
        });
    });

    test('settings panel close restores main view', async () => {
        await window.keyboard.press('Escape');
        await window.waitForTimeout(300);
        await expect(window).toHaveScreenshot('settings-closed-main-view.png', {
            maxDiffPixels: 200
        });
    });
});
