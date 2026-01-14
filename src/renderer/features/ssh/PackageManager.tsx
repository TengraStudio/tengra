
import { Layers,RefreshCw, Search } from 'lucide-react'
import { useEffect,useState } from 'react'

import { useTranslation } from '@/i18n'
import { cn } from '@/lib/utils'
import type { SSHPackageInfo } from '@/types/ssh'

interface PackageManagerProps {
    connectionId: string
}

export function PackageManager({ connectionId }: PackageManagerProps) {
    const { t } = useTranslation()
    const [manager, setManager] = useState<'apt' | 'npm' | 'pip'>('apt')
    const [packages, setPackages] = useState<SSHPackageInfo[]>([])
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(false)

    const fetchPackages = async () => {
        setLoading(true)
        setPackages([])
        try {
            const data = await window.electron.ssh.getInstalledPackages(connectionId, manager)
            setPackages(data)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchPackages()
    }, [connectionId, manager])

    const filtered = packages.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

    return (
        <div className="flex flex-col h-full bg-zinc-950">
            {/* Header */}
            <div className="p-4 border-b border-white/5 flex items-center justify-between gap-4">
                <div className="flex bg-zinc-900 rounded-lg p-1">
                    {(['apt', 'npm', 'pip'] as const).map(m => (
                        <button
                            key={m}
                            onClick={() => setManager(m)}
                            className={cn(
                                "px-4 py-1.5 rounded-md text-sm font-medium transition-all uppercase",
                                manager === m ? "bg-zinc-800 text-white shadow" : "text-zinc-500 hover:text-zinc-300"
                            )}
                        >
                            {m}
                        </button>
                    ))}
                </div>

                <div className="flex-1 max-w-sm relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder={t('ssh.searchPackages')}
                        className="w-full bg-zinc-900 border border-white/10 rounded-lg py-1.5 pl-9 pr-3 text-sm text-white focus:outline-none focus:border-white/20"
                    />
                </div>

                <button
                    onClick={fetchPackages}
                    disabled={loading}
                    className="p-2 bg-zinc-900 border border-white/10 rounded-lg text-zinc-400 hover:text-white"
                >
                    <RefreshCw size={16} className={cn(loading && "animate-spin")} />
                </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2">
                {packages.length === 0 && !loading && (
                    <div className="text-center text-zinc-500 py-10">{t('ssh.noPackages')}</div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {filtered.map((pkg, i) => (
                        <div key={i} className="bg-zinc-900/50 border border-white/5 rounded-lg p-3 flex items-start justify-between">
                            <div>
                                <div className="font-medium text-zinc-200 text-sm">{pkg.name}</div>
                                <div className="text-xs text-zinc-500 mt-1 font-mono">{pkg.version}</div>
                            </div>
                            <Layers size={14} className="text-zinc-700" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
