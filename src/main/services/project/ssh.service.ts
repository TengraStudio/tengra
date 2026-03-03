import * as crypto from 'crypto';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import { SSHKeyManager } from '@main/services/project/ssh-key-manager';
import { SSHTunnelManager } from '@main/services/project/ssh-tunnel-manager';
import { SecurityService } from '@main/services/security/security.service';
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
import { safeJsonParse } from '@shared/utils/sanitize.util';
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

// StoredTunnelPreset moved to SSHTunnelManager
type StoredSearchHistoryEntry = SSHSearchHistoryEntry;
type StoredProfileTemplate = SSHProfileTemplate;

export class SSHService extends EventEmitter {
    private connections: Map<string, Client> = new Map();
    private connectionDetails: Map<string, SSHConnection> = new Map();
    private connectionStats: Map<string, SSHConnectionStats> = new Map();
    private shellSessions: Map<string, ShellSession> = new Map();
    private connectionPoolRefs: Map<string, number> = new Map();
    private transferQueue: SSHTransferTask[] = [];
    private transferQueueProcessing = false;
    private sessionRecordings: Map<string, SSHSessionRecording> = new Map();
    private keepaliveTimers: Map<string, NodeJS.Timeout> = new Map();
    private storagePath: string;
    private initPromise: Promise<void> | null = null;
    // Allowed base directories for file operations (prevents path traversal)
    private allowedBasePaths: string[] = ['/home', '/var', '/tmp', '/opt', '/srv', '/usr/local'];

    private securityService?: SecurityService;

    // Delegated managers
    private keyManager: SSHKeyManager;
    private _tunnelManager: SSHTunnelManager;

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
        this._tunnelManager = new SSHTunnelManager(storagePath);

