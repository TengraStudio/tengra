/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */


import * as schemas from '@shared/schemas/terminal.schema';
import { ExplainErrorResult, FixErrorResult,TerminalCommandHistoryEntry } from '@shared/types/terminal';

export type { ExplainErrorResult, FixErrorResult,TerminalCommandHistoryEntry };

// Re-export schemas for easier usage in the feature
export const {
    terminalCreateOptionsSchema,
    terminalExplainErrorOptionsSchema,
    terminalFixErrorOptionsSchema,
    terminalCommandHistoryEntrySchema,
    explainErrorResultSchema,
    fixErrorResultSchema,
    terminalIsAvailableResponseSchema,
    terminalGetDiscoverySnapshotArgsSchema,
    terminalGetShellsResponseSchema,
    terminalGetBackendsResponseSchema,
    terminalGetDiscoverySnapshotResponseSchema,
    terminalGetDockerContainersResponseSchema,
    terminalReadBufferResponseSchema,
    terminalCreateResponseSchema,
    terminalWriteResponseSchema,
    terminalResizeResponseSchema,
    terminalKillResponseSchema,
    terminalGetSuggestionsResponseSchema,
    terminalClearCommandHistoryResponseSchema
} = schemas;

// --- Contract ---

import { TerminalIpcContract } from '@shared/terminal-ipc';

export type { TerminalIpcContract };

// Contract-driven terminal IPC operations
