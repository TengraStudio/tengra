/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { AdvancedSemanticFragment, coerceMemoryCategory, MemoryCategory } from '@shared/types/advanced-memory';
import {
    Background,
    Controls,
    Edge,
    MarkerType,
    MiniMap,
    Node,
    Panel,
    ReactFlow,
    useEdgesState,
    useNodesState,
} from '@xyflow/react';
import { Network, RotateCcw } from 'lucide-react';
import React, { useCallback, useEffect, useMemo,useState } from 'react';

import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

import { appLogger } from '../../../utils/renderer-logger';
import { CATEGORY_CONFIG } from '../components/constants';

/* Batch-02: Extracted Long Classes */
const C_MEMORYGRAPHVIEW_1 = "p-2.5 bg-background/80 backdrop-blur-xl hover:bg-muted/40 rounded-xl border border-border/40 transition-all text-muted-foreground hover:text-foreground shadow-lg";



// Node type for memories
const MemoryNode = ({ data }: { data: { label: string; category: MemoryCategory; importance: number } }) => {
    const getCategoryColor = (cat: MemoryCategory) => {
        switch (cat) {
            case 'preference': return 'border-accent text-accent bg-accent/10';
            case 'personal': return 'border-info text-info bg-info/10';
            case 'workspace': return 'border-success text-success bg-success/10';
            case 'technical': return 'border-primary text-primary bg-primary/10';
            case 'workflow': return 'border-warning text-warning bg-warning/10';
            default: return 'border-muted text-muted-foreground bg-muted/20';
        }
    };

    return (
        <div className={cn(
            'px-4 py-2 rounded-xl border-2 shadow-xl backdrop-blur-md min-w-36 transition-all hover:scale-105',
            getCategoryColor(data.category)
        )}>
            <div className="typo-caption font-bold opacity-70 mb-1">{data.category}</div>
            <div className="text-sm font-medium line-clamp-2 leading-tight">{data.label}</div>
            <div className="mt-2 h-1 w-full bg-muted/40 rounded-full overflow-hidden">
                <div
                    className="h-full bg-current opacity-50 transition-all duration-1000"
                    style={{ width: `${data.importance * 100}%` }}
                />
            </div>
        </div>
    );
};

const nodeTypes = {
    memory: MemoryNode,
};

