import { useEffect, useRef } from 'react';

import { ActivityLog } from '../components/agent/ActivityStream';
import { ExecutionPlan } from '../components/agent/ExecutionPlanView';
import { ToolExecution } from '../components/agent/ToolTracking';

import {
    normalizeAgentEventPayload,
    type NormalizedAgentEvent,
} from './converters/agentEventNormalizer';
import { AgentTaskStatus } from './useAgentTask';

/**
 * Generate a unique ID for logs and activities
 * Uses crypto.randomUUID() for secure random ID generation
 */
const generateUniqueId = (): string => {
    return `${Date.now()}_${crypto.randomUUID().substring(0, 8)}`;
};

interface UseAgentEventsProps {
    selectedTaskId: string | null;
    setStatus: React.Dispatch<React.SetStateAction<AgentTaskStatus>>;
    setActivityLogs: React.Dispatch<React.SetStateAction<ActivityLog[]>>;
    setToolExecutions: React.Dispatch<React.SetStateAction<ToolExecution[]>>;
    setCurrentPlan: React.Dispatch<React.SetStateAction<ExecutionPlan | null>>;
    loadTaskHistory: () => Promise<void>;
    currentPlanStepsCount: number;
    setIsLoading?: React.Dispatch<React.SetStateAction<boolean>>;
}

interface EventData {
    taskId: string;
    description?: string;
    error?: string;
    state?: string;
    toolCallId?: string;
    toolName?: string;
    duration?: number;
    tokensUsed?: number;
    metrics?: AgentTaskStatus['metrics'];
    plan?: {
        steps: Array<{
            id?: string;
            index?: number;
            description: string;
            thoughts?: string;
        }>;
        requiredTools?: string[];
        dependencies?: string[];
    };
    stepIndex?: number;
    provider?: string;
    fromProvider?: string;
    toProvider?: string;
    reason?: string;
    message?: string;
    content?: string;
    thoughts?: string;
    currentProvider?: string;
    currentModel?: string;
    errorType?: string;
}

const toEventData = (event: NormalizedAgentEvent): EventData => event.data as EventData;

interface EventControllers {
    setStatus: React.Dispatch<React.SetStateAction<AgentTaskStatus>>;
    setActivityLogs: React.Dispatch<React.SetStateAction<ActivityLog[]>>;
    setToolExecutions: React.Dispatch<React.SetStateAction<ToolExecution[]>>;
    setCurrentPlan: React.Dispatch<React.SetStateAction<ExecutionPlan | null>>;
    loadTaskHistory: () => Promise<void>;
    currentPlanStepsCount: number;
    selectedTaskId: string | null;
    setIsLoading?: React.Dispatch<React.SetStateAction<boolean>>;
}

const clearLoadingState = (setIsLoading?: React.Dispatch<React.SetStateAction<boolean>>) => {
    if (setIsLoading) { setIsLoading(false); }
};

const addActivityLog = (
    setActivityLogs: React.Dispatch<React.SetStateAction<ActivityLog[]>>,
    type: ActivityLog['type'],
    message: string
) => {
    setActivityLogs(prev => [...prev, { id: generateUniqueId(), type, message, timestamp: new Date() }]);
};

const processLifecycleEvent = (type: string, data: EventData, ctrl: EventControllers) => {
    const { setStatus, setActivityLogs, setToolExecutions, setCurrentPlan, loadTaskHistory, setIsLoading } = ctrl;

    if (type === 'agent:task_started') {
        setActivityLogs([]);
        setToolExecutions([]);
        setCurrentPlan(null);
        setStatus({
            taskId: data.taskId,
            state: 'thinking',
            progress: 0,
            currentStep: 'Initializing...',
            error: null,
            metrics: { tokensUsed: 0, llmCalls: 0, toolCalls: 0, estimatedCost: 0 }
        });
        clearLoadingState(setIsLoading);
        void loadTaskHistory();
        return;
    }

    // Only process events for the selected task
    if (data.taskId !== ctrl.selectedTaskId) { return; }

    const eventHandlers: Partial<Record<string, () => void>> = {
        'agent:task_paused': () => {
            setStatus(prev => ({ ...prev, state: 'paused' }));
            addActivityLog(setActivityLogs, 'info', `Task paused${data.reason ? `: ${data.reason}` : ''}.`);
            clearLoadingState(setIsLoading);
        },
        'agent:task_resumed': () => {
            setStatus(prev => ({ ...prev, state: 'thinking' }));
            addActivityLog(setActivityLogs, 'info', 'Task resumed.');
        },
        'agent:task_completed': () => {
            setStatus(prev => ({ ...prev, state: 'completed', progress: 100 }));
            addActivityLog(setActivityLogs, 'success', 'Task completed successfully!');
            clearLoadingState(setIsLoading);
            void loadTaskHistory();
        },
        'agent:task_failed': () => {
            setStatus(prev => ({ ...prev, state: 'failed', error: data.error ?? 'Unknown error' }));
            addActivityLog(setActivityLogs, 'error', `Task failed: ${data.error ?? 'Unknown error'}`);
            clearLoadingState(setIsLoading);
            void loadTaskHistory();
        }
    };

    eventHandlers[type]?.();
};

