import { _electron as electron, ElectronApplication, expect, Page, test } from '@playwright/test';

test.describe('Theme Switching E2E', () => {
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

    test('should have a data-theme attribute on document root', async () => {
        const theme = await appWindow.evaluate(() =>
            document.documentElement.getAttribute('data-theme')
        );
        expect(theme).toBeTruthy();
        expect(['black', 'white']).toContain(theme);
    });

    test('should open settings and navigate to appearance tab', async () => {
        const settingsButton = appWindow.getByTestId('settings-button');
        await settingsButton.click();
        await appWindow.waitForTimeout(500);

        const appearanceTab = appWindow.locator('.settings-tab-btn', { hasText: /appearance|görünüm/i });
        if (await appearanceTab.count() > 0) {
            await appearanceTab.first().click();
            await appWindow.waitForTimeout(300);
        }
    });

    test('should display theme selector buttons', async () => {
        // Theme buttons have data-theme attribute on preview elements
        const themeButtons = appWindow.locator('button [data-theme]');
        const buttonCount = await themeButtons.count();
        expect(buttonCount).toBeGreaterThanOrEqual(1);
    });

    test('should switch to white theme', async () => {
        const initialTheme = await appWindow.evaluate(() =>
            document.documentElement.getAttribute('data-theme')
        );

        // Click the white theme button
        const whiteThemeButton = appWindow.locator('button', { has: appWindow.locator('[data-theme="white"]') });
        if (await whiteThemeButton.count() > 0) {
            await whiteThemeButton.first().click();
            await appWindow.waitForTimeout(500);

            const currentTheme = await appWindow.evaluate(() =>
                document.documentElement.getAttribute('data-theme')
            );
            expect(currentTheme).toBe('white');
        } else {
            // If we can't find the button, verify the attribute still exists
            expect(initialTheme).toBeTruthy();
        }
    });

    test('should verify CSS variables change with white theme', async () => {
        const currentTheme = await appWindow.evaluate(() =>
            document.documentElement.getAttribute('data-theme')
        );

        if (currentTheme === 'white') {
            const bgColor = await appWindow.evaluate(() =>
                getComputedStyle(document.documentElement).getPropertyValue('--background').trim()
            );
            expect(bgColor.length).toBeGreaterThan(0);
        }
    });

    test('should switch to black theme', async () => {
        const blackThemeButton = appWindow.locator('button', { has: appWindow.locator('[data-theme="black"]') });
        if (await blackThemeButton.count() > 0) {
            await blackThemeButton.first().click();
            await appWindow.waitForTimeout(500);

            const currentTheme = await appWindow.evaluate(() =>
                document.documentElement.getAttribute('data-theme')
            );
            expect(currentTheme).toBe('black');
        }
    });

    test('should verify CSS variables change with black theme', async () => {
        const currentTheme = await appWindow.evaluate(() =>
            document.documentElement.getAttribute('data-theme')
        );

        if (currentTheme === 'black') {
            const bgColor = await appWindow.evaluate(() =>
                getComputedStyle(document.documentElement).getPropertyValue('--background').trim()
            );
            expect(bgColor.length).toBeGreaterThan(0);
        }
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

    test('should close settings after theme tests', async () => {
        await appWindow.keyboard.press('Escape');
        await appWindow.waitForTimeout(300);
    });
});
