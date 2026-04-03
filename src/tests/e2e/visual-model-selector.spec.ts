import { ElectronApplication, expect, Page, test } from '@playwright/test';

import { closeElectronApp, launchElectronApp, settleVisualState } from './e2e-test-utils';

test.describe('Model Selector Visual Regression', () => {
    let electronApp: ElectronApplication;
    let window: Page;

    test.beforeAll(async () => {
        const launched = await launchElectronApp();
        electronApp = launched.electronApp;
        window = launched.appWindow;
        await settleVisualState(window);
    });

    test.afterAll(async () => {
        await closeElectronApp(electronApp);
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
        await expect(window.locator('[role="dialog"], [class*="Modal"], [class*="modal"]').first().or(modelSelector)).toBeVisible();
        await expect(window).toHaveScreenshot('model-selector-opened.png', {
            maxDiffPixels: 300
        });
    });

    test('model selector dismiss on escape', async () => {
        await window.keyboard.press('Escape');
        const modelSelector = window.getByTestId('model-selector');
        await expect(modelSelector).toBeVisible();
        await expect(modelSelector).toHaveScreenshot('model-selector-dismissed.png', {
            maxDiffPixels: 150
        });
    });
});
