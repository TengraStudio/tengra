/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { _electron as electron, ElectronApplication, expect, Page } from '@playwright/test';

const ELECTRON_ENTRY = 'dist/main/main.js';

export interface E2eAppContext {
    electronApp: ElectronApplication;
    appWindow: Page;
}

export async function launchElectronApp(): Promise<E2eAppContext> {
    const { ELECTRON_RUN_AS_NODE: _ignoredElectronRunAsNode, ...launchEnv } = process.env;
    const electronApp = await electron.launch({
        args: [ELECTRON_ENTRY],
        env: { ...launchEnv, NODE_ENV: 'test' }
    });
    const appWindow = await electronApp.firstWindow();
    await appWindow.waitForLoadState('domcontentloaded');
    await expect(appWindow.locator('body')).toBeVisible();
    return { electronApp, appWindow };
}

export async function closeElectronApp(electronApp: ElectronApplication | undefined): Promise<void> {
    if (electronApp) {
        await electronApp.close();
    }
}

export async function pressAppShortcut(page: Page, key: string): Promise<void> {
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.press(`${modifier}+${key}`);
}

export async function openSettingsPanel(page: Page): Promise<void> {
    const settingsButton = page.getByTestId('settings-button').or(
        page.getByRole('button', { name: /settings|ayar/i }).first()
    );
    await expect(settingsButton).toBeVisible();
    await settingsButton.click();
    await expect(page.locator('.settings-container')).toBeVisible();
}

export async function settleVisualState(page: Page): Promise<void> {
    await page.addStyleTag({
        content: `
            *,
            *::before,
            *::after {
                transition-duration: 0s !important;
                animation-duration: 0s !important;
                caret-color: transparent !important;
            }
        `
    });
}
