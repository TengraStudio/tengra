import { Activity } from 'lucide-react'
import React from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatReset } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { ClaudeQuota } from '@/types/quota'

import { AccountWrapper } from '../../types'

import { QuotaRing } from './QuotaRing'

interface ClaudeCardProps {
    claudeQuota: AccountWrapper<ClaudeQuota> | null
    locale?: string
}

export const ClaudeCard: React.FC<ClaudeCardProps> = ({ claudeQuota, locale = 'en-US' }) => {
    if (!claudeQuota?.accounts || claudeQuota.accounts.length === 0) { return null }

    return (
        <Card className="border-border/40 bg-zinc-950/50 backdrop-blur-md overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Activity className="w-12 h-12 text-orange-500" />
            </div>
            <CardHeader>
                <CardTitle className="text-sm font-black text-white/90 uppercase tracking-tighter">Anthropic Claude</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {claudeQuota.accounts.map((acc, idx: number) => {
                    if (acc.error) {
                        return (
                            <div key={acc.accountId ?? idx} className={cn("space-y-4", idx > 0 && "pt-6 border-t border-white/5")}>
                                <div className="text-xs font-bold text-orange-400 truncate">{acc.email ?? 'Claude Account'}</div>
                                <div className="text-[10px] font-medium p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-red-400" />
                                    Error: {acc.error}
                                </div>
                            </div>
                        )
                    }
                    return (
                        <div key={acc.accountId ?? idx} className={cn("space-y-4", idx > 0 && "pt-6 border-t border-white/5")}>
                            <div className="text-xs font-black text-orange-400/80 uppercase tracking-widest">{acc.email ?? 'Claude Account'}</div>
                            <div className="flex items-center gap-8">
                                {acc.fiveHour && (
                                    <div className="flex items-center gap-4">
                                        <QuotaRing value={100 - acc.fiveHour.utilization} color="#a855f7" size="sm" />
                                        <div>
                                            <div className="text-[10px] font-black uppercase text-white/40 tracking-tighter">5hr Status</div>
                                            <div className="text-[10px] font-bold text-white/60 tabular-nums">{100 - acc.fiveHour.utilization}% left</div>
                                            <div className="text-[9px] text-white/30 mt-0.5">{formatReset(acc.fiveHour.resetsAt, locale)}</div>
                                        </div>
                                    </div>
                                )}
                                {acc.sevenDay && (
                                    <div className="flex items-center gap-4">
                                        <QuotaRing value={100 - acc.sevenDay.utilization} color="#8b5cf6" size="sm" />
                                        <div>
                                            <div className="text-[10px] font-black uppercase text-white/40 tracking-tighter">7d Status</div>
                                            <div className="text-[10px] font-bold text-white/60 tabular-nums">{100 - acc.sevenDay.utilization}% left</div>
                                            <div className="text-[9px] text-white/30 mt-0.5">{formatReset(acc.sevenDay.resetsAt, locale)}</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </CardContent>
        </Card>
    )
}
