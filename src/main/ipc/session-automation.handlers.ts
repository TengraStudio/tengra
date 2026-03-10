import { AutomationWorkflowService } from '@main/services/workspace/automation-workflow.service';
import { createValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import { SESSION_AUTOMATION_CHANNELS } from '@shared/constants/ipc-channels';
import {
    AgentProfileSchema,
    AgentStartOptionsSchema,
    AutomationWorkflowStateSchema,
    AutomationWorkflowStepSchema,
    ModelRoutingRuleSchema,
} from '@shared/schemas/automation-workflow-hardening.schema';
import type { AgentEventRecord, TaskMetrics } from '@shared/types/agent-state';
import type {
    AgentProfile,
    AgentStartOptions,
    AgentTaskHistoryItem,
    AgentTemplate,
    AgentTemplateCategory,
    AgentTemplateExport,
    AutomationWorkflowState,
    AutomationWorkflowStep,
    ModelRoutingRule,
    RollbackCheckpointResult,
} from '@shared/types/automation-workflow';
import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { z } from 'zod';

interface AvailableModelInfo {
    id: string;
    name: string;
    provider: string;
}

type TaskMessagesResult = Awaited<ReturnType<AutomationWorkflowService['getTaskMessages']>>;
type AutomationSenderValidator = (event: IpcMainInvokeEvent) => void;

const optionalTaskIdPayloadSchema = z.object({
    taskId: z.string().optional(),
}).optional();

const requiredTaskIdPayloadSchema = z.object({
    taskId: z.string().min(1),
});

const retryStepPayloadSchema = z.union([
    z.number(),
    z.object({
        index: z.number(),
        taskId: z.string().optional(),
    }),
]);

const approvePlanPayloadSchema = z.union([
    z.array(AutomationWorkflowStepSchema),
    z.object({
        plan: z.array(AutomationWorkflowStepSchema),
        taskId: z.string().optional(),
    }),
]);

const taskReasonPayloadSchema = z.object({
    taskId: z.string().min(1),
    reason: z.string().optional(),
});

const selectModelPayloadSchema = z.object({
    taskId: z.string().min(1),
    provider: z.string().min(1),
    model: z.string().min(1),
});

const taskStepPayloadSchema = z.object({
    taskId: z.string().min(1),
    stepId: z.string().min(1),
});

const editStepPayloadSchema = z.object({
    taskId: z.string().min(1),
    stepId: z.string().min(1),
    text: z.string().min(1),
});

const commentStepPayloadSchema = z.object({
    taskId: z.string().min(1),
    stepId: z.string().min(1),
    comment: z.string().min(1),
});

const interventionPayloadSchema = z.object({
    taskId: z.string().min(1),
    afterStepId: z.string().min(1),
});

const taskHistoryPayloadSchema = z.object({
    workspaceId: z.string().optional(),
}).optional();

const applyTemplateValuesSchema = z.record(
    z.string(),
    z.union([z.string(), z.number(), z.boolean()])
);

const applyTemplatePayloadSchema = z.object({
    templateId: z.string().min(1),
    values: applyTemplateValuesSchema,
});

const agentTemplateVariableSchema = z.object({
    name: z.string().min(1),
    type: z.enum(['string', 'file_path', 'directory', 'select', 'boolean', 'number']),
    description: z.string().min(1),
    required: z.boolean(),
    defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
    options: z.array(z.string()).optional(),
    placeholder: z.string().optional(),
});

const agentTemplateSchema: z.ZodType<AgentTemplate> = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    category: z.enum([
        'refactor',
        'bug-fix',
        'feature',
        'documentation',
        'testing',
        'security',
        'performance',
        'custom',
    ]),
    systemPromptOverride: z.string().optional(),
    taskTemplate: z.string(),
    predefinedSteps: z.array(z.string()).optional(),
    variables: z.array(agentTemplateVariableSchema),
    modelRouting: z.array(ModelRoutingRuleSchema).optional(),
    tags: z.array(z.string()),
    isBuiltIn: z.boolean(),
    authorId: z.string().optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
});

const saveTemplateResponseSchema = z.object({
    success: z.boolean(),
    template: agentTemplateSchema,
});

const agentTemplateExportSchema = z.object({
    version: z.literal(1),
    template: agentTemplateSchema,
    exportedAt: z.number(),
    exportedBy: z.string().optional(),
});

