import React, { useState } from 'react';
import { useTranslation } from '@/i18n';
import { Network, Database, History, Maximize2 } from 'lucide-react';
import { MemoryGraphView } from './MemoryGraphView';
import { EntityRelationshipDiagram } from './EntityRelationshipDiagram';
import { MemoryTimelineView } from './MemoryTimelineView';

type VizTab = 'graph' | 'entities' | 'timeline';

export const MemoryVisualization: React.FC = () => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<VizTab>('graph');

    const tabs = [
        { id: 'graph' as VizTab, label: t('memory.graph') || 'Knowledge Graph', icon: Network, color: 'text-primary' },
        { id: 'entities' as VizTab, label: t('memory.entities') || 'Entity Diagram', icon: Database, color: 'text-success' },
        { id: 'timeline' as VizTab, label: t('memory.timeline') || 'Memory Timeline', icon: History, color: 'text-info' },
    ];

    return (
        <div className="flex flex-col h-full bg-background/20 backdrop-blur-sm">
            {/* Header / Tabs */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-primary/20 rounded-xl text-primary">
                        <Maximize2 className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold tracking-tight">Memory Visualization</h1>
                        <p className="text-xs text-muted-foreground">Interactive exploration of agent knowledge</p>
                    </div>
                </div>

                <div className="flex bg-background/50 p-1 rounded-2xl border border-white/10 shadow-inner">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === tab.id
                                ? 'bg-white/10 text-foreground shadow-xl scale-105'
                                : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                                }`}
                        >
                            <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? tab.color : ''}`} />
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
            <div className="px-6 py-3 border-t border-white/5 bg-black/20 flex items-center justify-between text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                        <span>Semantic Context</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-success" />
                        <span>Entity Knowledge</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-info" />
                        <span>Episodic Experience</span>
                    </div>
                </div>
                <div>
                    Powered by Tandem Advanced Memory Service
                </div>
            </div>
        </div>
    );
};
