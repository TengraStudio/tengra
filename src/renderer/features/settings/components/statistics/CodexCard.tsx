import { Activity } from 'lucide-react';
import React from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatReset } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { CodexUsage } from '@/types/quota';

import { AccountWrapper } from '../../types';

import { QuotaRing } from './QuotaRing';

interface CodexCardProps {
    codexUsage: AccountWrapper<{ usage: CodexUsage }> | null
    locale?: string
}

export const CodexCard: React.FC<CodexCardProps> = ({ codexUsage, locale = 'en-US' }) => {
    if (!codexUsage?.accounts || codexUsage.accounts.length === 0) { return null; }

    return (
        <Card className="border-border/40 bg-card backdrop-blur-md overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Activity className="w-12 h-12 text-primary" />
            </div>
            <CardHeader>
                <CardTitle className="text-sm font-black text-foreground/90 uppercase tracking-tighter">ChatGPT Codex</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {codexUsage.accounts.map((acc, idx: number) => {
                    if (acc.error) {
                        return (
                            <div key={acc.accountId || idx} className={cn("space-y-4", idx > 0 && "pt-6 border-t border-border/50")}>
                                <div className="text-xs font-bold text-primary truncate">{acc.email || 'Codex Account'}</div>
                                <div className="text-[10px] font-medium p-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-destructive" />
                                    Error: {acc.error}
                                </div>
                            </div>
                        );
                    }
                    const usage = acc.usage || {};
                    return (
                        <div key={acc.accountId || idx} className={cn("space-y-4", idx > 0 && "pt-6 border-t border-border/50")}>
                            <div className="text-xs font-black text-primary/80 uppercase tracking-widest">{acc.email || 'Codex Account'}</div>
                            <div className="flex items-center gap-8">
                                <div className="flex items-center gap-4">
                                    <QuotaRing value={100 - (usage.dailyUsedPercent || 0)} color="hsl(var(--primary))" size="sm" />
                                    <div>
                                        <div className="text-[10px] font-black uppercase text-muted-foreground tracking-tighter">Daily Status</div>
                                        <div className="text-[10px] font-bold text-foreground/80 tabular-nums">{100 - (usage.dailyUsedPercent || 0)}% left</div>
                                        <div className="text-[9px] text-muted-foreground/60 truncate mt-0.5">{formatReset(usage.dailyResetAt, locale)}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <QuotaRing value={100 - (usage.weeklyUsedPercent || 0)} color="hsl(var(--purple))" size="sm" />
                                    <div>
                                        <div className="text-[10px] font-black uppercase text-muted-foreground tracking-tighter">Weekly Status</div>
                                        <div className="text-[10px] font-bold text-foreground/80 tabular-nums">{100 - (usage.weeklyUsedPercent || 0)}% left</div>
                                        <div className="text-[9px] text-muted-foreground/60 truncate mt-0.5">{formatReset(usage.weeklyResetAt, locale)}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
};
