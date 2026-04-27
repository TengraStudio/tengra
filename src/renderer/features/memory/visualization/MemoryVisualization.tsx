/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconDatabase, IconHistory, IconMaximize, IconNetwork } from '@tabler/icons-react';
import React, { useState } from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

import { EntityRelationshipDiagram } from './EntityRelationshipDiagram';
import { MemoryGraphView } from './MemoryGraphView';
import { MemoryTimelineView } from './MemoryTimelineView';

/* Batch-02: Extracted Long Classes */
const C_MEMORYVISUALIZATION_1 = "px-6 py-3 border-t border-border/30 bg-muted/20 flex items-center justify-between typo-caption text-muted-foreground font-bold";

function getLegacyTabAriaLabel(tabId: VizTab, fallbackLabel: string, t: (key: string) => string): string {
    if (tabId === 'entities') {
        return t('memory.entities');
    }
    if (tabId === 'timeline') {
        return t('memory.timeline');
    }
    return fallbackLabel;
}

type VizTab = 'graph' | 'entities' | 'timeline';

export const MemoryVisualization: React.FC = () => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<VizTab>('graph');

    const tabs = [
        { id: 'graph' as VizTab, label: t('memory.graphView'), icon: IconNetwork, color: 'text-primary' },
        { id: 'entities' as VizTab, label: t('memory.erDiagram'), icon: IconDatabase, color: 'text-success' },
        { id: 'timeline' as VizTab, label: t('memory.timelineView'), icon: IconHistory, color: 'text-info' },
    ];

    return (
        <div className="flex flex-col h-full bg-background/20 backdrop-blur-sm">
            {/* Header / Tabs */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 bg-muted/30">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-primary/20 rounded-xl text-primary">
                        <IconMaximize className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold">{t('memory.visualization.title')}</h1>
                        <p className="typo-caption text-muted-foreground">{t('memory.visualization.subtitle')}</p>
                    </div>
                </div>

                <div className="flex bg-background/50 p-1 rounded-2xl border border-border/50 shadow-inner">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            aria-label={getLegacyTabAriaLabel(tab.id, tab.label, t)}
                            className={cn(
                                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300',
                                activeTab === tab.id
                                    ? 'bg-muted/40 text-foreground shadow-xl scale-105'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                            )}
                        >
                            <tab.icon className={cn('w-4 h-4', activeTab === tab.id && tab.color)} />
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 p-6 overflow-hidden">
                <div className="h-full w-full relative">
                    {activeTab === 'graph' && <MemoryGraphView />}
                    {activeTab === 'entities' && <EntityRelationshipDiagram />}
                    {activeTab === 'timeline' && <MemoryTimelineView />}
                </div>
            </div>

            {/* Footer / Legend */}
            <div className={C_MEMORYVISUALIZATION_1}>
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                        <span>{t('memory.visualization.legend.semanticContext')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-success" />
                        <span>{t('memory.visualization.legend.entityKnowledge')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-info" />
                        <span>{t('memory.visualization.legend.episodicExperience')}</span>
                    </div>
                </div>
                <div>
                    {t('memory.visualization.poweredBy')}
                </div>
            </div>
        </div>
    );
};

