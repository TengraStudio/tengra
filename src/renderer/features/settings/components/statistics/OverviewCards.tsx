import { Activity, Clock, Loader2, MessageSquare, TrendingUp } from 'lucide-react'
import React from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatNumber } from '@/lib/formatters'

import { DetailedStats, TimeStats } from '../../types'

import { TimeBarChart } from './TimeBarChart'

interface OverviewCardsProps {
    t: (key: string) => string
    statsData: DetailedStats | null
    timeStats: TimeStats | null
    loadingTimeStats: boolean
}

export const OverviewCards: React.FC<OverviewCardsProps> = ({ t, statsData, timeStats, loadingTimeStats }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-border/40 bg-zinc-950/40 backdrop-blur-md overflow-hidden relative group hover:bg-zinc-950/60 transition-all duration-300">
                <div className="absolute -right-2 -bottom-2 opacity-[0.03] group-hover:opacity-[0.07] transition-all duration-500 group-hover:scale-110">
                    <MessageSquare className="w-24 h-24 text-white" />
                </div>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">{t('statistics.messages')}</CardTitle>
                        <MessageSquare className="w-4 h-4 text-primary/50" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="text-4xl font-black text-white leading-none tracking-tighter tabular-nums">{statsData?.messageCount ?? 0}</div>
                    <p className="text-[10px] font-bold text-white/20 uppercase mt-2 tracking-widest leading-none">Total messages</p>
                </CardContent>
            </Card>

            <Card className="border-border/40 bg-zinc-950/40 backdrop-blur-md overflow-hidden relative group hover:bg-zinc-950/60 transition-all duration-300">
                <div className="absolute -right-2 -bottom-2 opacity-[0.03] group-hover:opacity-[0.07] transition-all duration-500 group-hover:scale-110">
                    <Activity className="w-24 h-24 text-white" />
                </div>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">{t('statistics.chats')}</CardTitle>
                        <Activity className="w-4 h-4 text-emerald-500/50" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="text-4xl font-black text-white leading-none tracking-tighter tabular-nums">{statsData?.chatCount ?? 0}</div>
                    <p className="text-[10px] font-bold text-white/20 uppercase mt-2 tracking-widest leading-none">Active threads</p>
                </CardContent>
            </Card>

            <Card className="border-border/40 bg-zinc-950/40 backdrop-blur-md overflow-hidden relative group hover:bg-zinc-950/60 transition-all duration-300">
                <div className="absolute -right-2 -bottom-2 opacity-[0.03] group-hover:opacity-[0.07] transition-all duration-500 group-hover:scale-110">
                    <TrendingUp className="w-24 h-24 text-white" />
                </div>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">{t('statistics.totalTokens')}</CardTitle>
                        <TrendingUp className="w-4 h-4 text-blue-400/50" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex items-end justify-between gap-4">
                            <div className="text-4xl font-black text-white leading-none tracking-tighter tabular-nums">{formatNumber(statsData?.totalTokens ?? 0)}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                            <div>
                                <div className="text-[9px] font-black text-white/20 uppercase tracking-widest">In</div>
                                <div className="text-xs font-bold text-blue-400 tabular-nums">{formatNumber(statsData?.promptTokens ?? 0)}</div>
                            </div>
                            <div>
                                <div className="text-[9px] font-black text-white/20 uppercase tracking-widest">Out</div>
                                <div className="text-xs font-bold text-emerald-400 tabular-nums">{formatNumber(statsData?.completionTokens ?? 0)}</div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-border/40 bg-zinc-950/40 backdrop-blur-md overflow-hidden relative group hover:bg-zinc-950/60 transition-all duration-300">
                <div className="absolute -right-2 -bottom-2 opacity-[0.03] group-hover:opacity-[0.07] transition-all duration-500 group-hover:scale-110">
                    <Clock className="w-24 h-24 text-white" />
                </div>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">{t('statistics.onlineTime')}</CardTitle>
                        <Clock className="w-4 h-4 text-purple-400/50" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="pt-2">
                        {loadingTimeStats ? (
                            <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        ) : (
                            <TimeBarChart
                                value={timeStats?.totalOnlineTime ?? 0}
                                maxValue={Math.max(timeStats?.totalOnlineTime ?? 0, 86400000)}
                                label={t('statistics.totalAppUsage')}
                                color="linear-gradient(90deg, #a855f7, #ec4899)"
                            />
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
