/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 */

import { ElectronApplication, expect, Page, test } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

import { launchElectronApp, settleVisualState } from './e2e-test-utils';

type ProviderRun = {
    provider: string;
    thoughtPrompt: string;
    toolPrompt: string;
};

type ProviderSummary = {
    provider: string;
    selected: boolean;
    thoughtBlocksVisible: boolean;
    usingToolVisible: boolean;
    fileChangesVisible: boolean;
    reviewVisible: boolean;
    previewOpened: boolean;
    previewError: string | null;
};

const RUN_MATRIX: ProviderRun[] = [
    {
        provider: 'Copilot',
        thoughtPrompt: 'Think step by step about whether 91 is prime. Do not use tools. End with one short final answer.',
        toolPrompt: 'Create a file at tmp/tengra-ui-copilot.txt with the text "line 1", then append a second line with "line 2". After the tool work, confirm in one short sentence.'
    },
    {
        provider: 'Codex',
        thoughtPrompt: 'Think step by step about whether 91 is prime. Do not use tools. End with one short final answer.',
        toolPrompt: 'Create a file at tmp/tengra-ui-codex.txt with the text "line 1", then append a second line with "line 2". After the tool work, confirm in one short sentence.'
    },
    {
        provider: 'Claude',
        thoughtPrompt: 'Think step by step about whether 91 is prime. Do not use tools. End with one short final answer.',
        toolPrompt: 'Create a file at tmp/tengra-ui-claude.txt with the text "line 1", then append a second line with "line 2". After the tool work, confirm in one short sentence.'
    },
    {
        provider: 'Antigravity',
        thoughtPrompt: 'Think step by step about whether 91 is prime. Do not use tools. End with one short final answer.',
        toolPrompt: 'Create a file at tmp/tengra-ui-antigravity.txt with the text "line 1", then append a second line with "line 2". After the tool work, confirm in one short sentence.'
    },
    {
        provider: 'Ollama',
        thoughtPrompt: 'Think step by step about whether 91 is prime. Do not use tools. End with one short final answer.',
        toolPrompt: 'Create a file at tmp/tengra-ui-ollama.txt with the text "line 1", then append a second line with "line 2". After the tool work, confirm in one short sentence.'
    },
    {
        provider: 'OpenCode',
        thoughtPrompt: 'Think step by step about whether 91 is prime. Do not use tools. End with one short final answer.',
        toolPrompt: 'Create a file at tmp/tengra-ui-opencode.txt with the text "line 1", then append a second line with "line 2". After the tool work, confirm in one short sentence.'
    }
];

const OUT_DIR = path.resolve(process.cwd(), 'assets', `test-thought-tool-ui-${new Date().toISOString().slice(0, 10)}`);

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

async function setThinkingMode(page: Page): Promise<void> {
    await openModelSelector(page);
    const modeTrigger = page.locator('button[role="combobox"]').filter({ hasText: /instant|thinking|agent/i }).last();
    if (await modeTrigger.isVisible().catch(() => false)) {
        await modeTrigger.click();
        await page.getByRole('option', { name: /^Thinking$/i }).click();
    }
    await page.keyboard.press('Escape');
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

async function waitForResponseSettled(page: Page, timeoutMs: number = 60000): Promise<void> {
    const start = Date.now();
    while ((Date.now() - start) < timeoutMs) {
        const bodyText = await page.locator('body').innerText().catch(() => '');
        const stillThinking = /Thinking\.\.\./i.test(bodyText);
        const hasSignals = /Thought #\d+|Using tool|file changed|files changed|Review|line 2|prime/i.test(bodyText);
        if (!stillThinking && hasSignals) {
            await page.waitForTimeout(1200);
            return;
        }
        await page.waitForTimeout(1000);
    }
}

async function readBodyText(page: Page): Promise<string> {
    return page.locator('body').innerText().catch(() => '');
}

test.describe('Chat Thought Blocks And Tool UI', () => {
    let electronApp: ElectronApplication;
    let appWindow: Page;
    test.setTimeout(12 * 60 * 1000);

    test.beforeAll(async () => {
        await fs.mkdir(OUT_DIR, { recursive: true });
        const launched = await launchElectronApp();
        electronApp = launched.electronApp;
        appWindow = await resolveMainWindow(electronApp, launched.appWindow);
        await settleVisualState(appWindow);
        await expect(appWindow.locator('body')).toBeVisible({ timeout: 30000 });
        await appWindow.screenshot({ path: path.join(OUT_DIR, '00-app-open.png'), fullPage: true });
    });

    test('captures provider thought blocks and file-change UI', async () => {
        const summary: ProviderSummary[] = [];

        for (const run of RUN_MATRIX) {
            await ensureNewChat(appWindow);
            await setThinkingMode(appWindow);
            const selected = await pickProviderAndFirstModel(appWindow, run.provider);
            const record: ProviderSummary = {
                provider: run.provider,
                selected,
                thoughtBlocksVisible: false,
                usingToolVisible: false,
                fileChangesVisible: false,
                reviewVisible: false,
                previewOpened: false,
                previewError: null,
            };

            if (!selected) {
                summary.push(record);
                continue;
            }

            await sendPrompt(appWindow, run.thoughtPrompt);
            await waitForResponseSettled(appWindow, 45000);
            const thoughtBodyText = await readBodyText(appWindow);
            record.thoughtBlocksVisible = /Thought #\d+/i.test(thoughtBodyText);
            record.usingToolVisible = /Using tool/i.test(thoughtBodyText);
            await appWindow.screenshot({
                path: path.join(OUT_DIR, `${run.provider.toLowerCase()}-thought.png`),
                fullPage: true
            });

            await ensureNewChat(appWindow);
            await setThinkingMode(appWindow);
            await pickProviderAndFirstModel(appWindow, run.provider);
            await sendPrompt(appWindow, run.toolPrompt);
            await waitForResponseSettled(appWindow, 90000);
            const toolBodyText = await readBodyText(appWindow);
            record.fileChangesVisible = /\bfile changed\b|\bfiles changed\b/i.test(toolBodyText);
            record.reviewVisible = await appWindow.getByRole('button', { name: /^Review$/i }).first().isVisible().catch(() => false);

            if (record.reviewVisible) {
                await appWindow.getByRole('button', { name: /^Review$/i }).first().click();
                await appWindow.waitForTimeout(1500);
                record.previewOpened = await appWindow.getByLabel('Close preview').isVisible().catch(() => false);
                if (record.previewOpened) {
                    const maybeError = await appWindow.locator('text=/Failed to (open file|load diff)/i').first().textContent().catch(() => null);
                    record.previewError = maybeError ? maybeError.trim() : null;
                }
            }

            await appWindow.screenshot({
                path: path.join(OUT_DIR, `${run.provider.toLowerCase()}-tool-ui.png`),
                fullPage: true
            });

            summary.push(record);
        }

        await fs.writeFile(
            path.join(OUT_DIR, 'summary.json'),
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

