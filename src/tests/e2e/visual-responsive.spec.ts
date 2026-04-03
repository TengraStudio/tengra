import { ElectronApplication, expect, Page, test } from '@playwright/test';

import { closeElectronApp, launchElectronApp, settleVisualState } from './e2e-test-utils';

test.describe('Responsive & Window Controls Visual Regression', () => {
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
        await setWindowSize(electronApp, window, 900, 700);

        await expect(window).toHaveScreenshot('layout-narrow-900.png', {
            maxDiffPixels: 400
        });
    });

    test('wide window layout', async () => {
        await setWindowSize(electronApp, window, 1600, 900);

        await expect(window).toHaveScreenshot('layout-wide-1600.png', {
            maxDiffPixels: 400
        });
    });

    test('compact window layout', async () => {
        await setWindowSize(electronApp, window, 800, 600);

        await expect(window).toHaveScreenshot('layout-compact-800x600.png', {
            maxDiffPixels: 400
        });
    });
});

async function setWindowSize(
    electronApp: ElectronApplication,
    _window: Page,
    width: number,
    height: number
): Promise<void> {
    await electronApp.evaluate(
        async ({ BrowserWindow }, dimensions: { width: number; height: number }) => {
            const win = BrowserWindow.getAllWindows()[0];
            win.setSize(dimensions.width, dimensions.height);
        },
        { width, height }
    );
    await expect
        .poll(async () => {
            const size = await electronApp.evaluate(
                async ({ BrowserWindow }) => {
                    const currentSize = BrowserWindow.getAllWindows()[0]?.getSize();
                    if (currentSize && currentSize.length >= 2) {
                        return [currentSize[0], currentSize[1]];
                    }
                    return [0, 0];
                }
            );
            return size.join('x');
        })
        .toBe(`${width}x${height}`);
}
