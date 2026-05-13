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
import { appLogger } from '@system/utils/renderer-logger';
import { IconClock, IconLink, IconNetwork, IconRotate, IconTag } from '@tabler/icons-react';
import {
    Background,
    Controls,
    Edge,
    Handle,
    MarkerType,
    Node,
    Panel,
    Position,
    ReactFlow,
    useEdgesState,
    useNodesState,
} from '@xyflow/react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n';
import { resolveCssColorVariable } from '@/lib/theme-css';
import { cn } from '@/lib/utils';

import { CATEGORY_CONFIG } from '../components/constants';

/* Batch-02: Extracted Long Classes */
const C_MEMORYGRAPHVIEW_1 = "p-2.5 bg-background/80 backdrop-blur-xl hover:bg-muted/40 rounded-xl border border-border/40 transition-all text-muted-foreground hover:text-foreground shadow-lg";
const BRAIN_LEFT_CATEGORIES = new Set<MemoryCategory>(['preference', 'personal', 'relationship']);
const BRAIN_CENTER_CATEGORIES = new Set<MemoryCategory>(['workflow', 'workspace']);
const MEMORY_HANDLE_IDS = {
    input: 'memory-input',
    output: 'memory-output',
} as const;

type BrainSlot = {
    x: number;
    y: number;
    width: number;
    height: number;
};

const BRAIN_LAYERS: Record<'left' | 'right' | 'center', BrainSlot> = {
    left: { x: -340, y: 0, width: 680, height: 560 },
    right: { x: 340, y: 0, width: 680, height: 560 },
    center: { x: 0, y: 8, width: 200, height: 280 },
};
function hashString(value: string): number {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
        hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
    }
    return hash;
}

function getHemisphere(category: MemoryCategory): 'left' | 'right' {
    return BRAIN_LEFT_CATEGORIES.has(category) ? 'left' : 'right';
}

function getBrainLayout(memories: AdvancedSemanticFragment[]): Map<string, { x: number; y: number }> {
    const positions = new Map<string, { x: number; y: number }>();
    const left = memories.filter(memory => getHemisphere(memory.category) === 'left' && !BRAIN_CENTER_CATEGORIES.has(memory.category));
    const right = memories.filter(memory => getHemisphere(memory.category) === 'right' && !BRAIN_CENTER_CATEGORIES.has(memory.category));
    const center = memories.filter(memory => BRAIN_CENTER_CATEGORIES.has(memory.category));

    const placeRows = (
        group: AdvancedSemanticFragment[],
        slot: BrainSlot,
        hemisphere: 'left' | 'right' | 'center'
    ) => {
        const count = group.length;
        if (count === 0) {
            return;
        }

        const columns = hemisphere === 'center' ? 2 : 4;
        const columnSpacing = slot.width / columns;
        const rowCount = Math.max(10, Math.ceil(count / columns));
        const rowSpacing = slot.height / rowCount;
        const startX = slot.x - (slot.width / 2) + (columnSpacing / 2);
        const startY = slot.y - (slot.height / 2) + (rowSpacing / 2);

        group.forEach((memory, index) => {
            const columnIndex = index % columns;
            const rowIndex = Math.floor(index / columns);
            const hash = hashString(memory.id);
            const arc = Math.abs((rowIndex / Math.max(1, rowCount - 1)) - 0.5);
            const sideNudge = hemisphere === 'left' ? -arc * 18 : hemisphere === 'right' ? arc * 18 : 0;
            const jitterX = (((hash >> 4) % 7) - 3) * 2.5;
            const jitterY = (((hash >> 11) % 7) - 3) * 2.5;

            positions.set(memory.id, {
                x: startX + (columnIndex * columnSpacing) + sideNudge + jitterX,
                y: startY + (rowIndex * rowSpacing) + jitterY,
            });
        });
    };

    const sortedLeft = [...left].sort((a, b) => b.importance - a.importance);
    const sortedRight = [...right].sort((a, b) => b.importance - a.importance);
    const sortedCenter = [...center].sort((a, b) => b.importance - a.importance);

    placeRows(sortedLeft, BRAIN_LAYERS.left, 'left');
    placeRows(sortedRight, BRAIN_LAYERS.right, 'right');
    placeRows(sortedCenter, BRAIN_LAYERS.center, 'center');

    return positions;
}

type MemoryNodeData = {
    preview: string;
    category: MemoryCategory;
    categoryLabel: string;
    sourceLabel: string;
    importance: number;
    isSelected?: boolean;
};