const deleteTemplateResponseSchema = z.object({
    success: z.boolean(),
});

const availableModelsResponseSchema = z.object({
    success: z.boolean(),
    models: z.array(z.object({
        id: z.string(),
        name: z.string(),
        provider: z.string(),
    })),
});

const deleteTaskResponseSchema = z.object({
    success: z.boolean(),
    error: z.string().optional(),
});

const pullRequestResponseSchema = z.object({
    success: z.boolean(),
    url: z.string().optional(),
    error: z.string().optional(),
}).nullable();

const checkpointItemSchema = z.object({
    id: z.string(),
    stepIndex: z.number(),
    trigger: z.string(),
    createdAt: z.number(),
});

const planVersionSchema = z.object({
    id: z.string(),
    taskId: z.string(),
    versionNumber: z.number(),
    reason: z.string(),
    plan: z.array(AutomationWorkflowStepSchema),
    createdAt: z.number(),
});

const rollbackCheckpointResponseSchema = z.object({
    success: z.boolean(),
    taskId: z.string(),
    resumedCheckpointId: z.string(),
    preRollbackCheckpointId: z.string(),
    planVersionId: z.string().optional(),
}).nullable();

const boolSuccessSchema = z.object({
    success: z.boolean(),
    error: z.string().optional(),
});

interface RegisterSessionAutomationHandlersOptions {
    automationWorkflowService: AutomationWorkflowService;
    validateSender: AutomationSenderValidator;
}

