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

import { closeElectronApp, launchElectronApp, pressAppShortcut } from './e2e-test-utils';

test.describe('Chat Basic UI Flow E2E', () => {
    let electronApp: ElectronApplication;
    let appWindow: Page;

    test.beforeAll(async () => {
        const launched = await launchElectronApp();
        electronApp = launched.electronApp;
        appWindow = launched.appWindow;
    });

    test.afterAll(async () => {
        await closeElectronApp(electronApp);
    });

    test('should display chat view', async () => {
        const chatView = appWindow.getByTestId('chat-view');
        await expect(chatView).toBeVisible();
    });

    test('should display chat textarea', async () => {
        const chatTextarea = appWindow.getByTestId('chat-textarea');
        await expect(chatTextarea).toBeVisible();
    });

    test('should accept text input in chat textarea', async () => {
        const chatTextarea = appWindow.getByTestId('chat-textarea');
        await chatTextarea.click();
        await chatTextarea.fill('Hello, this is a test message');

        const value = await chatTextarea.inputValue();
        expect(value).toBe('Hello, this is a test message');
    });

    test('should support multiline input with Shift+Enter', async () => {
        const chatTextarea = appWindow.getByTestId('chat-textarea');
        await chatTextarea.click();
        await chatTextarea.fill('');
        await chatTextarea.type('Line 1');
        await chatTextarea.press('Shift+Enter');
        await chatTextarea.type('Line 2');

        const value = await chatTextarea.inputValue();
        expect(value).toContain('Line 1');
        expect(value).toContain('Line 2');
    });

    test('should clear textarea content', async () => {
        const chatTextarea = appWindow.getByTestId('chat-textarea');
        await chatTextarea.fill('');

        const value = await chatTextarea.inputValue();
        expect(value).toBe('');
    });

    test('should display model selector alongside chat', async () => {
        const modelSelector = appWindow.getByTestId('model-selector');
        await expect(modelSelector).toBeVisible();
    });

    test('should create new chat via button', async () => {
        const newChatButton = appWindow.getByTestId('new-chat-button');
        await expect(newChatButton).toBeVisible();
        const chatTextarea = appWindow.getByTestId('chat-textarea');
        await chatTextarea.fill('Draft to clear');
        await newChatButton.click();
        await expect(chatTextarea).toBeVisible();
        await expect(chatTextarea).toHaveValue('');
    });

    test('should create new chat via keyboard shortcut', async () => {
        // Type something first
        const chatTextarea = appWindow.getByTestId('chat-textarea');
        await chatTextarea.fill('Draft message');

        // Create new chat with Ctrl+N
        await pressAppShortcut(appWindow, 'n');

        // Textarea should be present in the new chat
        await expect(chatTextarea).toBeVisible();
        await expect(chatTextarea).toHaveValue('');
    });
});

test.describe('Chat Sidebar Interactions E2E', () => {
    let electronApp: ElectronApplication;
    let appWindow: Page;

    test.beforeAll(async () => {
        const launched = await launchElectronApp();
        electronApp = launched.electronApp;
        appWindow = launched.appWindow;
    });

    test.afterAll(async () => {
        await closeElectronApp(electronApp);
    });

    test('should display sidebar with chat list', async () => {
        const sidebar = appWindow.getByRole('complementary').first();
        await expect(sidebar).toBeVisible();
    });

    test('should have new chat button in sidebar', async () => {
        const newChatButton = appWindow.getByTestId('new-chat-button');
        await expect(newChatButton).toBeVisible();
    });

    test('should have settings button in sidebar', async () => {
        const settingsButton = appWindow.getByRole('button', { name: /settings|ayar/i }).first();
        await expect(settingsButton).toBeVisible();
    });

    test('should list chat history items in sidebar', async () => {
        const sidebar = appWindow.getByRole('complementary').first();
        const chatItems = sidebar.locator('[class*="chat"], [class*="Chat"], [role="listitem"], [role="button"]');
        const itemCount = await chatItems.count();

        // Sidebar should contain at least navigation buttons
        expect(itemCount).toBeGreaterThan(0);
    });

    test('should handle rapid new chat creation', async () => {
        const newChatButton = appWindow.getByTestId('new-chat-button');

        // Create multiple chats in quick succession
        await newChatButton.click();
        await newChatButton.click();

        // App should remain stable
        const chatView = appWindow.getByTestId('chat-view');
        await expect(chatView).toBeVisible();
    });
});

test.describe('Chat Input Attachments E2E', () => {
    let electronApp: ElectronApplication;
    let appWindow: Page;

    test.beforeAll(async () => {
        const launched = await launchElectronApp();
        electronApp = launched.electronApp;
        appWindow = launched.appWindow;
    });

    test.afterAll(async () => {
        await closeElectronApp(electronApp);
    });

    test('should display chat input area with action buttons', async () => {
        const chatTextarea = appWindow.getByTestId('chat-textarea');
        await expect(chatTextarea).toBeVisible();

        // Look for action buttons near the chat input (attach, send, etc.)
        const chatView = appWindow.getByTestId('chat-view');
        const buttons = chatView.locator('button');
        const buttonCount = await buttons.count();
        expect(buttonCount).toBeGreaterThan(0);
    });

    test('should focus textarea on click', async () => {
        const chatTextarea = appWindow.getByTestId('chat-textarea');
        await chatTextarea.click();

        const isFocused = await chatTextarea.evaluate(
            (el) => document.activeElement === el
        );
        expect(isFocused).toBe(true);
    });
});
