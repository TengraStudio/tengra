import { appLogger } from '@main/logging/logger';
import { z } from 'zod';

/**
 * Validates data against a Zod schema.
 * Throws a focused error if validation fails.
 */
export function validateIpc<T>(schema: z.ZodType<T>, data: unknown, context: string): T {
    const result = schema.safeParse(data);

    if (!result.success) {
        const errors = result.error.issues.map(e => `${e.path.map(String).join('.')}: ${e.message}`).join(', ');
        appLogger.error('IPCValidation', `Validation failed for ${context}: ${errors}`);
        throw new Error(`Invalid arguments for ${context}: ${errors}`);
    }

    return result.data;
}

// --- SSH Schemas ---

export const sshConnectionSchema = z.object({
    id: z.string().optional(),
    name: z.string().optional(),
    host: z.string().min(1, "Host is required"),
    port: z.number().int().min(1).max(65535).optional().default(22),
    username: z.string().min(1, "Username is required"),
    authType: z.enum(['password', 'key']).optional(),
    password: z.string().optional(),
    privateKey: z.string().optional(),
    passphrase: z.string().optional(),
    keepaliveInterval: z.number().optional(),
    jumpHost: z.string().optional(),
    forwardAgent: z.boolean().optional()
});

export const sshProfileSchema = sshConnectionSchema.extend({
    id: z.string().uuid(),
    connected: z.boolean().optional(),
    lastConnected: z.number().optional(),
    connectionCount: z.number().optional(),
    isFavorite: z.boolean().optional(),
    tags: z.array(z.string()).optional()
});

// --- Audit Schemas ---

export const auditGetLogsOptionsSchema = z.object({
    category: z.enum(['security', 'settings', 'authentication', 'data', 'system']).optional(),
    startDate: z.number().int().nonnegative().optional(),
    endDate: z.number().int().nonnegative().optional(),
    limit: z.number().int().positive().optional()
}).optional();

export const fileOpSchema = z.object({
    connectionId: z.string(),
    path: z.string().min(1),
    content: z.string().optional(),
    oldPath: z.string().optional(),
    newPath: z.string().optional(),
    local: z.string().optional(),
    remote: z.string().optional()
});

// --- Auth Schemas ---
export const providerSchema = z.string().trim().min(1).max(64);
export const accountIdSchema = z.string().trim().min(1).max(128);

export const authTokenDataSchema = z.object({
    accessToken: z.string().min(1).optional(),
    refreshToken: z.string().min(1).optional(),
    sessionToken: z.string().min(1).optional(),
    email: z.string().email().optional(),
    displayName: z.string().max(256).optional(),
    avatarUrl: z.string().url().optional(),
    expiresAt: z.number().int().nonnegative().optional(),
    scope: z.string().max(1024).optional(),
    metadata: z.record(z.string(), z.unknown()).optional()
}).refine(
    data => Boolean(data.accessToken || data.refreshToken || data.sessionToken),
    { message: 'At least one token field must be present.' }
);

export const sessionIdSchema = z.string().uuid();
export const sessionLimitSchema = z.number().int().min(1).max(100);
