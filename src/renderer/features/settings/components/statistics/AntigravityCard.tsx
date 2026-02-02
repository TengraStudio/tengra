import { Activity, Clock, RefreshCw } from 'lucide-react';
import React from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatReset } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { ModelQuotaItem, QuotaResponse } from '@/types/quota';

import { AccountWrapper } from '../../types';

import { getQuotaColor, QuotaRing } from './QuotaRing';

interface AntigravityCardProps {
    t: (key: string) => string
    quotaData: AccountWrapper<QuotaResponse> | null
    setReloadTrigger?: (v: number | ((prev: number) => number)) => void
    locale?: string
}

export const AntigravityCard: React.FC<AntigravityCardProps> = ({ t, quotaData, setReloadTrigger, locale = 'en-US' }) => {
    if (!quotaData?.accounts || quotaData.accounts.length === 0) { return null; }

    return (
        <Card className="border-border/40 bg-card backdrop-blur-md overflow-hidden relative group col-span-1 md:col-span-2 shadow-2xl shadow-primary/5">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Activity className="w-12 h-12 text-primary" />
            </div>
            <CardHeader className="flex flex-row items-center justify-between relative z-10">
                <div>
                    <CardTitle className="text-sm font-black text-foreground/90 uppercase tracking-tighter">{t('statistics.antigravityQuotas')}</CardTitle>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1 tracking-widest">{t('statistics.enterpriseStatus')}</p>
                </div>
                {setReloadTrigger && (
                    <button onClick={() => setReloadTrigger((p: number) => p + 1)} className="p-2 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-all duration-300 border border-transparent hover:border-border shadow-lg">
                        <RefreshCw className="w-4 h-4" />
                    </button>
                )}
            </CardHeader>
            <CardContent className="space-y-6 relative z-10">
                {quotaData.accounts.map((acc, idx: number) => (
                    <div key={acc.accountId ?? idx} className={cn("space-y-4 relative group", idx > 0 && "pt-6 border-t border-border/50")}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                <div className="text-xs font-black text-foreground/90 uppercase tracking-widest">{acc.email ?? t('statistics.defaultAccount')}</div>
                            </div>
                            <div className="text-[9px] font-bold py-0.5 px-2 rounded-full bg-primary/20 text-primary-foreground border border-primary/30 shadow-[0_0_10px_rgba(var(--primary),0.2)]">{t('statistics.active')}</div>
                        </div>
                        <div className="max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {acc.models.map((m: ModelQuotaItem) => (
                                    <div key={m.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/50 hover:bg-muted/40 hover:border-border transition-all duration-300 group/item">
                                        <div className="min-w-0 flex-1">
                                            <div className="text-[11px] font-bold text-muted-foreground truncate group-hover/item:text-foreground transition-colors">{m.name || m.id}</div>
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <Clock className="w-2.5 h-2.5 text-muted-foreground/60" />
                                                <div className="text-[9px] font-medium text-muted-foreground/60 truncate">{formatReset(m.reset, locale)}</div>
                                            </div>
                                        </div>
                                        <div className="ml-3">
                                            <QuotaRing value={m.percentage || 0} color={getQuotaColor(m.percentage || 0)} size="sm" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
};
