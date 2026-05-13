/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconLayersLinked, IconShieldExclamation } from '@tabler/icons-react';
import React, { useEffect, useState } from 'react';

import type { LinkedAccountInfo } from '@/electron';
import { appLogger } from '@/utils/renderer-logger';

import type { SettingsSharedProps } from '../types';

import { AntigravityCard } from './statistics/AntigravityCard';
import { ClaudeCard } from './statistics/ClaudeCard';
import { CodexCard } from './statistics/CodexCard';
import { CopilotCard } from './statistics/CopilotCard';
import { CursorCard } from './statistics/CursorCard';
import {
    SettingsPanel,
    SettingsTabLayout,
} from './SettingsPrimitives';

type QuotasTabProps = Pick<
    SettingsSharedProps,
    'settings' | 'quotaData' | 'copilotQuota' | 'codexUsage' | 'claudeQuota' | 'cursorQuota' | 't' | 'setReloadTrigger'
>;

export const QuotasTab: React.FC<QuotasTabProps> = ({
    settings,
    quotaData,
    copilotQuota,
    codexUsage,
    claudeQuota,
    cursorQuota,
    t,
}) => {
    const [hasDecryptionError, setHasDecryptionError] = useState(false);
    const [activeAccounts, setActiveAccounts] = useState<Record<string, { id?: string; email?: string } | null>>({});

    useEffect(() => {
        const loadStatus = async () => {
            try {
                // Check all accounts for decryption errors
                const accounts = await window.electron.auth.getLinkedAccounts();
                const anyError = accounts.some((acc: LinkedAccountInfo & { decryptionError?: boolean }) => acc.decryptionError);
                setHasDecryptionError(anyError);

                const providers = ['antigravity', 'google', 'copilot', 'codex', 'claude', 'cursor'] as const;
                const resolved = await Promise.all(
                    providers.map(async provider => {
                        const account = await window.electron.auth.getActiveLinkedAccount(provider).catch(() => null);
                        return [provider, account ? { id: account.id, email: account.email } : null] as const;
                    })
                );
                setActiveAccounts(Object.fromEntries(resolved));
            } catch (error) {
                appLogger.error('QuotasTab', 'Failed to load accounts status', error as Error);
            }
        };

        void loadStatus();
    }, [quotaData, copilotQuota, claudeQuota, codexUsage, cursorQuota]);

    const locale = settings?.general.language ?? 'en-US';

    return (
        <SettingsTabLayout>
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
                        activeAccountId={activeAccounts.antigravity?.id ?? null}
                        activeAccountEmail={activeAccounts.antigravity?.email ?? null}
                    />
                </SettingsPanel>

                <SettingsPanel title={t('frontend.statistics.active')} icon={IconLayersLinked}>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 px-6 py-2">
                        <ClaudeCard
                            claudeQuota={claudeQuota}
                            locale={locale}
                            activeAccountId={activeAccounts.claude?.id ?? null}
                            activeAccountEmail={activeAccounts.claude?.email ?? null}
                        />
                        <CopilotCard
                            copilotQuota={copilotQuota}
                            activeAccountId={activeAccounts.copilot?.id ?? null}
                            activeAccountEmail={activeAccounts.copilot?.email ?? null}
                        />
                        <CodexCard
                            codexUsage={codexUsage}
                            locale={locale}
                            activeAccountId={activeAccounts.codex?.id ?? null}
                            activeAccountEmail={activeAccounts.codex?.email ?? null}
                        />
                        <CursorCard cursorQuota={cursorQuota} locale={locale} />
                    </div>
                </SettingsPanel>
            </div>
        </SettingsTabLayout>
    );
};

