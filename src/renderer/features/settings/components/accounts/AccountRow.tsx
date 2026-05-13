/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconCheck, IconKey, IconTrash, IconUser } from '@tabler/icons-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { LinkedAccountInfo } from '@/electron.d';
import { cn } from '@/lib/utils';
import type { AntigravityCreditUsageMode } from '@/types/settings';

/* Batch-02: Extracted Long Classes */
const C_ACCOUNTROW_1 = "inline-flex items-center gap-1 rounded-md border border-success/20 bg-success/10 px-2.5 py-1 typo-caption font-medium text-success";
const C_ACCOUNTROW_2 = "h-8 border-border/30 bg-background px-3 typo-caption font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground";


interface AccountRowProps {
    account: LinkedAccountInfo
    isLast: boolean
    isBusy: boolean
    providerId: string
    creditAmount?: number
    creditUsageMode?: AntigravityCreditUsageMode
    onUnlink: (accountId: string) => Promise<void>
    onSetActive: (providerId: string, accountId: string) => Promise<void>
    onShowManualSession: (accountId: string, email?: string, provider?: string) => void
    onCreditUsageModeChange?: (accountId: string, mode: AntigravityCreditUsageMode) => void
    t: (key: string) => string
}

export const AccountRow: React.FC<AccountRowProps> = ({
    account,
    isLast,
    isBusy,
    providerId,
    creditAmount,
    creditUsageMode = 'ask-every-time',
    onUnlink,
    onSetActive,
    onShowManualSession,
    onCreditUsageModeChange,
    t
}) => {
    const creditLabel = typeof creditAmount === 'number'
        ? `${t('frontend.models.creditsLeft')}: ${Math.max(0, Math.round(creditAmount))}`
        : null;
    const showAntigravityControls = providerId === 'antigravity';

    return (
        <div
            className={cn(
                'flex flex-col gap-3 px-4 py-4 transition-colors sm:flex-row sm:items-center sm:gap-4',
                !isLast && 'border-b border-border/30',
                account.isActive && 'bg-primary/5'
            )}
        >
            <div className="flex items-center gap-3 sm:flex-1 sm:min-w-0">
                <div className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/20 bg-muted/50 transition-colors',
                    account.isActive && 'border-primary/30 bg-primary/10'
                )}>
                    {account.avatarUrl ? (
                        <img src={account.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                        <IconUser className="h-4 w-4 text-muted-foreground/70" />
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">
                        {account.displayName ?? account.email ?? t('frontend.accounts.account')}
                    </div>
                    <div className="truncate typo-caption text-muted-foreground">
                        {account.email ?? t('frontend.accounts.noEmail')}
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                {showAntigravityControls && (
                    <div className="flex min-w-172 flex-col gap-1 rounded-xl border border-border/20 bg-background/70 px-3 py-2">
                        {creditLabel && (
                            <div className="typo-caption font-medium text-muted-foreground">
                                {creditLabel}
                            </div>
                        )}
                        <Select
                            value={creditUsageMode}
                            onValueChange={(value) => {
                                if (!onCreditUsageModeChange) {
                                    return;
                                }
                                onCreditUsageModeChange(account.id, value as AntigravityCreditUsageMode);
                            }}
                            disabled={isBusy || !onCreditUsageModeChange}
                        >
                            <SelectTrigger
                                className="h-8 rounded-lg border-border/30 bg-muted/20 typo-caption text-muted-foreground"
                                data-testid={`antigravity-credit-mode-${account.id}`}
                                aria-label={t('frontend.modelSelector.mode')}
                            >
                                <SelectValue placeholder={t('frontend.modelSelector.mode')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="auto">{t('common.auto')}</SelectItem>
                                <SelectItem value="ask-every-time">{t('frontend.workspaceAgent.permissions.policy.ask-every-time')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                )}
                {account.isActive ? (
                    <span className={C_ACCOUNTROW_1}>
                        <IconCheck className="h-3 w-3" />
                        {t('frontend.accounts.active')}
                    </span>
                ) : (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            void onSetActive(providerId, account.id);
                        }}
                        disabled={isBusy}
                        className={C_ACCOUNTROW_2}
                    >
                        {t('frontend.accounts.setActive')}
                    </Button>
                )}
                {providerId === 'claude' && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onShowManualSession(account.id, account.email, providerId);
                        }}
                        disabled={isBusy}
                        className="h-8 w-8 rounded-lg text-muted-foreground transition-colors hover:text-primary hover:bg-primary/10"
                        title={t('frontend.auth.sessionKeyLabel')}
                    >
                        <IconKey className="h-3.5 w-3.5" />
                    </Button>
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void onUnlink(account.id);
                    }}
                    disabled={isBusy}
                    className="h-8 w-8 rounded-lg text-muted-foreground transition-colors hover:text-destructive hover:bg-destructive/10"
                    title={t('frontend.accounts.removeAccount')}
                >
                    <IconTrash className="h-3.5 w-3.5" />
                </Button>
            </div>
        </div>
    );
};

