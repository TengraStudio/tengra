/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconBolt, IconCircleCheck, IconPackage, IconShield, IconTrash } from '@tabler/icons-react';

import { cn } from '@/lib/utils';

/* Batch-02: Extracted Long Classes */
const C_MCPCARD_1 = "h-8 px-3 flex items-center gap-2 rounded-lg text-destructive/40 hover:text-destructive hover:bg-destructive/5 transition-colors text-sm font-semibold";

interface McpAction {
    name: string;
    description: string;
}

export interface McpPlugin {
    id: string;
    name: string;
    description: string;
    isEnabled: boolean;
    isAlive: boolean;
    source: 'core' | 'user' | 'remote';
    actions: McpAction[];
    version?: string;
    author?: string;
}

interface McpCardProps {
    plugin: McpPlugin;
    t: (key: string, options?: Record<string, string | number>) => string;
    onUninstall?: (id: string, name: string) => void;
}

export const McpCard = ({ plugin, t, onUninstall }: McpCardProps): JSX.Element => {
    const localizedDesc = t(`marketplace.mcp.plugins.${plugin.name.toLowerCase()}.description`);
    const description = localizedDesc.includes('marketplace.mcp.plugins') ? plugin.description : localizedDesc;

    return (
        <div className={cn(
            'group relative flex items-start gap-4 p-5 transition-all duration-200 border border-transparent rounded-2xl',
            plugin.isEnabled ? 'bg-primary/02 border-primary/10' : 'bg-transparent hover:bg-muted/30 hover:border-border/30'
        )}>
            {/* Icon Container */}
            <div className={cn(
                'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-all',
                plugin.isEnabled
                    ? 'bg-primary/10 text-primary shadow-inner'
                    : 'bg-muted/40 text-muted-foreground/40 group-hover:bg-muted/60 group-hover:text-muted-foreground'
            )}>
                {plugin.source === 'core' ? <IconShield className="h-6 w-6" /> : <IconPackage className="h-6 w-6" />}
            </div>

            <div className="flex flex-1 flex-col min-w-0 py-0.5">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 min-w-0">
                        <h3 className="truncate text-base font-semibold text-foreground ">
                            {plugin.name}
                        </h3>
                        {plugin.isEnabled && (
                            <IconCircleCheck className="h-3.5 w-3.5 shrink-0 text-primary/60" />
                        )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        {onUninstall && plugin.source !== 'core' && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onUninstall(plugin.id, plugin.name);
                                }}
                                className={C_MCPCARD_1}
                            >
                                <IconTrash className="h-3.5 w-3.5" />
                                {t('frontend.marketplace.uninstall')}
                            </button>
                        )}
                        <div className="h-8 px-3 flex items-center gap-1.5 rounded-lg bg-primary/5 text-primary text-sm font-semibold">
                            <IconBolt className="h-3.5 w-3.5" />
                            {t('common.active')}
                        </div>
                    </div>
                </div>

                <div className="mt-1.5 flex items-center gap-2 text-sm font-medium text-muted-foreground/40">
                    <span className="truncate">{plugin.author || (plugin.source === 'core' ? 'Tengra Core' : 'Unknown')}</span>
                    <span className="opacity-20">•</span>
                    <span className="font-semibold  text-sm bg-muted/40 px-1.5 py-0.5 rounded-md text-muted-foreground/40">V{plugin.version || '1.0.0'}</span>
                    <span className="opacity-20">•</span>
                    <span className=" uppercase opacity-80 text-sm">{plugin.source}</span>
                </div>

                <p className="mt-3 line-clamp-1 text-sm text-muted-foreground/50 group-hover:text-muted-foreground/70 transition-colors">
                    {description}
                </p>

                {plugin.actions.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5 overflow-hidden max-h-7">
                        {plugin.actions.slice(0, 3).map((action, index) => (
                            <div
                                key={`${plugin.id}-${action.name}-${index}`}
                                className="px-2 py-0.5 rounded-md bg-muted/20 text-sm font-semibold  text-muted-foreground/40 border border-border/5"
                            >
                                {action.name}
                            </div>
                        ))}
                        {plugin.actions.length > 3 && (
                            <div className="px-2 py-0.5 rounded-md bg-muted/10 text-sm font-semibold text-muted-foreground/30">
                                +{plugin.actions.length - 3}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

