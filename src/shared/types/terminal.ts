/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export interface TerminalTab {
    id: string;
    name: string;
    type: string;
    status: 'idle' | 'running' | 'error';
    history: string[];
    command: string;
    content?: string[];
    inputHistory?: string[];
    historyIndex?: number;
    currentInput?: string;
    isRunning?: boolean;
    cwd?: string;
    backendId?: string;
    metadata?: Record<string, RuntimeValue>;
    bootstrapCommand?: string;
}

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

export interface TerminalScrollbackSearchOptions {
    regex?: boolean;
    caseSensitive?: boolean;
    limit?: number;
}

