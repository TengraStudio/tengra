/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Badge } from '@renderer/components/ui/badge';
import { Activity, Layers, ShieldAlert } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import type { LinkedAccountInfo } from '@/electron';
import { appLogger } from '@/utils/renderer-logger';

import type { SettingsSharedProps } from '../types';

import { AntigravityCard } from './statistics/AntigravityCard';
import { ClaudeCard } from './statistics/ClaudeCard';
import { CodexCard } from './statistics/CodexCard';
import { CopilotCard } from './statistics/CopilotCard';

type QuotasTabProps = Pick<
    SettingsSharedProps,
    'settings' | 'quotaData' | 'copilotQuota' | 'codexUsage' | 'claudeQuota' | 't'
>;

export const QuotasTab: React.FC<QuotasTabProps> = ({
    settings,
    quotaData,
    copilotQuota,
    codexUsage,
    claudeQuota,
    t,
}) => {
    const [activeAntigravityAccount, setActiveAntigravityAccount] = useState<{ id?: string; email?: string } | null>(null);
    const [hasDecryptionError, setHasDecryptionError] = useState(false);

    useEffect(() => {
        const loadStatus = async () => {
            try {
                // Check all accounts for decryption errors
                const accounts = await window.electron.getLinkedAccounts();
                const anyError = accounts.some((acc: LinkedAccountInfo & { decryptionError?: boolean }) => acc.decryptionError);
                setHasDecryptionError(anyError);

                const account = await window.electron.getActiveLinkedAccount('antigravity')
                    .catch(() => window.electron.getActiveLinkedAccount('google'));
                setActiveAntigravityAccount(account ? { id: account.id, email: account.email } : null);
            } catch (error) {
                appLogger.error('QuotasTab', 'Failed to load accounts status', error as Error);
            }
        };

        void loadStatus();
    }, []);

    const locale = settings?.general.language ?? 'en-US';

    return (
        <div className="mx-auto max-w-6xl space-y-6 pb-10">
            <div className="px-1">
                <div className="mb-3 flex items-center gap-4">
                    <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                        <Layers className="w-7 h-7" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-semibold text-foreground leading-none">
                            {t('statistics.connectedAppsUsage')}
                        </h3>
                    </div>
                </div>
                <p className="max-w-2xl px-1 text-sm leading-relaxed text-muted-foreground/70">
                    {t('statistics.usageStatistics')}
                </p>
            </div>

            {hasDecryptionError && (
                <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-6 mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="flex items-start gap-4">
                        <div className="rounded-2xl bg-destructive/10 p-3 text-destructive">
                            <ShieldAlert className="w-6 h-6" />
                        </div>
                        <div className="space-y-2">
                            <h4 className="text-lg font-bold text-foreground">
                                {t('security.decryptionErrorTitle') || 'Security Key Mismatch'}
                            </h4>
                            <p className="typo-body text-muted-foreground font-bold opacity-80 leading-relaxed">
                                {t('security.decryptionErrorDesc') || 'Some of your account tokens cannot be decrypted. This usually happens if the master security key was reset or corrupted. Please go to Advanced settings to Reset your Encryption Key or re-link your accounts.'}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="rounded-3xl border border-border/20 bg-muted/5 p-5 sm:p-6">
                <div className="mb-4 flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <Activity className="w-4 h-4 text-primary" />
                        <h4 className="typo-caption font-medium text-foreground">{t('statistics.connectedServices')}</h4>
                    </div>
                    <Badge variant="outline" className="h-6 w-fit border-border/20 px-2 typo-body text-muted-foreground">
                        {t('statistics.live')}
                    </Badge>
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <AntigravityCard
                        t={t}
                        quotaData={quotaData}
                        locale={locale}
                        activeAccountId={activeAntigravityAccount?.id ?? null}
                        activeAccountEmail={activeAntigravityAccount?.email ?? null}
                    />
                    <ClaudeCard claudeQuota={claudeQuota} locale={locale} />
                    <CopilotCard copilotQuota={copilotQuota} />
                    <CodexCard codexUsage={codexUsage} locale={locale} />
                </div>
            </div>
        </div>
    );
};
