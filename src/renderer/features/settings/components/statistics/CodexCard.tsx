import { Activity } from 'lucide-react'
import React from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatReset } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { CodexUsage } from '@/types/quota'

import { AccountWrapper } from '../../types'

import { QuotaRing } from './QuotaRing'

interface CodexCardProps {
    codexUsage: AccountWrapper<{ usage: CodexUsage }> | null
    locale?: string
}

export const CodexCard: React.FC<CodexCardProps> = ({ codexUsage, locale = 'en-US' }) => {
    if (!codexUsage?.accounts || codexUsage.accounts.length === 0) {return null}

    return (
        <Card className="border-border/40 bg-zinc-950/50 backdrop-blur-md overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Activity className="w-12 h-12 text-blue-500" />
            </div>
            <CardHeader>
                <CardTitle className="text-sm font-black text-white/90 uppercase tracking-tighter">ChatGPT Codex</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {codexUsage.accounts.map((acc, idx: number) => {
                    if (acc.error) {
                        return (
                            <div key={acc.accountId || idx} className={cn("space-y-4", idx > 0 && "pt-6 border-t border-white/5")}>
                                <div className="text-xs font-bold text-blue-400 truncate">{acc.email || 'Codex Account'}</div>
                                <div className="text-[10px] font-medium p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-red-400" />
                                    Error: {acc.error}
                                </div>
                            </div>
                        )
                    }
                    const usage = acc.usage || {}
                    return (
                        <div key={acc.accountId || idx} className={cn("space-y-4", idx > 0 && "pt-6 border-t border-white/5")}>
                            <div className="text-xs font-black text-blue-400/80 uppercase tracking-widest">{acc.email || 'Codex Account'}</div>
                            <div className="flex items-center gap-8">
                                <div className="flex items-center gap-4">
                                    <QuotaRing value={100 - (usage.dailyUsedPercent || 0)} color="#3b82f6" size="sm" />
                                    <div>
                                        <div className="text-[10px] font-black uppercase text-white/40 tracking-tighter">Daily Status</div>
                                        <div className="text-[10px] font-bold text-white/60 tabular-nums">{100 - (usage.dailyUsedPercent || 0)}% left</div>
                                        <div className="text-[9px] text-white/30 truncate mt-0.5">{formatReset(usage.dailyResetAt, locale)}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <QuotaRing value={100 - (usage.weeklyUsedPercent || 0)} color="#a855f7" size="sm" />
                                    <div>
                                        <div className="text-[10px] font-black uppercase text-white/40 tracking-tighter">Weekly Status</div>
                                        <div className="text-[10px] font-bold text-white/60 tabular-nums">{100 - (usage.weeklyUsedPercent || 0)}% left</div>
                                        <div className="text-[9px] text-white/30 truncate mt-0.5">{formatReset(usage.weeklyResetAt, locale)}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </CardContent>
        </Card>
    )
}
