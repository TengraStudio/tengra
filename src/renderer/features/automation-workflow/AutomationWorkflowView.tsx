import { useSessionCapabilities } from '@renderer/hooks/useSessionCapabilities';
import { useSessionRecoverySnapshots } from '@renderer/hooks/useSessionRecoverySnapshots';
import { useSessionStates } from '@renderer/hooks/useSessionStates';
import { IpcValue, SessionCanvasEdgeRecord, SessionCanvasNodeRecord } from '@shared/types';
import { WorkspaceState } from '@shared/types/automation-workflow';
import {
    addEdge,
    Background,
    Connection,
    Edge,
    MiniMap,
    Node,
    Panel,
    ReactFlow,
    ReactFlowProvider,
    useEdgesState,
    useNodesState,
    useReactFlow,
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
    ZoomOut,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { useTranslation } from '@/i18n';
import { AnimatePresence, motion } from '@/lib/framer-motion-compat';
import { appLogger } from '@/utils/renderer-logger';

import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';

import { AnimatedEdge } from './components/AnimatedEdge';
import { PlanNode } from './nodes/PlanNode';
import { TaskNode } from './nodes/TaskNode';
import {
    pickPrimaryAutomationSnapshot,
    pickPrimaryAutomationState,
    toWorkspaceStateFromSession,
    toWorkspaceStateFromSnapshot,
} from './utils/automation-session-state';
import { AgentStateMachinePanel } from './AgentStateMachinePanel';
import { AgentVotingPanel } from './AgentVotingPanel';

import '@xyflow/react/dist/style.css';

const PLAN_NODE_X_OFFSET_PX = 80;
const PLAN_NODE_Y_OFFSET_PX = 420;
const PLAN_NODE_LANE_SPACING_PX = 260;
const PLAN_NODE_X_STEP_DRIFT_PX = 18;
const PLAN_NODE_Y_STEP_SPACING_PX = 170;
const MAX_STATE_HISTORY_ENTRIES = 30;

const getPlanNodeId = (taskNodeId: string, stepId: string) => `plan-node-${taskNodeId}-${stepId}`;
const getPlanEdgeId = (source: string, target: string) => `plan-edge-${source}-${target}`;

const isAutoPlanNodeForTask = (node: Node, taskNodeId: string): boolean =>
    (node.data as Record<string, unknown>)?.autoPlanNode === true &&
    (node.data as Record<string, unknown>)?.planParentId === taskNodeId;

const isAutoPlanEdgeForTask = (edge: Edge, taskNodeId: string): boolean =>
    (edge.data as Record<string, unknown>)?.autoPlanEdge === true &&
    (edge.data as Record<string, unknown>)?.planParentId === taskNodeId;

const findFirstPlannerNodeId = (nodes: Node[]): string | null => {
    const plannerNode = nodes.find(node => {
        return (node.data as Record<string, unknown>).taskType === 'planner';
    });

    return plannerNode?.id ?? null;
};

const resolveTaskNodeId = (
    nodes: Node[],
    workspaceState: WorkspaceState
): string | null => {
    if (workspaceState.nodeId) {
        const byNodeId = nodes.find(node => node.id === workspaceState.nodeId);
        if (byNodeId) {
            return byNodeId.id;
        }
    }

    if (workspaceState.taskId) {
        const byTaskId = nodes.find(node => {
            return (node.data as Record<string, unknown>).taskId === workspaceState.taskId;
        });
        if (byTaskId) {
            return byTaskId.id;
        }
    }

    return findFirstPlannerNodeId(nodes);
};

const buildNodeDataFromWorkspaceState = (
    node: Node,
    workspaceState: WorkspaceState
): Record<string, unknown> => {
    return {
        ...node.data,
        status: workspaceState.status,
        plan: workspaceState.plan,
        history: workspaceState.history,
        currentTask: workspaceState.currentTask,
        taskId: workspaceState.taskId,
        totalTokens: workspaceState.totalTokens,
        timing: workspaceState.timing,
        model:
            (node.data as Record<string, unknown>).model
            ?? workspaceState.config?.model,
        systemMode:
            (node.data as Record<string, unknown>).systemMode
            ?? workspaceState.config?.systemMode,
        agentProfileId:
            (node.data as Record<string, unknown>).agentProfileId
            ?? workspaceState.config?.agentProfileId,
        isExpanded: true,
    };
};

const createRestoredTaskNode = (workspaceState: WorkspaceState): Node | null => {
    if (!workspaceState.nodeId) {
        return null;
    }

    return {
        id: workspaceState.nodeId,
        type: 'task',
        position: { x: 100, y: 100 },
        data: {
            label: 'Restored Task',
            taskType: 'planner',
            status: workspaceState.status,
            title: workspaceState.currentTask,
            plan: workspaceState.plan,
            history: workspaceState.history,
            totalTokens: workspaceState.totalTokens,
            timing: workspaceState.timing,
            taskId: workspaceState.taskId,
            isExpanded: workspaceState.status === 'waiting_for_approval',
            activeTab: 'plan',
            model: workspaceState.config?.model,
            systemMode: workspaceState.config?.systemMode,
            agentProfileId: workspaceState.config?.agentProfileId,
        },
    };
};

/**
 * CommandCenter - A floating dock for centralizing canvas controls
 */
interface CommandCenterProps {
    onAddNode: (type: 'planner' | 'action' | 'fork' | 'join' | 'create-pr') => void;
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
                    onClick={() => {
                        void zoomIn();
                    }}
                    className="p-2 hover:bg-white/10 rounded-xl transition-all hover:scale-110 active:scale-95 text-muted-foreground hover:text-foreground"
                    title={t('common.zoomIn') || 'Zoom In'}
                >
                    <ZoomIn className="w-4 h-4" />
                </button>
                <button
                    onClick={() => {
                        void zoomOut();
                    }}
                    className="p-2 hover:bg-white/10 rounded-xl transition-all hover:scale-110 active:scale-95 text-muted-foreground hover:text-foreground"
                    title={t('common.zoomOut') || 'Zoom Out'}
                >
                    <ZoomOut className="w-4 h-4" />
                </button>
                <div className="w-px h-4 bg-white/10 mx-1" />
                <button
                    onClick={() => {
                        void fitView({ duration: 800 });
                    }}
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
                    <PopoverContent
                        side="top"
                        className="w-48 p-1 bg-background/90 backdrop-blur-xl border-white/10"
                    >
                        <button
                            onClick={() => onAddNode('planner')}
                            className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-white/10 rounded-lg text-sm transition-colors text-left"
                        >
                            <Sparkles className="w-4 h-4 text-accent" />
                            <span>{t('agents.newTask')}</span>
                        </button>
                        <button
                            onClick={() => onAddNode('action')}
                            className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-white/10 rounded-lg text-sm transition-colors text-left"
                        >
                            <Zap className="w-4 h-4 text-warning" />
                            <span>{t('agents.addAction')}</span>
                        </button>
                        <button
                            onClick={() => onAddNode('fork')}
                            className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-white/10 rounded-lg text-sm transition-colors text-left"
                        >
                            <Zap className="w-4 h-4 text-info" />
                            <span>Fork Node</span>
                        </button>
                        <button
                            onClick={() => onAddNode('join')}
                            className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-white/10 rounded-lg text-sm transition-colors text-left"
                        >
                            <Zap className="w-4 h-4 text-warning" />
                            <span>Join Node</span>
                        </button>
                        <button
                            onClick={() => onAddNode('create-pr')}
                            className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-white/10 rounded-lg text-sm transition-colors text-left"
                        >
                            <Zap className="w-4 h-4 text-success" />
                            <span>Create PR</span>
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
    onAddNode: (type: 'planner' | 'action' | 'fork' | 'join' | 'create-pr') => void;
}

/**
 * ContextMenu - Elegant context-sensitive menu for the canvas
 */
const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose, onAddNode }) => {
    const { t } = useTranslation();
    const [showSubMenu, setShowSubMenu] = useState(false);

    const handleAddNode = (type: 'planner' | 'action' | 'fork' | 'join' | 'create-pr') => {
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
            onClick={e => e.stopPropagation()}
        >
            <div className="flex flex-col gap-1">
                <div
                    className="relative group/item"
                    onMouseEnter={() => setShowSubMenu(true)}
                    onMouseLeave={() => setShowSubMenu(false)}
                >
                    <button className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/10 rounded-xl transition-all text-sm text-left">
                        <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-primary/10 rounded-lg group-hover/item:bg-primary/20 transition-colors">
                                <Plus className="w-3.5 h-3.5 text-primary" />
                            </div>
                            <span className="font-medium">
                                {t('tasks.createNew') || 'New Task'}
                            </span>
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
                                    <Sparkles className="w-4 h-4 text-accent" />
                                    <span>{t('agents.newTask')}</span>
                                </button>
                                <button
                                    onClick={() => handleAddNode('action')}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-white/10 rounded-lg text-sm transition-colors text-left"
                                >
                                    <Zap className="w-4 h-4 text-warning-400" />
                                    <span>{t('agents.addAction')}</span>
                                </button>
                                <button
                                    onClick={() => handleAddNode('fork')}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-white/10 rounded-lg text-sm transition-colors text-left"
                                >
                                    <Zap className="w-4 h-4 text-info" />
                                    <span>Fork Node</span>
                                </button>
                                <button
                                    onClick={() => handleAddNode('join')}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-white/10 rounded-lg text-sm transition-colors text-left"
                                >
                                    <Zap className="w-4 h-4 text-warning" />
                                    <span>Join Node</span>
                                </button>
                                <button
                                    onClick={() => handleAddNode('create-pr')}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-white/10 rounded-lg text-sm transition-colors text-left"
                                >
                                    <Zap className="w-4 h-4 text-success" />
                                    <span>Create PR</span>
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
                    <span className="font-medium text-muted-foreground">
                        {t('canvas.selectArea') || 'Select Area'}
                    </span>
                </button>
            </div>
        </motion.div>
    );
};