const processToolEvent = (type: string, data: EventData, ctrl: EventControllers) => {
    const { setToolExecutions, setActivityLogs, selectedTaskId } = ctrl;
    if (data.taskId !== selectedTaskId) {
        return;
    }
    if (type === 'agent:tool_started' && data.toolName) {
        // Generate unique ID: use toolCallId if available, otherwise create one
        const toolId = data.toolCallId ?? `tool_${generateUniqueId()}`;

        setToolExecutions(prev => {
            // Check if this tool execution already exists (prevent duplicates)
            const existingIndex = prev.findIndex(t => t.id === toolId);
            if (existingIndex !== -1) {
                // Update existing entry instead of adding duplicate
                return prev.map((t, idx) => idx === existingIndex ? { ...t, status: 'running', startTime: new Date() } : t);
            }
            // Add new tool execution
            return [...prev, {
                id: toolId,
                name: data.toolName as string,
                status: 'running',
                startTime: new Date()
            }];
        });
        setActivityLogs(prev => [...prev, { id: generateUniqueId(), type: 'tool', message: `Executing tool: ${data.toolName}...`, timestamp: new Date() }]);
    } else if (type === 'agent:tool_completed' && data.toolCallId) {
        setToolExecutions(prev => prev.map(t => t.id === data.toolCallId ? { ...t, status: 'completed', endTime: new Date(), duration: data.duration } : t));
    } else if (type === 'agent:tool_error' && data.toolCallId) {
        setToolExecutions(prev => prev.map(t => t.id === data.toolCallId ? { ...t, status: 'error', endTime: new Date(), error: data.error } : t));
        setActivityLogs(prev => [...prev, { id: generateUniqueId(), type: 'error', message: `Tool error: ${data.error ?? 'Unknown error'}`, timestamp: new Date() }]);
    }
};

const processPlanEvent = (type: string, data: EventData, ctrl: EventControllers) => {
    const { setCurrentPlan, setStatus, setActivityLogs, currentPlanStepsCount, selectedTaskId } = ctrl;
    if (data.taskId !== selectedTaskId) {
        return;
    }
    if (type === 'agent:plan_ready' && data.plan) {
        const steps = data.plan.steps;
        const newPlan: ExecutionPlan = {
            id: generateUniqueId(),
            taskId: data.taskId,
            planNumber: 1,
            status: 'executing',
            steps: steps.map((s, idx) => ({
                id: s.id ?? String(s.index ?? idx),
                description: s.description,
                status: 'pending' as const
            })),
            currentStep: 0,
            createdAt: new Date()
        };
        setCurrentPlan(newPlan);
        // Log the plan steps for activity stream
        setActivityLogs(prev => [
            ...prev,
            { id: generateUniqueId(), type: 'info', message: `Plan created with ${steps.length} steps:`, timestamp: new Date() },
            ...steps.map((s, idx) => ({
                id: generateUniqueId(),
                type: 'info' as const,
                message: `  ${idx + 1}. ${s.description}`,
                timestamp: new Date()
            }))
        ]);
        setStatus(prev => {
            const metrics = prev.metrics ? { ...prev.metrics, totalSteps: steps.length } : undefined;
            return { ...prev, state: 'planning', metrics } as AgentTaskStatus;
        });
    } else if (type === 'agent:step_started' && typeof data.stepIndex === 'number') {
        const stepIdx = data.stepIndex;
        const progress = Math.round((stepIdx / (currentPlanStepsCount || 1)) * 100);
        setStatus(prev => ({ ...prev, state: 'executing', progress, currentStep: data.description ?? `Executing step ${stepIdx + 1}...` }));
        if (data.thoughts) {
            setActivityLogs(prev => [...prev, { id: generateUniqueId(), type: 'llm', message: `Step Reason: ${data.thoughts}`, timestamp: new Date() }]);
        }
        setActivityLogs(prev => [...prev, { id: generateUniqueId(), type: 'info', message: `Step ${stepIdx + 1}: ${data.description ?? 'No description'}`, timestamp: new Date() }]);
    }
};

