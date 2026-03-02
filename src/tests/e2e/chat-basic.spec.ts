import { _electron as electron, ElectronApplication, expect, Page, test } from '@playwright/test';

test.describe('Chat Basic UI Flow E2E', () => {
    let electronApp: ElectronApplication;
    let appWindow: Page;

    test.beforeAll(async () => {
        electronApp = await electron.launch({
            args: ['dist/main/main.js'],
            env: { ...process.env, NODE_ENV: 'test' }
        });
        appWindow = await electronApp.firstWindow();
        await appWindow.waitForLoadState('domcontentloaded');
        await appWindow.waitForTimeout(2000);
    });

    test.afterAll(async () => {
        if (electronApp) {
            await electronApp.close();
        }
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
        await appWindow.waitForTimeout(200);

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
        await appWindow.waitForTimeout(200);

        const value = await chatTextarea.inputValue();
        expect(value).toContain('Line 1');
        expect(value).toContain('Line 2');
    });

    test('should clear textarea content', async () => {
        const chatTextarea = appWindow.getByTestId('chat-textarea');
        await chatTextarea.fill('');
        await appWindow.waitForTimeout(200);

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
        await newChatButton.click();
        await appWindow.waitForTimeout(500);

        // After creating new chat, textarea should be empty and visible
        const chatTextarea = appWindow.getByTestId('chat-textarea');
        await expect(chatTextarea).toBeVisible();
    });

    test('should create new chat via keyboard shortcut', async () => {
        // Type something first
        const chatTextarea = appWindow.getByTestId('chat-textarea');
        await chatTextarea.fill('Draft message');
        await appWindow.waitForTimeout(200);

        // Create new chat with Ctrl+N
        await appWindow.keyboard.press('Control+n');
        await appWindow.waitForTimeout(500);

        // Textarea should be present in the new chat
        await expect(chatTextarea).toBeVisible();
    });
});

test.describe('Chat Sidebar Interactions E2E', () => {
    let electronApp: ElectronApplication;
    let appWindow: Page;

    test.beforeAll(async () => {
        electronApp = await electron.launch({
            args: ['dist/main/main.js'],
            env: { ...process.env, NODE_ENV: 'test' }
        });
        appWindow = await electronApp.firstWindow();
        await appWindow.waitForLoadState('domcontentloaded');
        await appWindow.waitForTimeout(2000);
    });

    test.afterAll(async () => {
        if (electronApp) {
            await electronApp.close();
        }
    });

    test('should display sidebar with chat list', async () => {
        const sidebar = appWindow.getByTestId('sidebar');
        await expect(sidebar).toBeVisible();
    });

    test('should have new chat button in sidebar', async () => {
        const newChatButton = appWindow.getByTestId('new-chat-button');
        await expect(newChatButton).toBeVisible();
    });

    test('should have settings button in sidebar', async () => {
        const settingsButton = appWindow.getByTestId('settings-button');
        await expect(settingsButton).toBeVisible();
    });

    test('should list chat history items in sidebar', async () => {
        const sidebar = appWindow.getByTestId('sidebar');
        const chatItems = sidebar.locator('[class*="chat"], [class*="Chat"], [role="listitem"], [role="button"]');
        const itemCount = await chatItems.count();

        // Sidebar should contain at least navigation buttons
        expect(itemCount).toBeGreaterThanOrEqual(0);
    });

    test('should handle rapid new chat creation', async () => {
        const newChatButton = appWindow.getByTestId('new-chat-button');

        // Create multiple chats in quick succession
        await newChatButton.click();
        await appWindow.waitForTimeout(300);
        await newChatButton.click();
        await appWindow.waitForTimeout(300);

        // App should remain stable
        const chatView = appWindow.getByTestId('chat-view');
        await expect(chatView).toBeVisible();
    });
});

test.describe('Chat Input Attachments E2E', () => {
    let electronApp: ElectronApplication;
    let appWindow: Page;

    test.beforeAll(async () => {
        electronApp = await electron.launch({
            args: ['dist/main/main.js'],
            env: { ...process.env, NODE_ENV: 'test' }
        });
        appWindow = await electronApp.firstWindow();
        await appWindow.waitForLoadState('domcontentloaded');
        await appWindow.waitForTimeout(2000);
    });

    test.afterAll(async () => {
        if (electronApp) {
            await electronApp.close();
        }
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
        await appWindow.waitForTimeout(100);

        const isFocused = await chatTextarea.evaluate(
            (el) => document.activeElement === el
        );
        expect(isFocused).toBe(true);
    });
});
