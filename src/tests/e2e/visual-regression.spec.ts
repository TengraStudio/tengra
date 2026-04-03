import { ElectronApplication, expect, Page, test } from '@playwright/test';

import {
    closeElectronApp,
    launchElectronApp,
    openSettingsPanel,
    settleVisualState
} from './e2e-test-utils';

test.describe('Visual Regression', () => {
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

    test('main window baseline screenshot', async () => {
        await expect(window).toHaveScreenshot('main-window.png', {
            maxDiffPixels: 200
        });
    });

    test('settings visual baseline', async () => {
        await openSettingsPanel(window);
        await expect(window).toHaveScreenshot('settings-window.png', {
            maxDiffPixels: 250
        });
    });
});
