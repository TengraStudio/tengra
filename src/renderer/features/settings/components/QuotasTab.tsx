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
import {
    SettingsPanel,
    SettingsStatCard,
    SettingsStatGrid,
    SettingsTabHeader,
    SettingsTabLayout,
} from './SettingsPrimitives';

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
                const accounts = await window.electron.auth.getLinkedAccounts();
                const anyError = accounts.some((acc: LinkedAccountInfo & { decryptionError?: boolean }) => acc.decryptionError);
                setHasDecryptionError(anyError);

                const account = await window.electron.auth.getActiveLinkedAccount('antigravity')
                    .catch(() => window.electron.auth.getActiveLinkedAccount('google')); 
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
            await window.electron.auth.forceRefreshQuota();
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
        <SettingsTabLayout>
            <SettingsTabHeader
                title={t('frontend.statistics.connectedAppsUsage')}
                description={t('frontend.statistics.usageStatistics')}
                icon={IconLayersLinked}
                actions={(
                    <div className="flex flex-col items-start gap-2 md:items-end">
                        <button
                            onClick={() => { void handleRefresh(); }}
                            disabled={isRefreshing}
                            className={cn(
                                'flex items-center gap-2 rounded-xl border border-border/20 bg-muted/10 px-4 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted/20',
                                isRefreshing && 'opacity-50'
                            )}
                        >
                            <IconRefresh className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
                            {isRefreshing ? t('common.refreshing') : t('common.refresh')}
                        </button>
                        <span className="text-xs font-medium text-muted-foreground/55 tabular-nums">
                            {t('frontend.statistics.lastUpdated')}: {lastUpdated.toLocaleTimeString(locale)}
                        </span>
                    </div>
                )}
            />

            <SettingsStatGrid>
                <SettingsStatCard label={t('frontend.statistics.services')} value={totalServices} />
                <SettingsStatCard label={t('frontend.statistics.active')} value={totalServices - errorServices} tone="success" />
                <SettingsStatCard label={t('frontend.statistics.errors')} value={errorServices} tone="destructive" />
                <SettingsStatCard label={t('frontend.statistics.health')} value={`${Math.round(((totalServices - errorServices) / Math.max(1, totalServices)) * 100)}%`} tone="primary" />
            </SettingsStatGrid>

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

            <div className="space-y-6">
                <SettingsPanel title={t('frontend.statistics.services')} icon={IconLayersLinked}>
                    <AntigravityCard
                        t={t}
                        quotaData={quotaData}
                        locale={locale}
                        activeAccountId={activeAntigravityAccount?.id ?? null}
                        activeAccountEmail={activeAntigravityAccount?.email ?? null}
                    />
                </SettingsPanel>

                <SettingsPanel title={t('frontend.statistics.active')} icon={IconLayersLinked}>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <ClaudeCard claudeQuota={claudeQuota} locale={locale} />
                        <CopilotCard copilotQuota={copilotQuota} />
                        <CodexCard codexUsage={codexUsage} locale={locale} />
                    </div>
                </SettingsPanel>
            </div>
        </SettingsTabLayout>
    );
};

