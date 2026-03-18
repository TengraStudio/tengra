import { z } from 'zod';

const gitPathSchema = z.string().min(1).max(4096).trim();

export const gitTreeStatusPreviewArgsSchema = z.tuple([
    gitPathSchema,
    gitPathSchema.optional(),
    z.object({
        refresh: z.boolean().optional(),
    }).optional(),
]);

export const gitTreeStatusPreviewResponseSchema = z.object({
    success: z.boolean(),
    isRepository: z.boolean().optional(),
    repoRoot: z.string().optional(),
    targetPath: z.string().optional(),
    refreshedAt: z.number().int().nonnegative().optional(),
    entries: z.array(
        z.object({
            path: z.string(),
            statuses: z.array(z.string()),
            isDirectory: z.boolean(),
        })
    ),
    error: z.string().optional(),
});
