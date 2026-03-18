import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import { SecurityService } from '@main/services/security/security.service';
import { SSHKeyManager } from '@main/services/workspace/ssh-key-manager';
import { SSHProfileManager } from '@main/services/workspace/ssh-profile-manager';
import { SSHSessionRecordingManager } from '@main/services/workspace/ssh-session-recording-manager';
import { SSHTunnelManager } from '@main/services/workspace/ssh-tunnel-manager';
import { validateCommand } from '@main/utils/command-validator.util';
import { withRetry } from '@main/utils/retry.util';
import {
    SSHDevContainer,
    SSHExecOptions,
    SSHFile,
    SSHKnownHostEntry,
    SSHManagedKey,
    SSHPackageInfo,
    SSHPortForward,
    SSHProfileTemplate,
    SSHProfileTestResult,
    SSHRemoteSearchResult,
    SSHSearchHistoryEntry,
    SSHSessionRecording,
    SSHSystemStats,
    SSHTransferTask,
    SSHTunnelPreset
} from '@shared/types/ssh';
import { getErrorMessage } from '@shared/utils/error.util';
import { safeStorage } from 'electron';
import { Client, ClientChannel } from 'ssh2';

export interface SSHConnection {
    id: string;
    name: string;
    host: string;
    port: number;
    username: string;
    authType: 'password' | 'key';
    password?: string;
    privateKey?: string;
    passphrase?: string;
    connected: boolean;
    // Enhanced fields
    lastConnected?: number;
    connectionCount?: number;
    isFavorite?: boolean;
    tags?: string[];
    jumpHost?: string; // For SSH tunneling through another host
    forwardAgent?: boolean;
    keepaliveInterval?: number;
    [key: string]: string | number | boolean | string[] | undefined;
}

export type PortForward = SSHPortForward;

export interface SSHConnectionStats {
    bytesReceived: number;
    bytesSent: number;
    commandsExecuted: number;
    connectedAt: number;
    lastActivity: number;
}

interface SSHConnectDiagnostics {
    category: 'auth' | 'network' | 'timeout' | 'key' | 'unknown';
    hint: string;
}

interface ShellSession {
    stream: ClientChannel;
    onData: (data: string) => void;
    onExit: () => void;
}

const SSH_MESSAGE_KEY = {
    NOT_CONNECTED: 'mainProcess.sshService.notConnected',
    CONNECTION_PROFILE_NOT_FOUND: 'mainProcess.sshService.connectionProfileNotFound',
    RECONNECT_ATTEMPTS_EXHAUSTED: 'mainProcess.sshService.reconnectAttemptsExhausted'
} as const;
const SSH_ERROR_MESSAGE = {
    NOT_CONNECTED: 'Not connected',
    CONNECTION_PROFILE_NOT_FOUND: 'Connection profile not found',
    RECONNECT_ATTEMPTS_EXHAUSTED: 'Reconnect attempts exhausted',
    PATH_TRAVERSAL_DETECTED: 'Access denied: Path traversal detected',
    PATH_MUST_BE_ABSOLUTE: 'Access denied: Path must be absolute',
    PATH_MUST_BE_WITHIN_VAR_LOG: 'Access denied: Path must be within /var/log'
} as const;

export class SSHService extends EventEmitter {
    private connections: Map<string, Client> = new Map();
    private connectionDetails: Map<string, SSHConnection> = new Map();
    private connectionStats: Map<string, SSHConnectionStats> = new Map();
    private shellSessions: Map<string, ShellSession> = new Map();
    private connectionPoolRefs: Map<string, number> = new Map();
    private transferQueue: SSHTransferTask[] = [];
    private transferQueueProcessing = false;
    private keepaliveTimers: Map<string, NodeJS.Timeout> = new Map();
    private storagePath: string;
    private initPromise: Promise<void> | null = null;
    // Allowed base directories for file operations (prevents path traversal)
    private allowedBasePaths: string[] = ['/home', '/var', '/tmp', '/opt', '/srv', '/usr/local'];

    private securityService?: SecurityService;

    // Delegated managers
    private keyManager: SSHKeyManager;
    private profileManager: SSHProfileManager;
    private sessionRecordingManager: SSHSessionRecordingManager;
    private _tunnelManager: SSHTunnelManager;
    private readonly onTunnelCreated = (forward: SSHPortForward): void => {
        this.emit('portForwardCreated', forward);
    };
    private readonly onTunnelClosed = (forwardId: string): void => {
        this.emit('portForwardClosed', forwardId);
    };

    /**
     * Get tunnel manager for SSH port forwarding operations
     */
    get tunnelManager(): SSHTunnelManager {
        return this._tunnelManager;
    }

    constructor(storagePath: string, securityService?: SecurityService) {
        super();
        this.securityService = securityService;
        this.storagePath = storagePath;
        this.ensureInitialization().catch(err => appLogger.error('SSHService', 'Init failed', err as Error));
        this.keyManager = new SSHKeyManager(storagePath);
        this.profileManager = new SSHProfileManager({
            storagePath,
            ensureInitialized: () => this.ensureInitialization(),
            encryptCredential: value => this.encryptCredential(value),
            decryptCredential: value => this.decryptCredential(value)
        });
        this.sessionRecordingManager = new SSHSessionRecordingManager();
        this._tunnelManager = new SSHTunnelManager(storagePath);

        // Forward tunnel manager events
        this._tunnelManager.on('portForwardCreated', this.onTunnelCreated);
        this._tunnelManager.on('portForwardClosed', this.onTunnelClosed);
    }

    /**
     * Validates and normalizes a remote path to prevent path traversal attacks.
     * Returns the normalized path if valid, throws if path traversal detected.
     */
    private validateRemotePath(remotePath: string): string {
        // Normalize the path to resolve '..' and '.' segments
        const normalized = path.posix.normalize(remotePath);

        // Check for path traversal attempts that escape allowed directories
        if (normalized.includes('..')) {
            throw new Error(SSH_ERROR_MESSAGE.PATH_TRAVERSAL_DETECTED);
        }

        // Ensure path is absolute
        if (!normalized.startsWith('/')) {
            throw new Error(SSH_ERROR_MESSAGE.PATH_MUST_BE_ABSOLUTE);
        }

        // Check if path starts with an allowed base path
        const isAllowed = this.allowedBasePaths.some(
            base => normalized === base || normalized.startsWith(base + '/')
        );

        if (!isAllowed) {
            throw new Error(
                `Access denied: Path must be within allowed directories: ${this.allowedBasePaths.join(', ')}`
            );
        }

        return normalized;
    }

