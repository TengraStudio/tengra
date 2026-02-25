import { _electron as electron, ElectronApplication, expect, test } from '@playwright/test';


test.describe('Application Launch', () => {
    let electronApp: ElectronApplication;

    test.beforeAll(async () => {
        // Launch Electron app from source
        electronApp = await electron.launch({
            args: ['dist/main/main.js'], // Point to compiled main
            env: { ...process.env, NODE_ENV: 'test' }
        });
    });

    test.afterAll(async () => {
        if (electronApp) {
            await electronApp.close();
        }
    });

    test('should show main window', async () => {
        const window = await electronApp.firstWindow();
        const title = await window.title();

        // Verify a non-empty title is provided by the app shell
        expect(title.length).toBeGreaterThan(0);
        // expect(title).toContain('Tengra'); 
        // Title usually set in HTML or via setIsTitleVisible. 
        // The main.ts loads index.html.

        // Check if window is visible
        const isVisible = await window.isVisible('body');
        expect(isVisible).toBe(true);
    });
});

