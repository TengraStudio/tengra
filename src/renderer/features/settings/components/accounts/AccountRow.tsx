import { Button } from '@renderer/components/ui/button';
import { LinkedAccountInfo } from '@renderer/electron.d';
import { cn } from '@renderer/lib/utils';
import { Check, Key, Trash2, User } from 'lucide-react';
import React from 'react';

interface AccountRowProps {
    account: LinkedAccountInfo
    isLast: boolean
    isBusy: boolean
    providerId: string
    onUnlink: (accountId: string) => Promise<void>
    onSetActive: (providerId: string, accountId: string) => Promise<void>
    onShowManualSession: (accountId: string, email?: string) => void
    t: (key: string) => string
}

export const AccountRow: React.FC<AccountRowProps> = ({
    account, isLast, isBusy, providerId, onUnlink, onSetActive, onShowManualSession, t
}) => {
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
                        <User className="h-4 w-4 text-muted-foreground/70" />
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">
                        {account.displayName ?? account.email ?? t('accounts.account')}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                        {account.email ?? t('accounts.noEmail')}
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                {account.isActive ? (
                    <span className="inline-flex items-center gap-1 rounded-md border border-success/20 bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
                        <Check className="h-3 w-3" />
                        {t('accounts.active')}
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
                        className="h-8 border-border/30 bg-background px-3 text-xs font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                    >
                        {t('accounts.setActive')}
                    </Button>
                )}
                {providerId === 'claude' && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onShowManualSession(account.id, account.email);
                        }}
                        disabled={isBusy}
                        className="h-8 w-8 rounded-lg text-muted-foreground transition-colors hover:text-primary hover:bg-primary/10"
                        title={t('auth.sessionKeyLabel')}
                    >
                        <Key className="h-3.5 w-3.5" />
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
                    title={t('accounts.removeAccount')}
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </div>
        </div>
    );
};
