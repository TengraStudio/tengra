
import { Layers, RefreshCw, Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import type { SSHPackageInfo } from '@/types/ssh';

interface PackageManagerProps {
    connectionId: string
}

export function PackageManager({ connectionId }: PackageManagerProps) {
    const { t } = useTranslation();
    const [manager, setManager] = useState<'apt' | 'npm' | 'pip'>('apt');
    const [packages, setPackages] = useState<SSHPackageInfo[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);

    const fetchPackages = useCallback(async () => {
        setLoading(true);
        setPackages([]);
        try {
            const data = await window.electron.ssh.getInstalledPackages(connectionId, manager);
            setPackages(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [connectionId, manager]);

    useEffect(() => {
        void fetchPackages();
    }, [fetchPackages]);

    const filtered = packages.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Header */}
            <div className="p-4 border-b border-border/50 flex items-center justify-between gap-4">
                <div className="flex bg-muted/30 rounded-lg p-1">
                    {(['apt', 'npm', 'pip'] as const).map(m => (
                        <button
                            key={m}
                            onClick={() => setManager(m)}
                            className={cn(
                                "px-4 py-1.5 rounded-md text-sm font-medium transition-all uppercase",
                                manager === m ? "bg-muted/50 text-foreground shadow-sm" : "text-muted-foreground/40 hover:text-muted-foreground/60"
                            )}
                        >
                            {m}
                        </button>
                    ))}
                </div>

                <div className="flex-1 max-w-sm relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40" size={14} />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder={t('ssh.searchPackages')}
                        className="w-full bg-muted/30 border border-border/50 rounded-lg py-1.5 pl-9 pr-3 text-sm text-foreground focus:outline-none focus:border-primary/30"
                    />
                </div>

                <button
                    onClick={() => void fetchPackages()}
                    disabled={loading}
                    className="p-2 bg-muted/30 border border-border/50 rounded-lg text-muted-foreground/60 hover:text-foreground"
                >
                    <RefreshCw size={16} className={cn(loading && "animate-spin")} />
                </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2">
                {packages.length === 0 && !loading && (
                    <div className="text-center text-muted-foreground/40 py-10">{t('ssh.noPackages')}</div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {filtered.map((pkg, i) => (
                        <div key={i} className="bg-card/40 border border-border/50 rounded-lg p-3 flex items-start justify-between hover:bg-card/60 transition-colors group">
                            <div>
                                <div className="font-medium text-foreground/90 text-sm group-hover:text-primary transition-colors">{pkg.name}</div>
                                <div className="text-xs text-muted-foreground/40 mt-1 font-mono">{pkg.version}</div>
                            </div>
                            <Layers size={14} className="text-muted-foreground/20 group-hover:text-primary/40 transition-colors" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
