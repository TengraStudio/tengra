import { z } from 'zod';

import * as schemas from './schemas/terminal.schema';
import { type IpcContractMap } from './types/common';
import { ExplainErrorResult, FixErrorResult,TerminalCommandHistoryEntry } from './types/terminal';

/**
 * Terminal IPC Contract definition.
 * Provides type safety and runtime validation for all terminal operations.
 */
export type TerminalIpcContract = IpcContractMap & {
    'terminal:create': {
        args: [z.infer<typeof schemas.terminalCreateOptionsSchema> | undefined];
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
        args: [z.infer<typeof schemas.terminalExplainErrorOptionsSchema>];
        response: ExplainErrorResult;
    };
    'terminal:fixError': {
        args: [z.infer<typeof schemas.terminalFixErrorOptionsSchema>];
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
