import { z } from 'zod';

export const ServiceHealthUiStateSchema = z.enum(['ready', 'empty', 'failure']);
export const ServiceHealthStatusSchema = z.enum(['healthy', 'degraded']);

export const AdvancedMemoryCategorySchema = z.enum([
    'preference',
    'personal',
    'project',
    'technical',
    'workflow',
    'relationship',
    'fact',
    'instruction'
]);

export const AdvancedMemoryRecallContextSchema = z.object({
    query: z.string().trim().max(5000),
    projectId: z.string().trim().max(200).optional(),
    categories: z.array(AdvancedMemoryCategorySchema).max(16).optional(),
    tags: z.array(z.string().trim()).max(32).optional(),
    createdAfter: z.number().finite().optional(),
    createdBefore: z.number().finite().optional(),
    minConfidence: z.number().finite().min(0).max(1).optional(),
    minImportance: z.number().finite().min(0).max(1).optional(),
    includeArchived: z.boolean().optional(),
    includePending: z.boolean().optional(),
    limit: z.number().int().min(1).max(100).optional(),
    diversityFactor: z.number().finite().min(0).max(1).optional()
});

export const AdvancedMemoryImportPayloadSchema = z.object({
    memories: z.array(z.record(z.string(), z.unknown())).max(2000).optional(),
    pendingMemories: z.array(z.record(z.string(), z.unknown())).max(2000).optional(),
    replaceExisting: z.boolean().optional()
});

export const ContextRetrievalInputSchema = z.object({
    query: z.string().trim().max(5000),
    projectId: z.string().trim().max(200).optional(),
    limit: z.number().int().min(1).max(20).optional()
});

export const EmbeddingTextInputSchema = z.object({
    text: z.string().max(20000)
});

export const ProjectRootPathSchema = z.string().trim().min(1).max(4096);
export const ProjectEnvKeySchema = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/);
export const ProjectEnvVarsSchema = z.record(ProjectEnvKeySchema, z.string().max(20000));
