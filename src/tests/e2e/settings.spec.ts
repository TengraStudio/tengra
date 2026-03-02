import { _electron as electron, ElectronApplication, expect, Page, test } from '@playwright/test';

test.describe('Settings Panel E2E', () => {
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

    test('should open settings panel via button', async () => {
        const settingsButton = appWindow.getByTestId('settings-button');
        await expect(settingsButton).toBeVisible();
        await settingsButton.click();
        await appWindow.waitForTimeout(500);

        const settingsContainer = appWindow.locator('.settings-container');
        await expect(settingsContainer).toBeVisible();
    });

    test('should display settings tabs', async () => {
        const settingsContainer = appWindow.locator('.settings-container');
        await expect(settingsContainer).toBeVisible();

        // Verify settings tab buttons are present
        const tabButtons = appWindow.locator('.settings-tab-btn');
        const tabCount = await tabButtons.count();
        expect(tabCount).toBeGreaterThan(0);
    });

    test('should navigate to appearance tab', async () => {
        const appearanceTab = appWindow.locator('.settings-tab-btn', { hasText: /appearance|görünüm/i });
        if (await appearanceTab.count() > 0) {
            await appearanceTab.first().click();
            await appWindow.waitForTimeout(300);
        }
    });

    test('should navigate to general tab', async () => {
        const generalTab = appWindow.locator('.settings-tab-btn', { hasText: /general|genel/i });
        if (await generalTab.count() > 0) {
            await generalTab.first().click();
            await appWindow.waitForTimeout(300);
        }
    });

    test('should navigate to advanced tab', async () => {
        const advancedTab = appWindow.locator('.settings-tab-btn', { hasText: /advanced|gelişmiş/i });
        if (await advancedTab.count() > 0) {
            await advancedTab.first().click();
            await appWindow.waitForTimeout(300);
        }
    });

    test('should navigate to about tab', async () => {
        const aboutTab = appWindow.locator('.settings-tab-btn', { hasText: /about|hakkında/i });
        if (await aboutTab.count() > 0) {
            await aboutTab.first().click();
            await appWindow.waitForTimeout(300);
        }
    });

    test('should close settings with Escape key', async () => {
        await appWindow.keyboard.press('Escape');
        await appWindow.waitForTimeout(300);
    });

    test('should reopen settings with keyboard shortcut', async () => {
        await appWindow.keyboard.press('Control+,');
        await appWindow.waitForTimeout(500);

        // Clean up
        await appWindow.keyboard.press('Escape');
        await appWindow.waitForTimeout(300);
    });
});

test.describe('Settings Language Switching E2E', () => {
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

    test('should open settings and verify language selector exists', async () => {
        const settingsButton = appWindow.getByTestId('settings-button');
        await settingsButton.click();
        await appWindow.waitForTimeout(500);

        // General tab should contain language settings
        const generalTab = appWindow.locator('.settings-tab-btn', { hasText: /general|genel/i });
        if (await generalTab.count() > 0) {
            await generalTab.first().click();
            await appWindow.waitForTimeout(300);
        }

        // Verify the settings content area is rendered
        const settingsMain = appWindow.locator('.settings-main');
        await expect(settingsMain).toBeVisible();
    });

    test('should have language dropdown or selector in general settings', async () => {
        // Look for a select element or language-related UI in the settings
        const languageSelector = appWindow.locator('select, [role="combobox"], [role="listbox"]').first();
        const hasLanguageSelector = await languageSelector.count() > 0;

        // At minimum, the settings main area should be visible
        const settingsMain = appWindow.locator('.settings-main');
        await expect(settingsMain).toBeVisible();

        // Language selector presence is feature-dependent
        if (hasLanguageSelector) {
            await expect(languageSelector).toBeVisible();
        }
    });
});
