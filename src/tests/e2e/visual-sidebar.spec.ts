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

import { closeElectronApp, launchElectronApp, settleVisualState } from './e2e-test-utils';

test.describe('Sidebar Visual Regression', () => {
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

        const sidebar = window.getByTestId('sidebar');
        await expect(sidebar).toBeVisible();
        await expect(sidebar).toHaveScreenshot('sidebar-after-new-chat.png', {
            maxDiffPixels: 250
        });
    });
});