        // Forward tunnel manager events
        this._tunnelManager.on('portForwardCreated', (forward: SSHPortForward) => {
            this.emit('portForwardCreated', forward);
        });
        this._tunnelManager.on('portForwardClosed', (forwardId: string) => {
            this.emit('portForwardClosed', forwardId);
        });
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
            throw new Error('Access denied: Path traversal detected');
        }

        // Ensure path is absolute
        if (!normalized.startsWith('/')) {
            throw new Error('Access denied: Path must be absolute');
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

    private get profilesPath(): string {
        return path.join(this.storagePath, 'ssh-profiles.json');
    }

    private get keysPath(): string {
        return path.join(this.storagePath, 'ssh-keys.json');
    }

    private get knownHostsPath(): string {
        return path.join(this.storagePath, 'known_hosts');
    }

    private get tunnelPresetsPath(): string {
        return path.join(this.storagePath, 'ssh-tunnel-presets.json');
    }

    private get searchHistoryPath(): string {
        return path.join(this.storagePath, 'ssh-search-history.json');
    }

    private get profileTemplatesPath(): string {
        return path.join(this.storagePath, 'ssh-profile-templates.json');
    }

    private async ensureInitialization(): Promise<void> {
        if (this.initPromise) {
            return this.initPromise;
        }
        this.initPromise = (async () => {
            try {
                await fs.promises.mkdir(this.storagePath, { recursive: true, mode: 0o700 });
                try {
                    await fs.promises.access(this.profilesPath);
                } catch {
                    await fs.promises.writeFile(this.profilesPath, JSON.stringify([], null, 2));
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

    private async ensureKeyStorageInitialized(): Promise<void> {
        await this.ensureInitialization();
        try {
            await fs.promises.access(this.keysPath);
        } catch {
            await fs.promises.writeFile(this.keysPath, JSON.stringify([], null, 2));
        }

        try {
            await fs.promises.access(this.knownHostsPath);
        } catch {
            await fs.promises.writeFile(this.knownHostsPath, '');
        }

        try {
            await fs.promises.access(this.tunnelPresetsPath);
        } catch {
            await fs.promises.writeFile(this.tunnelPresetsPath, JSON.stringify([], null, 2));
        }

        try {
            await fs.promises.access(this.searchHistoryPath);
        } catch {
            await fs.promises.writeFile(this.searchHistoryPath, JSON.stringify([], null, 2));
        }

        try {
            await fs.promises.access(this.profileTemplatesPath);
        } catch {
            await fs.promises.writeFile(this.profileTemplatesPath, JSON.stringify([], null, 2));
        }
    }


    private async readProfileTemplates(): Promise<StoredProfileTemplate[]> {
        await this.ensureKeyStorageInitialized();
        const content = await fs.promises.readFile(this.profileTemplatesPath, 'utf-8');
        return safeJsonParse<StoredProfileTemplate[]>(content, []);
    }

    private async writeProfileTemplates(templates: StoredProfileTemplate[]): Promise<void> {
        await fs.promises.writeFile(this.profileTemplatesPath, JSON.stringify(templates, null, 2));
    }

    private async readSearchHistory(): Promise<StoredSearchHistoryEntry[]> {
        await this.ensureKeyStorageInitialized();
        const content = await fs.promises.readFile(this.searchHistoryPath, 'utf-8');
        return safeJsonParse<StoredSearchHistoryEntry[]>(content, []);
    }

    private async writeSearchHistory(entries: StoredSearchHistoryEntry[]): Promise<void> {
        await fs.promises.writeFile(this.searchHistoryPath, JSON.stringify(entries, null, 2));
    }

    async getSavedProfiles(): Promise<SSHConnection[]> {
        try {
            await this.ensureInitialization();
            try {
                await fs.promises.access(this.profilesPath);
            } catch {
                return [];
            }
            const content = await fs.promises.readFile(this.profilesPath, 'utf-8');
            return safeJsonParse<SSHConnection[]>(content, []);
        } catch (error) {
            appLogger.error(
                'SSHService',
                `Failed to load SSH profiles: ${getErrorMessage(error as Error)}`
            );
            return [];
        }
    }

    async saveProfile(profile: SSHConnection): Promise<boolean> {
        try {
            await this.ensureInitialization();
            const profiles = await this.getSavedProfiles();

            // Encrypt sensitive credentials
            const safeProfile = { ...profile };
            if (safeProfile.password) {
                safeProfile.password = this.encryptCredential(safeProfile.password);
            }
            if (safeProfile.passphrase) {
                safeProfile.passphrase = this.encryptCredential(safeProfile.passphrase);
            }
            if (safeProfile.privateKey) {
                safeProfile.privateKey = this.encryptCredential(safeProfile.privateKey);
            }

            const profileIndex = profiles.findIndex(p => p.id === safeProfile.id);
            if (profileIndex >= 0) {
                profiles[profileIndex] = safeProfile;
            } else {
                profiles.push(safeProfile);
            }

            await fs.promises.writeFile(this.profilesPath, JSON.stringify(profiles, null, 2));
            return true;
        } catch (error) {
            appLogger.error(
                'SSHService',
                `Failed to save SSH profile: ${getErrorMessage(error as Error)}`
            );
            return false;
        }
    }

    /**
     * Get a profile with decrypted credentials
     */
    async getProfileWithCredentials(id: string): Promise<SSHConnection | null> {
        const profiles = await this.getSavedProfiles();
        const profile = profiles.find(p => p.id === id);
        if (!profile) {
            return null;
        }

        // Decrypt credentials
        const decrypted = { ...profile };
        if (decrypted.password) {
            decrypted.password = this.decryptCredential(decrypted.password);
        }
        if (decrypted.passphrase) {
            decrypted.passphrase = this.decryptCredential(decrypted.passphrase);
        }
        if (decrypted.privateKey) {
            decrypted.privateKey = this.decryptCredential(decrypted.privateKey);
        }
        return decrypted;
    }

    /**
     * Toggle favorite status for a profile
     */
    async toggleFavorite(id: string): Promise<boolean> {
        const profiles = await this.getSavedProfiles();
        const index = profiles.findIndex(p => p.id === id);
        if (index === -1) {
            return false;
        }

        profiles[index].isFavorite = !profiles[index].isFavorite;
        await fs.promises.writeFile(this.profilesPath, JSON.stringify(profiles, null, 2));
        return true;
    }

    /**
     * Get favorite profiles
     */
    async getFavorites(): Promise<SSHConnection[]> {
        const profiles = await this.getSavedProfiles();
        return profiles.filter(p => p.isFavorite);
    }

    /**
     * Get recent connections sorted by last connected time
     */
    async getRecentConnections(limit: number = 10): Promise<SSHConnection[]> {
        const profiles = await this.getSavedProfiles();
        return profiles
            .filter(p => p.lastConnected)
            .sort((a, b) => (b.lastConnected ?? 0) - (a.lastConnected ?? 0))
            .slice(0, limit);
    }

    /**
     * Add tags to a profile
     */
    async setProfileTags(id: string, tags: string[]): Promise<boolean> {
        const profiles = await this.getSavedProfiles();
        const index = profiles.findIndex(p => p.id === id);
        if (index === -1) {
            return false;
        }

        profiles[index].tags = tags;
        await fs.promises.writeFile(this.profilesPath, JSON.stringify(profiles, null, 2));
        return true;
    }

    /**
     * Search profiles by name, host, or tags
     */
    async searchProfiles(query: string): Promise<SSHConnection[]> {
        const profiles = await this.getSavedProfiles();
        const q = query.toLowerCase();
        return profiles.filter(
            p =>
                p.name.toLowerCase().includes(q) ||
                p.host.toLowerCase().includes(q) ||
                p.username.toLowerCase().includes(q) ||
                p.tags?.some(t => t.toLowerCase().includes(q))
        );
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
        try {
            const profiles = await this.getSavedProfiles();
            const filtered = profiles.filter(p => p.id !== id);
            await fs.promises.writeFile(this.profilesPath, JSON.stringify(filtered, null, 2));
            return true;
        } catch (error) {
            appLogger.error(
                'SSHService',
                `Failed to delete SSH profile: ${getErrorMessage(error as Error)}`
            );
            return false;
        }
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
        try {
            const profiles = await this.getSavedProfiles();
            const profileIndex = profiles.findIndex(p => p.id === connectionId);
            if (profileIndex !== -1) {
                profiles[profileIndex].lastConnected = Date.now();
                profiles[profileIndex].connectionCount =
                    (profiles[profileIndex].connectionCount ?? 0) + 1;
                await fs.promises.writeFile(this.profilesPath, JSON.stringify(profiles, null, 2));
            }
        } catch {
            // Ignore error updating history
        }
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
            throw new Error('Not connected');
        }

        // Update stats
        const stats = this.connectionStats.get(connectionId);
        if (stats) {
            stats.commandsExecuted++;
            stats.lastActivity = Date.now();
            stats.bytesSent += command.length;
        }

        return new Promise((resolve, reject) => {
            const execOptions: Record<string, unknown> = {};
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
            throw new Error('Not connected');
        }

        const stats = this.connectionStats.get(connectionId);
        if (stats) {
            stats.commandsExecuted++;
            stats.lastActivity = Date.now();
        }

        return new Promise((resolve, reject) => {
            const execOptions: Record<string, unknown> = {};
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
            throw new Error('Not connected');
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
            throw new Error('Not connected');
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
            throw new Error('Not connected');
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
            throw new Error('Not connected');
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
            throw new Error('Not connected');
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
            throw new Error('Not connected');
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
            throw new Error('Not connected');
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
            throw new Error('Not connected');
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
            throw new Error('Not connected');
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
    ): Promise<{ success: boolean; error?: string }> {
        const conn = this.connections.get(connectionId);
        if (!conn) {
            return { success: false, error: 'Not connected' };
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
            throw new Error('Not connected');
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
            throw new Error('Not connected');
        }

        // Normalize path to resolve '..' segments
        // We use path.posix because SSH targets are typically Linux/Unix
        const normalizedPath = path.posix.normalize(filePath);

        // Ensure it starts with /var/log
        if (!normalizedPath.startsWith('/var/log/') && normalizedPath !== '/var/log') {
            throw new Error('Access denied: Path must be within /var/log');
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
    ): Promise<{ success: boolean; forwardId?: string; error?: string }> {
        const conn = this.connections.get(connectionId);
        if (!conn) {
            return { success: false, error: 'Not connected' };
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
    ): Promise<{ success: boolean; forwardId?: string; error?: string }> {
        const conn = this.connections.get(connectionId);
        if (!conn) {
            return { success: false, error: 'Not connected' };
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
    ): Promise<{ success: boolean; forwardId?: string; error?: string }> {
        const conn = this.connections.get(connectionId);
        if (!conn) {
            return { success: false, error: 'Not connected' };
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
        const history = await this.readSearchHistory();
        history.push({
            id: crypto.randomUUID(),
            query,
            createdAt: Date.now(),
            connectionId
        });
        await this.writeSearchHistory(history.slice(-200));
        return results;
    }

    async getSearchHistory(connectionId?: string): Promise<SSHSearchHistoryEntry[]> {
        const history = await this.readSearchHistory();
        return connectionId ? history.filter(entry => entry.connectionId === connectionId) : history;
    }

    async exportSearchHistory(): Promise<string> {
        const history = await this.readSearchHistory();
        return JSON.stringify(history, null, 2);
    }

    async reconnectConnection(connectionId: string, maxRetries: number = 3): Promise<{ success: boolean; error?: string }> {
        const active = this.connectionDetails.get(connectionId);
        const fallback = await this.getProfileWithCredentials(connectionId);
        const config = active ?? fallback;
        if (!config) {
            return { success: false, error: 'Connection profile not found' };
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
            return { success: false, error: 'Reconnect attempts exhausted' };
        }
    }

    async acquireConnection(connectionId: string): Promise<{ success: boolean; error?: string }> {
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
        const templates = await this.readProfileTemplates();
        const now = Date.now();
        const created: StoredProfileTemplate = {
            id: crypto.randomUUID(),
            createdAt: now,
            updatedAt: now,
            ...template
        };
        templates.push(created);
        await this.writeProfileTemplates(templates);
        return created;
    }

    async listProfileTemplates(): Promise<SSHProfileTemplate[]> {
        return this.readProfileTemplates();
    }

    async deleteProfileTemplate(id: string): Promise<boolean> {
        const templates = await this.readProfileTemplates();
        const filtered = templates.filter((t: SSHProfileTemplate) => t.id !== id);
        if (filtered.length === templates.length) {
            return false;
        }
        await this.writeProfileTemplates(filtered);
        return true;
    }

    async exportProfiles(ids?: string[]): Promise<string> {
        const profiles = await this.getSavedProfiles();
        const selected = ids && ids.length > 0 ? profiles.filter(profile => ids.includes(profile.id)) : profiles;
        return JSON.stringify(selected.map(profile => ({ ...profile, password: undefined, privateKey: undefined })), null, 2);
    }

    async importProfiles(payload: string): Promise<number> {
        const profiles = safeJsonParse<SSHConnection[]>(payload, []);
        let savedCount = 0;
        for (const profile of profiles) {
            if (!profile.id || !profile.host || !profile.username) {
                continue;
            }
            const success = await this.saveProfile(profile);
            if (success) {
                savedCount += 1;
            }
        }
        return savedCount;
    }

    validateProfile(profile: Partial<SSHConnection>): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        if (!profile.host?.trim()) {
            errors.push('Host is required');
        }
        if (!profile.username?.trim()) {
            errors.push('Username is required');
        }
        if (!profile.port || profile.port < 1 || profile.port > 65535) {
            errors.push('Port must be between 1 and 65535');
        }
        return { valid: errors.length === 0, errors };
    }

    async testProfile(profile: Partial<SSHConnection>): Promise<SSHProfileTestResult> {
        const validation = this.validateProfile(profile);
        if (!validation.valid) {
            return {
                success: false,
                latencyMs: 0,
                authMethod: profile.privateKey ? 'key' : 'password',
                message: 'Profile validation failed',
                error: validation.errors.join('; ')
            };
        }

        const startedAt = Date.now();
        let privateKey: string | undefined;

        if (profile.privateKey) {
            if (profile.privateKey.includes('BEGIN')) {
                privateKey = profile.privateKey;
            } else {
                try {
                    privateKey = await fs.promises.readFile(profile.privateKey, 'utf-8');
                } catch (error) {
                    return {
                        success: false,
                        latencyMs: Date.now() - startedAt,
                        authMethod: 'key',
                        message: 'Private key could not be loaded',
                        error: getErrorMessage(error as Error)
                    };
                }
            }
        }

        const password = profile.password ? this.decryptCredential(profile.password) : undefined;
        const passphrase = profile.passphrase ? this.decryptCredential(profile.passphrase) : undefined;

        return await new Promise<SSHProfileTestResult>(resolve => {
            const conn = new Client();
            const authMethod: 'password' | 'key' = privateKey ? 'key' : 'password';
            let settled = false;

            const finalize = (result: SSHProfileTestResult) => {
                if (settled) {
                    return;
                }
                settled = true;
                clearTimeout(timeout);
                conn.removeAllListeners();
                try {
                    conn.end();
                } catch {
                    // ignore connection teardown failures
                }
                resolve(result);
            };

            const timeout = setTimeout(() => {
                finalize({
                    success: false,
                    latencyMs: Date.now() - startedAt,
                    authMethod,
                    message: 'SSH profile test timed out',
                    error: 'Connection timed out'
                });
            }, 10000);

            conn
                .on('ready', () => {
                    conn.exec('echo tengra-ssh-test', (error, stream) => {
                        if (error) {
                            finalize({
                                success: false,
                                latencyMs: Date.now() - startedAt,
                                authMethod,
                                message: 'Connected but command test failed',
                                error: error.message
                            });
                            return;
                        }

                        stream.on('close', () => {
                            finalize({
                                success: true,
                                latencyMs: Date.now() - startedAt,
                                authMethod,
                                message: 'SSH profile test passed'
                            });
                        });
                    });
                })
                .on('error', error => {
                    finalize({
                        success: false,
                        latencyMs: Date.now() - startedAt,
                        authMethod,
                        message: 'SSH profile test failed',
                        error: error.message
                    });
                });

            try {
                conn.connect({
                    host: profile.host ?? '',
                    port: profile.port ?? 22,
                    username: profile.username ?? '',
                    password,
                    privateKey,
                    passphrase,
                    readyTimeout: 10000
                });
            } catch (error) {
                finalize({
                    success: false,
                    latencyMs: Date.now() - startedAt,
                    authMethod,
                    message: 'SSH profile test failed',
                    error: getErrorMessage(error as Error)
                });
            }
        });
    }

    startSessionRecording(connectionId: string): SSHSessionRecording {
        const recording: SSHSessionRecording = {
            id: crypto.randomUUID(),
            connectionId,
            startedAt: Date.now(),
            chunks: []
        };
        this.sessionRecordings.set(connectionId, recording);
        return recording;
    }

    stopSessionRecording(connectionId: string): SSHSessionRecording | null {
        const recording = this.sessionRecordings.get(connectionId);
        if (!recording) {
            return null;
        }
        recording.endedAt = Date.now();
        return recording;
    }

    private appendRecordingChunk(connectionId: string, chunk: string): void {
        const recording = this.sessionRecordings.get(connectionId);
        if (!recording) {
            return;
        }
        recording.chunks.push(chunk);
        if (recording.chunks.length > 10000) {
            recording.chunks.shift();
        }
    }

    getSessionRecording(connectionId: string): SSHSessionRecording | null {
        return this.sessionRecordings.get(connectionId) ?? null;
    }

    searchSessionRecording(connectionId: string, query: string): string[] {
        const recording = this.sessionRecordings.get(connectionId);
        if (!recording) {
            return [];
        }
        const normalized = query.toLowerCase();
        return recording.chunks.filter(chunk => chunk.toLowerCase().includes(normalized));
    }

    exportSessionRecording(connectionId: string): string {
        const recording = this.sessionRecordings.get(connectionId);
        if (!recording) {
            return '';
        }
        return recording.chunks.join('');
    }

    listSessionRecordings(): SSHSessionRecording[] {
        return Array.from(this.sessionRecordings.values());
    }
}

