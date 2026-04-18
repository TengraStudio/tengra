/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { CheckCircle2, Package, Shield, Trash2, Zap } from 'lucide-react';

import { cn } from '@/lib/utils';

/* Batch-02: Extracted Long Classes */
const C_MCPCARD_1 = "h-8 px-2 flex items-center gap-1.5 rounded-md text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-all active:scale-95 text-xxxs font-bold uppercase tracking-wider";


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
            'group relative flex items-start gap-4 p-4 transition-colors duration-200',
            plugin.isEnabled ? 'bg-primary/[0.03]' : 'bg-transparent hover:bg-muted/30'
        )}>
            {/* Visual indicator for enabled */}
            {plugin.isEnabled && (
                <div className="absolute left-0 top-4 bottom-4 w-0.5 bg-primary rounded-r-full" />
            )}

            {/* Icon - Smaller and more integrated */}
            <div className={cn(
                'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg transition-transform',
                plugin.isEnabled
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted/50 text-muted-foreground group-hover:scale-105'
            )}>
                {plugin.source === 'core' ? <Shield className="h-6 w-6" /> : <Package className="h-6 w-6" />}
            </div>

            <div className="flex flex-1 flex-col min-w-0 py-0.5">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 min-w-0">
                        <h3 className="truncate text-base font-semibold text-foreground/90">
                            {plugin.name}
                        </h3>
                        {plugin.isEnabled && (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success opacity-80" />
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
                                <Trash2 className="h-3.5 w-3.5" />
                                {t('marketplace.uninstall')}
                            </button>
                        )}
                        <div className="h-8 px-2 flex items-center gap-1.5 rounded-md bg-success/10 text-success text-xxxs font-bold uppercase tracking-wider">
                            <Zap className="h-3.5 w-3.5" />
                            {t('common.active')}
                        </div>
                    </div>
                </div>

                <div className="mt-1 flex items-center gap-2 text-xxs font-medium text-muted-foreground/60">
                    <span className="truncate">{plugin.author || (plugin.source === 'core' ? 'Tengra Core' : 'Unknown')}</span>
                    <span className="opacity-30">•</span>
                    <span className="font-bold">V{plugin.version || '1.0.0'}</span>
                    <span className="opacity-30">•</span>
                    <span className="uppercase tracking-widest text-xxxs font-black">{plugin.source}</span>
                </div>

                <p className="mt-2 line-clamp-1 text-sm text-muted-foreground/50 group-hover:text-muted-foreground/70 transition-colors">
                    {description}
                </p>

                {plugin.actions.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5 overflow-hidden max-h-6">
                        {plugin.actions.slice(0, 3).map((action, index) => (
                            <div 
                                key={`${plugin.id}-${action.name}-${index}`} 
                                className="px-2 py-0.5 rounded-md bg-muted/20 text-xxxs font-black uppercase tracking-widest text-muted-foreground/40"
                            >
                                {action.name}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

