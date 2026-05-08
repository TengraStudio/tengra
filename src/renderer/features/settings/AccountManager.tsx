/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconCheck, IconPlus, IconRefresh, IconUser, IconUsers } from '@tabler/icons-react';
import React, { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LinkedAccountInfo } from '@/electron.d';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { CommonBatches } from '@/utils/ipc-batch.util';
import { appLogger } from '@/utils/renderer-logger';

export const AccountManager: React.FC = () => {
    const { t } = useTranslation();
    const [accounts, setAccounts] = useState<LinkedAccountInfo[]>([]);
    const [activeAccountId, setActiveAccountId] = useState<string>('default');
    const [newAccountName, setNewAccountName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    const showMessage = (text: string, type: 'success' | 'error') => {
        setMessage({ text, type });
        setTimeout(() => setMessage(null), 3000);
    };

    const loadAccounts = useCallback(async () => {
        try {
            // Use batching to load accounts and active account in one call
            const { accounts, activeAccount } = await CommonBatches.loadAuthState();
            setAccounts(accounts);
            setActiveAccountId(activeAccount?.id ?? 'default');
        } catch (error) {
            appLogger.error('AccountManager', 'Failed to load accounts', error as Error);
            showMessage(t('frontend.accounts.loadFailed'), 'error');
        }
    }, [t]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void loadAccounts();
        }, 0);
        return () => window.clearTimeout(timer);
    }, [loadAccounts]);

    const handleCreateAccount = async () => {
        if (!newAccountName.trim()) { return; }
        try {
            setIsCreating(true);
            await window.electron.auth.createAccount(newAccountName);
            setNewAccountName('');
            await loadAccounts();
            showMessage(t('frontend.accounts.createSuccess', { name: newAccountName }), 'success');
        } catch {
            showMessage(t('frontend.accounts.createFailed'), 'error');
        } finally {
            setIsCreating(false);
        }
    };

    const handleSwitchAccount = async (id: string, name: string) => {
        try {
            await window.electron.auth.switchAccount(id);
            setActiveAccountId(id);
            showMessage(t('frontend.accounts.switchSuccess', { name }), 'success');
            setTimeout(() => window.location.reload(), 1000); // Reload to apply changes
        } catch {
            showMessage(t('frontend.accounts.switchFailed'), 'error');
        }
    };

    return (
        <Card className="w-full border border-border bg-card">
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <IconUsers className="w-5 h-5" />
                        {t('frontend.accounts.management')}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => { void loadAccounts(); }} title={t('frontend.accounts.refreshAccounts')}>
                        <IconRefresh className="w-4 h-4" />
                    </Button>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {message && (
                    <div className={cn(
                        'p-3 rounded-md text-sm font-medium',
                        message.type === 'success' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                    )}>
                        {message.text}
                    </div>
                )}

                <div className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground">{t('frontend.accounts.activeAccounts')}</h3>
                    <div className="grid gap-3">
                        {accounts.map((account) => (
                            <div
                                key={account.id}
                                className={cn(
                                    'flex items-center justify-between p-3 rounded-lg border transition-colors',
                                    activeAccountId === account.id ? 'border-primary bg-primary/10' : 'border-border/50 hover:bg-muted/50'
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center overflow-hidden border border-border">
                                        {account.avatarUrl ? (
                                            <img src={account.avatarUrl} alt={account.displayName ?? account.id} className="w-full h-full object-cover" />
                                        ) : (
                                            <IconUser className="w-4 h-4 text-muted-foreground" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-medium text-foreground">{account.displayName ?? t('frontend.accounts.unnamed')}</p>
                                        <p className="typo-caption text-muted-foreground">{t('frontend.accounts.idPrefix')} {account.id.slice(0, 8)}...</p>
                                    </div>
                                </div>
                                {activeAccountId === account.id ? (
                                    <div className="flex items-center gap-2 text-primary text-sm font-bold bg-primary/10 px-3 py-1 rounded-full">
                                        <IconCheck className="w-3 h-3" />
                                        {t('frontend.accounts.active')}
                                    </div>
                                ) : (
                                    <Button variant="secondary" size="sm" onClick={() => { void handleSwitchAccount(account.id, account.displayName ?? account.id); }}>
                                        {t('frontend.accounts.switch')}
                                    </Button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-border">
                    <label className="text-sm font-medium text-muted-foreground block">{t('frontend.accounts.addNewAccount')}</label>
                    <div className="flex gap-2">
                        <Input
                            placeholder={t('frontend.accounts.accountNamePlaceholder')}
                            value={newAccountName}
                            onChange={(e) => setNewAccountName(e.target.value)}
                            className="bg-background"
                        />
                        <Button onClick={() => { void handleCreateAccount(); }} disabled={isCreating || !newAccountName.trim()}>
                            <IconPlus className="w-4 h-4 mr-2" />
                            {t('frontend.accounts.create')}
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

