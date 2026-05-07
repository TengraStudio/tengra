/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconRefresh } from '@tabler/icons-react';
import React, { useEffect, useState } from 'react'; 

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { marketplaceStore, useMarketplaceStore } from '@/store/marketplace.store';

import { SettingsSharedProps } from '../types';

import { ExtensionPluginsTab } from './ExtensionPluginsTab';
import { MCPServersTab } from './MCPServersTab'; 
import { SkillsTab } from './SkillsTab';

export type ExtensionSettingsSection = 'mcp' | 'skills' | 'plugins';

interface ExtensionsTabProps extends SettingsSharedProps {
    initialSection?: ExtensionSettingsSection;
}

export const ExtensionsTab: React.FC<ExtensionsTabProps> = ({
    t,
    initialSection = 'plugins',
}) => {
    const [section, setSection] = useState<ExtensionSettingsSection>(initialSection);
    const registry = useMarketplaceStore(s => s.registry);

    useEffect(() => {
        setSection(initialSection);
    }, [initialSection]);

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h3 className="text-lg font-semibold">{t('frontend.settings.tabs.extensions')}</h3>
                    <p className="text-sm text-muted-foreground">{t('frontend.settings.extensions.description')}</p>
                </div> 
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => void marketplaceStore.checkLiveUpdates()}
                    className="h-8 gap-2"
                >
                    <IconRefresh className="h-4 w-4" /> 
                </Button>
            </div>

            <div className="inline-flex rounded-lg border border-border/40 bg-muted/20 p-1">
                {([
                    ['plugins', t('frontend.settings.tabs.plugins')],
                    ['mcp', t('frontend.settings.tabs.mcpServers')],
                    ['skills', t('frontend.settings.tabs.skills')],
                ] as Array<[ExtensionSettingsSection, string]>).map(([id, label]) => {
                    const hasUpdate = (registry?.[id === 'plugins' ? 'extensions' : id === 'mcp' ? 'mcp' : 'skills'] || [])
                        .some(item => item.updateAvailable);

                    return (
                        <button
                            key={id}
                            type="button"
                            onClick={() => setSection(id)}
                            className={cn(
                                'relative rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                                section === id
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            {label}
                            {hasUpdate && (
                                <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75"></span>
                                    <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive"></span>
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {section === 'plugins' ? (
                <ExtensionPluginsTab t={t} />
            ) : section === 'mcp' ? (
                <div className="rounded-lg border border-border/40 bg-card/30">
                    <MCPServersTab />
                </div>
            ) : (
                <SkillsTab t={t} />
            )}
        </div>
    );
};