function registerAutomationLifecycleHandlers(
    automationWorkflowService: AutomationWorkflowService,
    validateSender: AutomationSenderValidator
): void {
    ipcMain.handle(
        SESSION_AUTOMATION_CHANNELS.START,
        createValidatedIpcHandler<{ taskId: string }, [AgentStartOptions]>(
            SESSION_AUTOMATION_CHANNELS.START,
            async (event, options) => {
                validateSender(event);
                const taskId = await automationWorkflowService.start(options);
                return { taskId };
            },
            { argsSchema: z.tuple([AgentStartOptionsSchema]), wrapResponse: true }
        )
    );

    ipcMain.handle(
        SESSION_AUTOMATION_CHANNELS.PLAN,
        createValidatedIpcHandler<{ taskId: string }, [AgentStartOptions]>(
            SESSION_AUTOMATION_CHANNELS.PLAN,
            async (event, options) => {
                validateSender(event);
                const taskId = await automationWorkflowService.generatePlan(options);
                return { taskId };
            },
            { argsSchema: z.tuple([AgentStartOptionsSchema]), wrapResponse: true }
        )
    );

    ipcMain.handle(
        SESSION_AUTOMATION_CHANNELS.APPROVE_PLAN,
        createValidatedIpcHandler<void, [AutomationWorkflowStep[] | { plan: AutomationWorkflowStep[]; taskId?: string }]>(
            SESSION_AUTOMATION_CHANNELS.APPROVE_PLAN,
            async (event, payload) => {
                validateSender(event);
                if (Array.isArray(payload)) {
                    await automationWorkflowService.approvePlan(payload);
                    return;
                }

                await automationWorkflowService.approvePlan(payload.plan, payload.taskId);
            },
            { argsSchema: z.tuple([approvePlanPayloadSchema]), wrapResponse: true }
        )
    );

    ipcMain.handle(
        SESSION_AUTOMATION_CHANNELS.STOP,
        createValidatedIpcHandler<void, [{ taskId?: string } | undefined]>(
            SESSION_AUTOMATION_CHANNELS.STOP,
            async (event, payload) => {
                validateSender(event);
                await automationWorkflowService.stop(payload?.taskId);
            },
            { argsSchema: z.tuple([optionalTaskIdPayloadSchema]), wrapResponse: true }
        )
    );

    ipcMain.handle(
        SESSION_AUTOMATION_CHANNELS.PAUSE_TASK,
        createValidatedIpcHandler<{ success: true }, [{ taskId: string }]>(
            SESSION_AUTOMATION_CHANNELS.PAUSE_TASK,
            async (event, payload) => {
                validateSender(event);
                await automationWorkflowService.pauseTask(payload.taskId);
                return { success: true };
            },
            { argsSchema: z.tuple([requiredTaskIdPayloadSchema]), wrapResponse: true }
        )
    );

    ipcMain.handle(
        SESSION_AUTOMATION_CHANNELS.RESUME_TASK,
        createValidatedIpcHandler<{ success: boolean; error?: string }, [{ taskId: string }]>(
            SESSION_AUTOMATION_CHANNELS.RESUME_TASK,
            async (event, payload) => {
                validateSender(event);
                const success = await automationWorkflowService.resumeTask(payload.taskId);
                return { success, error: success ? undefined : 'Failed to resume task' };
            },
            { argsSchema: z.tuple([requiredTaskIdPayloadSchema]), responseSchema: boolSuccessSchema, wrapResponse: true }
        )
    );

    ipcMain.handle(
        SESSION_AUTOMATION_CHANNELS.SAVE_SNAPSHOT,
        createValidatedIpcHandler<{ success: boolean; checkpointId?: string }, [{ taskId: string }]>(
            SESSION_AUTOMATION_CHANNELS.SAVE_SNAPSHOT,
            async (event, payload) => {
                validateSender(event);
                const checkpointId = await automationWorkflowService.saveSnapshot(payload.taskId);
                return { success: Boolean(checkpointId), checkpointId: checkpointId || undefined };
            },
            {
                argsSchema: z.tuple([requiredTaskIdPayloadSchema]),
                responseSchema: z.object({ success: z.boolean(), checkpointId: z.string().optional() }),
                wrapResponse: true,
            }
        )
    );

    ipcMain.handle(
        SESSION_AUTOMATION_CHANNELS.APPROVE_CURRENT_PLAN,
        createValidatedIpcHandler<{ success: boolean; error?: string }, [{ taskId: string }]>(
            SESSION_AUTOMATION_CHANNELS.APPROVE_CURRENT_PLAN,
            async (event, payload) => {
                validateSender(event);
                const success = await automationWorkflowService.approveCurrentPlan(payload.taskId);
                return { success, error: success ? undefined : 'Failed to approve current plan' };
            },
            { argsSchema: z.tuple([requiredTaskIdPayloadSchema]), responseSchema: boolSuccessSchema, wrapResponse: true }
        )
    );

    ipcMain.handle(
        SESSION_AUTOMATION_CHANNELS.REJECT_CURRENT_PLAN,
        createValidatedIpcHandler<{ success: boolean; error?: string }, [{ taskId: string; reason?: string }]>(
            SESSION_AUTOMATION_CHANNELS.REJECT_CURRENT_PLAN,
            async (event, payload) => {
                validateSender(event);
                const success = await automationWorkflowService.rejectCurrentPlan(payload.taskId, payload.reason);
                return { success, error: success ? undefined : 'Failed to reject current plan' };
            },
            { argsSchema: z.tuple([taskReasonPayloadSchema]), responseSchema: boolSuccessSchema, wrapResponse: true }
        )
    );

    ipcMain.handle(
        SESSION_AUTOMATION_CHANNELS.RESET_STATE,
        createValidatedIpcHandler<void, [{ taskId?: string } | undefined]>(
            SESSION_AUTOMATION_CHANNELS.RESET_STATE,
            async (event, payload) => {
                validateSender(event);
                await automationWorkflowService.resetState(payload?.taskId);
            },
            { argsSchema: z.tuple([optionalTaskIdPayloadSchema]), wrapResponse: true }
        )
    );

    ipcMain.handle(
        SESSION_AUTOMATION_CHANNELS.GET_STATUS,
        createValidatedIpcHandler<AutomationWorkflowState, [{ taskId?: string } | undefined]>(
            SESSION_AUTOMATION_CHANNELS.GET_STATUS,
            async (event, payload) => {
                validateSender(event);
                return await automationWorkflowService.getStatus(payload?.taskId);
            },
            { argsSchema: z.tuple([optionalTaskIdPayloadSchema]), responseSchema: AutomationWorkflowStateSchema, wrapResponse: true }
        )
    );

    ipcMain.handle(
        SESSION_AUTOMATION_CHANNELS.GET_TASK_MESSAGES,
        createValidatedIpcHandler<TaskMessagesResult, [{ taskId: string }]>(
            SESSION_AUTOMATION_CHANNELS.GET_TASK_MESSAGES,
            async (event, payload) => {
                validateSender(event);
                return await automationWorkflowService.getTaskMessages(payload.taskId);
            },
            { argsSchema: z.tuple([requiredTaskIdPayloadSchema]), wrapResponse: true }
        )
    );

    ipcMain.handle(
        SESSION_AUTOMATION_CHANNELS.GET_TASK_EVENTS,
        createValidatedIpcHandler<{ success: boolean; events: AgentEventRecord[] }, [{ taskId: string }]>(
            SESSION_AUTOMATION_CHANNELS.GET_TASK_EVENTS,
            async (event, payload) => {
                validateSender(event);
                return await automationWorkflowService.getTaskEvents(payload.taskId);
            },
            { argsSchema: z.tuple([requiredTaskIdPayloadSchema]), wrapResponse: true }
        )
    );

    ipcMain.handle(
        SESSION_AUTOMATION_CHANNELS.GET_TASK_TELEMETRY,
        createValidatedIpcHandler<{ success: boolean; telemetry: TaskMetrics[] }, [{ taskId: string }]>(
            SESSION_AUTOMATION_CHANNELS.GET_TASK_TELEMETRY,
            async (event, payload) => {
                validateSender(event);
                return await automationWorkflowService.getTaskTelemetry(payload.taskId);
            },
            { argsSchema: z.tuple([requiredTaskIdPayloadSchema]), wrapResponse: true }
        )
    );

    ipcMain.handle(
        SESSION_AUTOMATION_CHANNELS.GET_TASK_HISTORY,
        createValidatedIpcHandler<AgentTaskHistoryItem[], [{ workspaceId?: string } | undefined]>(
            SESSION_AUTOMATION_CHANNELS.GET_TASK_HISTORY,
            async (event, payload) => {
                validateSender(event);
                return await automationWorkflowService.getTaskHistory(payload?.workspaceId ?? '');
            },
            { argsSchema: z.tuple([taskHistoryPayloadSchema]), wrapResponse: true }
        )
    );

    ipcMain.handle(
        SESSION_AUTOMATION_CHANNELS.DELETE_TASK,
        createValidatedIpcHandler<{ success: boolean; error?: string }, [{ taskId: string }]>(
            SESSION_AUTOMATION_CHANNELS.DELETE_TASK,
            async (event, payload) => {
                validateSender(event);
                const success = await automationWorkflowService.deleteTask(payload.taskId);
                return { success, error: success ? undefined : 'Failed to delete task' };
            },
            { argsSchema: z.tuple([requiredTaskIdPayloadSchema]), responseSchema: deleteTaskResponseSchema, wrapResponse: true }
        )
    );

    ipcMain.handle(
        SESSION_AUTOMATION_CHANNELS.GET_AVAILABLE_MODELS,
        createValidatedIpcHandler<{ success: boolean; models: AvailableModelInfo[] }, []>(
            SESSION_AUTOMATION_CHANNELS.GET_AVAILABLE_MODELS,
            async event => {
                validateSender(event);
                const models = await automationWorkflowService.getAvailableModels();
                return { success: true, models };
            },
            { responseSchema: availableModelsResponseSchema, wrapResponse: true }
        )
    );
}

