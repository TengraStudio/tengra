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
    pressAppShortcut
} from './e2e-test-utils';

test.describe('Settings Panel E2E', () => {
    let electronApp: ElectronApplication;
    let appWindow: Page;

    test.beforeAll(async () => {
        const launched = await launchElectronApp();
        electronApp = launched.electronApp;
        appWindow = launched.appWindow;
        await expect(appWindow.getByRole('group', { name: /chat input/i })).toBeVisible({ timeout: 10000 });
    });

    test.afterAll(async () => {
        await closeElectronApp(electronApp);
    });

    test('should open settings panel via button', async () => {
        await openSettingsPanel(appWindow);
    });

    test('should display settings tabs', async () => {
        const settingsContainer = appWindow.locator('.settings-container');
        await expect(settingsContainer).toBeVisible();

        // Verify settings tab buttons are present
        const tabButtons = appWindow.locator('.settings-tab-btn');
        const tabCount = await tabButtons.count();
        expect(tabCount).toBeGreaterThan(0);
    });

    test('should navigate to appearance tab', async () => {
        const appearanceTab = appWindow.locator('#settings-tab-appearance');
        await expect(appearanceTab).toBeVisible();
        await appearanceTab.click();
        const appearancePanel = appWindow.locator('#settings-panel-appearance');
        await expect(appearancePanel).toBeVisible();
    });

    test('should navigate to general tab', async () => {
        const generalTab = appWindow.locator('#settings-tab-general');
        await expect(generalTab).toBeVisible();
        await generalTab.click();
        const generalPanel = appWindow.locator('#settings-panel-general');
        await expect(generalPanel).toBeVisible();
    });

    test('should navigate to advanced tab', async () => {
        const advancedTab = appWindow.locator('#settings-tab-advanced');
        await expect(advancedTab).toBeVisible();
        await advancedTab.click();
        const advancedPanel = appWindow.locator('#settings-panel-advanced');
        await expect(advancedPanel).toBeVisible();
    });

    test('should navigate to about tab', async () => {
        const aboutTab = appWindow.locator('#settings-tab-about');
        await expect(aboutTab).toBeVisible();
        await aboutTab.click();
        const aboutPanel = appWindow.locator('#settings-panel-about');
        await expect(aboutPanel).toBeVisible();
    });

    test('should close settings with Escape key', async () => {
        await expect(appWindow.locator('.settings-container')).toBeVisible();
        await appWindow.keyboard.press('Escape');
        await expect(appWindow.locator('.settings-container')).not.toBeVisible();
    });

    test('should reopen settings with keyboard shortcut', async () => {
        await pressAppShortcut(appWindow, ',');
        await expect(appWindow.locator('.settings-container')).toBeVisible();

        // Clean up
        await appWindow.keyboard.press('Escape');
        await expect(appWindow.locator('.settings-container')).not.toBeVisible();
    });
});

test.describe('Settings Language Switching E2E', () => {
    let electronApp: ElectronApplication;
    let appWindow: Page;

    test.beforeAll(async () => {
        const launched = await launchElectronApp();
        electronApp = launched.electronApp;
        appWindow = launched.appWindow;
        await expect(appWindow.getByRole('group', { name: /chat input/i })).toBeVisible({ timeout: 10000 });
    });

    test.afterAll(async () => {
        await closeElectronApp(electronApp);
    });

    test('should open settings and verify language selector exists', async () => {
        await openSettingsPanel(appWindow);

        // General tab should contain language settings
        const generalTab = appWindow.locator('#settings-tab-general');
        await expect(generalTab).toBeVisible();
        await generalTab.click();

        // Verify the settings content area is rendered
        const settingsMain = appWindow.locator('.settings-main');
        await expect(settingsMain).toBeVisible();
    });

    test('should have language dropdown or selector in general settings', async () => {
        // Look for a select element or language-related UI in the settings
        const languageSelectors = appWindow.locator('select, [role="combobox"], [role="listbox"]');
        const selectorCount = await languageSelectors.count();

        const settingsMain = appWindow.locator('.settings-main');
        await expect(settingsMain).toBeVisible();

        expect(selectorCount).toBeGreaterThan(0);
        await expect(languageSelectors.first()).toBeVisible();
    });
});

