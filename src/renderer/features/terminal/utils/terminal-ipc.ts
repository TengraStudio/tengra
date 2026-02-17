import { type IpcContractMap } from '@renderer/lib/ipc-client';
import { z } from 'zod';

/**
 * Terminal IPC Contract definition for DEBT-03 migration.
 * Provides type safety and runtime validation for all terminal operations.
 */

// --- Types ---

export interface TerminalCommandHistoryEntry {
    command: string;
    shell?: string;
    cwd?: string;
    timestamp: number;
    sessionId: string;
}

export interface ExplainErrorResult {
    summary: string;
    cause: string;
    solution: string;
    steps?: string[];
}

export interface FixErrorResult {
    suggestedCommand: string;
    explanation: string;
    confidence: 'low' | 'medium' | 'high';
    alternativeCommands?: string[];
}

// --- Schemas ---

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

// --- Result Schemas (for invokeTypedIpc) ---

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

// --- Contract ---

export type TerminalIpcContract = IpcContractMap & {
    'terminal:create': {
        args: [z.infer<typeof terminalCreateOptionsSchema> | undefined];
        response: string | null;
    };
    'terminal:close': {
        args: [string];
        response: boolean;
    };
    'terminal:kill': {
        args: [string];
        response: boolean;
    };
    'terminal:write': {
        args: [string, string];
        response: boolean;
    };
    'terminal:resize': {
        args: [string, number, number];
        response: boolean;
    };
    'terminal:isAvailable': {
        args: [];
        response: boolean;
    };
    'terminal:getShells': {
        args: [];
        response: Array<{ id: string; name: string; path: string }>;
    };
    'terminal:getBackends': {
        args: [];
        response: Array<{ id: string; name: string; available: boolean }>;
    };
    'terminal:getDockerContainers': {
        args: [];
        response: { success: boolean; containers?: Record<string, unknown>[]; error?: string; raw?: string };
    };
    'terminal:readBuffer': {
        args: [string];
        response: string;
    };
    'terminal:getSuggestions': {
        args: [{ command: string; shell: string; cwd: string; historyLimit?: number }];
        response: string[];
    };
    'terminal:clearCommandHistory': {
        args: [];
        response: boolean;
    };
    'terminal:explainCommand': {
        args: [{ command: string; shell: string; cwd?: string }];
        response: {
            explanation: string;
            breakdown: Array<{ part: string; description: string }>;
            warnings?: string[];
            relatedCommands?: string[];
        };
    };
    'terminal:getCommandHistory': {
        args: [string | undefined, number | undefined];
        response: TerminalCommandHistoryEntry[];
    };
    'terminal:explainError': {
        args: [z.infer<typeof terminalExplainErrorOptionsSchema>];
        response: ExplainErrorResult;
    };
    'terminal:fixError': {
        args: [z.infer<typeof terminalFixErrorOptionsSchema>];
        response: FixErrorResult;
    };
    'terminal:getSnapshotSessions': {
        args: [];
        response: Array<{ id: string; title: string; lastActivity: number }>;
    };
    'terminal:restoreAllSnapshots': {
        args: [];
        response: { restored: number; failed: number; sessionIds: string[] };
    };
    'terminal:setSessionTitle': {
        args: [string, string];
        response: boolean;
    };
    'terminal:detach': {
        args: [{ sessionId: string }];
        response: boolean;
    };
};

// Contract-driven terminal IPC operations
