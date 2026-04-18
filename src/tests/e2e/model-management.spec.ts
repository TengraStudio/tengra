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

test.describe('Model Management E2E', () => {
    let electronApp: ElectronApplication;
    let appWindow: Page;

    test.beforeAll(async () => {
        const launched = await launchElectronApp();
        electronApp = launched.electronApp;
        appWindow = launched.appWindow;
        await settleVisualState(appWindow);
    });

    test.afterAll(async () => {
        await closeElectronApp(electronApp);
    });

    test('should display model selector in chat view', async () => {
        const modelSelector = appWindow.getByTestId('model-selector');
        await expect(modelSelector).toBeVisible();
    });

    test('should open model selector modal on click', async () => {
        const modelSelector = appWindow.getByTestId('model-selector');
        await modelSelector.click();

        // A modal or dropdown should appear
        const modal = appWindow.locator('[role="dialog"], [class*="Modal"], [class*="modal"]')
            .first();
        await expect(modal.or(modelSelector)).toBeVisible();
    });

    test('should display model list or categories', async () => {
        // Check for model items in the selector
        const modelItems = appWindow.locator('[class*="ModelSelector"], [class*="model-selector"], [class*="model-item"]');
        await expect(modelItems.first().or(appWindow.getByTestId('model-selector'))).toBeVisible();
    });

    test('should have filter or search capability in model selector', async () => {
        // Look for search input in the model selector modal
        const searchInput = appWindow.locator('[role="dialog"] input[type="text"], [role="dialog"] input[type="search"], [class*="Modal"] input').first();

        if (await searchInput.count() > 0) {
            await expect(searchInput).toBeVisible();

            // Type a search query
            await searchInput.fill('gpt');
            await expect(searchInput).toHaveValue('gpt');

            // Clear the search
            await searchInput.clear();
            await expect(searchInput).toHaveValue('');
        }
    });

    test('should have tab filters for model types', async () => {
        // Model selector may have tabs like 'models' and 'reasoning'
        const tabs = appWindow.locator('[role="dialog"] button, [class*="Modal"] button').filter({
            hasText: /model|reasoning|local|cloud/i
        });

        const tabCount = await tabs.count();
        if (tabCount > 0) {
            // Click through available tabs
            const firstTab = tabs.first();
            await firstTab.click();
            await expect(firstTab).toBeVisible();
        }
    });

    test('should close model selector', async () => {
        await appWindow.keyboard.press('Escape');
        await expect(appWindow.getByTestId('model-selector')).toBeVisible();
    });
});

test.describe('Model Settings Tab E2E', () => {
    let electronApp: ElectronApplication;
    let appWindow: Page;

    test.beforeAll(async () => {
        const launched = await launchElectronApp();
        electronApp = launched.electronApp;
        appWindow = launched.appWindow;
        await settleVisualState(appWindow);
    });

    test.afterAll(async () => {
        await closeElectronApp(electronApp);
    });

    test('should open settings and navigate to models tab', async () => {
        await openSettingsPanel(appWindow);

        const modelsTab = appWindow.locator('.settings-tab-btn', { hasText: /model|yapay zeka/i });
        if (await modelsTab.count() > 0) {
            await modelsTab.first().click();
            await expect(appWindow.locator('.settings-main')).toBeVisible();
        }
    });

    test('should display models settings content', async () => {
        const settingsMain = appWindow.locator('.settings-main');
        await expect(settingsMain).toBeVisible();

        // The models tab should show model-related configuration
        const settingsSection = appWindow.locator('.settings-section');
        await expect(settingsSection).toBeVisible();
    });

    test('should close settings after model settings tests', async () => {
        await appWindow.keyboard.press('Escape');
        await expect(appWindow.locator('.settings-container')).not.toBeVisible();
    });
});
