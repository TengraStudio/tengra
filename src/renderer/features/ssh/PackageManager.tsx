/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */


import { IconLayersLinked, IconRefresh, IconSearch } from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import type { SSHPackageInfo } from '@/types/ssh';
import { appLogger } from '@/utils/renderer-logger';

/* Batch-02: Extracted Long Classes */
const C_PACKAGEMANAGER_1 = "w-full bg-muted/30 border border-border/50 rounded-lg py-1.5 pl-9 pr-3 text-sm text-foreground focus:outline-none focus:border-primary/30";
const C_PACKAGEMANAGER_2 = "bg-card/40 border border-border/50 rounded-lg p-3 flex items-start justify-between hover:bg-card/60 transition-colors group";


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
            appLogger.error('PackageManager', 'Failed to load packages', e as Error);
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
                                "px-4 py-1.5 rounded-md text-sm font-medium transition-all ",
                                manager === m ? "bg-muted/50 text-foreground shadow-sm" : "text-muted-foreground/40 hover:text-muted-foreground/60"
                            )}
                        >
                            {m}
                        </button>
                    ))}
                </div>

                <div className="flex-1 max-w-sm relative">
                    <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40" size={14} />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder={t('frontend.ssh.searchPackages')}
                        className={C_PACKAGEMANAGER_1}
                    />
                </div>

                <button
                    onClick={() => void fetchPackages()}
                    disabled={loading}
                    className="p-2 bg-muted/30 border border-border/50 rounded-lg text-muted-foreground/60 hover:text-foreground"
                >
                    <IconRefresh size={16} className={cn(loading && "animate-spin")} />
                </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2">
                {packages.length === 0 && !loading && (
                    <div className="text-center text-muted-foreground/40 py-10">{t('frontend.ssh.noPackages')}</div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {filtered.map((pkg, i) => (
                        <div key={i} className={C_PACKAGEMANAGER_2}>
                            <div>
                                <div className="font-medium text-foreground/90 text-sm group-hover:text-primary transition-colors">{pkg.name}</div>
                                <div className="typo-caption text-muted-foreground/40 mt-1 font-mono">{pkg.version}</div>
                            </div>
                            <IconLayersLinked size={14} className="text-muted-foreground/20 group-hover:text-primary/40 transition-colors" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
