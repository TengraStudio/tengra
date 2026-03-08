/**
 * Terminal System V2 - Type Definitions
 * VSCode-style terminal panel with pluggable backends
 */

export type TerminalBackendType = 'xterm' | 'ghostty' | 'alacritty' | 'wezterm' | 'warp' | 'kitty' | 'windows-terminal';

export interface ITerminalBackend {
    readonly id: TerminalBackendType;
    readonly name: string;
    readonly version: string;
    isAvailable(): Promise<boolean>;
    spawn(options: TerminalSpawnOptions): Promise<string>; // Returns session ID
}

export interface TerminalSpawnOptions {
    shell?: string;
    cwd?: string;
    env?: Record<string, string>;
    cols: number;
    rows: number;
    profileId?: string;
}

export interface TerminalSession {
    id: string;
    title: string;
    cwd: string;
    shell: string;
    backendType: TerminalBackendType;
    status: 'running' | 'stopped' | 'error';
    createdAt: number;
    lastActive: number;
    workspaceId?: string;
}

export interface TerminalProfile {
    id: string;
    name: string;
    description?: string;
    icon?: string;
    shell: string;
    shellArgs: string[];
    cwd?: string;
    env: Record<string, string>;
    preferredBackend?: TerminalBackendType;
    theme?: TerminalTheme;
    isDefault?: boolean;
}

export interface TerminalTheme {
    name: string;
    background: string;
    foreground: string;
    cursor: string;
    selection: string;
    black: string;
    red: string;
    green: string;
    yellow: string;
    blue: string;
    magenta: string;
    cyan: string;
    white: string;
    brightBlack: string;
    brightRed: string;
    brightGreen: string;
    brightYellow: string;
    brightBlue: string;
    brightMagenta: string;
    brightCyan: string;
    brightWhite: string;
}

export interface TerminalPanelState {
    isOpen: boolean;
    height: number; // pixels
    activeSessionId: string | null;
    sessions: TerminalSession[];
    splitMode: 'single' | 'horizontal' | 'vertical';
}

export interface TerminalCommand {
    type: 'create' | 'close' | 'resize' | 'write' | 'clear' | 'split' | 'focus' | 'toggle';
    sessionId?: string;
    payload?: unknown;
}
