import { Check, Plus, RefreshCw, User, Users } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LinkedAccountInfo } from '@/electron.d';
import { useTranslation } from '@/i18n';
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
            showMessage(t('accounts.loadFailed'), 'error');
        }
    }, [t]);

    useEffect(() => {
        void loadAccounts();
    }, [loadAccounts]);

    const handleCreateAccount = async () => {
        if (!newAccountName.trim()) { return; }
        try {
            setIsCreating(true);
            await window.electron.ipcRenderer.invoke('auth:create-account', newAccountName);
            setNewAccountName('');
            await loadAccounts();
            showMessage(t('accounts.createSuccess', { name: newAccountName }), 'success');
        } catch {
            showMessage(t('accounts.createFailed'), 'error');
        } finally {
            setIsCreating(false);
        }
    };

    const handleSwitchAccount = async (id: string, name: string) => {
        try {
            await window.electron.ipcRenderer.invoke('auth:switch-account', id);
            setActiveAccountId(id);
            showMessage(t('accounts.switchSuccess', { name }), 'success');
            setTimeout(() => window.location.reload(), 1000); // Reload to apply changes
        } catch {
            showMessage(t('accounts.switchFailed'), 'error');
        }
    };

    return (
        <Card className="w-full border border-border bg-card">
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        {t('accounts.management')}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => { void loadAccounts(); }} title={t('accounts.refreshAccounts')}>
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {message && (
                    <div className={`p-3 rounded-md text-sm font-medium ${message.type === 'success' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                        {message.text}
                    </div>
                )}

                <div className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground">{t('accounts.activeAccounts')}</h3>
                    <div className="grid gap-3">
                        {accounts.map((account) => (
                            <div
                                key={account.id}
                                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${activeAccountId === account.id ? 'border-primary bg-primary/10' : 'border-border/50 hover:bg-muted/50'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center overflow-hidden border border-border">
                                        {account.avatarUrl ? (
                                            <img src={account.avatarUrl} alt={account.displayName ?? account.id} className="w-full h-full object-cover" />
                                        ) : (
                                            <User className="w-4 h-4 text-muted-foreground" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-medium text-foreground">{account.displayName ?? t('accounts.unnamed')}</p>
                                        <p className="text-xs text-muted-foreground">ID: {account.id.slice(0, 8)}...</p>
                                    </div>
                                </div>
                                {activeAccountId === account.id ? (
                                    <div className="flex items-center gap-2 text-primary text-sm font-bold bg-primary/10 px-3 py-1 rounded-full">
                                        <Check className="w-3 h-3" />
                                        {t('accounts.active')}
                                    </div>
                                ) : (
                                    <Button variant="secondary" size="sm" onClick={() => { void handleSwitchAccount(account.id, account.displayName ?? account.id); }}>
                                        {t('accounts.switch')}
                                    </Button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-border">
                    <label className="text-sm font-medium text-muted-foreground block">{t('accounts.addNewAccount')}</label>
                    <div className="flex gap-2">
                        <Input
                            placeholder={t('accounts.accountNamePlaceholder')}
                            value={newAccountName}
                            onChange={(e) => setNewAccountName(e.target.value)}
                            className="bg-background"
                        />
                        <Button onClick={() => { void handleCreateAccount(); }} disabled={isCreating || !newAccountName.trim()}>
                            <Plus className="w-4 h-4 mr-2" />
                            {t('accounts.create')}
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
