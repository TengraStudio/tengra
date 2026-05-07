/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { LinkedAccount } from '@main/services/data/database.service';
import { LLMService } from '@main/services/llm/llm.service';
import { LocalImageProviders } from '@main/services/llm/local/local-image-providers';
import { ProxyService } from '@main/services/proxy/proxy.service';
import { AuthService } from '@main/services/security/auth.service';
import { SettingsService } from '@main/services/system/settings.service';
import { AppSettings } from '@shared/types/settings';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }
}));

const SETTINGS_FIXTURE: AppSettings = {
    ollama: { url: 'http://127.0.0.1:11434' },
    embeddings: { provider: 'none' },
    general: {
        language: 'tr',
        theme: 'dark',
        resolution: '1920x1080',
        fontSize: 14,

    },
    images: { provider: 'antigravity' },
};

const ACCOUNT_FIXTURE: LinkedAccount = {
    id: 'account-1',
    provider: 'antigravity',
    email: 'mockuser@example.com',
    accessToken: 'token',
    isActive: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
};

function createSettingsService(): SettingsService {
    // SAFETY: The test only exercises getSettings().
    return {
        getSettings: () => SETTINGS_FIXTURE,
    } as never as SettingsService;
}

function createAuthService(
    getAllAccountsFull: () => Promise<LinkedAccount[]>,
    setActiveAccount?: (provider: string, accountId: string) => Promise<void>
): AuthService {
    // SAFETY: The test only exercises getAllAccountsFull() and setActiveAccount().
    return {
        getAllAccountsFull,
        setActiveAccount,
    } as never as AuthService;
}

function createProxyService(
    getQuota: () => Promise<TestValue>
): ProxyService {
    // SAFETY: The test only exercises getQuota().
    return {
        getQuota,
    } as never as ProxyService;
}

function createLlmService(
    chat: (messages: Array<{ role: string; content: string }>, model: string, tools: TestValue[], provider: string) => Promise<{ images: string[] }>
): LLMService {
    // SAFETY: The test only exercises chat().
    return {
        chat,
    } as never as LLMService;
}

describe('LocalImageProviders', () => {
    const getAllAccountsFull = vi.fn<() => Promise<LinkedAccount[]>>();
    const setActiveAccount = vi.fn<(provider: string, accountId: string) => Promise<void>>();
    const getQuota = vi.fn();
    const chat = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('accepts Antigravity image model aliases when quota is available', async () => {
        getAllAccountsFull.mockResolvedValue([ACCOUNT_FIXTURE]);
        setActiveAccount.mockResolvedValue();
        getQuota.mockResolvedValue({
            accounts: [{
                accountId: ACCOUNT_FIXTURE.id,
                models: [{
                    id: 'gemini-3.1-flash-image',
                    name: 'Gemini 3.1 Flash Image',
                    quotaInfo: { remainingFraction: 0.42 },
                }],
            }],
        });
        chat.mockResolvedValue({
            images: ['safe-file://generated-image.png'],
        });

        const providers = new LocalImageProviders({
            settingsService: createSettingsService(),
            authService: createAuthService(getAllAccountsFull, setActiveAccount),
            proxyService: createProxyService(getQuota),
            llmService: createLlmService(chat),
        });

        const result = await providers.tryGenerateWithAntigravity({ prompt: 'Draw a lighthouse' });

        expect(result).toBe('safe-file://generated-image.png');
        expect(setActiveAccount).toHaveBeenCalledWith('antigravity', 'account-1');
        expect(chat).toHaveBeenCalledWith(
            [{ role: 'user', content: 'Draw a lighthouse' }],
            'gemini-3.1-flash-image',
            [],
            'antigravity'
        );
    });

    it('surfaces Google account verification errors instead of silently falling back', async () => {
        getAllAccountsFull.mockResolvedValue([ACCOUNT_FIXTURE]);
        setActiveAccount.mockResolvedValue();
        getQuota.mockResolvedValue({
            accounts: [{
                accountId: ACCOUNT_FIXTURE.id,
                models: [{
                    id: 'gemini-3.1-flash-image',
                    name: 'Gemini 3.1 Flash Image',
                    quotaInfo: { remainingFraction: 1 },
                }],
            }],
        });
        chat.mockRejectedValue(new Error(JSON.stringify({
            error: {
                code: 403,
                message: 'Verify your account to continue.',
                status: 'PERMISSION_DENIED',
                details: [
                    {
                        '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
                        metadata: {
                            validation_error_message: 'Verify your account to continue.',
                            validation_url: 'https://accounts.google.com/verify'
                        }
                    }
                ]
            }
        })));

        const providers = new LocalImageProviders({
            settingsService: createSettingsService(),
            authService: createAuthService(getAllAccountsFull, setActiveAccount),
            proxyService: createProxyService(getQuota),
            llmService: createLlmService(chat),
        });

        await expect(providers.tryGenerateWithAntigravity({ prompt: 'Draw a lighthouse' }))
            .rejects
            .toThrow('Verify your account to continue. https://accounts.google.com/verify');
    });
});

