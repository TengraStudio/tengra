/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Globe } from 'lucide-react';

import { Remote } from './types';

interface RemotesProps {
    remotes: Remote[];
    t: (key: string) => string;
}

export const GitRemotes: React.FC<RemotesProps> = ({ remotes, t }) => {
    if (remotes.length === 0) { return null; }
    return (
        <div className="bg-card/80 backdrop-blur-md rounded-2xl border border-border/50 p-6">
            <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                <Globe className="w-4 h-4" />
                {t('workspaceDashboard.remotes')}
            </h3>
            <div className="space-y-2">
                {remotes.map((remote: Remote) => (
                    <div key={remote.name} className="bg-muted/30 rounded-xl p-3 flex items-center justify-between">
                        <div>
                            <div className="text-sm font-semibold text-foreground">{remote.name}</div>
                            <div className="typo-caption text-muted-foreground">{remote.url}</div>
                        </div>
                        <div className="flex items-center gap-2 typo-caption text-muted-foreground">
                            {remote.fetch && <span>{t('workspaceDashboard.fetch')}</span>}
                            {remote.push && <span>{t('workspaceDashboard.push')}</span>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
