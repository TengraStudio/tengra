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
    metadata?: Record<string, unknown>;
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
