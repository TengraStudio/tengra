import { _electron as electron, ElectronApplication, expect, Page, test } from '@playwright/test';

test.describe('Responsive & Window Controls Visual Regression', () => {
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

    test('window controls baseline', async () => {
        const minimizeBtn = window.getByTestId('window-minimize');
        const maximizeBtn = window.getByTestId('window-maximize');
        const closeBtn = window.getByTestId('window-close');

        await expect(minimizeBtn).toBeVisible();
        await expect(maximizeBtn).toBeVisible();
        await expect(closeBtn).toBeVisible();

        await expect(window).toHaveScreenshot('window-controls-default.png', {
            maxDiffPixels: 200
        });
    });

    test('default window size layout', async () => {
        await expect(window).toHaveScreenshot('layout-default-size.png', {
            maxDiffPixels: 300
        });
    });

    test('narrow window layout', async () => {
        await electronApp.evaluate(
            async ({ BrowserWindow }: { BrowserWindow: { getAllWindows: () => Array<{ setSize: (w: number, h: number) => void }> } }) => {
                const win = BrowserWindow.getAllWindows()[0];
                win.setSize(900, 700);
            }
        );
        await window.waitForTimeout(500);

        await expect(window).toHaveScreenshot('layout-narrow-900.png', {
            maxDiffPixels: 400
        });
    });

    test('wide window layout', async () => {
        await electronApp.evaluate(
            async ({ BrowserWindow }: { BrowserWindow: { getAllWindows: () => Array<{ setSize: (w: number, h: number) => void }> } }) => {
                const win = BrowserWindow.getAllWindows()[0];
                win.setSize(1600, 900);
            }
        );
        await window.waitForTimeout(500);

        await expect(window).toHaveScreenshot('layout-wide-1600.png', {
            maxDiffPixels: 400
        });
    });

    test('compact window layout', async () => {
        await electronApp.evaluate(
            async ({ BrowserWindow }: { BrowserWindow: { getAllWindows: () => Array<{ setSize: (w: number, h: number) => void }> } }) => {
                const win = BrowserWindow.getAllWindows()[0];
                win.setSize(800, 600);
            }
        );
        await window.waitForTimeout(500);

        await expect(window).toHaveScreenshot('layout-compact-800x600.png', {
            maxDiffPixels: 400
        });
    });
});
