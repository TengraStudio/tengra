/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/select', async () => {
    const ReactModule = await import('react');
    const SelectContext = ReactModule.createContext<{
        value?: string;
        onValueChange?: (value: string) => void;
    }>({});

    const Select = ({
        value,
        onValueChange,
        children,
    }: {
        value?: string;
        onValueChange?: (value: string) => void;
        children: React.ReactNode;
    }) => (
        <SelectContext.Provider value={{ value, onValueChange }}>
            {children}
        </SelectContext.Provider>
    );

    const SelectTrigger = ReactModule.forwardRef<HTMLButtonElement, React.ComponentProps<'button'>>(
        ({ children, ...props }, ref) => (
            <button ref={ref} type="button" {...props}>
                {children}
            </button>
        )
    );

    const SelectValue = ({ placeholder }: { placeholder?: string }) => {
        const context = ReactModule.useContext(SelectContext);
        return <span>{context.value ?? placeholder ?? ''}</span>;
    };

    const SelectContent = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;

    const SelectItem = ({
        value,
        children,
    }: {
        value: string;
        children: React.ReactNode;
    }) => {
        const context = ReactModule.useContext(SelectContext);
        return (
            <button type="button" onClick={() => context.onValueChange?.(value)}>
                {children}
            </button>
        );
    };

    return {
        Select,
        SelectContent,
        SelectItem,
        SelectTrigger,
        SelectValue,
    };
});

import type { LinkedAccountInfo } from '@/electron.d';
import { AccountRow } from '@/features/settings/components/accounts/AccountRow';
import {
    buildAntigravityCreditModeSettings,
    findMatchingQuotaAccount,
    getCreditUsageMode,
} from '@/features/settings/components/AccountsTab';
import type { QuotaResponse } from '@/types/quota';
import type { AppSettings } from '@/types/settings';

const t = (key: string) => {
    const messages: Record<string, string> = {
        'accounts.account': 'Account',
        'accounts.noEmail': 'No email',
        'accounts.active': 'Active',
        'accounts.setActive': 'Set active',
        'accounts.removeAccount': 'Remove account',
        'common.auto': 'Auto',
        'modelSelector.mode': 'Mode',
        'models.creditsLeft': 'Credits left',
        'workspaceAgent.permissions.policy.ask-every-time': 'Ask every time',
    };
    return messages[key] ?? key;
};

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
        email: 'mockuser@example.com',
        displayName: 'agnes',
        isActive: true,
        createdAt: Date.now(),
        ...overrides,
    };
}

function createQuota(overrides?: Partial<QuotaResponse>): QuotaResponse {
    return {
        status: 'ok',
        next_reset: '2026-04-11T00:00:00.000Z',
        models: [],
        accountId: 'account-1',
        email: 'mockuser@example.com',
        antigravityAiCredits: {
            creditAmount: 12,
            useAICredits: true,
            canUseCredits: true,
        },
        ...overrides,
    };
}

describe('Antigravity credit settings helpers', () => {
    it('matches quota accounts by linked account id before email fallback', () => {
        const linkedAccount = createAccount({ email: 'different@example.com' });
        const quotaData = {
            accounts: [
                createQuota({ accountId: 'other-account', email: linkedAccount.email }),
                createQuota({ accountId: linkedAccount.id, email: 'quota@example.com' }),
            ],
        };

        const match = findMatchingQuotaAccount(linkedAccount, quotaData);

        expect(match?.accountId).toBe(linkedAccount.id);
        expect(match?.email).toBe('quota@example.com');
    });

    it('prefers saved per-account mode and falls back to upstream auto state', () => {
        const savedSettings = createSettings();
        savedSettings.antigravity = {
            connected: true,
            creditUsageModeByAccount: {
                'account-1': 'ask-every-time',
            }
        };

        expect(getCreditUsageMode(savedSettings, 'account-1', createQuota())).toBe('ask-every-time');
        expect(getCreditUsageMode(createSettings(), 'account-2', createQuota())).toBe('auto');
        expect(getCreditUsageMode(createSettings(), 'account-3', createQuota({
            antigravityAiCredits: {
                creditAmount: 0,
                useAICredits: false,
                canUseCredits: false,
            }
        }))).toBe('ask-every-time');
    });

    it('writes the selected credit mode without dropping existing account settings', () => {
        const settings = createSettings();
        settings.antigravity = {
            connected: true,
            creditUsageModeByAccount: {
                'existing-account': 'auto',
            }
        };

        const nextSettings = buildAntigravityCreditModeSettings(settings, 'account-1', 'ask-every-time');

        expect(nextSettings.antigravity?.creditUsageModeByAccount).toEqual({
            'existing-account': 'auto',
            'account-1': 'ask-every-time',
        });
    });
});

describe('AccountRow', () => {
    it('shows credits and lets the user change the Antigravity credit mode', () => {
        const onCreditUsageModeChange = vi.fn();
        const account = createAccount();

        render(
            <AccountRow
                account={account}
                isLast={true}
                isBusy={false}
                providerId="antigravity"
                creditAmount={12}
                creditUsageMode="auto"
                onUnlink={vi.fn().mockResolvedValue(undefined)}
                onSetActive={vi.fn().mockResolvedValue(undefined)}
                onShowManualSession={vi.fn()}
                onCreditUsageModeChange={onCreditUsageModeChange}
                t={t}
            />
        );

        expect(screen.getByText('Credits left: 12')).toBeInTheDocument();
        expect(screen.getByTestId('antigravity-credit-mode-account-1')).toHaveTextContent('auto');
        fireEvent.click(screen.getByText('Ask every time'));

        expect(onCreditUsageModeChange).toHaveBeenCalledWith('account-1', 'ask-every-time');
    });
});

