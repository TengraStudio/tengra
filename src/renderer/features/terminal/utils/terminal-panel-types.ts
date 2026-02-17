/**
 * Type definitions for terminal panel components
 */

/**
 * Remote SSH profile configuration
 */
export type RemoteSshProfile = {
    /** Profile identifier */
    id: string;
    /** Display name */
    name: string;
    /** SSH host */
    host: string;
    /** SSH port */
    port: number;
    /** SSH username */
    username: string;
    /** Optional SSH private key path */
    privateKey?: string;
    /** Optional jump host */
    jumpHost?: string;
};

/**
 * Remote Docker container information
 */
export type RemoteDockerContainer = {
    /** Container ID */
    id: string;
    /** Container name */
    name: string;
    /** Container status */
    status: string;
    /** Container shell */
    shell: string;
};

/**
 * Remote connection target (SSH or Docker)
 */
export type RemoteConnectionTarget =
    | {
        /** Connection type */
        kind: 'ssh';
        /** SSH profile */
        profile: RemoteSshProfile;
    }
    | {
        /** Connection type */
        kind: 'docker';
        /** Docker container */
        container: RemoteDockerContainer;
    };

/**
 * Terminal multiplexer mode
 */
export type MultiplexerMode = 'tmux' | 'screen';

/**
 * Terminal multiplexer session
 */
export type MultiplexerSession = {
    /** Session ID */
    id: string;
    /** Display label */
    label: string;
    /** Optional session details */
    details?: string;
};

/**
 * Terminal recording event
 */
export type TerminalRecordingEvent = {
    /** Relative timestamp in milliseconds */
    at: number;
    /** Event type */
    type: 'data' | 'exit';
    /** Event data */
    data: string;
};

/**
 * Terminal recording
 */
export type TerminalRecording = {
    /** Recording ID */
    id: string;
    /** Terminal tab ID */
    tabId: string;
    /** Terminal tab name */
    tabName: string;
    /** Recording start timestamp */
    startedAt: number;
    /** Recording end timestamp */
    endedAt: number;
    /** Recording duration in milliseconds */
    durationMs: number;
    /** Recording events */
    events: TerminalRecordingEvent[];
};

/**
 * Terminal semantic issue
 */
export type TerminalSemanticIssue = {
    /** Issue ID */
    id: string;
    /** Terminal tab ID */
    tabId: string;
    /** Issue severity */
    severity: 'error' | 'warning';
    /** Issue message */
    message: string;
    /** Issue timestamp */
    timestamp: number;
};

/**
 * Terminal backend information
 */
export type TerminalBackendInfo = {
    /** Backend ID */
    id: string;
    /** Backend name */
    name: string;
    /** Whether backend is available */
    available: boolean;
};
