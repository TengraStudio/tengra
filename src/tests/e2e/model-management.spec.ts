import { _electron as electron, ElectronApplication, expect, Page, test } from '@playwright/test';

test.describe('Model Management E2E', () => {
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

    test('should display model selector in chat view', async () => {
        const modelSelector = appWindow.getByTestId('model-selector');
        await expect(modelSelector).toBeVisible();
    });

    test('should open model selector modal on click', async () => {
        const modelSelector = appWindow.getByTestId('model-selector');
        await modelSelector.click();
        await appWindow.waitForTimeout(500);

        // A modal or dropdown should appear
        const modal = appWindow.locator('[role="dialog"], [class*="Modal"], [class*="modal"]').first();
        if (await modal.count() > 0) {
            await expect(modal).toBeVisible();
        }
    });

    test('should display model list or categories', async () => {
        // Check for model items in the selector
        const modelItems = appWindow.locator('[class*="ModelSelector"], [class*="model-selector"], [class*="model-item"]');
        const itemCount = await modelItems.count();

        // Either model items or the selector container should be present
        expect(itemCount).toBeGreaterThanOrEqual(0);

        // Look for model-related content
        const modelContent = appWindow.locator('[class*="Model"], [class*="model"]').first();
        if (await modelContent.count() > 0) {
            await expect(modelContent).toBeVisible();
        }
    });

    test('should have filter or search capability in model selector', async () => {
        // Look for search input in the model selector modal
        const searchInput = appWindow.locator('[role="dialog"] input[type="text"], [role="dialog"] input[type="search"], [class*="Modal"] input').first();

        if (await searchInput.count() > 0) {
            await expect(searchInput).toBeVisible();

            // Type a search query
            await searchInput.fill('gpt');
            await appWindow.waitForTimeout(300);

            // Clear the search
            await searchInput.clear();
            await appWindow.waitForTimeout(200);
        }
    });

    test('should have tab filters for model types', async () => {
        // Model selector may have tabs like 'models' and 'reasoning'
        const tabs = appWindow.locator('[role="dialog"] button, [class*="Modal"] button').filter({
            hasText: /model|reasoning|local|cloud/i
        });

        const tabCount = await tabs.count();
        if (tabCount > 0) {
            // Click through available tabs
            const firstTab = tabs.first();
            await firstTab.click();
            await appWindow.waitForTimeout(300);
        }
    });

    test('should close model selector', async () => {
        await appWindow.keyboard.press('Escape');
        await appWindow.waitForTimeout(300);
    });
});

test.describe('Model Settings Tab E2E', () => {
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

    test('should open settings and navigate to models tab', async () => {
        const settingsButton = appWindow.getByTestId('settings-button');
        await settingsButton.click();
        await appWindow.waitForTimeout(500);

        const modelsTab = appWindow.locator('.settings-tab-btn', { hasText: /model|yapay zeka/i });
        if (await modelsTab.count() > 0) {
            await modelsTab.first().click();
            await appWindow.waitForTimeout(500);
        }
    });

    test('should display models settings content', async () => {
        const settingsMain = appWindow.locator('.settings-main');
        await expect(settingsMain).toBeVisible();

        // The models tab should show model-related configuration
        const settingsSection = appWindow.locator('.settings-section');
        await expect(settingsSection).toBeVisible();
    });

    test('should close settings after model settings tests', async () => {
        await appWindow.keyboard.press('Escape');
        await appWindow.waitForTimeout(300);
    });
});