    /**
     * Encrypt sensitive data using SecurityService (preferred) or Electron's safeStorage (fallback)
     */
    private encryptCredential(value: string): string {
        if (!value) {
            return value;
        }

        if (this.securityService) {
            return this.securityService.encryptSync(value);
        }

        // Fallback for tests or disconnected mode
        if (!safeStorage.isEncryptionAvailable()) {
            return value;
        }
        try {
            return safeStorage.encryptString(value).toString('base64');
        } catch {
            return value;
        }
    }

    /**
     * Decrypt sensitive data using SecurityService (preferred) or Electron's safeStorage (fallback)
     */
    private decryptCredential(value: string): string {
        if (!value) {
            return value;
        }

        if (this.securityService) {
            const result = this.securityService.decryptSync(value);
            return result ?? value;
        }

        // Fallback for tests or disconnected mode
        if (!safeStorage.isEncryptionAvailable()) {
            return value;
        }
        try {
            const buffer = Buffer.from(value, 'base64');
            return safeStorage.decryptString(buffer);
        } catch {
            return value;
        }
    }

    private async ensureInitialization(): Promise<void> {
        if (this.initPromise) {
            return this.initPromise;
        }
        this.initPromise = (async () => {
            try {
                const profilesPath = path.join(this.storagePath, 'ssh-profiles.json');
                await fs.promises.mkdir(this.storagePath, { recursive: true, mode: 0o700 });
                try {
                    await fs.promises.access(profilesPath);
                } catch {
                    await fs.promises.writeFile(profilesPath, JSON.stringify([], null, 2));
                }
            } catch (error) {
                appLogger.error(
                    'SSHService',
                    `Initialization failed: ${getErrorMessage(error as Error)}`
                );
                this.initPromise = null;
                throw error;
            }
        })();
        return this.initPromise;
    }

    async getSavedProfiles(): Promise<SSHConnection[]> {
        return this.profileManager.getSavedProfiles();
    }

    async saveProfile(profile: SSHConnection): Promise<boolean> {
        return this.profileManager.saveProfile(profile);
    }

    /**
     * Get a profile with decrypted credentials
     */
    async getProfileWithCredentials(id: string): Promise<SSHConnection | null> {
        return this.profileManager.getProfileWithCredentials(id);
    }

    /**
     * Toggle favorite status for a profile
     */
    async toggleFavorite(id: string): Promise<boolean> {
        return this.profileManager.toggleFavorite(id);
    }

    /**
     * Get favorite profiles
     */
    async getFavorites(): Promise<SSHConnection[]> {
        return this.profileManager.getFavorites();
    }

    /**
     * Get recent connections sorted by last connected time
     */
    async getRecentConnections(limit: number = 10): Promise<SSHConnection[]> {
        return this.profileManager.getRecentConnections(limit);
    }

    /**
     * Add tags to a profile
     */
    async setProfileTags(id: string, tags: string[]): Promise<boolean> {
        return this.profileManager.setProfileTags(id, tags);
    }

    /**
     * Search profiles by name, host, or tags
     */
    async searchProfiles(query: string): Promise<SSHConnection[]> {
        return this.profileManager.searchProfiles(query);
    }

    async listManagedKeys(): Promise<SSHManagedKey[]> {
        return this.keyManager.listManagedKeys();
    }

    async generateManagedKey(name: string, passphrase?: string): Promise<{
        key: SSHManagedKey;
        privateKey: string;
        publicKey: string;
    }> {
        return this.keyManager.generateManagedKey(name, passphrase);
    }

    async importManagedKey(name: string, privateKey: string, passphrase?: string): Promise<SSHManagedKey> {
        return this.keyManager.importManagedKey(name, privateKey, passphrase);
    }

    async deleteManagedKey(id: string): Promise<boolean> {
        return this.keyManager.deleteManagedKey(id);
    }

    async rotateManagedKey(id: string, nextPassphrase?: string): Promise<SSHManagedKey | null> {
        return this.keyManager.rotateManagedKey(id, nextPassphrase);
    }

    async backupManagedKey(id: string): Promise<{ filename: string; privateKey: string } | null> {
        return this.keyManager.backupManagedKey(id);
    }

    async listKnownHosts(): Promise<SSHKnownHostEntry[]> {
        return this.keyManager.listKnownHosts();
    }

    async addKnownHost(entry: SSHKnownHostEntry): Promise<boolean> {
        return this.keyManager.addKnownHost(entry);
    }

    async removeKnownHost(host: string, keyType?: string): Promise<boolean> {
        return this.keyManager.removeKnownHost(host, keyType);
    }

    async deleteProfile(id: string): Promise<boolean> {
        return this.profileManager.deleteProfile(id);
    }

    private buildConnectDiagnostics(errorMessage: string): SSHConnectDiagnostics {
        const normalized = errorMessage.toLowerCase();
        if (normalized.includes('timed out') || normalized.includes('timeout')) {
            return {
                category: 'timeout',
                hint: 'Connection timed out. Verify host/port reachability and firewall rules.',
            };
        }
        if (
            normalized.includes('all configured authentication methods failed') ||
            normalized.includes('authentication')
        ) {
            return {
                category: 'auth',
                hint: 'Authentication failed. Verify username, password/private key, and passphrase.',
            };
        }
        if (
            normalized.includes('enoent') ||
            normalized.includes('private key') ||
            normalized.includes('key')
        ) {
            return {
                category: 'key',
                hint: 'SSH key could not be loaded. Verify key path and file permissions.',
            };
        }
        if (
            normalized.includes('econnrefused') ||
            normalized.includes('enotfound') ||
            normalized.includes('ehostunreach')
        ) {
            return {
                category: 'network',
                hint: 'Cannot reach SSH host. Verify host, port, and network connectivity.',
            };
        }
        return {
            category: 'unknown',
            hint: 'Unknown SSH failure. Re-test connection and inspect SSH server logs.',
        };
    }