const handleLlmResponse = (data: EventData, ctrl: EventControllers) => {
    const { setStatus, setActivityLogs } = ctrl;
    const duration = (data.duration ?? 0) / 1000;
    const tokens = data.tokensUsed ? ` (${data.tokensUsed} tokens)` : '';
    if (data.content) {
        // Truncate long content for activity stream, show first 500 chars
        const MAX_DISPLAY_LENGTH = 500;
        const content = data.content;
        const displayContent = content.length > MAX_DISPLAY_LENGTH
            ? `${content.substring(0, MAX_DISPLAY_LENGTH)}... (truncated)`
            : content;
        setActivityLogs(prev => [...prev, { id: generateUniqueId(), type: 'llm', message: `AI Response: ${displayContent}`, timestamp: new Date() }]);
    }
    setActivityLogs(prev => [...prev, { id: generateUniqueId(), type: 'llm', message: `Received response from ${data.provider ?? 'unknown'} in ${duration.toFixed(1)}s${tokens}`, timestamp: new Date() }]);
    if (data.metrics) {
        setStatus(prev => ({ ...prev, metrics: data.metrics }));
    }
};

const handlePlanAwaitingApproval = (_data: EventData, ctrl: EventControllers) => {
    const { setStatus, setActivityLogs } = ctrl;
    setStatus(prev => ({ ...prev, state: 'waiting_approval' }));
    setActivityLogs(prev => [...prev, {
        id: generateUniqueId(),
        type: 'info',
        message: '📋 Execution plan ready. Waiting for your approval to proceed.',
        timestamp: new Date()
    }]);
};

const handlePlanApproved = (ctrl: EventControllers) => {
    const { setActivityLogs } = ctrl;
    setActivityLogs(prev => [...prev, {
        id: generateUniqueId(),
        type: 'success',
        message: '✓ Plan approved. Starting execution...',
        timestamp: new Date()
    }]);
};

const handlePlanRejected = (_data: EventData, ctrl: EventControllers) => {
    const { setActivityLogs } = ctrl;
    setActivityLogs(prev => [...prev, {
        id: generateUniqueId(),
        type: 'error',
        message: `✗ Plan rejected${_data.reason ? `: ${_data.reason}` : ''}`,
        timestamp: new Date()
    }]);
};

const handleStateChanged = (_data: EventData, ctrl: EventControllers) => {
    const { setStatus } = ctrl;
    if (_data.state) {
        setStatus(prev => ({ ...prev, state: _data.state as string }));
    }
};

const handleLlmRequest = (_data: EventData, ctrl: EventControllers) => {
    const { setActivityLogs } = ctrl;
    setActivityLogs(prev => [...prev, {
        id: generateUniqueId(),
        type: 'llm',
        message: `Calling LLM with ${_data.provider ?? 'unknown'}...`,
        timestamp: new Date()
    }]);
};

const handleProviderChanged = (_data: EventData, ctrl: EventControllers) => {
    const { setActivityLogs } = ctrl;
    setActivityLogs(prev => [...prev, {
        id: generateUniqueId(),
        type: 'info',
        message: `Switched provider: ${_data.fromProvider ?? 'unknown'} → ${_data.toProvider ?? 'unknown'}${_data.reason ? ` (${_data.reason})` : ''}`,
        timestamp: new Date()
    }]);
};

const handleErrorOccurred = (_data: EventData, ctrl: EventControllers) => {
    const { setActivityLogs } = ctrl;
    setActivityLogs(prev => [...prev, {
        id: generateUniqueId(),
        type: 'error',
        message: _data.message ?? 'Unknown error',
        timestamp: new Date()
    }]);
};

