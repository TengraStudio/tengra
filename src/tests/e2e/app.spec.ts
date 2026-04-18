/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ElectronApplication, expect, test } from '@playwright/test';

import { closeElectronApp, launchElectronApp } from './e2e-test-utils';

test.describe('Application Launch', () => {
    let electronApp: ElectronApplication;
    test.beforeAll(async () => {
        const launched = await launchElectronApp();
        electronApp = launched.electronApp;
    });

    test.afterAll(async () => {
        await closeElectronApp(electronApp);
    });

    test('should show main window', async () => {
        const window = await electronApp.firstWindow();
        const title = await window.title();

        // Verify a non-empty title is provided by the app shell
        expect(title.length).toBeGreaterThan(0);

        // Check if window is visible
        const isVisible = await window.isVisible('body');
        expect(isVisible).toBe(true);
    });

});