    async connect(config: SSHConnection): Promise<{ success: boolean; error?: string; diagnostics?: SSHConnectDiagnostics }> {
        // Check if already connected
        if (this.connections.has(config.id)) {
            return { success: true };
        }

        let privateKeyContent: Buffer | undefined;
        try {
            if (config.privateKey) {
                privateKeyContent = await fs.promises.readFile(config.privateKey);
            }
        } catch (error) {
            const message = getErrorMessage(error as Error);
            return { success: false, error: message, diagnostics: this.buildConnectDiagnostics(message) };
        }

        return new Promise(resolve => {
            const conn = new Client();
            const keepaliveInterval = config.keepaliveInterval ?? 30000;

            this.setupConnectionHandlers(conn, config, keepaliveInterval, resolve);

            try {
                // Decrypt credentials if needed
                const password = config.password
                    ? this.decryptCredential(config.password)
                    : undefined;
                const passphrase = config.passphrase
                    ? this.decryptCredential(config.passphrase)
                    : undefined;

                conn.connect({
                    host: config.host,
                    port: config.port,
                    username: config.username,
                    password,
                    privateKey: privateKeyContent,
                    passphrase,
                    keepaliveInterval,
                    keepaliveCountMax: 3,
                    readyTimeout: 20000,
                    agentForward: config.forwardAgent,
                });
            } catch (error) {
                const message = getErrorMessage(error as Error);
                resolve({ success: false, error: message, diagnostics: this.buildConnectDiagnostics(message) });
            }
        });
    }

    private setupConnectionHandlers(
        conn: Client,
        config: SSHConnection,
        keepaliveInterval: number,
        resolve: (val: { success: boolean; error?: string; diagnostics?: SSHConnectDiagnostics }) => void
    ) {
        conn.on('ready', () => {
            this.handleConnectionReady(conn, config, keepaliveInterval)
                .then(() => resolve({ success: true }))
                .catch(err => {
                    const message = getErrorMessage(err as Error);
                    appLogger.error(
                        'SSHService',
                        `Error in ready handler for ${config.id}: ${message}`
                    );
                    resolve({ success: false, error: message, diagnostics: this.buildConnectDiagnostics(message) });
                });
        })
            .on('error', (err: Error) => {
                this.emit('error', { id: config.id, message: err.message });
                resolve({ success: false, error: err.message, diagnostics: this.buildConnectDiagnostics(err.message) });
            })
            .on('close', () => {
                this.cleanupConnection(config.id);
            });
    }

    private async handleConnectionReady(
        conn: Client,
        config: SSHConnection,
        keepaliveInterval: number
    ) {
        this.connections.set(config.id, conn);
        this.connectionDetails.set(config.id, { ...config, connected: true });

        // Initialize connection stats
        this.connectionStats.set(config.id, {
            bytesReceived: 0,
            bytesSent: 0,
            commandsExecuted: 0,
            connectedAt: Date.now(),
            lastActivity: Date.now(),
        });

        // Setup keepalive
        const timer = setInterval(() => {
            conn.exec('echo keepalive', () => { });
        }, keepaliveInterval);
        this.keepaliveTimers.set(config.id, timer);

        // Update profile with connection history
        await this.updateConnectionHistory(config.id);

        this.emit('connected', config.id);
    }

    private async updateConnectionHistory(connectionId: string) {
        await this.profileManager.updateConnectionHistory(connectionId);
    }

    private cleanupConnection(connectionId: string) {
        const timer = this.keepaliveTimers.get(connectionId);
        if (timer) {
            clearInterval(timer);
        }
        this.keepaliveTimers.delete(connectionId);
        this.connections.delete(connectionId);
        this.connectionDetails.delete(connectionId);
        this.connectionStats.delete(connectionId);
        this.shellSessions.delete(connectionId);
        this.emit('disconnected', connectionId);
    }

    /**
     * Get connection statistics
     */
    getConnectionStats(connectionId: string): SSHConnectionStats | null {
        return this.connectionStats.get(connectionId) ?? null;
    }

    async disconnect(connectionId: string): Promise<boolean> {
        const conn = this.connections.get(connectionId);
        if (conn) {
            conn.end();
            this.connections.delete(connectionId);
            this.connectionDetails.delete(connectionId);
            return true;
        }
        return false;
    }

    getAllConnections(): SSHConnection[] {
        return Array.from(this.connectionDetails.values());
    }

    isConnected(connectionId: string): boolean {
        return this.connections.has(connectionId);
    }

    async executeCommand(
        connectionId: string,
        command: string,
        options?: SSHExecOptions
    ): Promise<{ stdout: string; stderr: string; code: number }> {
        const validation = validateCommand(command);
        if (!validation.allowed) {
            throw new Error(`Command blocked: ${validation.reason}`);
        }

        const conn = this.connections.get(connectionId);
        if (!conn) {
            throw new Error(SSH_ERROR_MESSAGE.NOT_CONNECTED);
        }

        // Update stats
        const stats = this.connectionStats.get(connectionId);
        if (stats) {
            stats.commandsExecuted++;
            stats.lastActivity = Date.now();
            stats.bytesSent += command.length;
        }

        return new Promise((resolve, reject) => {
            const execOptions: Record<string, RuntimeValue> = {};
            if (options?.env) {
                execOptions.env = options.env;
            }
            if (options?.pty) {
                execOptions.pty = true;
            }

            conn.exec(command, execOptions, (err, stream) => {
                if (err) {
                    return reject(err);
                }
                let stdout = '';
                let stderr = '';

                // Handle timeout
                let timeout: NodeJS.Timeout | null = null;
                if (options?.timeout) {
                    timeout = setTimeout(() => {
                        stream.close();
                        reject(new Error('Command timed out'));
                    }, options.timeout);
                }

                stream
                    .on('close', (code: number) => {
                        if (timeout) {
                            clearTimeout(timeout);
                        }
                        // Update bytes received
                        if (stats) {
                            stats.bytesReceived += stdout.length + stderr.length;
                        }
                        resolve({ stdout, stderr, code });
                    })
                    .on('data', (data: Buffer | string) => {
                        stdout += data.toString();
                    })
                    .stderr.on('data', (data: Buffer | string) => {
                        stderr += data.toString();
                    });
            });
        });
    }

