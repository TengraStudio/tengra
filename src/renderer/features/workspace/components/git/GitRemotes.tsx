/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconGlobe } from '@tabler/icons-react';
import React from 'react';

import { Remote } from './types';

interface RemotesProps {
    remotes: Remote[];
    t: (key: string) => string;
}

export const GitRemotes: React.FC<RemotesProps> = ({ remotes }) => {
    return (
        <div className="space-y-3">
            <span className="typo-overline font-semibold text-muted-foreground uppercase px-1">Remotes</span>
            <div className="p-4 rounded-lg bg-card border border-border/40 space-y-3">
                {remotes.length === 0 ? (
                    <div className="py-4 text-center typo-overline text-muted-foreground/30 font-bold uppercase ">
                        Local Only
                    </div>
                ) : (
                    remotes.map((remote) => (
                        <div key={remote.name} className="flex flex-col gap-1 overflow-hidden">
                            <div className="flex items-center gap-2">
                                <IconGlobe className="w-3 h-3 text-primary/40" />
                                <span className="text-sm font-bold text-foreground/80">{remote.name}</span>
                            </div>
                            <div className="typo-overline font-medium text-muted-foreground/50 truncate font-mono">
                                {remote.url}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

