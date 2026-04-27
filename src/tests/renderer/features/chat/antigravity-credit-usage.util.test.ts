/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { describe, expect, it } from 'vitest';

import type { LinkedAccountInfo } from '@/electron.d';
import {
    findMatchingQuotaAccount,
    shouldConfirmAntigravityCreditUsage,
} from '@/features/chat/hooks/antigravity-credit-usage.util';
import type { AppSettings } from '@/types';
import type { QuotaResponse } from '@/types/quota';

function createSettings(): AppSettings {
    return {
        ollama: { url: 'http://localhost:11434' },
        embeddings: { provider: 'none' },
        general: {
            language: 'en',
            theme: 'dark',
            resolution: '1920x1080',
            fontSize: 14,
        },
        antigravity: {
            connected: true,
            creditUsageModeByAccount: {},
        },
    };
}

function createAccount(overrides?: Partial<LinkedAccountInfo>): LinkedAccountInfo {
    return {
        id: 'account-1',
        provider: 'antigravity',
        email: 'trtheclawnz@gmail.com',
        displayName: 'Primary',
        isActive: true,
        createdAt: Date.now(),
        ...overrides,
    };
}

function createQuota(overrides?: Partial<QuotaResponse>): QuotaResponse {
    return {
        status: 'ok',
        next_reset: '2026-04-11T00:00:00.000Z',
        accountId: 'account-1',
        email: 'trtheclawnz@gmail.com',
        antigravityAiCredits: {
            creditAmount: 19,
            minimumCreditAmountForUsage: 10,
            useAICredits: true,
            canUseCredits: true,
            hasSufficientCredits: true,
        },
        models: [{
            id: 'gemini-3.1-pro',
            name: 'Gemini 3.1 Pro',
            object: 'model',
            owned_by: 'antigravity',
            provider: 'antigravity',
            percentage: 0,
            reset: '2026-04-11T00:00:00.000Z',
            permission: [],
            quotaInfo: {
                remainingQuota: 0,
                totalQuota: 100,
                remainingFraction: 0,
                resetTime: '2026-04-11T00:00:00.000Z',
                aiCredits: {
                    creditAmount: 19,
                    minimumCreditAmountForUsage: 10,
                    useAICredits: true,
                    canUseCredits: true,
                    hasSufficientCredits: true,
                },
            },
        }],
        ...overrides,
    };
}

describe('antigravity-credit-usage util', () => {
    it('matches quota accounts by account id before email fallback', () => {
        const linkedAccount = createAccount({ email: 'other@example.com' });
        const quotaData = {
            accounts: [
                createQuota({ accountId: 'account-2', email: linkedAccount.email }),
                createQuota({ accountId: linkedAccount.id, email: 'quota@example.com' }),
            ],
        };

        const match = findMatchingQuotaAccount(linkedAccount, quotaData);

        expect(match?.accountId).toBe(linkedAccount.id);
        expect(match?.email).toBe('quota@example.com');
    });

    it('requires confirmation when ask-every-time is set and credits can cover exhausted quota', () => {
        const settings = createSettings();
        settings.antigravity = {
            connected: true,
            creditUsageModeByAccount: {
                'account-1': 'ask-every-time',
            },
        };

        const result = shouldConfirmAntigravityCreditUsage({
            provider: 'antigravity',
            model: 'antigravity/gemini-3.1-pro-high',
            settings,
            linkedAccounts: [createAccount()],
            quotaData: { accounts: [createQuota()] },
        });

        expect(result).not.toBeNull();
        expect(result?.account.id).toBe('account-1');
        expect(result?.creditAmount).toBe(19);
        expect(result?.minimumCreditAmountForUsage).toBe(10);
    });

    it('skips confirmation when the saved mode is auto', () => {
        const result = shouldConfirmAntigravityCreditUsage({
            provider: 'antigravity',
            model: 'gemini-3.1-pro',
            settings: createSettings(),
            linkedAccounts: [createAccount()],
            quotaData: { accounts: [createQuota()] },
        });

        expect(result).toBeNull();
    });
});
