import React, { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { useTranslation } from '@/i18n'
import type { SSHPackageInfo } from '@/types/ssh'

interface SSHPackagesProps {
    connectionId: string
    active: boolean
}

export const SSHPackages: React.FC<SSHPackagesProps> = ({ connectionId, active }) => {
    const { t } = useTranslation()
    const [packages, setPackages] = useState<SSHPackageInfo[]>([])
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')

    useEffect(() => {
        if (active && packages.length === 0) {
            loadPackages()
        }
    }, [active, connectionId])

    const loadPackages = async () => {
        setLoading(true)
        try {
            const data = await window.electron.ssh.getInstalledPackages(connectionId)
            setPackages(data)
        } catch (e) {
            console.error('Failed to load packages', e)
        } finally {
            setLoading(false)
        }
    }

    const filtered = packages.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

    if (!active) return null

    return (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b border-border space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{t('ssh.installedPackages')}</h3>
                    <button
                        onClick={loadPackages}
                        className="text-xs px-2 py-1 bg-muted hover:bg-muted/80 rounded"
                        disabled={loading}
                    >
                        {loading ? t('ssh.refreshing') : t('ssh.refresh')}
                    </button>
                </div>
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                    <input
                        className="w-full bg-muted/20 border border-border rounded-md pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder={t('ssh.searchPackages')}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex-1 overflow-auto p-0">
                <table className="w-full text-sm text-left">
                    <thead className="bg-muted/30 sticky top-0 backdrop-blur-sm">
                        <tr>
                            <th className="p-3 font-medium text-muted-foreground">{t('ssh.packageName')}</th>
                            <th className="p-3 font-medium text-muted-foreground">{t('ssh.packageVersion')}</th>
                            <th className="p-3 font-medium text-muted-foreground">{t('ssh.packageStatus')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                        {loading && packages.length === 0 ? (
                            <tr><td colSpan={3} className="p-8 text-center text-muted-foreground">{t('ssh.loading')}</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan={3} className="p-8 text-center text-muted-foreground">{t('ssh.noPackages')}</td></tr>
                        ) : (
                            filtered.map((pkg, i) => (
                                <tr key={i} className="hover:bg-muted/10 transition-colors">
                                    <td className="p-3 font-medium">{pkg.name}</td>
                                    <td className="p-3 text-muted-foreground font-mono text-xs">{pkg.version}</td>
                                    <td className="p-3">
                                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-xs border border-emerald-500/20">
                                            {pkg.status}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
