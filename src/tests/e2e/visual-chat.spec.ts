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

test.describe('Chat Interface Visual Regression', () => {
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

    test('chat view default empty state', async () => {
        const chatView = window.getByTestId('chat-view');
        await expect(chatView).toBeVisible();
        await expect(chatView).toHaveScreenshot('chat-view-empty.png', {
            maxDiffPixels: 200
        });
    });

    test('chat input area baseline', async () => {
        const chatTextarea = window.getByTestId('chat-textarea');
        await expect(chatTextarea).toBeVisible();
        await expect(chatTextarea).toHaveScreenshot('chat-textarea-empty.png', {
            maxDiffPixels: 150
        });
    });

    test('chat input with text entered', async () => {
        const chatTextarea = window.getByTestId('chat-textarea');
        await chatTextarea.fill('Hello, this is a visual regression test message');
        await expect(chatTextarea).toHaveValue('Hello, this is a visual regression test message');
        await expect(chatTextarea).toHaveScreenshot('chat-textarea-with-text.png', {
            maxDiffPixels: 200
        });
    });

    test('chat input multiline text', async () => {
        const chatTextarea = window.getByTestId('chat-textarea');
        await chatTextarea.fill('Line 1\nLine 2\nLine 3\nThis is a longer message to test textarea expansion');
        await expect(chatTextarea).toHaveValue(/Line 1[\s\S]*Line 3/);
        await expect(chatTextarea).toHaveScreenshot('chat-textarea-multiline.png', {
            maxDiffPixels: 250
        });
    });

    test('chat view full layout with input', async () => {
        await expect(window).toHaveScreenshot('chat-full-layout.png', {
            maxDiffPixels: 300
        });
    });
});

