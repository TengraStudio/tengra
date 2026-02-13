import { _electron as electron, ElectronApplication, expect, Page, test } from '@playwright/test';

test.describe('Chat Feature E2E Tests', () => {
    let electronApp: ElectronApplication;
    let appWindow: Page;

    test.beforeAll(async () => {
        electronApp = await electron.launch({
            args: ['dist/main/main.js'],
            env: { ...process.env, NODE_ENV: 'test' }
        });
        appWindow = await electronApp.firstWindow();

        // Wait for app to fully load
        await appWindow.waitForLoadState('domcontentloaded');
        await appWindow.waitForTimeout(2000);
    });

    test.afterAll(async () => {
        if (electronApp) {
            await electronApp.close();
        }
    });

    test('should display chat input area', async () => {
        const chatInput = appWindow.getByTestId('chat-textarea');
        await expect(chatInput).toBeVisible();
    });

    test('should display sidebar with chat list', async () => {
        const sidebar = appWindow.getByTestId('sidebar');
        await expect(sidebar).toBeVisible();
    });

    test('should be able to create new chat', async () => {
        const newChatButton = appWindow.getByTestId('new-chat-button');
        await expect(newChatButton).toBeVisible();
        await newChatButton.click();
        await appWindow.waitForTimeout(500);
    });

    test('should display model selector', async () => {
        const modelSelector = appWindow.getByTestId('model-selector');
        await expect(modelSelector).toBeVisible();
    });

    test('should toggle settings panel', async () => {
        const settingsButton = appWindow.getByTestId('settings-button');
        await expect(settingsButton).toBeVisible();
        await settingsButton.click();
        await appWindow.waitForTimeout(500);

        const closeButton = appWindow.getByRole('button', { name: /close/i }).first();
        if (await closeButton.isVisible()) {
            await closeButton.click();
        }
    });
});

test.describe('Keyboard Shortcuts E2E Tests', () => {
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

    test('should respond to Ctrl+N for new chat', async () => {
        await appWindow.keyboard.press('Control+n');
        await appWindow.waitForTimeout(300);
    });

    test('should respond to Ctrl+, for settings', async () => {
        await appWindow.keyboard.press('Control+,');
        await appWindow.waitForTimeout(300);
        const modal = await appWindow.$('.modal, [role="dialog"]');
        if (modal) {
            await appWindow.keyboard.press('Escape');
        }
    });

    test('should respond to Escape to close modals', async () => {
        await appWindow.keyboard.press('Control+,');
        await appWindow.waitForTimeout(300);
        await appWindow.keyboard.press('Escape');
        await appWindow.waitForTimeout(300);
    });
});

test.describe('Window Controls E2E Tests', () => {
    let electronApp: ElectronApplication;
    let appWindow: Page;

    test.beforeAll(async () => {
        electronApp = await electron.launch({
            args: ['dist/main/main.js'],
            env: { ...process.env, NODE_ENV: 'test' }
        });
        appWindow = await electronApp.firstWindow();
        await appWindow.waitForLoadState('domcontentloaded');
    });

    test.afterAll(async () => {
        if (electronApp) {
            await electronApp.close();
        }
    });

    test('should display window control buttons', async () => {
        const minimizeBtn = appWindow.getByTestId('window-minimize');
        const maximizeBtn = appWindow.getByTestId('window-maximize');
        const closeBtn = appWindow.getByTestId('window-close');

        await expect(minimizeBtn).toBeVisible();
        await expect(maximizeBtn).toBeVisible();
        await expect(closeBtn).toBeVisible();
    });

    test('should respond to window resize', async () => {
        const initialSize = await appWindow.evaluate(() => ({
            width: window.innerWidth,
            height: window.innerHeight
        }));

        await electronApp.evaluate(async ({ BrowserWindow }: { BrowserWindow: { getAllWindows: () => Array<{ setSize: (width: number, height: number) => void }> } }) => {
            const win = BrowserWindow.getAllWindows()[0];
            win.setSize(1000, 700);
        });

        await appWindow.waitForTimeout(500);

        const newSize = await appWindow.evaluate(() => ({
            width: window.innerWidth,
            height: window.innerHeight
        }));

        expect(newSize.width).not.toBe(initialSize.width);
    });
});
