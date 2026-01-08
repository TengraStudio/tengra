import React from 'react'
import { cn } from '@/lib/utils'

interface StatisticsTabProps {
    statsLoading: boolean
    statsData: any
    statsPeriod: string
    setStatsPeriod: (p: any) => void
    codexUsage: any
    copilotQuota: any
    quotaData: any
    setReloadTrigger: (v: any) => void
    t: (key: string) => string
    settings?: any // Adding settings to props to access language
}

export const StatisticsTab: React.FC<StatisticsTabProps> = ({
    statsLoading, statsData, statsPeriod, setStatsPeriod, codexUsage, copilotQuota, quotaData, setReloadTrigger, t, settings
}) => {
    if (statsLoading) return <div className="space-y-6 animate-pulse"><div className="bg-card p-6 rounded-xl border border-border h-32"></div><div className="bg-card p-6 rounded-xl border border-border h-48"></div></div>

    const timeline = statsData?.tokenTimeline || []
    const totals = timeline.map((t: any) => (t.promptTokens || 0) + (t.completionTokens || 0))
    const maxTotal = Math.max(1, ...totals)

    const codex = codexUsage?.usage || {}
    const dailyUsedPercent = codex?.dailyUsedPercent || 0
    const weeklyUsedPercent = codex?.weeklyUsedPercent || 0
    const copilotPercent = typeof copilotQuota?.percentage === 'number' ? copilotQuota.percentage : null

    const formatReset = (value?: string) => {
        if (!value) return '-'
        const date = new Date(value)
        const locale = settings?.general?.language === 'tr' ? 'tr-TR' : 'en-US'
        return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    }

    const renderRing = (value: number, color: string) => (
        <div className="relative h-12 w-12 text-white">
            <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(${color} ${value}%, rgba(255,255,255,0.08) 0)` }} />
            <div className="absolute inset-1 rounded-full bg-card flex items-center justify-center text-xs font-bold">{Math.round(value)}%</div>
        </div>
    )

    const getQuotaColor = (p: number) => p === 0 ? 'rgb(239 68 68)' : p < 25 ? 'rgb(249 115 22)' : p < 50 ? 'rgb(234 179 8)' : 'rgb(34 197 94)'

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div><h3 className="text-lg font-bold text-white">{t('statistics.title')}</h3><p className="text-xs text-muted-foreground">{t('statistics.subtitle')}</p></div>
                <div className="flex items-center gap-2">
                    {['daily', 'weekly', 'monthly', 'yearly'].map(p => (
                        <button key={p} onClick={() => setStatsPeriod(p)} className={cn("px-3 py-1.5 rounded-full text-xs font-bold border transition-colors", statsPeriod === p ? "bg-primary/20 text-primary border-primary/30" : "bg-white/5 text-muted-foreground border-white/10")}>
                            {t(`statistics.${p}`)}
                        </button>
                    ))}
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-card p-4 rounded-xl border border-border"><div className="text-xs font-bold uppercase text-muted-foreground">{t('statistics.chats')}</div><div className="text-2xl font-black text-white mt-2">{statsData?.chatCount ?? 0}</div></div>
                <div className="bg-card p-4 rounded-xl border border-border"><div className="text-xs font-bold uppercase text-muted-foreground">{t('statistics.messages')}</div><div className="text-2xl font-black text-white mt-2">{statsData?.messageCount ?? 0}</div></div>
                <div className="bg-card p-4 rounded-xl border border-border"><div className="text-xs font-bold uppercase text-muted-foreground">{t('statistics.totalTokens')}</div><div className="text-2xl font-black text-white mt-2">{statsData?.totalTokens ?? 0}</div></div>
            </div>

            <div className="bg-card p-6 rounded-xl border border-border space-y-4">
                <div className="flex items-center justify-between">
                    <div><div className="text-sm font-bold text-white">{t('statistics.tokenFlow')}</div><div className="text-xs text-muted-foreground">{t('statistics.outgoing')} / {t('statistics.incoming')}</div></div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary/70" />{t('statistics.outgoing')}</span><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-400/70" />{t('statistics.incoming')}</span></div>
                </div>
                <div className="h-36 flex items-end gap-1 px-1">
                    {timeline.map((point: any, idx: number) => (
                        <div key={idx} className="flex-1 flex items-end gap-0.5 group relative">
                            <div className="flex-1 flex items-end h-full"><div className="w-full rounded-t-sm bg-primary/60 group-hover:bg-primary transition-colors" style={{ height: `${point.promptTokens ? Math.max(3, Math.round((point.promptTokens / maxTotal) * 100)) : 1}%` }} /></div>
                            <div className="flex-1 flex items-end h-full"><div className="w-full rounded-t-sm bg-emerald-400/60 group-hover:bg-emerald-400 transition-colors" style={{ height: `${point.completionTokens ? Math.max(3, Math.round((point.completionTokens / maxTotal) * 100)) : 1}%` }} /></div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-card p-5 rounded-xl border border-border space-y-3">
                    <div className="text-sm font-bold text-white">ChatGPT Codex</div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3">
                            {renderRing(100 - dailyUsedPercent, 'hsl(var(--primary))')}
                            <div>
                                <div className="text-xs font-bold uppercase text-muted-foreground">{t('statistics.dailyRemaining')}</div>
                                <div className="text-xs text-muted-foreground">{t('statistics.reset')}: {formatReset(codex?.dailyResetAt)}</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {renderRing(100 - weeklyUsedPercent, 'hsl(280 100% 60%)')}
                            <div>
                                <div className="text-xs font-bold uppercase text-muted-foreground">{t('statistics.weeklyRemaining')}</div>
                                <div className="text-xs text-muted-foreground">{t('statistics.reset')}: {formatReset(codex?.weeklyResetAt)}</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="bg-card p-5 rounded-xl border border-border space-y-3">
                    <div className="text-sm font-bold text-white">GitHub Copilot</div>
                    {copilotPercent !== null && <div className="flex items-center gap-3">{renderRing(copilotPercent, 'hsl(142 76% 45%)')}<div><div className="text-xs font-bold uppercase text-muted-foreground">{t('statistics.quotaStatus')}</div><div className="text-xs text-muted-foreground">{t('statistics.remaining')}: {copilotQuota?.remaining}</div></div></div>}
                </div>
                <div className="bg-card p-5 rounded-xl border border-border md:col-span-2 space-y-4">
                    <div className="flex justify-between items-center"><div className="text-sm font-bold text-white">{t('statistics.antigravityQuotas')}</div><button onClick={() => setReloadTrigger((p: any) => p + 1)} className="p-1 hover:bg-white/10 rounded-full text-muted-foreground">↻</button></div>
                    <div className="max-h-64 overflow-y-auto pr-2 space-y-3">
                        {quotaData?.models?.map((m: any) => (
                            <div key={m.name} className="flex items-center gap-3 p-3 rounded-lg border border-white/10 bg-white/5">
                                <div className="relative h-9 w-9 text-white"><div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(${getQuotaColor(m.percentage)} ${m.percentage}%, rgba(255,255,255,0.08) 0)` }} /><div className="absolute inset-1 rounded-full bg-card flex items-center justify-center text-[10px] font-bold">{m.percentage}%</div></div>
                                <div className="flex-1"><div className="text-xs font-bold text-white">{m.name}</div><div className="text-[10px] text-muted-foreground">{t('statistics.reset')}: {m.reset || '-'}</div></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
