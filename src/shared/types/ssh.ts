export interface SSHConnection {
    id: string
    name: string
    host: string
    port: number
    username: string
    status: 'connected' | 'disconnected' | 'connecting' | 'error'
    error?: string
    authType?: 'password' | 'key'
    password?: string
    privateKey?: string
    passphrase?: string
}

export interface SSHConfig {
    name: string
    host: string
    port: number
    username: string
    password?: string
    privateKey?: string
}

export interface SSHFile {
    name: string;
    isDirectory: boolean;
    size?: number;
    mtime?: number;
    permissions?: string;
}

export interface SSHExecOptions {
    cwd?: string;
    env?: Record<string, string>;
    pty?: boolean;
    timeout?: number;
}

export interface SSHDiskStat {
    filesystem: string;
    used: string;
    total: string;
    percent: string;
}

export interface SSHSystemStats {
    uptime: string;
    memory: { total: number; used: number; percent: number };
    cpu: number;
    disk: string | SSHDiskStat[];
    error?: string;
}

export interface SSHPackageInfo {
    name: string;
    version: string;
    status?: string;
}

export interface SSHManagedKey {
    id: string;
    name: string;
    algorithm: 'ed25519';
    publicKey: string;
    fingerprint: string;
    hasPassphrase: boolean;
    createdAt: number;
    updatedAt: number;
    rotationCount: number;
}

export interface SSHKnownHostEntry {
    host: string;
    keyType: string;
    publicKey: string;
}

export interface SSHPortForward {
    id: string;
    connectionId: string;
    type: 'local' | 'remote' | 'dynamic';
    localHost: string;
    localPort: number;
    remoteHost: string;
    remotePort: number;
    active: boolean;
}

export interface SSHTunnelPreset {
    id: string;
    name: string;
    type: 'local' | 'remote' | 'dynamic';
    localHost: string;
    localPort: number;
    remoteHost: string;
    remotePort: number;
    createdAt: number;
    updatedAt: number;
}

export interface SSHProfileValidationResult {
    valid: boolean;
    errors: string[];
}

export interface SSHProfileTestResult {
    success: boolean;
    latencyMs: number;
    authMethod: 'password' | 'key';
    message: string;
    error?: string;
    errorCode?: string;
    uiState?: 'ready' | 'failure' | 'empty';
}

export interface SSHRemoteSearchRequest {
    query: string;
    rootPath?: string;
    contentSearch?: boolean;
    caseSensitive?: boolean;
    regex?: boolean;
    limit?: number;
}

export interface SSHRemoteSearchResult {
    path: string;
    line?: number;
    content?: string;
}

export interface SSHSearchHistoryEntry {
    id: string;
    query: string;
    createdAt: number;
    connectionId: string;
}

export interface SSHTransferTask {
    id: string;
    connectionId: string;
    direction: 'upload' | 'download';
    localPath: string;
    remotePath: string;
}

export interface SSHDevContainer {
    id: string;
    image: string;
    status: string;
    names: string;
}

export interface SSHProfileTemplate {
    id: string;
    name: string;
    port: number;
    username: string;
    tags?: string[];
    createdAt: number;
    updatedAt: number;
}

export interface SSHSessionRecording {
    id: string;
    connectionId: string;
    startedAt: number;
    endedAt?: number;
    chunks: string[];
}
