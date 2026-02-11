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