    /**
     * Execute command with streaming output
     */
    async executeCommandStreaming(
        connectionId: string,
        command: string,
        onStdout: (data: string) => void,
        onStderr: (data: string) => void,
        options?: SSHExecOptions
    ): Promise<number> {
        const validation = validateCommand(command);
        if (!validation.allowed) {
            throw new Error(`Command blocked: ${validation.reason}`);
        }

        const conn = this.connections.get(connectionId);
        if (!conn) {
            throw new Error(SSH_ERROR_MESSAGE.NOT_CONNECTED);
        }

        const stats = this.connectionStats.get(connectionId);
        if (stats) {
            stats.commandsExecuted++;
            stats.lastActivity = Date.now();
        }

        return new Promise((resolve, reject) => {
            const execOptions: Record<string, RuntimeValue> = {};
            if (options?.env) {
                execOptions.env = options.env;
            }
            if (options?.pty) {
                execOptions.pty = true;
            }

            conn.exec(command, execOptions, (err, stream) => {
                if (err) {
                    return reject(err);
                }

                stream
                    .on('close', (code: number) => {
                        resolve(code);
                    })
                    .on('data', (data: Buffer | string) => {
                        onStdout(data.toString());
                    })
                    .stderr.on('data', (data: Buffer | string) => {
                        onStderr(data.toString());
                    });
            });
        });
    }

    async listDirectory(
        connectionId: string,
        dirPath: string
    ): Promise<{ success: boolean; files?: SSHFile[]; error?: string }> {
        const conn = this.connections.get(connectionId);
        if (!conn) {
            throw new Error(SSH_ERROR_MESSAGE.NOT_CONNECTED);
        }

        const validPath = this.validateRemotePath(dirPath);
        return new Promise(resolve => {
            conn.sftp((err, sftp) => {
                if (err) {
                    return resolve({ success: false, error: err.message });
                }
                sftp.readdir(validPath, (err, list) => {
                    if (err) {
                        return resolve({ success: false, error: err.message });
                    }
                    const files = list.map(entry => this.mapSftpEntry(entry));
                    resolve({ success: true, files });
                });
            });
        });
    }

    private mapSftpEntry(entry: {
        filename: string;
        longname: string;
        attrs: {
            size: number;
            mtime: number;
            isDirectory?: () => boolean;
        };
    }): SSHFile {
        const permissions =
            typeof entry.longname === 'string' ? entry.longname.split(/\s+/)[0] : undefined;
        const size = entry.attrs.size;
        const mtime = entry.attrs.mtime;
        const isDirectory =
            typeof entry.attrs.isDirectory === 'function'
                ? entry.attrs.isDirectory()
                : typeof entry.longname === 'string'
                    ? entry.longname.startsWith('d')
                    : false;
        return {
            name: entry.filename,
            isDirectory,
            size,
            mtime,
            permissions,
        };
    }

    async readFile(connectionId: string, filePath: string): Promise<string> {
        const conn = this.connections.get(connectionId);
        if (!conn) {
            throw new Error(SSH_ERROR_MESSAGE.NOT_CONNECTED);
        }

        const validPath = this.validateRemotePath(filePath);
        return new Promise((resolve, reject) => {
            conn.sftp((err, sftp) => {
                if (err) {
                    return reject(err);
                }
                const stream = sftp.createReadStream(validPath);
                let data = '';
                stream.on('data', (d: Buffer | string) => (data += d.toString()));
                stream.on('end', () => resolve(data));
                stream.on('error', (err: Error) => reject(err));
            });
        });
    }

    async writeFile(connectionId: string, filePath: string, content: string): Promise<boolean> {
        const conn = this.connections.get(connectionId);
        if (!conn) {
            throw new Error(SSH_ERROR_MESSAGE.NOT_CONNECTED);
        }

        const validPath = this.validateRemotePath(filePath);
        return new Promise((resolve, reject) => {
            conn.sftp((err, sftp) => {
                if (err) {
                    return reject(err);
                }
                const stream = sftp.createWriteStream(validPath);
                stream.write(content);
                stream.end();
                stream.on('close', () => resolve(true));
                stream.on('error', (err: Error) => reject(err));
            });
        });
    }

