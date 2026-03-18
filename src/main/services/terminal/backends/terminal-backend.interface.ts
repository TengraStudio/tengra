/**
 * Options for creating a terminal process
 */
export interface TerminalCreateOptions {
    id: string;
    shell: string;
    args: string[];
    cwd: string;
    cols: number;
    rows: number;
    env: Record<string, string | undefined>;
    onData: (data: string) => void;
    onExit: (code: number) => void;
    metadata?: Record<string, RuntimeValue>;
}

/**
 * Interface for a terminal process instance
 */
export interface ITerminalProcess {
    write(data: string): void;
    resize(cols: number, rows: number): void;
    kill(): void;
}

/**
 * Interface for terminal backends (node-pty, ghostty, etc.)
 */
export interface ITerminalBackend {
    /**
     * Unique identifier for the backend
     */
    readonly id: string;

    /**
     * Check if the backend is available on the current system
     */
    isAvailable(): Promise<boolean>;

    /**
     * Create a new terminal process
     */
    create(options: TerminalCreateOptions): Promise<ITerminalProcess>;
}
