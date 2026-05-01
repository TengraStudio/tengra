/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconLayersLinked, IconRefresh, IconShieldExclamation } from '@tabler/icons-react';
import React, { useEffect, useState } from 'react';

import type { LinkedAccountInfo } from '@/electron';
import { cn } from '@/lib/utils';
import { appLogger } from '@/utils/renderer-logger';

import type { SettingsSharedProps } from '../types';

import { AntigravityCard } from './statistics/AntigravityCard';
import { ClaudeCard } from './statistics/ClaudeCard';
import { CodexCard } from './statistics/CodexCard';
import { CopilotCard } from './statistics/CopilotCard';

type QuotasTabProps = Pick<
    SettingsSharedProps,
    'settings' | 'quotaData' | 'copilotQuota' | 'codexUsage' | 'claudeQuota' | 't' | 'setReloadTrigger'
>;

export const QuotasTab: React.FC<QuotasTabProps> = ({
    settings,
    quotaData,
    copilotQuota,
    codexUsage,
    claudeQuota,
    setReloadTrigger,
    t,
}) => {
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [hasDecryptionError, setHasDecryptionError] = useState(false);
    const [activeAntigravityAccount, setActiveAntigravityAccount] = useState<{ id?: string; email?: string } | null>(null);

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
                setLastUpdated(new Date());
            } catch (error) {
                appLogger.error('QuotasTab', 'Failed to load accounts status', error as Error);
            }
        };

        void loadStatus();
    }, [quotaData, copilotQuota, claudeQuota, codexUsage]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            await window.electron.forceRefreshQuota();
            // Trigger a reload of the stats data
            setReloadTrigger(prev => prev + 1);
            setLastUpdated(new Date());
        } catch (error) {
            appLogger.error('QuotasTab', 'Failed to refresh quotas', error as Error);
        } finally {
            setIsRefreshing(false);
        }
    };

    const locale = settings?.general.language ?? 'en-US';
    const totalServices = [quotaData, claudeQuota, copilotQuota, codexUsage].filter(Boolean).length;
    const errorServices = [quotaData, claudeQuota, copilotQuota, codexUsage].filter(s => s?.accounts?.some((a: { error?: string, success?: boolean }) => a.error || a.success === false)).length;

    return (
        <div className="mx-auto max-w-4xl space-y-8 pb-10">
            <div className="flex items-end justify-between px-1">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                            <IconLayersLinked className="w-6 h-6" />
                        </div>
                        <h3 className="text-xl font-bold text-foreground">
                            {t('frontend.statistics.connectedAppsUsage')}
                        </h3>
                    </div>
                    <p className="text-sm text-muted-foreground/60 px-0.5">
                        {t('frontend.statistics.usageStatistics')}
                    </p>
                </div>

                <div className="flex flex-col items-end gap-2">
                    <button
                        onClick={() => { void handleRefresh(); }}
                        disabled={isRefreshing}
                        className={cn(
                            "flex items-center gap-2 rounded-lg bg-muted/20 px-3 py-1.5 text-sm font-bold text-foreground/80 hover:bg-muted/30 transition-all",
                            isRefreshing && "opacity-50"
                        )}
                    >
                        <IconRefresh className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} />
                        {isRefreshing ? t('common.refreshing') : t('common.refresh')}
                    </button>
                    <span className="text-sm font-bold text-muted-foreground/40 tabular-nums">
                        {t('frontend.statistics.lastUpdated')}: {lastUpdated.toLocaleTimeString(locale)}
                    </span>
                </div>
            </div>

            {/* Quick Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-1">
                <div className="rounded-xl border border-border/10 bg-muted/5 p-3 flex flex-col gap-1">
                    <span className="text-sm font-bold text-muted-foreground/50 uppercase ">{t('frontend.statistics.services')}</span>
                    <span className="text-lg font-bold text-foreground">{totalServices}</span>
                </div>
                <div className="rounded-xl border border-border/10 bg-muted/5 p-3 flex flex-col gap-1">
                    <span className="text-sm font-bold text-muted-foreground/50 uppercase ">{t('frontend.statistics.active')}</span>
                    <span className="text-lg font-bold text-success">{totalServices - errorServices}</span>
                </div>
                <div className="rounded-xl border border-border/10 bg-muted/5 p-3 flex flex-col gap-1">
                    <span className="text-sm font-bold text-muted-foreground/50 uppercase ">{t('frontend.statistics.errors')}</span>
                    <span className="text-lg font-bold text-destructive">{errorServices}</span>
                </div>
                <div className="rounded-xl border border-border/10 bg-muted/5 p-3 flex flex-col gap-1">
                    <span className="text-sm font-bold text-muted-foreground/50 uppercase ">{t('frontend.statistics.health')}</span>
                    <span className="text-lg font-bold text-primary">{Math.round(((totalServices - errorServices) / Math.max(1, totalServices)) * 100)}%</span>
                </div>
            </div>

            {hasDecryptionError && (
                <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-5 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-start gap-4">
                        <IconShieldExclamation className="w-5 h-5 text-destructive mt-0.5" />
                        <div className="space-y-1">
                            <h4 className="text-sm font-bold text-foreground">
                                {t('frontend.security.decryptionErrorTitle')}
                            </h4>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {t('frontend.security.decryptionErrorDesc')}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-8">
                {/* Aggregators Category */}
                <div className="space-y-3">
                    <AntigravityCard
                        t={t}
                        quotaData={quotaData}
                        locale={locale}
                        activeAccountId={activeAntigravityAccount?.id ?? null}
                        activeAccountEmail={activeAntigravityAccount?.email ?? null}
                    />
                </div>

                {/* Direct Services Category */}
                <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <ClaudeCard claudeQuota={claudeQuota} locale={locale} />
                        <CopilotCard copilotQuota={copilotQuota} />
                        <CodexCard codexUsage={codexUsage} locale={locale} />
                    </div>
                </div>
            </div>
        </div>
    );
};
