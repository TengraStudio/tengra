/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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

