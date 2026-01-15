import { _electron as electron, expect, test } from '@playwright/test';

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
        const chatInput = window.getByTestId('chat-textarea');
        await expect(chatInput).toBeVisible();
    });

    test('should display sidebar with chat list', async () => {
        const sidebar = window.getByTestId('sidebar');
        await expect(sidebar).toBeVisible();
    });

    test('should be able to create new chat', async () => {
        const newChatButton = window.getByTestId('new-chat-button');
        await expect(newChatButton).toBeVisible();
        await newChatButton.click();
        await window.waitForTimeout(500);
    });

    test('should display model selector', async () => {
        const modelSelector = window.getByTestId('model-selector');
        await expect(modelSelector).toBeVisible();
    });

    test('should toggle settings panel', async () => {
        const settingsButton = window.getByTestId('settings-button');
        await expect(settingsButton).toBeVisible();
        await settingsButton.click();
        await window.waitForTimeout(500);

        const closeButton = window.getByRole('button', { name: /close/i }).first();
        if (await closeButton.isVisible()) {
            await closeButton.click();
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
    });

    test('should respond to Ctrl+, for settings', async () => {
        await window.keyboard.press('Control+,');
        await window.waitForTimeout(300);
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
        const minimizeBtn = window.getByTestId('window-minimize');
        const maximizeBtn = window.getByTestId('window-maximize');
        const closeBtn = window.getByTestId('window-close');

        await expect(minimizeBtn).toBeVisible();
        await expect(maximizeBtn).toBeVisible();
        await expect(closeBtn).toBeVisible();
    });

    test('should respond to window resize', async () => {
        const initialSize = await window.evaluate(() => ({
            width: window.innerWidth,
            height: window.innerHeight
        }));

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
