import { z } from 'zod';

export const terminalCreateOptionsSchema = z.object({
    id: z.string().optional(),
    shell: z.string().optional(),
    cwd: z.string().optional(),
    cols: z.number().int().optional(),
    rows: z.number().int().optional(),
    backendId: z.string().optional(),
    workspaceId: z.string().optional(),
    title: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional()
});

export const terminalExplainErrorOptionsSchema = z.object({
    errorOutput: z.string(),
    command: z.string().optional(),
    shell: z.string(),
    cwd: z.string().optional()
});

export const terminalFixErrorOptionsSchema = z.object({
    errorOutput: z.string(),
    command: z.string(),
    shell: z.string(),
    cwd: z.string().optional()
});

export const terminalCommandHistoryEntrySchema = z.object({
    command: z.string(),
    shell: z.string().optional(),
    cwd: z.string().optional(),
    timestamp: z.number(),
    sessionId: z.string()
});

export const explainErrorResultSchema = z.object({
    summary: z.string(),
    cause: z.string(),
    solution: z.string(),
    steps: z.array(z.string()).optional()
});

export const fixErrorResultSchema = z.object({
    suggestedCommand: z.string(),
    explanation: z.string(),
    confidence: z.enum(['low', 'medium', 'high']),
    alternativeCommands: z.array(z.string()).optional()
});

export const terminalIsAvailableResponseSchema = z.boolean();

export const terminalGetShellsResponseSchema = z.array(z.object({
    id: z.string(),
    name: z.string(),
    path: z.string()
}));

export const terminalGetBackendsResponseSchema = z.array(z.object({
    id: z.string(),
    name: z.string(),
    available: z.boolean()
}));

export const terminalGetDockerContainersResponseSchema = z.object({
    success: z.boolean(),
    containers: z.array(z.record(z.string(), z.unknown())).optional(),
    error: z.string().optional(),
    raw: z.string().optional()
});

export const terminalReadBufferResponseSchema = z.string();
export const terminalCreateResponseSchema = z.string().nullable();
export const terminalWriteResponseSchema = z.boolean();
export const terminalResizeResponseSchema = z.boolean();
export const terminalKillResponseSchema = z.boolean();
export const terminalGetSuggestionsResponseSchema = z.array(z.string());
export const terminalClearCommandHistoryResponseSchema = z.boolean();
