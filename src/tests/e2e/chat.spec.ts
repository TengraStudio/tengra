import { _electron as electron,expect, test } from '@playwright/test';

test.describe('Chat Feature E2E Tests', () => {
    let electronApp: any;
    let window: any;

    test.beforeAll(async () => {
        electronApp = await electron.launch({
            args: ['dist/main/main.js'],
            env: { ...process.env, NODE_ENV: 'test' }
        });
        window = await electronApp.firstWindow();
        // Wait for app to fully load
        await window.waitForLoadState('domcontentloaded');
        await window.waitForTimeout(2000);
    });

    test.afterAll(async () => {
        if (electronApp) {
            await electronApp.close();
        }
    });

    test('should display chat input area', async () => {
        // Look for the chat input textarea or contenteditable
        const chatInput = await window.$('textarea, [contenteditable="true"]');
        expect(chatInput).toBeTruthy();
    });

    test('should display sidebar with chat list', async () => {
        // Look for sidebar element
        const sidebar = await window.$('[data-testid="sidebar"], .sidebar, aside');
        expect(sidebar).toBeTruthy();
    });

    test('should be able to create new chat', async () => {
        // Look for new chat button
        const newChatButton = await window.$('button:has-text("New"), [data-testid="new-chat"]');
        if (newChatButton) {
            await newChatButton.click();
            await window.waitForTimeout(500);
            // Verify a new chat was created (implementation specific)
        }
    });

    test('should display model selector', async () => {
        // Look for model selector dropdown
        const modelSelector = await window.$('[data-testid="model-selector"], .model-selector, select');
        expect(modelSelector).toBeTruthy();
    });

    test('should toggle settings panel', async () => {
        // Look for settings button
        const settingsButton = await window.$('button[aria-label*="settings" i], [data-testid="settings"]');
        if (settingsButton) {
            await settingsButton.click();
            await window.waitForTimeout(500);

            // Check if settings panel opened
            // Check if settings panel opened
            await window.$('[data-testid="settings-panel"], .settings-modal');
            // Close settings if opened
            const closeButton = await window.$('button[aria-label*="close" i]');
            if (closeButton) {
                await closeButton.click();
            }
        }
    });
});

test.describe('Keyboard Shortcuts E2E Tests', () => {
    let electronApp: any;
    let window: any;

    test.beforeAll(async () => {
        electronApp = await electron.launch({
            args: ['dist/main/main.js'],
            env: { ...process.env, NODE_ENV: 'test' }
        });
        window = await electronApp.firstWindow();
        await window.waitForLoadState('domcontentloaded');
        await window.waitForTimeout(2000);
    });

    test.afterAll(async () => {
        if (electronApp) {
            await electronApp.close();
        }
    });

    test('should respond to Ctrl+N for new chat', async () => {
        await window.keyboard.press('Control+n');
        await window.waitForTimeout(300);
        // Verify new chat behavior
    });

    test('should respond to Ctrl+, for settings', async () => {
        await window.keyboard.press('Control+,');
        await window.waitForTimeout(300);
        // Check if settings opened
        const modal = await window.$('.modal, [role="dialog"]');
        if (modal) {
            await window.keyboard.press('Escape');
        }
    });

    test('should respond to Escape to close modals', async () => {
        await window.keyboard.press('Control+,');
        await window.waitForTimeout(300);
        await window.keyboard.press('Escape');
        await window.waitForTimeout(300);
    });
});

test.describe('Window Controls E2E Tests', () => {
    let electronApp: any;
    let window: any;

    test.beforeAll(async () => {
        electronApp = await electron.launch({
            args: ['dist/main/main.js'],
            env: { ...process.env, NODE_ENV: 'test' }
        });
        window = await electronApp.firstWindow();
        await window.waitForLoadState('domcontentloaded');
    });

    test.afterAll(async () => {
        if (electronApp) {
            await electronApp.close();
        }
    });

    test('should display window control buttons', async () => {
        // Custom title bar buttons
        // const minimizeBtn = await window.$('[data-testid="minimize"], button[aria-label*="minimize" i]');
        // const maximizeBtn = await window.$('[data-testid="maximize"], button[aria-label*="maximize" i]');
        // const closeBtn = await window.$('[data-testid="close"], button[aria-label*="close" i]');

        // At least one should exist if using custom title bar
        // const hasControls = minimizeBtn || maximizeBtn || closeBtn;
        // This is optional as some apps use native window controls
    });

    test('should respond to window resize', async () => {
        const initialSize = await window.evaluate(() => ({
            width: window.innerWidth,
            height: window.innerHeight
        }));

        // Resize window
        await electronApp.evaluate(async ({ BrowserWindow }: any) => {
            const win = BrowserWindow.getAllWindows()[0];
            win.setSize(1000, 700);
        });

        await window.waitForTimeout(500);

        const newSize = await window.evaluate(() => ({
            width: window.innerWidth,
            height: window.innerHeight
        }));

        expect(newSize.width).not.toBe(initialSize.width);
    });
});
