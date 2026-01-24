import { LinkedAccountInfo } from '@renderer/electron.d'
import { Check, Key, Trash2, User } from 'lucide-react'
import React from 'react'

import { cn } from '@/lib/utils'

interface AccountRowProps {
    account: LinkedAccountInfo
    isLast: boolean
    providerId: string
    onUnlink: (accountId: string) => Promise<void>
    onSetActive: (providerId: string, accountId: string) => Promise<void>
    onShowManualSession: (accountId: string, email?: string) => void
    t: (key: string) => string
}

export const AccountRow: React.FC<AccountRowProps> = ({
    account, isLast, providerId, onUnlink, onSetActive, onShowManualSession, t
}) => {
    return (
        <div
            className={cn(
                "px-4 py-3 flex items-center gap-3 transition-colors",
                !isLast && "border-b border-border/50",
                account.isActive && "bg-primary/5"
            )}
        >
            {/* Avatar */}
            <div className={cn(
                "h-9 w-9 rounded-full flex items-center justify-center overflow-hidden shrink-0 transition-all",
                account.isActive ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-105" : "bg-muted/80"
            )}>
                {account.avatarUrl ? (
                    <img src={account.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                    <User className="h-4 w-4 text-muted-foreground/70" />
                )}
            </div>

            {/* Account Info */}
            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">
                    {account.displayName ?? account.email ?? 'Account'}
                </div>
                {/* Always show email for clear account identification */}
                <div className="text-xs text-muted-foreground truncate">
                    {account.email ?? t('accounts.noEmail')}
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
                {account.isActive ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-500 text-xs font-bold">
                        <Check className="h-3 w-3" />
                        {t('accounts.active')}
                    </span>
                ) : (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            void onSetActive(providerId, account.id);
                        }}
                        className="px-2.5 py-1 rounded-md text-xs font-medium bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition-colors"
                    >
                        {t('accounts.setActive')}
                    </button>
                )}
                {providerId === 'claude' && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            onShowManualSession(account.id, account.email)
                        }}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                        title="Session Key"
                    >
                        <Key className="h-3.5 w-3.5" />
                    </button>
                )}
                <button
                    type="button"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void onUnlink(account.id);
                    }}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title={t('accounts.removeAccount')}
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    )
}
