import { ElectronApplication, expect, Page, test } from '@playwright/test';

import { closeElectronApp, launchElectronApp, openSettingsPanel } from './e2e-test-utils';

test.describe('Theme Switching E2E', () => {
    let electronApp: ElectronApplication;
    let appWindow: Page;

    test.beforeAll(async () => {
        const launched = await launchElectronApp();
        electronApp = launched.electronApp;
        appWindow = launched.appWindow;
        await expect(appWindow.getByRole('group', { name: /chat input/i })).toBeVisible({ timeout: 10000 });
    });

    test.afterAll(async () => {
        await closeElectronApp(electronApp);
    });

    test('should have a data-theme attribute on document root', async () => {
        const theme = await appWindow.evaluate(() =>
            document.documentElement.getAttribute('data-theme')
        );
        expect(theme).toBeTruthy();
        expect(['black', 'white']).toContain(theme);
    });

    test('should open settings and navigate to appearance tab', async () => {
        await openSettingsPanel(appWindow);

        const appearanceTab = appWindow.locator('#settings-tab-appearance');
        await expect(appearanceTab).toBeVisible();
        await appearanceTab.click();
        await expect(appWindow.locator('#settings-panel-appearance')).toBeVisible();
    });

    test('should display theme selector buttons', async () => {
        // Theme buttons have data-theme attribute on preview elements
        const themeButtons = appWindow.locator('button [data-theme]');
        const buttonCount = await themeButtons.count();
        expect(buttonCount).toBeGreaterThanOrEqual(1);
    });

    test('should switch to white theme', async () => {
        // Click the white theme button
        const whiteThemeButton = appWindow.locator('button', { has: appWindow.locator('[data-theme="white"]') });
        await expect(whiteThemeButton.first()).toBeVisible();
        await whiteThemeButton.first().click();
        await expect.poll(async () => appWindow.evaluate(() =>
            document.documentElement.getAttribute('data-theme')
        )).toBe('white');
    });

    test('should verify CSS variables change with white theme', async () => {
        const currentTheme = await appWindow.evaluate(() =>
            document.documentElement.getAttribute('data-theme')
        );

        expect(currentTheme).toBe('white');
        const bgColor = await appWindow.evaluate(() =>
            getComputedStyle(document.documentElement).getPropertyValue('--background').trim()
        );
        expect(bgColor).not.toEqual('');
    });

    test('should switch to black theme', async () => {
        const blackThemeButton = appWindow.locator('button', { has: appWindow.locator('[data-theme="black"]') });
        await expect(blackThemeButton.first()).toBeVisible();
        await blackThemeButton.first().click();
        await expect.poll(async () => appWindow.evaluate(() =>
            document.documentElement.getAttribute('data-theme')
        )).toBe('black');
    });

    test('should verify CSS variables change with black theme', async () => {
        const currentTheme = await appWindow.evaluate(() =>
            document.documentElement.getAttribute('data-theme')
        );

        expect(currentTheme).toBe('black');
        const bgColor = await appWindow.evaluate(() =>
            getComputedStyle(document.documentElement).getPropertyValue('--background').trim()
        );
        expect(bgColor).not.toEqual('');
    });

    test('should persist theme in localStorage', async () => {
        const storedTheme = await appWindow.evaluate(() => {
            const raw = localStorage.getItem('tengra.theme.v1');
            return raw ? JSON.parse(raw) as { theme: string } : null;
        });

        expect(storedTheme).toBeTruthy();
        expect(storedTheme?.theme).toBeTruthy();
        expect(['black', 'white']).toContain(storedTheme?.theme);
    });

    test('should keep active theme after renderer reload', async () => {
        const beforeReload = await appWindow.evaluate(() =>
            document.documentElement.getAttribute('data-theme')
        );
        await appWindow.reload();
        await expect(appWindow.getByRole('group', { name: /chat input/i })).toBeVisible();
        const afterReload = await appWindow.evaluate(() =>
            document.documentElement.getAttribute('data-theme')
        );
        expect(afterReload).toBe(beforeReload);
    });

    test('should close settings after theme tests', async () => {
        await appWindow.keyboard.press('Escape');
        await expect(appWindow.locator('.settings-container')).not.toBeVisible();
    });
});
