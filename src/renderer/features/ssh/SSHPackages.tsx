/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconSearch } from '@tabler/icons-react';
import React, { useCallback, useEffect, useState } from 'react';

import { useTranslation } from '@/i18n';
import type { SSHPackageInfo } from '@/types/ssh';
import { appLogger } from '@/utils/renderer-logger';

/* Batch-02: Extracted Long Classes */
const C_SSHPACKAGES_1 = "w-full bg-muted/20 border border-border/50 rounded-md pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50";


interface SSHPackagesProps {
    connectionId: string
    active: boolean
}

export const SSHPackages: React.FC<SSHPackagesProps> = ({ connectionId, active }) => {
    const { t } = useTranslation();
    const [packages, setPackages] = useState<SSHPackageInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');

    const loadPackages = useCallback(async () => {
        setLoading(true);
        try {
            const data = await window.electron.ssh.getInstalledPackages(connectionId);
            setPackages(data);
        } catch (e) {
            appLogger.error('SSHPackages', 'Failed to load packages', e as Error);
        } finally {
            setLoading(false);
        }
    }, [connectionId]);

    useEffect(() => {
        if (active && packages.length === 0) {
            void loadPackages();
        }
    }, [active, packages.length, loadPackages]);

    const filtered = packages.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

    if (!active) { return null; }

    return (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b border-border space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{t('frontend.ssh.installedPackages')}</h3>
                    <button
                        onClick={() => void loadPackages()}
                        className="typo-caption px-2 py-1 bg-muted hover:bg-muted/80 rounded"
                        disabled={loading}
                    >
                        {loading ? t('frontend.ssh.refreshing') : t('frontend.ssh.refresh')}
                    </button>
                </div>
                <div className="relative">
                    <IconSearch className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground/50" />
                    <input
                        className={C_SSHPACKAGES_1}
                        placeholder={t('frontend.ssh.searchPackages')}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex-1 overflow-auto p-0">
                <table className="w-full text-sm text-left">
                    <thead className="bg-muted/30 sticky top-0 backdrop-blur-sm">
                        <tr>
                            <th className="p-3 font-medium text-muted-foreground">{t('frontend.ssh.packageName')}</th>
                            <th className="p-3 font-medium text-muted-foreground">{t('frontend.ssh.packageVersion')}</th>
                            <th className="p-3 font-medium text-muted-foreground">{t('frontend.ssh.packageStatus')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                        {loading && packages.length === 0 ? (
                            <tr><td colSpan={3} className="p-8 text-center text-muted-foreground">{t('frontend.ssh.loading')}</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan={3} className="p-8 text-center text-muted-foreground">{t('frontend.ssh.noPackages')}</td></tr>
                        ) : (
                            filtered.map((pkg, i) => (
                                <tr key={i} className="hover:bg-muted/10 transition-colors">
                                    <td className="p-3 font-medium">{pkg.name}</td>
                                    <td className="p-3 text-muted-foreground font-mono typo-caption">{pkg.version}</td>
                                    <td className="p-3">
                                        <span className="px-2 py-0.5 rounded-full bg-success/10 text-success text-sm font-bold border border-success/20">
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
    );
};