    async deleteDirectory(connectionId: string, dirPath: string): Promise<boolean> {
        const conn = this.connections.get(connectionId);
        if (!conn) {
            throw new Error(SSH_ERROR_MESSAGE.NOT_CONNECTED);
        }

        const validPath = this.validateRemotePath(dirPath);
        return new Promise((resolve, reject) => {
            conn.sftp((err, sftp) => {
                if (err) {
                    return reject(err);
                }
                sftp.rmdir(validPath, err => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(true);
                });
            });
        });
    }

    async deleteFile(connectionId: string, filePath: string): Promise<boolean> {
        const conn = this.connections.get(connectionId);
        if (!conn) {
            throw new Error(SSH_ERROR_MESSAGE.NOT_CONNECTED);
        }

        const validPath = this.validateRemotePath(filePath);
        return new Promise((resolve, reject) => {
            conn.sftp((err, sftp) => {
                if (err) {
                    return reject(err);
                }
                sftp.unlink(validPath, err => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(true);
                });
            });
        });
    }

    async createDirectory(connectionId: string, dirPath: string): Promise<boolean> {
        const conn = this.connections.get(connectionId);
        if (!conn) {
            throw new Error(SSH_ERROR_MESSAGE.NOT_CONNECTED);
        }

        const validPath = this.validateRemotePath(dirPath);
        return new Promise((resolve, reject) => {
            conn.sftp((err, sftp) => {
                if (err) {
                    return reject(err);
                }
                sftp.mkdir(validPath, err => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(true);
                });
            });
        });
    }

    async rename(connectionId: string, oldPath: string, newPath: string): Promise<boolean> {
        const conn = this.connections.get(connectionId);
        if (!conn) {
            throw new Error(SSH_ERROR_MESSAGE.NOT_CONNECTED);
        }

        const validOldPath = this.validateRemotePath(oldPath);
        const validNewPath = this.validateRemotePath(newPath);
        return new Promise((resolve, reject) => {
            conn.sftp((err, sftp) => {
                if (err) {
                    return reject(err);
                }
                sftp.rename(validOldPath, validNewPath, err => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(true);
                });
            });
        });
    }

    /** Minimum interval between progress emissions (ms) */
    private static readonly PROGRESS_THROTTLE_MS = 100;

    async uploadFile(
        connectionId: string,
        localPath: string,
        remotePath: string,
        onProgress?: (transferred: number, total: number) => void
    ): Promise<boolean> {
        const conn = this.connections.get(connectionId);
        if (!conn) {
            throw new Error(SSH_ERROR_MESSAGE.NOT_CONNECTED);
        }

        const validRemotePath = this.validateRemotePath(remotePath);

        // Throttle progress updates to prevent event flooding
        let lastProgressTime = 0;
        let lastTransferred = 0;
        let lastTotal = 0;

        const throttledProgress = (transferred: number, total: number) => {
            const now = Date.now();
            // Always emit on first call, last call (transferred === total), or throttled interval
            if (transferred === 0 || transferred === total ||
                now - lastProgressTime >= SSHService.PROGRESS_THROTTLE_MS) {
                lastProgressTime = now;
                lastTransferred = transferred;
                lastTotal = total;
                if (onProgress) {
                    onProgress(transferred, total);
                }
            }
        };

        return new Promise((resolve, reject) => {
            conn.sftp((err, sftp) => {
                if (err) {
                    return reject(err);
                }

                // Emit initial progress
                throttledProgress(0, 0);

                // Use fastPut for efficiency
                sftp.fastPut(
                    localPath,
                    validRemotePath,
                    {
                        step: (transferred, _chunk, total) => {
                            throttledProgress(transferred, total);
                        },
                    },
                    err => {
                        if (err) {
                            return reject(err);
                        }
                        // Emit final progress to ensure 100%
                        if (onProgress) {
                            onProgress(lastTransferred, lastTotal);
                        }
                        resolve(true);
                    }
                );
            });
        });
    }

    async downloadFile(
        connectionId: string,
        remotePath: string,
        localPath: string,
        onProgress?: (transferred: number, total: number) => void
    ): Promise<boolean> {
        const conn = this.connections.get(connectionId);
        if (!conn) {
            throw new Error(SSH_ERROR_MESSAGE.NOT_CONNECTED);
        }

        const validRemotePath = this.validateRemotePath(remotePath);

        // Throttle progress updates to prevent event flooding
        let lastProgressTime = 0;
        let lastTransferred = 0;
        let lastTotal = 0;

        const throttledProgress = (transferred: number, total: number) => {
            const now = Date.now();
            // Always emit on first call, last call (transferred === total), or throttled interval
            if (transferred === 0 || transferred === total ||
                now - lastProgressTime >= SSHService.PROGRESS_THROTTLE_MS) {
                lastProgressTime = now;
                lastTransferred = transferred;
                lastTotal = total;
                if (onProgress) {
                    onProgress(transferred, total);
                }
            }
        };

        return new Promise((resolve, reject) => {
            conn.sftp((err, sftp) => {
                if (err) {
                    return reject(err);
                }

                // Emit initial progress
                throttledProgress(0, 0);

                sftp.fastGet(
                    validRemotePath,
                    localPath,
                    {
                        step: (transferred, _chunk, total) => {
                            throttledProgress(transferred, total);
                        },
                    },
                    err => {
                        if (err) {
                            return reject(err);
                        }
                        // Emit final progress to ensure 100%
                        if (onProgress) {
                            onProgress(lastTransferred, lastTotal);
                        }
                        resolve(true);
                    }
                );
            });
        });
    }

    async startShell(
        connectionId: string,
        onData: (data: string) => void,
        onExit: () => void
    ): Promise<{
        success: boolean;
        error?: string;
        messageKey?: string;
        messageParams?: Record<string, string | number>;
    }> {
        const conn = this.connections.get(connectionId);
        if (!conn) {
            return {
                success: false,
                error: SSH_ERROR_MESSAGE.NOT_CONNECTED,
                messageKey: SSH_MESSAGE_KEY.NOT_CONNECTED
            };
        }

        // Check if shell already exists
        if (this.shellSessions.has(connectionId)) {
            return { success: true };
        }

        return new Promise(resolve => {
            conn.shell({ term: 'xterm-256color' }, (err, stream) => {
                if (err) {
                    resolve({ success: false, error: err.message });
                    return;
                }

                this.shellSessions.set(connectionId, { stream, onData, onExit });

                stream.on('data', (data: Buffer | string) => {
                    const chunk = data.toString();
                    this.appendRecordingChunk(connectionId, chunk);
                    onData(chunk);
                });

                stream.on('close', () => {
                    this.shellSessions.delete(connectionId);
                    onExit();
                });

                resolve({ success: true });
            });
        });
    }

    /**
     * Resize the shell terminal
     */
    resizeShell(connectionId: string, cols: number, rows: number): boolean {
        const session = this.shellSessions.get(connectionId);
        if (!session) {
            return false;
        }

        session.stream.setWindow(rows, cols, 0, 0);
        return true;
    }

    /**
     * Write data to the shell session
     */
    writeToShell(connectionId: string, data: string): boolean {
        const session = this.shellSessions.get(connectionId);
        if (!session) {
            return false;
        }

        session.stream.write(data);
        return true;
    }

    /**
     * Close the shell session
     */
    closeShell(connectionId: string): boolean {
        const session = this.shellSessions.get(connectionId);
        if (!session) {
            return false;
        }

        session.stream.close();
        this.shellSessions.delete(connectionId);
        return true;
    }

    async getLogFiles(connectionId: string): Promise<string[]> {
        const conn = this.connections.get(connectionId);
        if (!conn) {
            throw new Error(SSH_ERROR_MESSAGE.NOT_CONNECTED);
        }

        // List common log locations
        try {
            const cmd = `find /var/log -maxdepth 2 -name "*.log" -o -name "syslog" -o -name "messages" | head -n 20`;
            const { stdout } = await this.executeCommand(connectionId, cmd);
            return stdout.split('\n').filter(l => l.trim());
        } catch (e) {
            appLogger.error(
                'SSHService',
                `Failed to get log files: ${getErrorMessage(e as Error)}`
            );
            return [];
        }
    }

    async readLogFile(connectionId: string, filePath: string, lines: number = 50): Promise<string> {
        const conn = this.connections.get(connectionId);
        if (!conn) {
            throw new Error(SSH_ERROR_MESSAGE.NOT_CONNECTED);
        }

        // Normalize path to resolve '..' segments
        // We use path.posix because SSH targets are typically Linux/Unix
        const normalizedPath = path.posix.normalize(filePath);

        // Ensure it starts with /var/log
        if (!normalizedPath.startsWith('/var/log/') && normalizedPath !== '/var/log') {
            throw new Error(SSH_ERROR_MESSAGE.PATH_MUST_BE_WITHIN_VAR_LOG);
        }

        // Safe quoting for shell command
        // Replace single quotes with '"'"' to breaks out of single quotes, insert a single quote, and resume
        const safePath = `'${normalizedPath.replace(/'/g, "'\"'\"'")}'`;

        const { stdout } = await this.executeCommand(connectionId, `tail -n ${lines} ${safePath}`);
        return stdout;
    }

    sendShellData(connectionId: string, data: string): boolean {
        const session = this.shellSessions.get(connectionId);
        if (!session) {
            return false;
        }

        session.stream.write(data);

        // Update stats
        const stats = this.connectionStats.get(connectionId);
        if (stats) {
            stats.bytesSent += data.length;
            stats.lastActivity = Date.now();
        }

        return true;
    }

    /**
     * Create a local port forward (local -> remote)
     */
    async createLocalForward(
        connectionId: string,
        localHost: string,
        localPort: number,
        remoteHost: string,
        remotePort: number
    ): Promise<{
        success: boolean;
        forwardId?: string;
        error?: string;
        messageKey?: string;
        messageParams?: Record<string, string | number>;
    }> {
        const conn = this.connections.get(connectionId);
        if (!conn) {
            return {
                success: false,
                error: SSH_ERROR_MESSAGE.NOT_CONNECTED,
                messageKey: SSH_MESSAGE_KEY.NOT_CONNECTED
            };
        }

        return this._tunnelManager.createLocalForward({
            connectionId,
            conn,
            localHost,
            localPort,
            remoteHost,
            remotePort
        });
    }

    async createRemoteForward(
        connectionId: string,
        remoteHost: string,
        remotePort: number,
        localHost: string,
        localPort: number
    ): Promise<{
        success: boolean;
        forwardId?: string;
        error?: string;
        messageKey?: string;
        messageParams?: Record<string, string | number>;
    }> {
        const conn = this.connections.get(connectionId);
        if (!conn) {
            return {
                success: false,
                error: SSH_ERROR_MESSAGE.NOT_CONNECTED,
                messageKey: SSH_MESSAGE_KEY.NOT_CONNECTED
            };
        }

        return this._tunnelManager.createRemoteForward({
            connectionId,
            conn,
            remoteHost,
            remotePort,
            localHost,
            localPort
        });
    }

    async createDynamicForward(
        connectionId: string,
        localHost: string,
        localPort: number
    ): Promise<{
        success: boolean;
        forwardId?: string;
        error?: string;
        messageKey?: string;
        messageParams?: Record<string, string | number>;
    }> {
        const conn = this.connections.get(connectionId);
        if (!conn) {
            return {
                success: false,
                error: SSH_ERROR_MESSAGE.NOT_CONNECTED,
                messageKey: SSH_MESSAGE_KEY.NOT_CONNECTED
            };
        }

        return this._tunnelManager.createDynamicForward(connectionId, conn, localHost, localPort);
    }

    async saveTunnelPreset(preset: Omit<SSHTunnelPreset, 'id' | 'createdAt' | 'updatedAt'>): Promise<SSHTunnelPreset> {
        return this._tunnelManager.saveTunnelPreset(preset);
    }

    async listTunnelPresets(): Promise<SSHTunnelPreset[]> {
        return this._tunnelManager.listTunnelPresets();
    }

    async deleteTunnelPreset(id: string): Promise<boolean> {
        return this._tunnelManager.deleteTunnelPreset(id);
    }

    /**
     * Get all active port forwards
     */
    getPortForwards(connectionId?: string): SSHPortForward[] {
        const allForwards = this._tunnelManager.getAllPortForwards();
        if (connectionId) {
            return allForwards.filter(f => f.connectionId === connectionId);
        }
        return allForwards;
    }

    /**
     * Close a port forward
     */
    async closePortForward(forwardId: string): Promise<boolean> {
        return await this._tunnelManager.closePortForward(forwardId);
    }

    /**
     * Disconnect all connections and cleanup
     */
    async disconnectAll(): Promise<void> {
        // Close all port forwards
        const forwards = this._tunnelManager.getAllPortForwards();
        for (const forward of forwards) {
            await this._tunnelManager.closePortForward(forward.id);
        }

        // Close all connections
        for (const [id, conn] of this.connections) {
            try {
                conn.end();
            } catch (e) {
                appLogger.error(
                    'SSHService',
                    `Error disconnecting ${id}: ${getErrorMessage(e as Error)}`
                );
            }
        }

        // Clear all timers
        for (const timer of this.keepaliveTimers.values()) {
            clearInterval(timer);
        }

        this.connections.clear();
        this.connectionDetails.clear();
        this.connectionStats.clear();
        this.shellSessions.clear();
        this.keepaliveTimers.clear();
        this.emit('connectionsChanged', []);
    }

    async dispose(): Promise<void> {
        await this.disconnectAll();
        this.sessionRecordingManager.clear();
        this._tunnelManager.off('portForwardCreated', this.onTunnelCreated);
        this._tunnelManager.off('portForwardClosed', this.onTunnelClosed);
        await this._tunnelManager.dispose();
        this.removeAllListeners();
    }

    async getSystemStats(connectionId: string): Promise<SSHSystemStats> {
        try {
            const uptime = (await this.executeCommand(connectionId, 'uptime -p')).stdout.trim();
            const memoryOutput = (await this.executeCommand(connectionId, 'free -m')).stdout;
            const cpuOutput = (await this.executeCommand(connectionId, 'top -bn1 | grep "Cpu(s)"'))
                .stdout;
            const diskOutput = (await this.executeCommand(connectionId, 'df -h /')).stdout;

            return {
                uptime,
                memory: this.parseMemoryStats(memoryOutput),
                cpu: this.parseCpuStats(cpuOutput),
                disk: this.parseDiskStats(diskOutput),
            };
        } catch (error) {
            const message = getErrorMessage(error as Error);
            appLogger.error('SSHService', `Failed to get system stats: ${message}`);
            return {
                error: message,
                uptime: '-',
                memory: { total: 0, used: 0, percent: 0 },
                cpu: 0,
                disk: '0%',
            };
        }
    }

    private parseMemoryStats(output: string) {
        const lines = output.split('\n');
        const values = lines[1]?.split(/\s+/).filter(Boolean) ?? [];
        const total = parseInt(values[1] ?? '0');
        const used = parseInt(values[2] ?? '0');
        return { total, used, percent: total ? Math.round((used / total) * 100) : 0 };
    }

    private parseCpuStats(output: string): number {
        return parseFloat(output.split(',')[0].replace('Cpu(s):', '').trim()) || 0;
    }

    private parseDiskStats(output: string): string {
        const lines = output.split('\n');
        const values = lines[1]?.split(/\s+/).filter(Boolean) ?? [];
        return values[4] ?? '0%';
    }

    async getInstalledPackages(
        connectionId: string,
        manager: 'apt' | 'npm' | 'pip' = 'apt'
    ): Promise<SSHPackageInfo[]> {
        try {
            let command = '';
            switch (manager) {
                case 'apt':
                    command = 'apt list --installed';
                    break;
                case 'npm':
                    command = 'npm list -g --depth=0';
                    break;
                case 'pip':
                    command = 'pip list';
                    break;
                default:
                    return [];
            }

            const result = await this.executeCommand(connectionId, command);
            const lines = result.stdout.split('\n');

            if (manager === 'apt') {
                return lines
                    .slice(1)
                    .map(l => {
                        const parts = l.split('/');
                        return parts[0] ? { name: parts[0], version: 'latest' } : null;
                    })
                    .filter((p): p is SSHPackageInfo => p !== null);
            }
            if (manager === 'npm') {
                return lines
                    .slice(1)
                    .map(l => {
                        const parts = l.split('@');
                        return parts[0]
                            ? {
                                name: parts[0].trim().replace(/^.* /, ''),
                                version: parts[1]?.trim() || 'unknown',
                            }
                            : null;
                    })
                    .filter((p): p is SSHPackageInfo => p !== null);
            }
            // manager is guaranteed to be 'pip' here
            return lines
                .slice(2)
                .map(l => {
                    const parts = l.split(/\s+/);
                    return parts[0] ? { name: parts[0], version: parts[1] || 'unknown' } : null;
                })
                .filter((p): p is SSHPackageInfo => p !== null);

            return [];
        } catch (error) {
            appLogger.error(
                'SSHService',
                `Failed to get packages: ${getErrorMessage(error as Error)}`
            );
            return [];
        }
    }

    async searchRemoteFiles(
        connectionId: string,
        query: string,
        options?: { path?: string; contentSearch?: boolean; limit?: number }
    ): Promise<SSHRemoteSearchResult[]> {
        const rootPath = this.validateRemotePath(options?.path ?? '/home');
        const limit = Math.max(1, Math.min(options?.limit ?? 100, 500));
        const escaped = query.replace(/'/g, "'\"'\"'");
        const command = options?.contentSearch
            ? `grep -R -n -- '${escaped}' '${rootPath}' 2>/dev/null | head -n ${limit}`
            : `find '${rootPath}' -iname '*${escaped}*' 2>/dev/null | head -n ${limit}`;
        const { stdout } = await this.executeCommand(connectionId, command);
        const results = stdout.split('\n').filter(Boolean).map(line => {
            if (!options?.contentSearch) {
                return { path: line.trim() };
            }
            const firstColon = line.indexOf(':');
            const secondColon = line.indexOf(':', firstColon + 1);
            if (firstColon < 0 || secondColon < 0) {
                return { path: line.trim() };
            }
            return {
                path: line.slice(0, firstColon),
                line: Number.parseInt(line.slice(firstColon + 1, secondColon), 10),
                content: line.slice(secondColon + 1)
            };
        });
        await this.profileManager.recordSearchHistory(query, connectionId);
        return results;
    }

    async getSearchHistory(connectionId?: string): Promise<SSHSearchHistoryEntry[]> {
        return this.profileManager.getSearchHistory(connectionId);
    }

    async exportSearchHistory(): Promise<string> {
        return this.profileManager.exportSearchHistory();
    }

    async reconnectConnection(connectionId: string, maxRetries: number = 3): Promise<{
        success: boolean;
        error?: string;
        messageKey?: string;
        messageParams?: Record<string, string | number>;
    }> {
        const active = this.connectionDetails.get(connectionId);
        const fallback = await this.getProfileWithCredentials(connectionId);
        const config = active ?? fallback;
        if (!config) {
            return {
                success: false,
                error: SSH_ERROR_MESSAGE.CONNECTION_PROFILE_NOT_FOUND,
                messageKey: SSH_MESSAGE_KEY.CONNECTION_PROFILE_NOT_FOUND
            };
        }
        try {
            return await withRetry(
                async () => {
                    const result = await this.connect({ ...config, id: connectionId });
                    if (!result.success) {
                        throw new Error(result.error ?? 'Connection failed');
                    }
                    return result;
                },
                { maxRetries: maxRetries - 1, baseDelayMs: 1000 }
            );
        } catch {
            return {
                success: false,
                error: SSH_ERROR_MESSAGE.RECONNECT_ATTEMPTS_EXHAUSTED,
                messageKey: SSH_MESSAGE_KEY.RECONNECT_ATTEMPTS_EXHAUSTED
            };
        }
    }

    async acquireConnection(connectionId: string): Promise<{
        success: boolean;
        error?: string;
        messageKey?: string;
        messageParams?: Record<string, string | number>;
    }> {
        const refs = this.connectionPoolRefs.get(connectionId) ?? 0;
        this.connectionPoolRefs.set(connectionId, refs + 1);
        if (this.isConnected(connectionId)) {
            return { success: true };
        }
        return this.reconnectConnection(connectionId, 1);
    }

    async releaseConnection(connectionId: string): Promise<boolean> {
        const refs = this.connectionPoolRefs.get(connectionId) ?? 0;
        if (refs <= 1) {
            this.connectionPoolRefs.delete(connectionId);
            return this.disconnect(connectionId);
        }
        this.connectionPoolRefs.set(connectionId, refs - 1);
        return true;
    }

    getConnectionPoolStats(): Array<{ connectionId: string; refs: number }> {
        return Array.from(this.connectionPoolRefs.entries()).map(([connectionId, refs]) => ({ connectionId, refs }));
    }

    async enqueueTransfer(task: SSHTransferTask): Promise<void> {
        this.transferQueue.push(task);
        if (!this.transferQueueProcessing) {
            await this.processTransferQueue();
        }
    }

    getTransferQueue(): SSHTransferTask[] {
        return [...this.transferQueue];
    }

    private async processTransferQueue(): Promise<void> {
        this.transferQueueProcessing = true;
        while (this.transferQueue.length > 0) {
            const task = this.transferQueue.shift();
            if (!task) {
                continue;
            }
            await this.executeTransferTask(task);
        }
        this.transferQueueProcessing = false;
    }

    private async executeTransferTask(task: SSHTransferTask): Promise<boolean> {
        if (task.direction === 'upload') {
            return this.uploadFile(task.connectionId, task.localPath, task.remotePath);
        }
        return this.downloadFile(task.connectionId, task.remotePath, task.localPath);
    }

    async runTransferBatch(tasks: SSHTransferTask[], concurrency: number = 2): Promise<boolean[]> {
        const limit = Math.max(1, Math.min(concurrency, 8));
        const results: boolean[] = new Array(tasks.length).fill(false);
        let cursor = 0;
        const workers = Array.from({ length: limit }, async () => {
            while (cursor < tasks.length) {
                const index = cursor;
                cursor += 1;
                results[index] = await this.executeTransferTask(tasks[index]);
            }
        });
        await Promise.all(workers);
        return results;
    }

    async listRemoteContainers(connectionId: string): Promise<SSHDevContainer[]> {
        const { stdout } = await this.executeCommand(
            connectionId,
            "docker ps -a --format '{{.ID}}|{{.Image}}|{{.Status}}|{{.Names}}'"
        );
        return stdout.split('\n').filter(Boolean).map(line => {
            const [id, image, status, names] = line.split('|');
            return { id: id ?? '', image: image ?? '', status: status ?? '', names: names ?? '' };
        });
    }

    async runRemoteContainer(
        connectionId: string,
        image: string,
        name: string,
        ports?: Array<{ hostPort: number; containerPort: number }>
    ): Promise<{ success: boolean; id?: string; error?: string }> {
        const portFlags = (ports ?? []).map(port => `-p ${port.hostPort}:${port.containerPort}`).join(' ');
        const command = `docker run -d --name ${name} ${portFlags} ${image}`.trim();
        const { stdout, code, stderr } = await this.executeCommand(connectionId, command);
        return code === 0 ? { success: true, id: stdout.trim() } : { success: false, error: stderr || 'Failed to start container' };
    }

    async stopRemoteContainer(connectionId: string, containerId: string): Promise<boolean> {
        const { code } = await this.executeCommand(connectionId, `docker stop ${containerId}`);
        return code === 0;
    }

    async saveProfileTemplate(template: Omit<SSHProfileTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<SSHProfileTemplate> {
        return this.profileManager.saveProfileTemplate(template);
    }

    async listProfileTemplates(): Promise<SSHProfileTemplate[]> {
        return this.profileManager.listProfileTemplates();
    }

    async deleteProfileTemplate(id: string): Promise<boolean> {
        return this.profileManager.deleteProfileTemplate(id);
    }

    async exportProfiles(ids?: string[]): Promise<string> {
        return this.profileManager.exportProfiles(ids);
    }

    async importProfiles(payload: string): Promise<number> {
        return this.profileManager.importProfiles(payload);
    }

    validateProfile(profile: Partial<SSHConnection>): { valid: boolean; errors: string[] } {
        return this.profileManager.validateProfile(profile);
    }

    async testProfile(profile: Partial<SSHConnection>): Promise<SSHProfileTestResult> {
        return this.profileManager.testProfile(profile);
    }

    startSessionRecording(connectionId: string): SSHSessionRecording {
        return this.sessionRecordingManager.start(connectionId);
    }

    stopSessionRecording(connectionId: string): SSHSessionRecording | null {
        return this.sessionRecordingManager.stop(connectionId);
    }

    private appendRecordingChunk(connectionId: string, chunk: string): void {
        this.sessionRecordingManager.append(connectionId, chunk);
    }

    getSessionRecording(connectionId: string): SSHSessionRecording | null {
        return this.sessionRecordingManager.get(connectionId);
    }

    searchSessionRecording(connectionId: string, query: string): string[] {
        return this.sessionRecordingManager.search(connectionId, query);
    }

    exportSessionRecording(connectionId: string): string {
        return this.sessionRecordingManager.export(connectionId);
    }

    listSessionRecordings(): SSHSessionRecording[] {
        return this.sessionRecordingManager.list();
    }
}


