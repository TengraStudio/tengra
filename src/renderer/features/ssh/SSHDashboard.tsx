import React, { useEffect, useState } from 'react'
import { useTranslation } from '@/i18n'

interface SSHDashboardProps {
    connectionId: string
    active: boolean
}

export const SSHDashboard: React.FC<SSHDashboardProps> = ({ connectionId, active }) => {
    const { t } = useTranslation()
    const [stats, setStats] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fetchStats = async () => {
        try {
            setLoading(true)
            const data = await window.electron.ssh.getSystemStats(connectionId)
            setStats(data)
            setError(null)
        } catch (err: any) {
            setError(err.message || 'Failed to fetch stats')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (active) {
            fetchStats()
            const interval = setInterval(fetchStats, 5000) // Poll every 5s
            return () => clearInterval(interval)
        }
    }, [connectionId, active])

    if (!active) return null
    if (loading && !stats) return <div className="p-8 text-center text-muted-foreground">{t('ssh.loadingStats')}</div>
    if (error) return <div className="p-8 text-center text-red-500">{t('ssh.connectionError', { error })}</div>
    if (!stats) return null

    return (
        <div className="p-6 space-y-6 h-full overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">{t('ssh.systemDashboard')}</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* CPU Usage */}
                <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">{t('ssh.cpuUsage')}</h4>
                    <div className="flex items-end gap-2">
                        <span className="text-4xl font-bold text-foreground">{stats.cpu}%</span>
                        <span className="text-sm text-muted-foreground mb-1">{t('ssh.load')}</span>
                    </div>
                    <div className="w-full bg-muted/30 h-2 rounded-full mt-3 overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${stats.cpu > 80 ? 'bg-red-500' : stats.cpu > 50 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                            style={{ width: `${stats.cpu}%` }}
                        />
                    </div>
                </div>

                {/* Memory Usage */}
                <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">{t('ssh.memoryUsage')}</h4>
                    <div className="flex items-end gap-2">
                        <span className="text-4xl font-bold text-foreground">{Math.round((stats.memory.used / stats.memory.total) * 100)}%</span>
                        <span className="text-sm text-muted-foreground mb-1">
                            {stats.memory.used}MB / {stats.memory.total}MB
                        </span>
                    </div>
                    <div className="w-full bg-muted/30 h-2 rounded-full mt-3 overflow-hidden">
                        <div
                            className="h-full bg-blue-500 rounded-full transition-all duration-500"
                            style={{ width: `${(stats.memory.used / stats.memory.total) * 100}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Disk Usage */}
            <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
                <h4 className="text-sm font-medium text-muted-foreground mb-4">{t('ssh.diskUsage')}</h4>
                <div className="space-y-4">
                    {stats.disk.map((disk: any, idx: number) => (
                        <div key={idx} className="space-y-1">
                            <div className="flex justify-between text-sm">
                                <span className="font-mono text-xs text-muted-foreground">{disk.filesystem}</span>
                                <span>{disk.used} / {disk.total} ({disk.percent})</span>
                            </div>
                            <div className="w-full bg-muted/30 h-1.5 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-purple-500 rounded-full"
                                    style={{ width: disk.percent }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="text-xs text-muted-foreground text-right">
                {t('ssh.uptime')}: {stats.uptime}
            </div>
        </div>
    )
}
