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

    test('mobile window layout (390w)', async () => {
        await setWindowSize(electronApp, window, 390, 844);

        await expect(window).toHaveScreenshot('layout-mobile-390.png', {
            maxDiffPixels: 450
        });
    });

    test('tablet window layout (768w)', async () => {
        await setWindowSize(electronApp, window, 768, 1024);

        await expect(window).toHaveScreenshot('layout-tablet-768.png', {
            maxDiffPixels: 450
        });
    });

    test('desktop window layout (1440w)', async () => {
        await setWindowSize(electronApp, window, 1440, 900);

        await expect(window).toHaveScreenshot('layout-desktop-1440.png', {
            maxDiffPixels: 450
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

