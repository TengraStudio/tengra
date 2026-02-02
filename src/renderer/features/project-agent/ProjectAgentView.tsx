import { ProjectState } from '@shared/types/project-agent';
import {
    addEdge,
    Background,
    Connection,
    Edge,
    Node,
    Panel,
    ReactFlow,
    ReactFlowProvider,
    useEdgesState,
    useNodesState,
    useReactFlow
} from '@xyflow/react';
import {
    ChevronRight,
    Maximize,
    MousePointer2,
    Plus,
    RotateCcw,
    Sparkles,
    Zap,
    ZoomIn,
    ZoomOut
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { useTranslation } from '@/i18n';
import { AnimatePresence, motion } from '@/lib/framer-motion-compat';

import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';

import { TaskNode } from './nodes/TaskNode';

import '@xyflow/react/dist/style.css';

/**
 * CommandCenter - A floating dock for centralizing canvas controls
 */
interface CommandCenterProps {
    onAddNode: (type: 'planner' | 'action') => void;
}

const CommandCenter: React.FC<CommandCenterProps> = ({ onAddNode }) => {
    const { zoomIn, zoomOut, fitView, setViewport } = useReactFlow();
    const { t } = useTranslation();

    const resetZoom = () => {
        void setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 800 });
    };

    return (
        <Panel position="bottom-center" className="mb-6">
            <div className="flex items-center gap-1 p-1.5 bg-background/60 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-bottom duration-500">
                <button
                    onClick={() => { void zoomIn(); }}
                    className="p-2 hover:bg-white/10 rounded-xl transition-all hover:scale-110 active:scale-95 text-muted-foreground hover:text-foreground"
                    title={t('common.zoomIn') || 'Zoom In'}
                >
                    <ZoomIn className="w-4 h-4" />
                </button>
                <button
                    onClick={() => { void zoomOut(); }}
                    className="p-2 hover:bg-white/10 rounded-xl transition-all hover:scale-110 active:scale-95 text-muted-foreground hover:text-foreground"
                    title={t('common.zoomOut') || 'Zoom Out'}
                >
                    <ZoomOut className="w-4 h-4" />
                </button>
                <div className="w-px h-4 bg-white/10 mx-1" />
                <button
                    onClick={() => { void fitView({ duration: 800 }); }}
                    className="p-2 hover:bg-white/10 rounded-xl transition-all hover:scale-110 active:scale-95 text-muted-foreground hover:text-foreground"
                    title={t('common.fitView') || 'Fit View'}
                >
                    <Maximize className="w-4 h-4" />
                </button>
                <button
                    onClick={resetZoom}
                    className="p-2 hover:bg-white/10 rounded-xl transition-all hover:scale-110 active:scale-95 text-muted-foreground hover:text-foreground"
                    title={t('common.resetZoom') || 'Reset Zoom (1:1)'}
                >
                    <RotateCcw className="w-4 h-4" />
                </button>
                <div className="w-px h-4 bg-white/10 mx-1" />

                <Popover>
                    <PopoverTrigger asChild>
                        <button
                            className="p-2 hover:bg-white/10 rounded-xl transition-all hover:scale-110 active:scale-95 text-muted-foreground hover:text-primary"
                            title={t('tasks.createNew') || 'New Task'}
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </PopoverTrigger>
                    <PopoverContent side="top" className="w-48 p-1 bg-background/90 backdrop-blur-xl border-white/10">
                        <button
                            onClick={() => onAddNode('planner')}
                            className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-white/10 rounded-lg text-sm transition-colors text-left"
                        >
                            <Sparkles className="w-4 h-4 text-purple-400" />
                            <span>{t('agents.newTask')}</span>
                        </button>
                        <button
                            onClick={() => onAddNode('action')}
                            className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-white/10 rounded-lg text-sm transition-colors text-left"
                        >
                            <Zap className="w-4 h-4 text-yellow-400" />
                            <span>{t('agents.addAction')}</span>
                        </button>
                    </PopoverContent>
                </Popover>
            </div>
        </Panel>
    );
};

interface ContextMenuProps {
    x: number;
    y: number;
    onClose: () => void;
    onAddNode: (type: 'planner' | 'action') => void;
}

/**
 * ContextMenu - Elegant context-sensitive menu for the canvas
 */