function registerAutomationStepHandlers(
    automationWorkflowService: AutomationWorkflowService,
    validateSender: AutomationSenderValidator
): void {
    ipcMain.handle(
        SESSION_AUTOMATION_CHANNELS.RETRY_STEP,
        createValidatedIpcHandler<void, [number | { index: number; taskId?: string }]>(
            SESSION_AUTOMATION_CHANNELS.RETRY_STEP,
            async (event, payload) => {
                validateSender(event);
                if (typeof payload === 'number') {
                    await automationWorkflowService.retryStep(payload);
                    return;
                }
                await automationWorkflowService.retryStep(payload.index, payload.taskId);
            },
            { argsSchema: z.tuple([retryStepPayloadSchema]), wrapResponse: true }
        )
    );

    ipcMain.handle(
        SESSION_AUTOMATION_CHANNELS.SELECT_MODEL,
        createValidatedIpcHandler<{ success: boolean; error?: string }, [{ taskId: string; provider: string; model: string }]>(
            SESSION_AUTOMATION_CHANNELS.SELECT_MODEL,
            async (event, payload) => {
                validateSender(event);
                const success = await automationWorkflowService.selectModel(payload.taskId, payload.provider, payload.model);
                return { success, error: success ? undefined : 'Failed to select model' };
            },
            { argsSchema: z.tuple([selectModelPayloadSchema]), responseSchema: boolSuccessSchema, wrapResponse: true }
        )
    );

    ipcMain.handle(
        SESSION_AUTOMATION_CHANNELS.APPROVE_STEP,
        createValidatedIpcHandler<void, [{ taskId: string; stepId: string }]>(
            SESSION_AUTOMATION_CHANNELS.APPROVE_STEP,
            async (event, payload) => {
                validateSender(event);
                await automationWorkflowService.approveStep(payload.taskId, payload.stepId);
            },
            { argsSchema: z.tuple([taskStepPayloadSchema]), wrapResponse: true }
        )
    );

    ipcMain.handle(
        SESSION_AUTOMATION_CHANNELS.SKIP_STEP,
        createValidatedIpcHandler<void, [{ taskId: string; stepId: string }]>(
            SESSION_AUTOMATION_CHANNELS.SKIP_STEP,
            async (event, payload) => {
                validateSender(event);
                await automationWorkflowService.skipStep(payload.taskId, payload.stepId);
            },
            { argsSchema: z.tuple([taskStepPayloadSchema]), wrapResponse: true }
        )
    );

    ipcMain.handle(
        SESSION_AUTOMATION_CHANNELS.EDIT_STEP,
        createValidatedIpcHandler<void, [{ taskId: string; stepId: string; text: string }]>(
            SESSION_AUTOMATION_CHANNELS.EDIT_STEP,
            async (event, payload) => {
                validateSender(event);
                await automationWorkflowService.editStep(payload.taskId, payload.stepId, payload.text);
            },
            { argsSchema: z.tuple([editStepPayloadSchema]), wrapResponse: true }
        )
    );

    ipcMain.handle(
        SESSION_AUTOMATION_CHANNELS.ADD_STEP_COMMENT,
        createValidatedIpcHandler<void, [{ taskId: string; stepId: string; comment: string }]>(
            SESSION_AUTOMATION_CHANNELS.ADD_STEP_COMMENT,
            async (event, payload) => {
                validateSender(event);
                await automationWorkflowService.addStepComment(payload.taskId, payload.stepId, payload.comment);
            },
            { argsSchema: z.tuple([commentStepPayloadSchema]), wrapResponse: true }
        )
    );

    ipcMain.handle(
        SESSION_AUTOMATION_CHANNELS.INSERT_INTERVENTION_POINT,
        createValidatedIpcHandler<void, [{ taskId: string; afterStepId: string }]>(
            SESSION_AUTOMATION_CHANNELS.INSERT_INTERVENTION_POINT,
            async (event, payload) => {
                validateSender(event);
                await automationWorkflowService.insertInterventionPoint(payload.taskId, payload.afterStepId);
            },
            { argsSchema: z.tuple([interventionPayloadSchema]), wrapResponse: true }
        )
    );

    ipcMain.handle(
        SESSION_AUTOMATION_CHANNELS.CREATE_PULL_REQUEST,
        createValidatedIpcHandler<{ success: boolean; url?: string; error?: string } | null, [{ taskId?: string } | undefined]>(
            SESSION_AUTOMATION_CHANNELS.CREATE_PULL_REQUEST,
            async (event, payload) => {
                validateSender(event);
                return await automationWorkflowService.createPullRequest(payload?.taskId);
            },
            { argsSchema: z.tuple([optionalTaskIdPayloadSchema]), responseSchema: pullRequestResponseSchema, wrapResponse: true }
        )
    );
}

