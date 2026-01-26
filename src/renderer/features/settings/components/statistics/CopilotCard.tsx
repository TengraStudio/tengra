import { Activity } from 'lucide-react';
import React from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { CopilotQuota } from '@/types/quota';

import { AccountWrapper } from '../../types';

import { QuotaRing } from './QuotaRing';

interface CopilotCardProps {
    copilotQuota: AccountWrapper<CopilotQuota> | null
}

export const CopilotCard: React.FC<CopilotCardProps> = ({ copilotQuota }) => {
    if (!copilotQuota?.accounts || copilotQuota.accounts.length === 0) { return null; }

    return (
        <Card className="border-border/40 bg-card backdrop-blur-md overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Activity className="w-12 h-12 text-emerald-500" />
            </div>
            <CardHeader>
                <CardTitle className="text-sm font-black text-foreground/90 uppercase tracking-tighter">GitHub Copilot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {copilotQuota.accounts.map((acc, idx: number) => {
                    if (acc.error) {
                        return (
                            <div key={acc.accountId || idx} className={cn("space-y-4", idx > 0 && "pt-6 border-t border-border/50")}>
                                <div className="text-xs font-bold text-emerald-400 truncate">{acc.email || 'Copilot Account'}</div>
                                <div className="text-[10px] font-medium p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-red-400" />
                                    Error: {acc.error}
                                </div>
                            </div>
                        );
                    }
                    const hasSeats = !!acc.seat_breakdown;
                    const limit = hasSeats ? (acc.seat_breakdown?.total_seats || 0) : (acc.limit || 0);
                    const remaining = hasSeats ? (limit - (acc.seat_breakdown?.active_seats || 0)) : (acc.remaining || 0);
                    const percent = limit > 0 ? Math.round((remaining / limit) * 100) : 0;

                    return (
                        <div key={acc.accountId || idx} className={cn("space-y-4", idx > 0 && "pt-6 border-t border-border/50")}>
                            <div className="text-xs font-black text-emerald-400/80 uppercase tracking-widest">{acc.email ?? 'Copilot Account'}</div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="flex items-center gap-4">
                                    <QuotaRing value={percent} color="#10b981" size="sm" />
                                    <div>
                                        <div className="text-[10px] font-black uppercase text-muted-foreground tracking-tighter">{hasSeats ? 'Seats Status' : 'Usage Status'}</div>
                                        <div className="text-[10px] font-bold text-foreground/80 tabular-nums">{remaining} / {limit} left</div>
                                        <div className="text-[9px] text-muted-foreground/50 uppercase mt-0.5 tracking-wide">{acc.seat_breakdown?.plan_type || acc.copilot_plan || 'Individual'}</div>
                                    </div>
                                </div>
                                {acc.rate_limit && (
                                    <div className="flex items-center gap-4">
                                        <QuotaRing value={Math.round((acc.rate_limit.remaining / acc.rate_limit.limit) * 100)} color="#34d399" size="sm" />
                                        <div>
                                            <div className="text-[10px] font-black uppercase text-muted-foreground tracking-tighter">Rate Limit</div>
                                            <div className="text-[10px] font-bold text-foreground/80 tabular-nums">{acc.rate_limit.remaining} / {acc.rate_limit.limit}</div>
                                            <div className="text-[9px] text-muted-foreground/50 uppercase mt-0.5 tracking-wide">API Usage</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
};
