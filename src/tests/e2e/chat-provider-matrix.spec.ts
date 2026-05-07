/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 */

import { ElectronApplication, expect, Page, test } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

import { launchElectronApp } from './e2e-test-utils';

type ProviderRun = {
    provider: string;
    nonToolPrompt: string;
    toolPrompt: string;
};

const RUN_MATRIX: ProviderRun[] = [
    { provider: 'Copilot', nonToolPrompt: 'Say hello in one short sentence.', toolPrompt: 'List files in the current workspace.' },
    { provider: 'Codex', nonToolPrompt: 'What is 2 + 2 in one sentence?', toolPrompt: 'List files in the current workspace.' },
    { provider: 'Claude', nonToolPrompt: 'Explain HTTP in one short paragraph.', toolPrompt: 'List files in the current workspace.' },
    { provider: 'Antigravity', nonToolPrompt: 'Write one sentence about Istanbul.', toolPrompt: 'List files in the current workspace.' },
    { provider: 'Ollama', nonToolPrompt: 'Say hello in one short sentence.', toolPrompt: 'List files in the current workspace.' },
    { provider: 'OpenCode', nonToolPrompt: 'Write one sentence about Istanbul.', toolPrompt: 'List files in the current workspace.' }
];

const OUT_DIR = path.resolve(process.cwd(), 'assets', `test-chat-screenshots-${new Date().toISOString().slice(0, 10)}-rerun`);

async function resolveMainWindow(electronApp: ElectronApplication, initialWindow: Page): Promise<Page> {
    const candidates = [initialWindow, ...electronApp.windows()];
    for (const win of candidates) {
        const newChat = win.getByRole('button', { name: /new chat/i }).first();
        if (await newChat.isVisible().catch(() => false)) {
            return win;
        }
    }
    await electronApp.waitForEvent('window', { timeout: 20000 }).catch(() => null);
    for (const win of electronApp.windows()) {
        const newChat = win.getByRole('button', { name: /new chat/i }).first();
        if (await newChat.isVisible().catch(() => false)) {
            return win;
        }
    }
    return initialWindow;
}

async function openModelSelector(page: Page): Promise<void> {
    const byTestId = page.getByTestId('model-selector');
    if (await byTestId.isVisible().catch(() => false)) {
        await byTestId.click();
        return;
    }
    const chatInputGroup = page.getByRole('group', { name: /chat input/i });
    await expect(chatInputGroup).toBeVisible({ timeout: 20000 });
    await chatInputGroup.locator('button').first().click();
}

async function pickProviderAndFirstModel(page: Page, provider: string): Promise<boolean> {
    await openModelSelector(page);

    const providerButton = page.getByRole('button', { name: new RegExp(provider, 'i') }).first();
    if (!(await providerButton.isVisible().catch(() => false))) {
        await page.keyboard.press('Escape');
        return false;
    }
    await providerButton.click({ force: true });
    await page.waitForTimeout(300);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    return true;
}

async function sendPrompt(page: Page, prompt: string): Promise<void> {
    const byTestId = page.getByTestId('chat-textarea');
    const fallbackInput = page.locator('[role="combobox"], textarea, [contenteditable="true"]').first();
    const input = (await byTestId.isVisible().catch(() => false))
        ? byTestId
        : fallbackInput;
    await expect(input).toBeVisible({ timeout: 15000 });
    await input.fill(prompt);
    await input.press('Enter');
}

async function waitForAssistantActivity(page: Page): Promise<void> {
    await page.waitForTimeout(1500);
    await page.waitForTimeout(6000);
}

async function ensureNewChat(page: Page): Promise<void> {
    const newChat = page.getByTestId('new-chat-button');
    if (await newChat.isVisible().catch(() => false)) {
        await newChat.click();
        await page.waitForTimeout(500);
        return;
    }
    const fallback = page.getByRole('button', { name: /new chat/i }).first();
    if (await fallback.isVisible().catch(() => false)) {
        await fallback.click();
        await page.waitForTimeout(500);
    }
}

test.describe('Chat Provider Matrix', () => {
    let electronApp: ElectronApplication;
    let appWindow: Page;
    test.setTimeout(10 * 60 * 1000);

    test.beforeAll(async () => {
        await fs.mkdir(OUT_DIR, { recursive: true });
        const launched = await launchElectronApp();
        electronApp = launched.electronApp;
        appWindow = await resolveMainWindow(electronApp, launched.appWindow);
        const chatView = appWindow.getByTestId('chat-view');
        const chatInput = appWindow.locator('[role="combobox"], textarea, [contenteditable="true"]').first();
        if (await chatView.isVisible().catch(() => false)) {
            await expect(chatView).toBeVisible({ timeout: 30000 });
        } else {
            await expect(chatInput).toBeVisible({ timeout: 30000 });
        }
        await appWindow.screenshot({ path: path.join(OUT_DIR, '00-app-open.png'), fullPage: true });
    });

    test('run provider matrix and capture screenshots', async () => {
        const summary: Array<{ provider: string; selected: boolean }> = [];

        for (const run of RUN_MATRIX) {
            await ensureNewChat(appWindow);
            const selected = await pickProviderAndFirstModel(appWindow, run.provider);
            summary.push({ provider: run.provider, selected });
            if (!selected) {
                continue;
            }

            await sendPrompt(appWindow, run.nonToolPrompt);
            await waitForAssistantActivity(appWindow);
            await appWindow.screenshot({
                path: path.join(OUT_DIR, `${run.provider.toLowerCase()}-non-tool.png`),
                fullPage: true
            });

            await ensureNewChat(appWindow);
            await pickProviderAndFirstModel(appWindow, run.provider);
            await sendPrompt(appWindow, run.toolPrompt);
            await waitForAssistantActivity(appWindow);
            await appWindow.screenshot({
                path: path.join(OUT_DIR, `${run.provider.toLowerCase()}-tool.png`),
                fullPage: true
            });
        }

        await fs.writeFile(
            path.join(OUT_DIR, 'selection-summary.json'),
            JSON.stringify(summary, null, 2),
            'utf8'
        );
    });

    test.afterAll(async () => {
        try {
            await electronApp.evaluate(async ({ app }) => {
                app.quit();
            });
        } catch {
            // noop
        }
    });
});