function registerAutomationMetadataHandlers(
    automationWorkflowService: AutomationWorkflowService,
    validateSender: AutomationSenderValidator
): void {
    ipcMain.handle(
        SESSION_AUTOMATION_CHANNELS.GET_CHECKPOINTS,
        createValidatedIpcHandler<Array<{ id: string; stepIndex: number; trigger: string; createdAt: number }>, [string]>(
            SESSION_AUTOMATION_CHANNELS.GET_CHECKPOINTS,
            async (event, taskId) => {
                validateSender(event);
                return await automationWorkflowService.getCheckpoints(taskId);
            },
            { argsSchema: z.tuple([z.string().min(1)]), responseSchema: z.array(checkpointItemSchema), wrapResponse: true }
        )
    );

    ipcMain.handle(
        SESSION_AUTOMATION_CHANNELS.RESUME_CHECKPOINT,
        createValidatedIpcHandler<void, [string]>(
            SESSION_AUTOMATION_CHANNELS.RESUME_CHECKPOINT,
            async (event, checkpointId) => {
                validateSender(event);
                await automationWorkflowService.resumeFromCheckpoint(checkpointId);
            },
            { argsSchema: z.tuple([z.string().min(1)]), wrapResponse: true }
        )
    );

    ipcMain.handle(
        SESSION_AUTOMATION_CHANNELS.ROLLBACK_CHECKPOINT,
        createValidatedIpcHandler<RollbackCheckpointResult | null, [string]>(
            SESSION_AUTOMATION_CHANNELS.ROLLBACK_CHECKPOINT,
            async (event, checkpointId) => {
                validateSender(event);
                return await automationWorkflowService.rollbackCheckpoint(checkpointId);
            },
            { argsSchema: z.tuple([z.string().min(1)]), responseSchema: rollbackCheckpointResponseSchema, wrapResponse: true }
        )
    );

    ipcMain.handle(
        SESSION_AUTOMATION_CHANNELS.GET_PLAN_VERSIONS,
        createValidatedIpcHandler<Array<{ id: string; taskId: string; versionNumber: number; reason: string; plan: AutomationWorkflowStep[]; createdAt: number }>, [string]>(
            SESSION_AUTOMATION_CHANNELS.GET_PLAN_VERSIONS,
            async (event, taskId) => {
                validateSender(event);
                return await automationWorkflowService.getPlanVersions(taskId);
            },
            { argsSchema: z.tuple([z.string().min(1)]), responseSchema: z.array(planVersionSchema), wrapResponse: true }
        )
    );

    ipcMain.handle(
        SESSION_AUTOMATION_CHANNELS.DELETE_TASK_BY_NODE_ID,
        createValidatedIpcHandler<boolean, [string]>(
            SESSION_AUTOMATION_CHANNELS.DELETE_TASK_BY_NODE_ID,
            async (event, nodeId) => {
                validateSender(event);
                return await automationWorkflowService.deleteTaskByNodeId(nodeId);
            },
            { argsSchema: z.tuple([z.string().min(1)]), wrapResponse: true }
        )
    );

    ipcMain.handle(
        SESSION_AUTOMATION_CHANNELS.GET_PROFILES,
        createValidatedIpcHandler<AgentProfile[], []>(
            SESSION_AUTOMATION_CHANNELS.GET_PROFILES,
            async event => {
                validateSender(event);
                return await automationWorkflowService.getProfiles();
            },
            { responseSchema: z.array(AgentProfileSchema), wrapResponse: true }
        )
    );

    ipcMain.handle(
        SESSION_AUTOMATION_CHANNELS.GET_ROUTING_RULES,
        createValidatedIpcHandler<ModelRoutingRule[], []>(
            SESSION_AUTOMATION_CHANNELS.GET_ROUTING_RULES,
            async event => {
                validateSender(event);
                return automationWorkflowService.getRoutingRules();
            },
            { responseSchema: z.array(ModelRoutingRuleSchema), wrapResponse: true }
        )
    );

    ipcMain.handle(
        SESSION_AUTOMATION_CHANNELS.SET_ROUTING_RULES,
        createValidatedIpcHandler<{ success: true }, [ModelRoutingRule[]]>(
            SESSION_AUTOMATION_CHANNELS.SET_ROUTING_RULES,
            async (event, rules) => {
                validateSender(event);
                automationWorkflowService.setRoutingRules(rules);
                return { success: true };
            },
            { argsSchema: z.tuple([z.array(ModelRoutingRuleSchema)]), responseSchema: z.object({ success: z.literal(true) }), wrapResponse: true }
        )
    );
}