const getNodeTone = (category: MemoryCategory): { badge: string; accent: string; border: string; chip: string } => {
    switch (category) {
        case 'preference':
            return { badge: 'bg-primary/15 text-primary', accent: 'bg-primary', border: 'border-primary/25', chip: 'bg-primary/10' };
        case 'personal':
            return { badge: 'bg-accent/15 text-accent', accent: 'bg-accent', border: 'border-accent/25', chip: 'bg-accent/10' };
        case 'workspace':
            return { badge: 'bg-success/15 text-success', accent: 'bg-success', border: 'border-success/25', chip: 'bg-success/10' };
        case 'technical':
            return { badge: 'bg-warning/15 text-warning', accent: 'bg-warning', border: 'border-warning/25', chip: 'bg-warning/10' };
        case 'workflow':
            return { badge: 'bg-info/15 text-info', accent: 'bg-info', border: 'border-info/25', chip: 'bg-info/10' };
        case 'relationship':
            return { badge: 'bg-info/15 text-info', accent: 'bg-info', border: 'border-info/25', chip: 'bg-info/10' };
        case 'instruction':
            return { badge: 'bg-warning/15 text-warning', accent: 'bg-warning', border: 'border-warning/25', chip: 'bg-warning/10' };
        case 'fact':
        default:
            return { badge: 'bg-muted/20 text-muted-foreground', accent: 'bg-muted-foreground', border: 'border-border/35', chip: 'bg-muted/10' };
    }
};

