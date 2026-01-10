import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { QuotaResponse, CodexUsage, CopilotQuota, AppSettings } from '../../../../shared/types'

type DetailedStats = {
    chatCount: number
    messageCount: number
    dbSize: number
    totalTokens: number
    promptTokens: number
    completionTokens: number
    tokenTimeline: { timestamp: number; promptTokens: number; completionTokens: number }[]
    activity: number[]
}

interface StatisticsTabProps {
    statsLoading: boolean
    statsData: DetailedStats | null
    quotaData: QuotaResponse | null
    copilotQuota: CopilotQuota | null
    codexUsage: CodexUsage | null
    statsPeriod: 'daily' | 'weekly' | 'monthly' | 'yearly'
    setStatsPeriod: (p: 'daily' | 'weekly' | 'monthly' | 'yearly') => void
    settings: AppSettings | null
}

export const StatisticsTab: React.FC<StatisticsTabProps> = ({
    statsLoading, statsData, quotaData: _quotaData, copilotQuota, codexUsage, statsPeriod, setStatsPeriod, settings: _settings
}) => {

    if (statsLoading && !statsData) {
        return <div className="h-64 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Messages</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold">{statsData?.messageCount || 0}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Active Chats</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold">{statsData?.chatCount || 0}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Codex Usage</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-400">{codexUsage?.totalRequests || 0}</div>
                        <p className="text-xs text-muted-foreground">requests this month</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Copilot Quota</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-400">{copilotQuota && typeof copilotQuota === 'object' ? 'Active' : 'Unknown'}</div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Activity Overview</CardTitle>
                    <div className="flex bg-muted/20 rounded-lg p-1">
                        {(['daily', 'weekly', 'monthly'] as const).map((period) => (
                            <button
                                key={period}
                                onClick={() => setStatsPeriod(period)}
                                className={`px-3 py-1 text-xs rounded-md capitalize transition-all ${statsPeriod === period ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-muted/30 text-muted-foreground'}`}
                            >
                                {period}
                            </button>
                        ))}
                    </div>
                </CardHeader>
                <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Chart visualization disabled (missing dependency).
                </CardContent>
            </Card>
        </div>
    )
}