const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose, onAddNode }) => {
    const { t } = useTranslation();
    const [showSubMenu, setShowSubMenu] = useState(false);

    const handleAddNode = (type: 'planner' | 'action') => {
        onAddNode(type);
        onClose();
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed z-[100] w-56 bg-background/80 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-2"
            style={{ left: x, top: y }}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="flex flex-col gap-1">
                <div
                    className="relative group/item"
                    onMouseEnter={() => setShowSubMenu(true)}
                    onMouseLeave={() => setShowSubMenu(false)}
                >
                    <button
                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/10 rounded-xl transition-all text-sm text-left"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-primary/10 rounded-lg group-hover/item:bg-primary/20 transition-colors">
                                <Plus className="w-3.5 h-3.5 text-primary" />
                            </div>
                            <span className="font-medium">{t('tasks.createNew') || 'New Task'}</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </button>

                    {/* Submenu */}
                    <AnimatePresence>
                        {showSubMenu && (
                            <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                className="absolute left-full top-0 ml-2 w-48 bg-background/90 backdrop-blur-xl border border-white/10 rounded-xl p-1 shadow-xl"
                            >
                                <button
                                    onClick={() => handleAddNode('planner')}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-white/10 rounded-lg text-sm transition-colors text-left"
                                >
                                    <Sparkles className="w-4 h-4 text-purple-400" />
                                    <span>{t('agents.newTask')}</span>
                                </button>
                                <button
                                    onClick={() => handleAddNode('action')}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-white/10 rounded-lg text-sm transition-colors text-left"
                                >
                                    <Zap className="w-4 h-4 text-yellow-400" />
                                    <span>{t('agents.addAction')}</span>
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div className="h-px bg-white/10 my-1" />

                <button
                    onClick={onClose}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-white/10 rounded-xl transition-all text-sm text-left group opacity-50 cursor-not-allowed"
                >
                    <div className="p-1.5 bg-muted rounded-lg">
                        <MousePointer2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <span className="font-medium text-muted-foreground">{t('canvas.selectArea') || 'Select Area'}</span>
                </button>
            </div>
        </motion.div>
    );
};

const useProjectAgentState = (setNodes: React.Dispatch<React.SetStateAction<Node[]>>) => {
    useEffect(() => {
        // Fetch initial state on mount
        const fetchInitialState = async () => {
            try {
                const projectState = await window.electron.projectAgent.getStatus();
                if (projectState.nodeId || projectState.status !== 'idle') {
                    setNodes((nds) => {
                        const targetNodeId = projectState.nodeId;

                        // Check if node already exists
                        const existingNode = nds.find(n => n.id === targetNodeId);
                        if (existingNode) {
                            return nds.map(node => {
                                if (node.id === targetNodeId) {
                                    return {
                                        ...node,
                                        data: {
                                            ...node.data,
                                            status: projectState.status,
                                            plan: projectState.plan,
                                            history: projectState.history,
                                            currentTask: projectState.currentTask
                                        }
                                    };
                                }
                                return node;
                            });
                        }

                        // If node doesn't exist but we have state, we might need to create it
                        if (!targetNodeId) {
                            return nds.map(node => {
                                if (node.data.taskType === 'planner') {
                                    return {
                                        ...node,
                                        data: {
                                            ...node.data,
                                            status: projectState.status,
                                            plan: projectState.plan,
                                            history: projectState.history,
                                            currentTask: projectState.currentTask
                                        }
                                    };
                                }
                                return node;
                            });
                        }
                        return nds;
                    });
                }
            } catch (error) {
                console.error('[ProjectAgentView] Failed to fetch initial state:', error);
            }
        };

        void fetchInitialState();

        const unsubscribe = window.electron.projectAgent.onUpdate((projectState: ProjectState) => {
            setNodes((nds) => {
                const targetNodeId = projectState.nodeId;
                if (!targetNodeId) {
                    return nds.map((node) => {
                        if (node.data.taskType === 'planner') {
                            return {
                                ...node,
                                data: {
                                    ...node.data,
                                    status: projectState.status,
                                    plan: projectState.plan,
                                    history: projectState.history,
                                    currentTask: projectState.currentTask
                                }
                            };
                        }
                        return node;
                    });
                }

                return nds.map((node) => {
                    if (node.id === targetNodeId) {
                        return {
                            ...node,
                            data: {
                                ...node.data,
                                status: projectState.status,
                                plan: projectState.plan,
                                history: projectState.history,
                                currentTask: projectState.currentTask
                            }
                        };
                    }
                    return node;
                });
            });
        });

        return () => {
            unsubscribe();
        };
    }, [setNodes]);
};

const InternalProjectAgentView: React.FC = () => {
    const nodeTypes = React.useMemo(() => ({ task: TaskNode }), []);
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [menu, setMenu] = useState<{ x: number, y: number } | null>(null);
    const { screenToFlowPosition } = useReactFlow();

    useProjectAgentState(setNodes);

    const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge(params, eds)), [setEdges]);
    const onAddNode = useCallback((type: 'planner' | 'action', position?: { x: number, y: number }) => {
        const id = `node-${Date.now()}`;
        const newNode: Node = {
            id,
            position: position ?? { x: Math.random() * 400, y: Math.random() * 400 },
            data: {
                label: type === 'planner' ? 'New Plan' : 'New Action',
                taskType: type,
                status: 'idle'
            },
            type: 'task',
        };
        setNodes((nds) => nds.concat(newNode));
    }, [setNodes]);

    const onPaneContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
        event.preventDefault();
        const nativeEvent = 'nativeEvent' in event ? event.nativeEvent : event;
        setMenu({ x: nativeEvent.clientX, y: nativeEvent.clientY });
    }, []);

    const onPaneClick = useCallback(() => {
        setMenu(null);
    }, []);

    const handleContextAddNode = useCallback((type: 'planner' | 'action') => {
        if (menu) {
            // Convert screen coordinates to flow coordinates
            const flowPos = screenToFlowPosition({ x: menu.x, y: menu.y });
            onAddNode(type, flowPos);
            setMenu(null);
        }
    }, [menu, onAddNode, screenToFlowPosition]);

    return (
        <div className="h-full w-full relative overflow-hidden bg-background" onClick={onPaneClick}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onPaneContextMenu={onPaneContextMenu}
                className="bg-tech-grid"
                colorMode="dark"
                fitView
                proOptions={{ hideAttribution: true }}
            >
                <Background
                    id="1"
                    gap={40}
                    size={1}
                    color="hsl(var(--primary) / 0.2)"
                />
                <CommandCenter onAddNode={onAddNode} />
            </ReactFlow>

            <AnimatePresence>
                {menu && (
                    <ContextMenu
                        x={menu.x}
                        y={menu.y}
                        onClose={() => setMenu(null)}
                        onAddNode={handleContextAddNode}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

/**
 * ProjectAgentView - The Quantum Canvas for Tandem Autonomous Core (UAC)
 * 
 * Provides an infinite canvas with a grid system for visualizing autonomous nodes.
 */
export const ProjectAgentView: React.FC = () => {
    return (
        <ReactFlowProvider>
            <InternalProjectAgentView />
        </ReactFlowProvider>
    );
};
