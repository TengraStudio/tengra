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

test.describe('Settings Panel Visual Regression', () => {
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

    test('settings panel opened via button', async () => {
        await openSettingsPanel(window);

        await expect(window).toHaveScreenshot('settings-panel-default.png', {
            maxDiffPixels: 250
        });
    });

    test('settings general tab', async () => {
        const generalTab = window.getByRole('tab', { name: /general/i }).first();
        if (await generalTab.isVisible()) {
            await generalTab.click();
            await expect(generalTab).toBeVisible();
        }
        await expect(window).toHaveScreenshot('settings-general-tab.png', {
            maxDiffPixels: 250
        });
    });

    test('settings appearance tab', async () => {
        const appearanceTab = window.getByRole('tab', { name: /appearance|theme/i }).first();
        if (await appearanceTab.isVisible()) {
            await appearanceTab.click();
            await expect(appearanceTab).toBeVisible();
        }
        await expect(window).toHaveScreenshot('settings-appearance-tab.png', {
            maxDiffPixels: 250
        });
    });

    test('settings models tab', async () => {
        const modelsTab = window.getByRole('tab', { name: /model/i }).first();
        if (await modelsTab.isVisible()) {
            await modelsTab.click();
            await expect(modelsTab).toBeVisible();
        }
        await expect(window).toHaveScreenshot('settings-models-tab.png', {
            maxDiffPixels: 250
        });
    });

    test('settings accounts tab', async () => {
        const accountsTab = window.getByRole('tab', { name: /account/i }).first();
        if (await accountsTab.isVisible()) {
            await accountsTab.click();
            await expect(accountsTab).toBeVisible();
        }
        await expect(window).toHaveScreenshot('settings-accounts-tab.png', {
            maxDiffPixels: 250
        });
    });

    test('settings panel close restores main view', async () => {
        await window.keyboard.press('Escape');
        await expect(window.locator('.settings-container')).not.toBeVisible();
        await expect(window).toHaveScreenshot('settings-closed-main-view.png', {
            maxDiffPixels: 200
        });
    });
});

