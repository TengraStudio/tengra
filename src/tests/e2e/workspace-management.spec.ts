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

import { closeElectronApp, launchElectronApp } from './e2e-test-utils';

test.describe('Workspace Management E2E', () => {
    let electronApp: ElectronApplication;
    let appWindow: Page;

    test.beforeAll(async () => {
        const launched = await launchElectronApp();
        electronApp = launched.electronApp;
        appWindow = launched.appWindow;
        await expect(appWindow.getByRole('complementary').first()).toBeVisible({ timeout: 10000 });
    });

    test.afterAll(async () => {
        await closeElectronApp(electronApp);
    });

    test('should display sidebar with navigation', async () => {
        const sidebar = appWindow.getByRole('complementary').first();
        await expect(sidebar).toBeVisible();
    });

    test('should navigate to workspace view', async () => {
        const workspacesButton = appWindow.getByTestId('sidebar-nav-workspace');
        await expect(workspacesButton).toBeVisible();
        await workspacesButton.click();
        await expect
            .poll(async () => workspacesButton.getAttribute('class'))
            .toContain('tengra-sidebar-item__button--active');
    });

    test('should display workspace list or empty state', async () => {
        // After navigating to workspaces, either a list or creation prompt should be visible.
        const workspaceGrid = appWindow.locator('[class*="WorkspaceCard"]').first();
        const emptyState = appWindow.getByText(/create new workspace|already exists|local workspace/i).first();

        const hasWorkspaces = await workspaceGrid.count() > 0;
        const hasEmptyState = await emptyState.count() > 0;

        // One of these should be visible on the workspace page.
        expect(hasWorkspaces || hasEmptyState).toBeTruthy();
    });

    test('should look for new workspace button', async () => {
        // Look for a button to create a new workspace.
        const newWorkspaceButton = appWindow.locator('button', {
            hasText: /new workspace|create new workspace|yeni proje|oluştur/i
        }).first();

        if (await newWorkspaceButton.count() > 0) {
            await expect(newWorkspaceButton).toBeVisible();
        }
    });

    test('should open workspace creation wizard if available', async () => {
        const newWorkspaceButton = appWindow.locator('button', {
            hasText: /new workspace|create new workspace|yeni proje|oluştur/i
        }).first();

        if (await newWorkspaceButton.count() > 0 && await newWorkspaceButton.isVisible()) {
            await newWorkspaceButton.click();

            // A modal or wizard should appear
            const modal = appWindow.locator('[role="dialog"], .modal, [class*="Modal"], [class*="Wizard"]').first();
            if (await modal.count() > 0) {
                await expect(modal).toBeVisible();

                // Close the wizard
                await appWindow.keyboard.press('Escape');
                await expect(modal).not.toBeVisible();
            }
        }
    });

    test('should verify workspace card interactions', async () => {
        // If workspaces exist, verify card elements are interactive.
        const workspaceCards = appWindow.locator('[class*="WorkspaceCard"]');
        const cardCount = await workspaceCards.count();

        if (cardCount > 0) {
            const firstCard = workspaceCards.first();
            await expect(firstCard).toBeVisible();

            // Right-click or context menu trigger
            await firstCard.click({ button: 'right' });

            // Dismiss context menu
            await appWindow.keyboard.press('Escape');
        }
    });
});