const MemoryNode = ({ data }: { data: MemoryNodeData }) => {
    const tone = getNodeTone(data.category);
    const Icon = CATEGORY_CONFIG[data.category].icon;

    return (
        <div
            title={data.preview}
            className={cn(
                'w-[11.25rem] rounded-2xl border bg-card/95 px-3 py-2.5 shadow-[0_12px_26px_rgba(0,0,0,0.18)] backdrop-blur-md transition-transform',
                tone.border,
                data.isSelected && 'ring-2 ring-primary/35 scale-[1.02]'
            )}
        >
            <div className="flex items-center gap-2">
                <div className={cn('flex h-7 w-7 items-center justify-center rounded-xl', tone.chip)}>
                    <Icon className={cn('h-4 w-4', tone.accent)} />
                </div>
                <div className={cn('inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]', tone.badge)}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', tone.accent)} />
                    <span className="truncate">{data.categoryLabel}</span>
                </div>
                <span className="ml-auto text-[10px] font-semibold tabular-nums text-muted-foreground">
                    {Math.round(data.importance * 100)}%
                </span>
            </div>
            <div className="mt-2 text-[11px] font-medium leading-4 text-foreground/95 line-clamp-3">
                {data.preview}
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                <span className="truncate">{data.sourceLabel}</span>
                <span className="truncate">{data.categoryLabel}</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border/50">
                <div
                    className={cn('h-full rounded-full', tone.accent)}
                    style={{ width: `${Math.max(16, data.importance * 100)}%` }}
                />
            </div>
            <Handle id={MEMORY_HANDLE_IDS.input} type="target" position={Position.Top} className="!h-2 !w-2 !border-0 !bg-transparent !opacity-0" />
            <Handle id={MEMORY_HANDLE_IDS.output} type="source" position={Position.Bottom} className="!h-2 !w-2 !border-0 !bg-transparent !opacity-0" />
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
    const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(null);
    const [categoryFilter, setCategoryFilter] = useState<MemoryCategory | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);

    const { isLight } = useTheme();

    const loadData = useCallback(async (): Promise<void> => {
        await Promise.resolve();

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

    const selectedMemory = useMemo(
        () => allMemories.find(memory => memory.id === selectedMemoryId) ?? null,
        [allMemories, selectedMemoryId]
    );

    useEffect(() => {
        queueMicrotask(() => {
            void loadData();
        });
    }, [loadData]);

    const neutralEdgeColor = resolveCssColorVariable('border', 'hsl(215 16% 47%)');
    const destructiveColor = resolveCssColorVariable('destructive', 'hsl(0 72% 51%)');
    const relationshipGridColor = resolveCssColorVariable('memory-relationship-grid', 'hsl(215 16% 47% / 0.35)');

    useEffect(() => {
        if (filteredMemories.length === 0) {
            setNodes([]);
            setEdges([]);
            return;
        }

        const sortedMemories = [...filteredMemories].sort((a, b) => b.importance - a.importance);
        const layout = getBrainLayout(sortedMemories);
        const newNodes: Node[] = sortedMemories.map(memory => ({
            id: memory.id,
            type: 'memory',
            position: layout.get(memory.id) ?? { x: 0, y: 0 },
            data: {
                preview: memory.content.length > 88 ? `${memory.content.slice(0, 88).trimEnd()}…` : memory.content,
                category: memory.category,
                categoryLabel: t(CATEGORY_CONFIG[memory.category].labelKey),
                sourceLabel: t(`frontend.memory.sources.${memory.source}`) === `frontend.memory.sources.${memory.source}`
                    ? memory.source.replace(/_/g, ' ')
                    : t(`frontend.memory.sources.${memory.source}`),
                importance: memory.importance,
                isSelected: memory.id === selectedMemoryId,
            },
        }));

        const visibleIds = new Set(filteredMemories.map(memory => memory.id));
        const newEdges: Edge[] = [];
        const seenEdges = new Set<string>();

        const addEdge = (source: string, target: string, edge: Edge): void => {
            const key = `${source}:${target}:${edge.type ?? 'smoothstep'}`;
            if (seenEdges.has(key)) {
                return;
            }
            seenEdges.add(key);
            newEdges.push(edge);
        };

        filteredMemories.forEach(memory => {
            memory.relatedMemoryIds.forEach(relatedId => {
                if (!visibleIds.has(relatedId)) {
                    return;
                }
                addEdge(memory.id, relatedId, {
                    id: `e-${memory.id}-${relatedId}`,
                    source: memory.id,
                    target: relatedId,
                    sourceHandle: MEMORY_HANDLE_IDS.output,
                    targetHandle: MEMORY_HANDLE_IDS.input,
                    animated: true,
                    type: 'smoothstep',
                    style: { stroke: neutralEdgeColor, strokeWidth: 1.2, opacity: 0.22 },
                });
            });

            memory.contradictsIds.forEach(contradictId => {
                if (!visibleIds.has(contradictId)) {
                    return;
                }
                addEdge(memory.id, contradictId, {
                    id: `c-${memory.id}-${contradictId}`,
                    source: memory.id,
                    target: contradictId,
                    sourceHandle: MEMORY_HANDLE_IDS.output,
                    targetHandle: MEMORY_HANDLE_IDS.input,
                    type: 'smoothstep',
                    style: { stroke: destructiveColor, strokeWidth: 1.5, opacity: 0.42 },
                    markerEnd: { type: MarkerType.ArrowClosed, color: destructiveColor },
                });
            });
        });

        const structuralGroups = [
            sortedMemories.filter(memory => getHemisphere(memory.category) === 'left'),
            sortedMemories.filter(memory => getHemisphere(memory.category) === 'right'),
            sortedMemories.filter(memory => BRAIN_CENTER_CATEGORIES.has(memory.category)),
        ];

        structuralGroups.forEach((group, groupIndex) => {
            group.forEach((memory, index) => {
                const next = group[index + 1];
                if (next) {
                    addEdge(memory.id, next.id, {
                        id: `s-${groupIndex}-${memory.id}-${next.id}`,
                        source: memory.id,
                        target: next.id,
                        sourceHandle: MEMORY_HANDLE_IDS.output,
                        targetHandle: MEMORY_HANDLE_IDS.input,
                        type: 'smoothstep',
                        style: {
                            stroke: neutralEdgeColor,
                            strokeWidth: 1,
                            opacity: 0.12,
                            strokeDasharray: '4 8',
                        },
                    });
                }
            });
        });

        setNodes(newNodes);
        setEdges(newEdges);
    }, [destructiveColor, filteredMemories, neutralEdgeColor, selectedMemoryId, setEdges, setNodes, t]);

    return (
        <div className="relative w-full h-full min-h-[32rem] flex flex-col overflow-hidden rounded-2xl border border-border/30 bg-background shadow-2xl">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute left-[8%] top-[10%] h-[74%] w-[30%] rounded-[52%_48%_44%_56%/58%_52%_48%_42%] bg-primary/12 blur-3xl" />
                <div className="absolute right-[8%] top-[10%] h-[74%] w-[30%] rounded-[48%_52%_56%_44%/52%_58%_42%_48%] bg-info/12 blur-3xl" />
                <div className="absolute left-1/2 top-[18%] h-[58%] w-[12%] -translate-x-1/2 rounded-[50%] bg-gradient-to-b from-transparent via-border/25 to-transparent blur-2xl" />
                <svg
                    viewBox="0 0 900 520"
                    className="absolute inset-0 h-full w-full opacity-[0.12]"
                    aria-hidden="true"
                >
                    <path
                        d="M180 304c-42-36-58-100-38-151 24-59 85-102 152-103 46-1 91 18 120 54 18-43 60-72 107-75 73-4 140 47 154 118 4 18 3 38-3 57 34 22 57 60 57 104 0 69-56 125-125 125-26 0-50-8-70-21-26 44-77 73-132 73-64 0-121-37-147-91-20 10-42 16-66 16-65 0-118-53-118-118 0-3 0-8 1-12 17 18 39 30 68 30z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="10"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-foreground/80"
                    />
                </svg>
            </div>
            {loading && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/50 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm font-medium text-muted-foreground animate-pulse">
                            {t('frontend.memory.graphLoading')}
                        </span>
                    </div>
                </div>
            )}

            <div className="relative flex-1 min-h-[32rem]">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    nodeTypes={nodeTypes}
                    fitView
                    style={{ width: '100%', height: '100%' }}
                    onNodeClick={(_, node) => {
                        setSelectedMemoryId(node.id);
                    }}
                    onPaneClick={() => {
                        setSelectedMemoryId(null);
                    }}
                    defaultEdgeOptions={{
                        type: 'smoothstep',
                        style: { strokeLinecap: 'round' },
                    }}
                    colorMode={isLight ? 'light' : 'dark'}
                >
                    <Background color={relationshipGridColor} gap={20} size={1} />
                    <Controls className="bg-background/80 border-border/40 backdrop-blur-xl rounded-xl overflow-hidden" />
                    

                    <Panel position="top-left" className="m-4">
                        <div className="flex items-center gap-3 rounded-2xl border border-border/40 bg-background/80 p-3 backdrop-blur-xl shadow-xl">
                            <div className="rounded-2xl bg-primary/20 p-2 text-primary">
                                <IconNetwork className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-sm font-bold">{t('frontend.memory.graphView')}</h2>
                                <p className="typo-caption text-muted-foreground">
                                    {t('frontend.memory.graphStats', { nodes: nodes.length, edges: edges.length })}
                                </p>
                            </div>
                        </div>
                    </Panel>

                    <Panel position="top-right" className="m-4">
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => void loadData()}
                                className={C_MEMORYGRAPHVIEW_1}
                                title={t('frontend.memory.refreshTitle')}
                            >
                                <IconRotate className="w-4 h-4" />
                            </button>
                        </div>
                    </Panel>

                    <Panel position="top-center" className="m-4 w-full max-w-md">
                        <div className="flex items-center gap-2 rounded-xl border border-border/40 bg-background/80 p-2 backdrop-blur-xl">
                            <Input
                                value={searchQuery}
                                onChange={event => setSearchQuery(event.target.value)}
                                placeholder={t('frontend.memory.searchPlaceholder')}
                                className="h-8 bg-transparent"
                            />
                            <Select
                                value={categoryFilter}
                                onValueChange={value => setCategoryFilter(
                                    value === 'all' ? 'all' : coerceMemoryCategory(value)
                                )}
                            >
                                <SelectTrigger className="h-8 w-36 bg-transparent">
                                    <SelectValue placeholder={t('frontend.memory.allCategories')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">{t('frontend.memory.allCategories')}</SelectItem>
                                    {Object.entries(CATEGORY_CONFIG).map(([category, config]) => (
                                        <SelectItem key={category} value={category}>
                                            {t(config.labelKey)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </Panel> 

                    <Panel position="bottom-left" className="m-4 max-w-[24rem]">
                        <div className="rounded-2xl border border-border/40 bg-background/88 p-4 backdrop-blur-xl shadow-xl">
                            {selectedMemory ? (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <span className="inline-flex items-center gap-2 rounded-full border border-border/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                            {t(CATEGORY_CONFIG[selectedMemory.category].labelKey)}
                                        </span>
                                        <span className="ml-auto text-[10px] font-semibold tabular-nums text-muted-foreground">
                                            {Math.round(selectedMemory.importance * 100)}%
                                        </span>
                                    </div>
                                    <p className="text-sm leading-5 text-foreground/95">
                                        {selectedMemory.content}
                                    </p>
                                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                        <div className="flex items-center gap-1.5">
                                            <IconClock className="h-3.5 w-3.5" />
                                            <span>{t('frontend.memory.graphCreated', { time: new Date(selectedMemory.createdAt).toLocaleDateString() })}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <IconLink className="h-3.5 w-3.5" />
                                            <span>{t('frontend.memory.graphLinks', { count: selectedMemory.relatedMemoryIds.length + selectedMemory.contradictsIds.length })}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 col-span-2">
                                            <IconTag className="h-3.5 w-3.5" />
                                            <span className="truncate">
                                                {selectedMemory.tags.length > 0 ? selectedMemory.tags.join(', ') : t('frontend.memory.graphNoTags')}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    {t('frontend.memory.graphSelectionHint')}
                                </p>
                            )}
                        </div>
                    </Panel>
                </ReactFlow>
            </div>

            {!loading && nodes.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-sm">
                    <p className="rounded-lg border border-border/40 bg-background/80 px-4 py-2 text-sm text-muted-foreground">
                        {t('frontend.memory.emptyState')}
                    </p>
                </div>
            )}
        </div>
    );
};
