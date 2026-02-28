import { Clock, RefreshCw } from 'lucide-react';
import React from 'react';

import { formatReset } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { ModelQuotaItem, QuotaResponse } from '@/types/quota';

import { AccountWrapper } from '../../types';

import { QuotaRing } from './QuotaRing';

interface AntigravityCardProps {
    t: (key: string) => string
    quotaData: AccountWrapper<QuotaResponse> | null
    setReloadTrigger?: (v: number | ((prev: number) => number)) => void
    locale?: string
}

export const AntigravityCard: React.FC<AntigravityCardProps> = ({ t, quotaData, setReloadTrigger, locale = 'en-US' }) => {
    if (!quotaData?.accounts || quotaData.accounts.length === 0) { return null; }

    return (
        <div className="premium-glass p-8 space-y-8 col-span-1 md:col-span-2 relative group overflow-hidden">
            <div className="flex flex-row items-center justify-between relative z-10">
                <div>
                    <div className="text-base font-black text-foreground uppercase tracking-tight">{t('statistics.antigravityQuotas')}</div>
                    <div className="text-xs font-medium text-muted-foreground/70">{t('statistics.enterpriseStatus')}</div>
                </div>
                {setReloadTrigger && (
                    <button onClick={() => setReloadTrigger((p: number) => p + 1)} className="p-3 bg-primary/10 hover:bg-primary/20 rounded-2xl text-primary transition-all duration-300 border border-primary/20 shadow-lg shadow-primary/5">
                        <RefreshCw className="w-4 h-4" />
                    </button>
                )}
            </div>

            <div className="space-y-8 relative z-10">
                {quotaData.accounts.map((acc, idx: number) => (
                    <div key={acc.accountId ?? idx} className={cn("space-y-6 relative", idx > 0 && "pt-8 border-t border-border/10")}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_12px_rgba(var(--primary-rgb),0.5)] animate-pulse" />
                                <div className="text-xs font-black text-foreground/90 uppercase tracking-widest">{acc.email ?? t('statistics.defaultAccount')}</div>
                            </div>
                            <div className="text-[10px] font-black py-1 px-3 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-widest">
                                {acc.success === false ? t(`statistics.status${acc.status ?? 'Error'}`) : t('statistics.active')}
                            </div>
                        </div>

                        {acc.success === false ? (
                            <div className="text-[10px] font-medium p-3 rounded-2xl bg-destructive/5 border border-destructive/20 text-destructive flex items-center gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-destructive shadow-[0_0_8px_rgba(var(--destructive-rgb),0.5)]" />
                                {acc.authExpired ? t('quota.authExpired') : t(`statistics.status${acc.status ?? 'Error'}`)}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {acc.models.map((m: ModelQuotaItem) => (
                                    <div key={m.id} className="flex items-center justify-between p-4 rounded-2xl bg-muted/5 border border-border/40 hover:bg-muted/10 hover:border-primary/30 transition-all duration-300 group/item">
                                        <div className="min-w-0 flex-1">
                                            <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest truncate group-hover/item:text-foreground transition-colors">{m.name || m.id}</div>
                                            <div className="flex items-center gap-2 mt-1.5">
                                                <Clock className="w-3 h-3 text-muted-foreground/40" />
                                                <div className="text-[10px] font-medium text-muted-foreground/60 truncate">{formatReset(m.reset, locale)}</div>
                                            </div>
                                        </div>
                                        <div className="ml-4">
                                            <QuotaRing value={m.percentage || 0} color="hsl(var(--primary))" size="sm" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