const InternalAutomationWorkflowView: React.FC = () => {
    const { appSettings } = useAuth();
    const theme = appSettings?.general.theme ?? 'black';
    const isDark = theme !== 'white';

    const nodeTypes = React.useMemo(() => ({ task: TaskNode, plan: PlanNode }), []);
    const edgeTypes = React.useMemo(() => ({ animated: AnimatedEdge }), []);
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const sessionRecoverySnapshots = useSessionRecoverySnapshots();
    const automationSessionSnapshots = React.useMemo(() => {
        return sessionRecoverySnapshots.filter(snapshot => snapshot.mode === 'automation');
    }, [sessionRecoverySnapshots]);
    const automationSessionIds = React.useMemo(() => {
        return automationSessionSnapshots.map(snapshot => snapshot.sessionId);
    }, [automationSessionSnapshots]);
    const automationSessionStates = useSessionStates(automationSessionIds);
    const automationWorkspaceStates = React.useMemo(() => {
        const sessionStateMap = new Map<string, WorkspaceState>();
        for (const sessionState of automationSessionStates) {
            const workspaceState = toWorkspaceStateFromSession(sessionState);
            if (workspaceState) {
                sessionStateMap.set(sessionState.id, workspaceState);
            }
        }

        return automationSessionSnapshots
            .map(snapshot => {
                return sessionStateMap.get(snapshot.sessionId)
                    ?? toWorkspaceStateFromSnapshot(snapshot);
            })
            .filter((state): state is WorkspaceState => state !== null);
    }, [automationSessionSnapshots, automationSessionStates]);
    const primaryAutomationSnapshot = React.useMemo(() => {
        return pickPrimaryAutomationSnapshot(automationSessionSnapshots);
    }, [automationSessionSnapshots]);
    const latestWorkspaceState = React.useMemo(() => {
        return pickPrimaryAutomationState(automationWorkspaceStates);
    }, [automationWorkspaceStates]);
    const primaryAutomationSession = React.useMemo(() => {
        const primarySessionId = primaryAutomationSnapshot?.sessionId ?? latestWorkspaceState?.taskId;
        if (!primarySessionId) {
            return null;
        }

        return (
            automationSessionStates.find(sessionState => {
                return (
                    sessionState.id === primarySessionId
                    || sessionState.metadata.taskId === primarySessionId
                );
            }) ?? null
        );
    }, [automationSessionStates, latestWorkspaceState?.taskId, primaryAutomationSnapshot?.sessionId]);
    const sessionCapabilities = useSessionCapabilities();
    const supportsAutomationCouncil = sessionCapabilities.some(capability => {
        return capability.id === 'council' && capability.compatibleModes.includes('automation');
    });
    const shouldShowVotingPanel = Boolean(latestWorkspaceState?.taskId) && (
        primaryAutomationSession?.capabilities.includes('council') ?? supportsAutomationCouncil
    );
    const [stateHistory, setStateHistory] = useState<
        Array<{ status: WorkspaceState['status']; timestamp: number }>
    >([]);
    const { screenToFlowPosition, getNodes } = useReactFlow();
    const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
    const pushStateHistory = useCallback((status: WorkspaceState['status']) => {
        setStateHistory(previous => {
            const last = previous[previous.length - 1];
            if (last?.status === status) {
                return previous;
            }
            return [...previous, { status, timestamp: Date.now() }].slice(
                -MAX_STATE_HISTORY_ENTRIES
            );
        });
    }, []);
    const syncPlanNodesForTask = useCallback(
        (taskNodeId: string, plan?: WorkspaceState['plan']) => {
            const taskNode = getNodes().find((n: Node) => n.id === taskNodeId);
            if (!taskNode) {
                appLogger.warn(
                    'WorkspaceAgentView',
                    `Cannot sync plan nodes: task node ${taskNodeId} not found`
                );
                return;
            }

            const steps = plan ?? [];

            setNodes(prevNodes => {
                const existingPlanNodes = prevNodes.filter(node =>
                    isAutoPlanNodeForTask(node, taskNodeId)
                );
                const existingById = new Map(existingPlanNodes.map(node => [node.id, node]));
                const withoutTaskPlanNodes = prevNodes.filter(
                    node => !isAutoPlanNodeForTask(node, taskNodeId)
                );

                if (steps.length === 0) {
                    return withoutTaskPlanNodes;
                }

                const generatedPlanNodes: Node[] = steps.map((step, index) => {
                    const nodeId = getPlanNodeId(taskNodeId, step.id);
                    const existing = existingById.get(nodeId);
                    const lane = step.parallelLane ?? 0;

                    return {
                        id: nodeId,
                        type: 'plan',
                        position: existing?.position ?? {
                            x:
                                taskNode.position.x +
                                PLAN_NODE_X_OFFSET_PX +
                                lane * PLAN_NODE_LANE_SPACING_PX +
                                index * PLAN_NODE_X_STEP_DRIFT_PX,
                            y:
                                taskNode.position.y +
                                PLAN_NODE_Y_OFFSET_PX +
                                index * PLAN_NODE_Y_STEP_SPACING_PX,
                        },
                        data: {
                            ...((existing?.data as Record<string, unknown>) ?? {}),
                            label: `Plan ${index + 1}`,
                            description: step.text,
                            status: step.status,
                            stepIndex: index + 1,
                            stepId: step.id,
                            stepType: step.type ?? 'task',
                            lane,
                            dependsOn: step.dependsOn ?? [],
                            planParentId: taskNodeId,
                            autoPlanNode: true,
                        },
                    };
                });

                return [...withoutTaskPlanNodes, ...generatedPlanNodes];
            });

            setEdges(prevEdges => {
                const withoutTaskPlanEdges = prevEdges.filter(
                    edge => !isAutoPlanEdgeForTask(edge, taskNodeId)
                );
                if (steps.length === 0) {
                    return withoutTaskPlanEdges;
                }

                const generatedEdges: Edge[] = [];
                const stepIdSet = new Set(steps.map(step => step.id));

                for (const step of steps) {
                    const target = getPlanNodeId(taskNodeId, step.id);
                    const dependencies = (step.dependsOn ?? []).filter(depId => stepIdSet.has(depId));
                    if (dependencies.length === 0) {
                        generatedEdges.push({
                            id: getPlanEdgeId(taskNodeId, target),
                            source: taskNodeId,
                            target,
                            type: 'animated',
                            animated: true,
                            data: {
                                isActive: true,
                                autoPlanEdge: true,
                                planParentId: taskNodeId,
                                dependencyType: 'root',
                            },
                        });
                        continue;
                    }
                    for (const dependencyId of dependencies) {
                        const source = getPlanNodeId(taskNodeId, dependencyId);
                        generatedEdges.push({
                            id: getPlanEdgeId(source, target),
                            source,
                            target,
                            type: 'animated',
                            animated: true,
                            data: {
                                isActive: true,
                                autoPlanEdge: true,
                                planParentId: taskNodeId,
                                dependencyType: 'step',
                            },
                        });
                    }
                }

                return [...withoutTaskPlanEdges, ...generatedEdges];
            });
        },
        [getNodes, setEdges, setNodes]
    );

    // Load saved nodes and edges on mount
    useEffect(() => {
        const loadCanvas = async () => {
            try {
                const [savedNodes, savedEdges] = await Promise.all([
                    window.electron.session.workspace.getCanvasNodes(),
                    window.electron.session.workspace.getCanvasEdges(),
                ]);

                let nodesToSet: Node[] = [];

                if (savedNodes.length > 0) {
                    nodesToSet = savedNodes.map((n: SessionCanvasNodeRecord) => ({
                        id: n.id,
                        type: n.type,
                        position: n.position,
                        data: n.data,
                    }));
                }

                if (nodesToSet.length > 0) {
                    setNodes(nodesToSet);
                }

                if (savedEdges.length > 0) {
                    setEdges(
                        savedEdges.map((e: SessionCanvasEdgeRecord) => ({
                            id: e.id,
                            source: e.source,
                            target: e.target,
                            sourceHandle: e.sourceHandle,
                            targetHandle: e.targetHandle,
                        }))
                    );
                }

                appLogger.info(
                    'WorkspaceAgentView',
                    `Loaded ${nodesToSet.length} nodes and ${savedEdges.length} edges from database`
                );
            } catch (error) {
                appLogger.error('WorkspaceAgentView', 'Failed to load canvas state', error as Error);
            } finally {
                setIsLoaded(true);
            }
        };

        void loadCanvas();
    }, [setNodes, setEdges]);

    useEffect(() => {
        if (!latestWorkspaceState) {
            return;
        }

        pushStateHistory(latestWorkspaceState.status);
    }, [latestWorkspaceState, pushStateHistory]);

    useEffect(() => {
        if (!isLoaded || automationWorkspaceStates.length === 0) {
            return;
        }

        const currentNodes = getNodes();
        const createdNodes: Node[] = [];
        const targetMappings: Array<{ nodeId: string; workspaceState: WorkspaceState }> = [];

        for (const workspaceState of automationWorkspaceStates) {
            const visibleNodes = [...currentNodes, ...createdNodes];
            const missingExplicitNode =
                typeof workspaceState.nodeId === 'string'
                && !visibleNodes.some(node => node.id === workspaceState.nodeId);

            if (missingExplicitNode) {
                const restoredNode = createRestoredTaskNode(workspaceState);
                if (restoredNode) {
                    createdNodes.push(restoredNode);
                    targetMappings.push({
                        nodeId: restoredNode.id,
                        workspaceState,
                    });
                }
                continue;
            }

            const resolvedNodeId = resolveTaskNodeId(visibleNodes, workspaceState);
            if (!resolvedNodeId) {
                continue;
            }

            targetMappings.push({
                nodeId: resolvedNodeId,
                workspaceState,
            });
        }

        if (createdNodes.length === 0 && targetMappings.length === 0) {
            return;
        }

        setNodes(previousNodes => {
            const existingNodeIds = new Set(previousNodes.map(node => node.id));
            const nextNodes = [
                ...previousNodes,
                ...createdNodes.filter(node => !existingNodeIds.has(node.id)),
            ];
            const targetNodeMap = new Map(targetMappings.map(item => [item.nodeId, item.workspaceState]));

            return nextNodes.map(node => {
                const workspaceState = targetNodeMap.get(node.id);
                if (!workspaceState) {
                    return node;
                }

                return {
                    ...node,
                    data: buildNodeDataFromWorkspaceState(node, workspaceState),
                };
            });
        });

        if (createdNodes.length > 0) {
            void window.electron.session.workspace.saveCanvasNodes(
                createdNodes.map(node => ({
                    id: node.id,
                    type: node.type ?? 'task',
                    position: node.position,
                    data: node.data as Record<string, IpcValue>,
                }))
            );
        }

        window.requestAnimationFrame(() => {
            for (const { nodeId, workspaceState } of targetMappings) {
                syncPlanNodesForTask(nodeId, workspaceState.plan);
            }
        });
    }, [automationWorkspaceStates, getNodes, isLoaded, setNodes, syncPlanNodesForTask]);

    // Save nodes and edges when they change (debounced)
    useEffect(() => {
        if (!isLoaded) {
            return;
        }

        // Debounce save to avoid excessive DB writes
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(() => {
            const saveCanvas = async () => {
                try {
                    // Save nodes with their current data
                    const nodesToSave = nodes.map(n => ({
                        id: n.id,
                        type: n.type ?? 'task',
                        position: n.position,
                        data: n.data as Record<string, unknown>,
                    }));
                    await window.electron.session.workspace.saveCanvasNodes(
                        nodesToSave.map(node => ({
                            ...node,
                            data: node.data as Record<string, IpcValue>,
                        }))
                    );

                    // Save edges
                    const edgesToSave = edges.map(e => ({
                        id: e.id,
                        source: e.source,
                        target: e.target,
                        sourceHandle: e.sourceHandle ?? undefined,
                        targetHandle: e.targetHandle ?? undefined,
                    }));
                    await window.electron.session.workspace.saveCanvasEdges(edgesToSave);

                    appLogger.debug(
                        'WorkspaceAgentView',
                        `Saved ${nodes.length} nodes and ${edges.length} edges`
                    );
                } catch (error) {
                    appLogger.error(
                        'WorkspaceAgentView',
                        'Failed to save canvas state',
                        error as Error
                    );
                }
            };

            void saveCanvas();
        }, 500);

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [nodes, edges, isLoaded]);

    const onConnect = useCallback(
        (params: Connection) =>
            setEdges(eds =>
                addEdge(
                    { ...params, type: 'animated', animated: true, data: { isActive: true } },
                    eds
                )
            ),
        [setEdges]
    );
    const onAddNode = useCallback(
        (type: 'planner' | 'action' | 'fork' | 'join' | 'create-pr', position?: { x: number; y: number }) => {
            const id = `node-${Date.now()}`;
            const label =
                type === 'planner'
                    ? 'New Plan'
                    : type === 'action'
                        ? 'New Action'
                        : type === 'fork'
                            ? 'Fork'
                            : type === 'join'
                                ? 'Join'
                                : 'Create PR';
            const newNode: Node = {
                id,
                position: position ?? { x: Math.random() * 400, y: Math.random() * 400 },
                data: {
                    label,
                    taskType: type,
                    status: 'idle',
                    description:
                        type === 'fork'
                            ? 'Split execution into parallel branches'
                            : type === 'join'
                                ? 'Wait for all parallel branches before continuing'
                                : type === 'create-pr'
                                    ? 'Generate and open GitHub pull request URL for the active task'
                                    : undefined,
                },
                type: 'task',
            };
            setNodes(nds => nds.concat(newNode));
        },
        [setNodes]
    );

    const onPaneContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
        event.preventDefault();
        const nativeEvent = 'nativeEvent' in event ? event.nativeEvent : event;
        setMenu({ x: nativeEvent.clientX, y: nativeEvent.clientY });
    }, []);

    const onPaneClick = useCallback(() => {
        setMenu(null);
    }, []);

    const handleContextAddNode = useCallback(
        (type: 'planner' | 'action' | 'fork' | 'join' | 'create-pr') => {
            if (menu) {
                // Convert screen coordinates to flow coordinates
                const flowPos = screenToFlowPosition({ x: menu.x, y: menu.y });
                onAddNode(type, flowPos);
                setMenu(null);
            }
        },
        [menu, onAddNode, screenToFlowPosition]
    );

    return (
        <div className="h-full w-full relative overflow-hidden bg-background" onClick={onPaneClick}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onPaneContextMenu={onPaneContextMenu}
                className="bg-tech-grid"
                colorMode={isDark ? 'dark' : 'light'}
                fitView
                proOptions={{ hideAttribution: true }}
            >
                <Background id="1" gap={40} size={1} color="hsl(var(--border) / 0.2)" />
                <MiniMap
                    nodeStrokeColor={n => {
                        if (n.type === 'task') {
                            return 'hsl(var(--primary))';
                        }
                        return 'hsl(var(--muted-foreground))';
                    }}
                    nodeColor={n => {
                        if (n.type === 'task') {
                            return 'hsl(var(--card))';
                        }
                        return 'hsl(var(--background))';
                    }}
                    maskColor="hsl(var(--background) / 0.8)"
                    className="!bg-background/50 !border-border/50 rounded-lg overflow-hidden"
                />
                <CommandCenter onAddNode={onAddNode} />
            </ReactFlow>

            <div
                className="absolute right-4 top-4 z-20 w-[360px] max-h-[calc(100%-2rem)] space-y-3 overflow-y-auto"
                onClick={event => event.stopPropagation()}
            >
                <AgentStateMachinePanel
                    currentStatus={latestWorkspaceState?.status ?? 'idle'}
                    stateHistory={stateHistory}
                />
                {shouldShowVotingPanel ? <AgentVotingPanel taskId={latestWorkspaceState?.taskId} /> : null}
            </div>

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
 * WorkspaceAgentView - The Quantum Canvas for Tengra Autonomous Core (UAC)
 *
 * Provides an infinite canvas with a grid system for visualizing autonomous nodes.
 */
export const AutomationWorkflowView: React.FC = () => {
    return (
        <ReactFlowProvider>
            <InternalAutomationWorkflowView />
        </ReactFlowProvider>
    );
};