function registerAutomationTemplateHandlers(
    automationWorkflowService: AutomationWorkflowService,
    validateSender: AutomationSenderValidator
): void {
    ipcMain.handle(
        SESSION_AUTOMATION_CHANNELS.GET_TEMPLATES,
        createValidatedIpcHandler<AgentTemplate[], [AgentTemplateCategory | undefined]>(
            SESSION_AUTOMATION_CHANNELS.GET_TEMPLATES,
            async (event, category) => {
                validateSender(event);
                if (category) {
                    return automationWorkflowService.getTemplatesByCategory(category);
                }
                return automationWorkflowService.getTemplates();
            },
            { argsSchema: z.tuple([z.string().optional()]), responseSchema: z.array(agentTemplateSchema), wrapResponse: true }
        )
    );

    ipcMain.handle(
        SESSION_AUTOMATION_CHANNELS.GET_TEMPLATE,
        createValidatedIpcHandler<AgentTemplate | null, [string]>(
            SESSION_AUTOMATION_CHANNELS.GET_TEMPLATE,
            async (event, id) => {
                validateSender(event);
                return automationWorkflowService.getTemplate(id);
            },
            { argsSchema: z.tuple([z.string().min(1)]), responseSchema: agentTemplateSchema.nullable(), wrapResponse: true }
        )
    );

    ipcMain.handle(
        SESSION_AUTOMATION_CHANNELS.SAVE_TEMPLATE,
        createValidatedIpcHandler<{ success: boolean; template: AgentTemplate }, [AgentTemplate]>(
            SESSION_AUTOMATION_CHANNELS.SAVE_TEMPLATE,
            async (event, template) => {
                validateSender(event);
                return await automationWorkflowService.saveTemplate(template);
            },
            { argsSchema: z.tuple([agentTemplateSchema]), responseSchema: saveTemplateResponseSchema, wrapResponse: true }
        )
    );

    ipcMain.handle(
        SESSION_AUTOMATION_CHANNELS.DELETE_TEMPLATE,
        createValidatedIpcHandler<{ success: boolean }, [string]>(
            SESSION_AUTOMATION_CHANNELS.DELETE_TEMPLATE,
            async (event, id) => {
                validateSender(event);
                return { success: await automationWorkflowService.deleteTemplate(id) };
            },
            { argsSchema: z.tuple([z.string().min(1)]), responseSchema: deleteTemplateResponseSchema, wrapResponse: true }
        )
    );

    ipcMain.handle(
        SESSION_AUTOMATION_CHANNELS.EXPORT_TEMPLATE,
        createValidatedIpcHandler<AgentTemplateExport | null, [string]>(
            SESSION_AUTOMATION_CHANNELS.EXPORT_TEMPLATE,
            async (event, id) => {
                validateSender(event);
                return automationWorkflowService.exportTemplate(id);
            },
            { argsSchema: z.tuple([z.string().min(1)]), wrapResponse: true }
        )
    );

    ipcMain.handle(
        SESSION_AUTOMATION_CHANNELS.IMPORT_TEMPLATE,
        createValidatedIpcHandler<{ success: boolean; template?: AgentTemplate; error?: string }, [AgentTemplateExport]>(
            SESSION_AUTOMATION_CHANNELS.IMPORT_TEMPLATE,
            async (event, exported) => {
                validateSender(event);
                try {
                    const template = await automationWorkflowService.importTemplate(exported);
                    return { success: true, template };
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    return { success: false, error: message };
                }
            },
            { argsSchema: z.tuple([agentTemplateExportSchema]), wrapResponse: true }
        )
    );

    ipcMain.handle(
        SESSION_AUTOMATION_CHANNELS.APPLY_TEMPLATE,
        createValidatedIpcHandler<{ success: boolean; template?: AgentTemplate; task?: string; steps?: string[]; error?: string }, [{ templateId: string; values: Record<string, string | number | boolean> }]>(
            SESSION_AUTOMATION_CHANNELS.APPLY_TEMPLATE,
            async (event, payload) => {
                validateSender(event);
                try {
                    const result = automationWorkflowService.applyTemplate(payload.templateId, payload.values);
                    return {
                        success: true,
                        template: result.template,
                        task: result.task,
                        steps: result.steps,
                    };
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    return { success: false, error: message };
                }
            },
            { argsSchema: z.tuple([applyTemplatePayloadSchema]), wrapResponse: true }
        )
    );
}

export function registerSessionAutomationHandlers({
    automationWorkflowService,
    validateSender,
}: RegisterSessionAutomationHandlersOptions): void {
    registerAutomationLifecycleHandlers(automationWorkflowService, validateSender);
    registerAutomationStepHandlers(automationWorkflowService, validateSender);
    registerAutomationMetadataHandlers(automationWorkflowService, validateSender);
    registerAutomationTemplateHandlers(automationWorkflowService, validateSender);
}
