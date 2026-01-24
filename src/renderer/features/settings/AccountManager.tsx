import { Check, Plus, RefreshCw, User, Users } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CommonBatches } from '@/utils/ipc-batch.util';

interface AuthAccount {
    id: string;
    name: string;
    avatar?: string;
    createdAt: number;
    updatedAt: number;
}

export const AccountManager: React.FC = () => {
    const [accounts, setAccounts] = useState<AuthAccount[]>([]);
    const [activeAccountId, setActiveAccountId] = useState<string>('default');
    const [newAccountName, setNewAccountName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        void loadAccounts();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const showMessage = (text: string, type: 'success' | 'error') => {
        setMessage({ text, type });
        setTimeout(() => setMessage(null), 3000);
    };

    const loadAccounts = async () => {
        try {
            // Use batching to load accounts and active account in one call
            const { accounts, activeAccount } = await CommonBatches.loadAuthState()
            setAccounts(accounts)
            setActiveAccountId(activeAccount)
        } catch (error) {
            console.error('Failed to load accounts', error)
            showMessage('Failed to load accounts', 'error')
        }
    }

    const handleCreateAccount = async () => {
        if (!newAccountName.trim()) { return; }
        try {
            setIsCreating(true);
            await window.electron.ipcRenderer.invoke('auth:create-account', newAccountName);
            setNewAccountName('');
            await loadAccounts();
            showMessage(`Account "${newAccountName}" created`, 'success');
        } catch {
            showMessage('Failed to create account', 'error');
        } finally {
            setIsCreating(false);
        }
    };

    const handleSwitchAccount = async (id: string, name: string) => {
        try {
            await window.electron.ipcRenderer.invoke('auth:switch-account', id);
            setActiveAccountId(id);
            showMessage(`Switched to "${name}"`, 'success');
            setTimeout(() => window.location.reload(), 1000); // Reload to apply changes
        } catch {
            showMessage('Failed to switch account', 'error');
        }
    };

    return (
        <Card className="w-full border border-border bg-card">
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        Account Management
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => { void loadAccounts(); }} title="Refresh Accounts">
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {message && (
                    <div className={`p-3 rounded-md text-sm font-medium ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive'}`}>
                        {message.text}
                    </div>
                )}

                <div className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground">Active Accounts</h3>
                    <div className="grid gap-3">
                        {accounts.map((account) => (
                            <div
                                key={account.id}
                                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${activeAccountId === account.id ? 'border-primary bg-primary/10' : 'border-border/50 hover:bg-muted/50'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center overflow-hidden border border-border">
                                        {account.avatar ? (
                                            <img src={account.avatar} alt={account.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <User className="w-4 h-4 text-muted-foreground" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-medium text-foreground">{account.name}</p>
                                        <p className="text-xs text-muted-foreground">ID: {account.id.slice(0, 8)}...</p>
                                    </div>
                                </div>
                                {activeAccountId === account.id ? (
                                    <div className="flex items-center gap-2 text-primary text-sm font-bold bg-primary/10 px-3 py-1 rounded-full">
                                        <Check className="w-3 h-3" />
                                        Active
                                    </div>
                                ) : (
                                    <Button variant="secondary" size="sm" onClick={() => { void handleSwitchAccount(account.id, account.name); }}>
                                        Switch
                                    </Button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-border">
                    <label className="text-sm font-medium text-muted-foreground block">Add New Account</label>
                    <div className="flex gap-2">
                        <Input
                            placeholder="Account Name (e.g. Work, Personal)"
                            value={newAccountName}
                            onChange={(e) => setNewAccountName(e.target.value)}
                            className="bg-background"
                        />
                        <Button onClick={() => { void handleCreateAccount(); }} disabled={isCreating || !newAccountName.trim()}>
                            <Plus className="w-4 h-4 mr-2" />
                            Create
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
