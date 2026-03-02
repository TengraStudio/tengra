import { _electron as electron, ElectronApplication, expect, Page, test } from '@playwright/test';

test.describe('Model Selector Visual Regression', () => {
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

    test('model selector closed state', async () => {
        const modelSelector = window.getByTestId('model-selector');
        await expect(modelSelector).toBeVisible();
        await expect(modelSelector).toHaveScreenshot('model-selector-closed.png', {
            maxDiffPixels: 150
        });
    });

    test('model selector opened dropdown', async () => {
        const modelSelector = window.getByTestId('model-selector');
        await modelSelector.click();
        await window.waitForTimeout(500);
        await expect(window).toHaveScreenshot('model-selector-opened.png', {
            maxDiffPixels: 300
        });
    });

    test('model selector dismiss on escape', async () => {
        await window.keyboard.press('Escape');
        await window.waitForTimeout(300);
        const modelSelector = window.getByTestId('model-selector');
        await expect(modelSelector).toHaveScreenshot('model-selector-dismissed.png', {
            maxDiffPixels: 150
        });
    });
});