export const MemoryGraphView: React.FC = () => {
    const { t } = useTranslation();
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [allMemories, setAllMemories] = useState<AdvancedSemanticFragment[]>([]);
    const [categoryFilter, setCategoryFilter] = useState<MemoryCategory | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);

    const filteredMemories = useMemo(
        () => allMemories.filter(memory => {
            if (categoryFilter !== 'all' && memory.category !== categoryFilter) {
                return false;
            }
            if (!searchQuery.trim()) {
                return true;
            }
            const normalized = searchQuery.toLowerCase();
            return (
                memory.content.toLowerCase().includes(normalized)
                || memory.tags.some(tag => tag.toLowerCase().includes(normalized))
            );
        }),
        [allMemories, categoryFilter, searchQuery]
    );

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const result = await window.electron.advancedMemory.getAllAdvancedMemories();
            if (result.success && result.data) {
                const memories = result.data
                    .filter(m => m.status === 'confirmed')
                    .map(memory => ({
                        ...memory,
                        category: coerceMemoryCategory(memory.category)
                    }));
                setAllMemories(memories);
            }
        } catch (error) {
            appLogger.error('MemoryGraphView', 'Failed to load memory graph data', error as Error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    useEffect(() => {
        if (filteredMemories.length === 0) {
            setNodes([]);
            setEdges([]);
            return;
        }

        const radius = Math.max(400, filteredMemories.length * 40);
        const centerX = 0;
        const centerY = 0;

        const newNodes: Node[] = filteredMemories.map((memory, index) => {
            const angle = (index / filteredMemories.length) * 2 * Math.PI;
            return {
                id: memory.id,
                type: 'memory',
                position: {
                    x: centerX + radius * Math.cos(angle),
                    y: centerY + radius * Math.sin(angle),
                },
                data: {
                    label: memory.content,
                    category: memory.category,
                    importance: memory.importance,
                },
            };
        });

        const visibleIds = new Set(filteredMemories.map(memory => memory.id));
        const newEdges: Edge[] = [];

        filteredMemories.forEach(memory => {
            memory.relatedMemoryIds.forEach(relatedId => {
                if (!visibleIds.has(relatedId)) {
                    return;
                }
                newEdges.push({
                    id: `e-${memory.id}-${relatedId}`,
                    source: memory.id,
                    target: relatedId,
                    label: t('memory.graphEdgeRelated'),
                    animated: true,
                     style: { stroke: 'hsl(var(--border))' },
                     labelStyle: { fill: 'hsl(var(--muted-foreground))', fontSize: 8 },
                });
            });

            memory.contradictsIds.forEach(contradictId => {
                if (!visibleIds.has(contradictId)) {
                    return;
                }
                newEdges.push({
                    id: `c-${memory.id}-${contradictId}`,
                    source: memory.id,
                    target: contradictId,
                    label: t('memory.graphEdgeContradicts'),
                     style: { stroke: 'hsl(var(--destructive))', strokeWidth: 2 },
                     labelStyle: { fill: 'hsl(var(--destructive))', fontSize: 8 },
                     markerEnd: { type: MarkerType.ArrowClosed, color: 'hsl(var(--destructive))' },
                });
            });
        });

        setNodes(newNodes);
        setEdges(newEdges);
    }, [filteredMemories, setEdges, setNodes, t]);

    return (
        <div className="w-full h-full flex flex-col bg-background relative overflow-hidden rounded-2xl border border-border/30 shadow-2xl">
            {loading && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/50 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm font-medium text-muted-foreground animate-pulse">
                            {t('memory.graphLoading')}
                        </span>
                    </div>
                </div>
            )}

            <div className="flex-1">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    nodeTypes={nodeTypes}
                    fitView
                    colorMode="dark"
                >
                    <Background color="hsl(var(--border))" gap={20} size={1} />
                    <Controls className="bg-background/80 border-border/40 backdrop-blur-xl rounded-xl overflow-hidden" />
                    <MiniMap
                        style={{ backgroundColor: 'hsl(var(--muted) / 0.5)', borderRadius: '12px' }}
                        nodeColor={(n) => {
                            if (n.type === 'memory') {
                                return '#6366f1';
                            }
                            return '#94a3b8';
                        }}
                    />

                    <Panel position="top-left" className="m-4">
                        <div className="flex items-center gap-3 bg-background/80 backdrop-blur-xl p-2 rounded-2xl border border-border/40 shadow-xl">
                            <div className="p-2 bg-primary/20 rounded-xl text-primary">
                                <Network className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-sm font-bold">{t('memory.graphView')}</h2>
                                <p className="typo-caption text-muted-foreground">
                                    {t('memory.graphStats', { nodes: nodes.length, edges: edges.length })}
                                </p>
                            </div>
                        </div>
                    </Panel>

                    <Panel position="top-right" className="m-4">
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => void loadData()}
                                className={C_MEMORYGRAPHVIEW_1}
                                title={t('memory.refreshTitle')}
                            >
                                <RotateCcw className="w-4 h-4" />
                            </button>
                        </div>
                    </Panel>

                    <Panel position="top-center" className="m-4 w-full max-w-md">
                        <div className="flex items-center gap-2 rounded-xl border border-border/40 bg-background/80 p-2 backdrop-blur-xl">
                            <Input
                                value={searchQuery}
                                onChange={event => setSearchQuery(event.target.value)}
                                placeholder={t('memory.searchPlaceholder')}
                                className="h-8 bg-transparent"
                            />
                            <Select
                                value={categoryFilter}
                                onValueChange={value => setCategoryFilter(
                                    value === 'all' ? 'all' : coerceMemoryCategory(value)
                                )}
                            >
                                <SelectTrigger className="h-8 w-36 bg-transparent">
                                    <SelectValue placeholder={t('memory.allCategories')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">{t('memory.allCategories')}</SelectItem>
                                    {Object.entries(CATEGORY_CONFIG).map(([category, config]) => (
                                        <SelectItem key={category} value={category}>
                                            {t(config.labelKey)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </Panel>
                </ReactFlow>
            </div>

            {!loading && nodes.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-sm">
                    <p className="rounded-lg border border-border/40 bg-background/80 px-4 py-2 text-sm text-muted-foreground">
                        {t('memory.emptyState')}
                    </p>
                </div>
            )}
        </div>
    );
};
