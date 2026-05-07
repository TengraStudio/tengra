/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { appLogger } from '@system/utils/renderer-logger';
import { IconDatabase, IconRotate } from '@tabler/icons-react';
import {
    Background,
    Controls,
    Edge,
    MiniMap,
    Node,
    Panel,
    ReactFlow,
    useEdgesState,
    useNodesState,
} from '@xyflow/react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n';
import { resolveCssColorVariable } from '@/lib/theme-css';

/* Batch-02: Extracted Long Classes */
const C_ENTITYRELATIONSHIPDIAGRAM_1 = "p-2.5 bg-background/80 backdrop-blur-xl hover:bg-muted/40 rounded-xl border border-border/50 transition-all text-muted-foreground hover:text-foreground shadow-lg";



// Node type for Entities
const EntityNode = ({ data }: { data: { name: string; type: string; properties: Record<string, string> } }) => {
    return (
        <div className="px-4 py-3 rounded-2xl border-2 border-primary/30 bg-background/90 backdrop-blur-xl shadow-2xl min-w-52">
            <div className="flex items-center gap-2 mb-2">
                <div className="px-1.5 py-0.5 rounded-md bg-primary/20 text-primary text-sm font-bold">
                    {data.type}
                </div>
                <div className="text-sm font-bold text-foreground truncate">{data.name}</div>
            </div>
            <div className="space-y-1.5">
                {Object.entries(data.properties).map(([key, value]) => (
                    <div key={key} className="flex flex-col gap-0.5 border-t border-border/40 pt-1.5 first:border-0 first:pt-0">
                        <span className="text-sm text-muted-foreground">{key}</span>
                        <span className="typo-caption text-foreground/80 line-clamp-2">{value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const nodeTypes = {
    entity: EntityNode,
};

export const EntityRelationshipDiagram: React.FC = () => {
    const { t } = useTranslation();
    const { isLight, theme } = useTheme();
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [loading, setLoading] = useState(true);
    const relationshipStroke = useMemo(
        () => resolveCssColorVariable('memory-relationship-edge', 'hsl(239 84% 67% / 0.4)'),
        [theme]
    );
    const relationshipGridColor = useMemo(
        () => resolveCssColorVariable('memory-relationship-grid', 'hsl(215 16% 47% / 0.35)'),
        [theme]
    );

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const result = await window.electron.advancedMemory.getAllEntityKnowledge();
            if (result.success && result.data) {
                const rawFacts = result.data;

                // Group facts by entity Name
                const entities: Record<string, { name: string; type: string; properties: Record<string, string> }> = {};

                rawFacts.forEach(fact => {
                    const key = fact.entityName;
                    if (!entities[key]) {
                        entities[key] = {
                            name: fact.entityName,
                            type: fact.entityType,
                            properties: {},
                        };
                    }
                    entities[key].properties[fact.key] = fact.value;
                });

                const entityList = Object.values(entities);
                const radius = Math.max(300, entityList.length * 60);

                const newNodes: Node[] = entityList.map((ent, i) => {
                    const angle = (i / entityList.length) * 2 * Math.PI;
                    return {
                        id: ent.name,
                        type: 'entity',
                        position: {
                            x: radius * Math.cos(angle),
                            y: radius * Math.sin(angle),
                        },
                        data: ent,
                    };
                });

                // Infer edges based on mentions of entity names in values
                const newEdges: Edge[] = [];
                entityList.forEach(sourceEnt => {
                    Object.values(sourceEnt.properties).forEach(val => {
                        entityList.forEach(targetEnt => {
                            if (sourceEnt.name !== targetEnt.name && val.includes(targetEnt.name)) {
                                const edgeId = `e-${sourceEnt.name}-${targetEnt.name}`;
                                if (!newEdges.some(e => e.id === edgeId)) {
                                    newEdges.push({
                                        id: edgeId,
                                        source: sourceEnt.name,
                                        target: targetEnt.name,
                                        animated: true,
                                        style: { stroke: relationshipStroke, strokeWidth: 2 },
                                    });
                                }
                            }
                        });
                    });
                });

                setNodes(newNodes);
                setEdges(newEdges);
            }
        } catch (error) {
            appLogger.error('EntityRelationshipDiagram', 'Failed to load entity data', error as Error);
        } finally {
            setLoading(false);
        }
    }, [relationshipStroke, setEdges, setNodes]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    return (
        <div className="w-full h-full flex flex-col bg-background/50 relative overflow-hidden rounded-2xl border border-border/40">
            {loading && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/50 backdrop-blur-sm">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
                </div>
            )}

            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                fitView
                colorMode={isLight ? 'light' : 'dark'}
            >
                <Background color={relationshipGridColor} gap={20} />
                <Controls />
                <MiniMap />

                <Panel position="top-left" className="m-4">
                    <div className="flex items-center gap-3 bg-background/80 backdrop-blur-xl p-2 rounded-2xl border border-border/50 shadow-xl">
                        <div className="p-2 bg-success/20 rounded-xl text-success">
                            <IconDatabase className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold">{t('frontend.memory.erDiagram')}</h2>
                            <p className="text-sm text-muted-foreground">
                                {t('frontend.memory.entitiesTracked', { count: nodes.length })}
                            </p>
                        </div>
                    </div>
                </Panel>

                <Panel position="top-right" className="m-4">
                    <button
                        onClick={() => void loadData()}
                        className={C_ENTITYRELATIONSHIPDIAGRAM_1}
                    >
                        <IconRotate className="w-4 h-4" />
                    </button>
                </Panel>
            </ReactFlow>
        </div>
    );
};

