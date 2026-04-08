import { Badge } from '@renderer/components/ui/badge';
import { Activity, Layers } from 'lucide-react';
import React, { useEffect, useState } from 'react';

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

    useEffect(() => {
        const loadActiveAntigravityAccount = async () => {
            try {
                const account = await window.electron.getActiveLinkedAccount('antigravity')
                    .catch(() => window.electron.getActiveLinkedAccount('google'));
                setActiveAntigravityAccount(account ? { id: account.id, email: account.email } : null);
            } catch (error) {
                appLogger.error('QuotasTab', 'Failed to load active Antigravity account', error as Error);
            }
        };

        void loadActiveAntigravityAccount();
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

            <div className="rounded-3xl border border-border/20 bg-muted/5 p-5 sm:p-6">
                <div className="mb-4 flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <Activity className="w-4 h-4 text-primary" />
                        <h4 className="text-xs font-medium text-foreground">{t('statistics.connectedServices')}</h4>
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
