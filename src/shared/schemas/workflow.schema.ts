import { z } from 'zod';

/** Maximum lengths for workflow string fields */
export const WORKFLOW_LIMITS = {
    NAME_MAX_LENGTH: 200,
    DESCRIPTION_MAX_LENGTH: 2000,
    ID_MAX_LENGTH: 200,
    STEP_NAME_MAX_LENGTH: 200,
    CONFIG_KEY_MAX_LENGTH: 200,
    CONFIG_VALUE_MAX_SIZE: 50_000,
    MAX_TRIGGERS: 50,
    MAX_STEPS: 100,
    MAX_CONFIG_KEYS: 50,
} as const;

const TriggerTypeSchema = z.enum(['manual', 'app_start', 'interval', 'event']);
const ActionTypeSchema = z.enum(['command', 'log', 'http_request', 'llm_prompt', 'delay']);

const BoundedJsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
    z.union([
        z.string().max(WORKFLOW_LIMITS.CONFIG_VALUE_MAX_SIZE),
        z.number().finite(),
        z.boolean(),
        z.null(),
        z.array(z.lazy(() => BoundedJsonValueSchema)).max(100),
        z.record(
            z.string().max(WORKFLOW_LIMITS.CONFIG_KEY_MAX_LENGTH),
            z.lazy(() => BoundedJsonValueSchema)
        ).refine(
            (obj) => Object.keys(obj).length <= WORKFLOW_LIMITS.MAX_CONFIG_KEYS,
            { message: `Config must have at most ${WORKFLOW_LIMITS.MAX_CONFIG_KEYS} keys` }
        ),
    ])
);

const WorkflowConfigSchema = z.record(
    z.string().max(WORKFLOW_LIMITS.CONFIG_KEY_MAX_LENGTH),
    BoundedJsonValueSchema
).refine(
    (obj) => Object.keys(obj).length <= WORKFLOW_LIMITS.MAX_CONFIG_KEYS,
    { message: `Config must have at most ${WORKFLOW_LIMITS.MAX_CONFIG_KEYS} keys` }
);

export const WorkflowTriggerSchema = z.object({
    id: z.string().trim().min(1, 'Trigger id must be a non-empty string').max(WORKFLOW_LIMITS.ID_MAX_LENGTH),
    type: TriggerTypeSchema,
    config: WorkflowConfigSchema,
});

export const WorkflowActionSchema = z.object({
    id: z.string().trim().min(1, 'Action id must be a non-empty string').max(WORKFLOW_LIMITS.ID_MAX_LENGTH),
    type: ActionTypeSchema,
    config: WorkflowConfigSchema,
});

const StepRetryPolicySchema = z.object({
    maxRetries: z.number().int().min(0).max(10),
    baseDelayMs: z.number().int().min(0).max(60000),
    maxDelayMs: z.number().int().min(0).max(300000).optional(),
});

export const WorkflowStepSchema = z.object({
    id: z.string().trim().min(1, 'Step id must be a non-empty string').max(WORKFLOW_LIMITS.ID_MAX_LENGTH),
    name: z.string().trim().min(1, 'Step name must be a non-empty string').max(WORKFLOW_LIMITS.STEP_NAME_MAX_LENGTH),
    action: WorkflowActionSchema,
    nextStepId: z.string().trim().max(WORKFLOW_LIMITS.ID_MAX_LENGTH).optional(),
    critical: z.boolean().optional(),
    retryPolicy: StepRetryPolicySchema.optional(),
});

/** Schema for createWorkflow input (no id/createdAt/updatedAt) */
export const CreateWorkflowInputSchema = z.object({
    name: z.string().trim().min(1, 'Workflow name must be a non-empty string').max(WORKFLOW_LIMITS.NAME_MAX_LENGTH, `Workflow name must be at most ${WORKFLOW_LIMITS.NAME_MAX_LENGTH} characters`),
    description: z.string().max(WORKFLOW_LIMITS.DESCRIPTION_MAX_LENGTH, `Description must be at most ${WORKFLOW_LIMITS.DESCRIPTION_MAX_LENGTH} characters`).optional(),
    enabled: z.boolean(),
    triggers: z.array(WorkflowTriggerSchema).max(WORKFLOW_LIMITS.MAX_TRIGGERS, `Workflow can have at most ${WORKFLOW_LIMITS.MAX_TRIGGERS} triggers`),
    steps: z.array(WorkflowStepSchema).max(WORKFLOW_LIMITS.MAX_STEPS, `Workflow can have at most ${WORKFLOW_LIMITS.MAX_STEPS} steps`),
}).refine(
    (data) => {
        const stepIds = data.steps.map(s => s.id);
        return new Set(stepIds).size === stepIds.length;
    },
    { message: 'Workflow steps must have unique ids' }
).refine(
    (data) => {
        const triggerIds = data.triggers.map(t => t.id);
        return new Set(triggerIds).size === triggerIds.length;
    },
    { message: 'Workflow triggers must have unique ids' }
);

/** Schema for updateWorkflow partial payload */
export const UpdateWorkflowInputSchema = z.object({
    name: z.string().trim().min(1, 'Workflow name must be a non-empty string').max(WORKFLOW_LIMITS.NAME_MAX_LENGTH, `Workflow name must be at most ${WORKFLOW_LIMITS.NAME_MAX_LENGTH} characters`).optional(),
    description: z.string().max(WORKFLOW_LIMITS.DESCRIPTION_MAX_LENGTH, `Description must be at most ${WORKFLOW_LIMITS.DESCRIPTION_MAX_LENGTH} characters`).optional(),
    enabled: z.boolean().optional(),
    triggers: z.array(WorkflowTriggerSchema).max(WORKFLOW_LIMITS.MAX_TRIGGERS, `Workflow can have at most ${WORKFLOW_LIMITS.MAX_TRIGGERS} triggers`).optional(),
    steps: z.array(WorkflowStepSchema).max(WORKFLOW_LIMITS.MAX_STEPS, `Workflow can have at most ${WORKFLOW_LIMITS.MAX_STEPS} steps`).optional(),
    lastRunAt: z.number().finite().optional(),
    lastRunStatus: z.enum(['success', 'failure']).optional(),
}).refine(
    (data) => {
        if (!data.steps) {
            return true;
        }
        const stepIds = data.steps.map(s => s.id);
        return new Set(stepIds).size === stepIds.length;
    },
    { message: 'Workflow steps must have unique ids' }
).refine(
    (data) => {
        if (!data.triggers) {
            return true;
        }
        const triggerIds = data.triggers.map(t => t.id);
        return new Set(triggerIds).size === triggerIds.length;
    },
    { message: 'Workflow triggers must have unique ids' }
);

/** Schema for execute context input */
export const WorkflowContextInputSchema = z.object({
    variables: z.record(z.string().max(200), BoundedJsonValueSchema).optional(),
    agentTaskId: z.string().trim().max(200).optional(),
    userId: z.string().trim().max(200).optional(),
    timestamp: z.number().finite().optional(),
    executionMode: z.enum(['inline', 'async']).optional(),
}).optional();

/**
 * Format Zod validation errors into a human-readable message.
 * @param error - The ZodError to format.
 * @returns A single-line error summary.
 */
export function formatZodErrors(error: z.ZodError): string {
    return error.issues
        .map(issue => {
            const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
            return `${path}${issue.message}`;
        })
        .join('; ');
}