const handleResourceError = (_data: EventData, ctrl: EventControllers) => {
    const { setStatus, setActivityLogs } = ctrl;
    const errorMsg = _data.message ?? 'Insufficient system resources';
    setActivityLogs(prev => [...prev, {
        id: generateUniqueId(),
        type: 'error',
        message: `⚠️ Resource Error: ${errorMsg}. Task paused - please select a cloud-based model.`,
        timestamp: new Date()
    }]);
    setStatus(prev => ({ ...prev, state: 'waiting_user', error: errorMsg }));
};

type TelemetryEventHandler = (data: EventData, ctrl: EventControllers) => void;

const telemetryEventHandlers: Record<string, TelemetryEventHandler> = {
    'agent:plan_awaiting_approval': handlePlanAwaitingApproval,
    'agent:plan_approved': (_data, ctrl) => handlePlanApproved(ctrl),
    'agent:plan_rejected': handlePlanRejected,
    'agent:state_changed': handleStateChanged,
    'agent:llm_request': handleLlmRequest,
    'agent:llm_response': handleLlmResponse,
    'agent:provider_changed': handleProviderChanged,
    'agent:error_occurred': handleErrorOccurred,
    'agent:resource_error': handleResourceError
};

const processTelemetryEvent = (type: string, data: EventData, ctrl: EventControllers) => {
    const { selectedTaskId } = ctrl;
    if (data.taskId !== selectedTaskId) {
        return;
    }

    const handler = telemetryEventHandlers[type];
    if (typeof handler === 'function') {
        handler(data, ctrl);
    }
};


export function useAgentEvents(props: UseAgentEventsProps) {
    const propsRef = useRef<UseAgentEventsProps>(props);
    // Track the active task ID synchronously to handle race conditions
    // between event arrival and React state updates
    const activeTaskIdRef = useRef<string | null>(null);
    // Track if component is mounted to prevent state updates after unmount
    const isMountedRef = useRef<boolean>(true);
    const recentEventDedupeKeysRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        propsRef.current = props;
        // Sync the activeTaskIdRef when selectedTaskId changes
        if (props.selectedTaskId) {
            activeTaskIdRef.current = props.selectedTaskId;
        }
    });

    useEffect(() => {
        // Mark as mounted
        isMountedRef.current = true;

        const unsubscribe = window.electron.onAgentEvent((payload: unknown) => {
            // Prevent state updates if component is unmounted
            if (!isMountedRef.current) {
                return;
            }

            const normalizedPayload = normalizeAgentEventPayload(payload);
            if (!normalizedPayload) {
                return;
            }

            if (normalizedPayload.dedupeKey) {
                if (recentEventDedupeKeysRef.current.has(normalizedPayload.dedupeKey)) {
                    return;
                }
                recentEventDedupeKeysRef.current.add(normalizedPayload.dedupeKey);
                if (recentEventDedupeKeysRef.current.size > 500) {
                    const iterator = recentEventDedupeKeysRef.current.values();
                    const oldest = iterator.next().value;
                    if (oldest) {
                        recentEventDedupeKeysRef.current.delete(oldest);
                    }
                }
            }

            const type = normalizedPayload.type;
            const data = toEventData(normalizedPayload);
            const currentProps = propsRef.current;

            // When a new task starts, immediately track its ID synchronously
            // This handles the race condition where events arrive before React state updates
            if (type === 'agent:task_started') {
                activeTaskIdRef.current = data.taskId;
            }

            // Create a controller with the synchronously tracked task ID
            const controllerWithActiveId: EventControllers = {
                ...currentProps,
                selectedTaskId: activeTaskIdRef.current ?? currentProps.selectedTaskId
            };

            processLifecycleEvent(type, data, controllerWithActiveId);
            processToolEvent(type, data, controllerWithActiveId);
            processPlanEvent(type, data, controllerWithActiveId);
            processTelemetryEvent(type, data, controllerWithActiveId);
        });

        return () => {
            // Mark as unmounted before unsubscribing
            isMountedRef.current = false;
            recentEventDedupeKeysRef.current.clear();
            unsubscribe();
        };
    }, []);
}
