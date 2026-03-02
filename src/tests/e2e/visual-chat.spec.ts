import { _electron as electron, ElectronApplication, expect, Page, test } from '@playwright/test';

test.describe('Chat Interface Visual Regression', () => {
    let electronApp: ElectronApplication;
    let window: Page;

    test.beforeAll(async () => {
        electronApp = await electron.launch({
            args: ['dist/main/main.js'],
            env: { ...process.env, NODE_ENV: 'test' }
        });
        window = await electronApp.firstWindow();
        await window.waitForLoadState('domcontentloaded');
        await window.waitForTimeout(1000);
    });

    test.afterAll(async () => {
        await electronApp?.close();
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
        await window.waitForTimeout(200);
        await expect(chatTextarea).toHaveScreenshot('chat-textarea-with-text.png', {
            maxDiffPixels: 200
        });
    });

    test('chat input multiline text', async () => {
        const chatTextarea = window.getByTestId('chat-textarea');
        await chatTextarea.fill('Line 1\nLine 2\nLine 3\nThis is a longer message to test textarea expansion');
        await window.waitForTimeout(200);
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
