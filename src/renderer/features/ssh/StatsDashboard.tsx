
import { Activity, Clock,Cpu, HardDrive } from 'lucide-react'
import { useEffect,useState } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useTranslation } from '@/i18n'
import { motion } from '@/lib/framer-motion-compat'

interface SystemStats {
    cpu: number
    memory: {
        total: number
        used: number
        percent: number
    }
    disk: number
    uptime: string
    error?: string
}

interface StatsDashboardProps {
    connectionId: string
}

export function StatsDashboard({ connectionId }: StatsDashboardProps) {
    const { t } = useTranslation()
    const [stats, setStats] = useState<SystemStats | null>(null)

    useEffect(() => {
        let isMounted = true
        const load = async () => {
            try {
                const data = await window.electron.ssh.getSystemStats(connectionId) as SystemStats
                if (isMounted && data && !data.error) {
                    setStats(data)
                }
            } catch (e) {
                console.error(e)
            }
        }

        void load()
        const interval = setInterval(() => void load(), 5000)
        return () => {
            isMounted = false
            clearInterval(interval)
        }
    }, [connectionId])

    if (!stats) {return <div className="flex items-center justify-center p-8 text-zinc-500">{t('ssh.loadingStats')}</div>}

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4">
            {/* CPU */}
            <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-zinc-400">{t('ssh.cpuUsage')}</CardTitle>
                    <Cpu size={16} className="text-blue-400" />
                </CardHeader>
                <CardContent>
                    <div className="flex items-end gap-2">
                        <span className="text-2xl font-bold text-white">{stats.cpu}%</span>
                    </div>
                    <div className="mt-3 h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-blue-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(stats.cpu, 100)}%` }}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* RAM */}
            <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-zinc-400">{t('ssh.memoryUsage')}</CardTitle>
                    <Activity size={16} className="text-purple-400" />
                </CardHeader>
                <CardContent>
                    <div className="flex items-end gap-2">
                        <span className="text-2xl font-bold text-white">{stats.memory?.percent}%</span>
                        <span className="text-xs text-zinc-500 mb-1">{stats.memory?.used} / {stats.memory?.total} MB</span>
                    </div>
                    <div className="mt-3 h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-purple-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(stats.memory?.percent ?? 0, 100)}%` }}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Disk */}
            <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-zinc-400">{t('ssh.diskUsage')}</CardTitle>
                    <HardDrive size={16} className="text-emerald-400" />
                </CardHeader>
                <CardContent>
                    <div className="flex items-end gap-2">
                        <span className="text-2xl font-bold text-white">{stats.disk}%</span>
                        <span className="text-xs text-zinc-500 mb-1">{t('ssh.rootPartition')}</span>
                    </div>
                    <div className="mt-3 h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-emerald-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(stats.disk, 100)}%` }}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Uptime */}
            <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-zinc-400">{t('ssh.uptime')}</CardTitle>
                    <Clock size={16} className="text-orange-400" />
                </CardHeader>
                <CardContent>
                    <div className="text-lg font-bold text-white truncate" title={stats.uptime}>
                        {stats.uptime || t('ssh.unknown')}
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">{t('ssh.serverUptime')}</p>
                </CardContent>
            </Card>
        </div>
    )
}
