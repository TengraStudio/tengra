/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IpcValue, ToolDefinition, ToolResult } from '@shared/types';
import { IpcRenderer } from 'electron';

export interface ToolsBridge {
    executeTools: (
        toolName: string,
        args: Record<string, IpcValue>,
        toolCallId?: string,
        workspaceAgentSessionId?: string
    ) => Promise<ToolResult>;
    killTool: (toolCallId: string) => Promise<boolean>;
    getToolDefinitions: () => Promise<ToolDefinition[]>;
}

export function createToolsBridge(ipc: IpcRenderer): ToolsBridge {
    return {
        executeTools: (toolName, args, toolCallId, workspaceAgentSessionId) =>
            ipc.invoke('tools:execute', {
                toolName,
                args,
                toolCallId,
                workspaceAgentSessionId,
            }),
        killTool: toolCallId => ipc.invoke('tools:kill', toolCallId),
        getToolDefinitions: () => ipc.invoke('tools:get-definitions'),
    };
}
