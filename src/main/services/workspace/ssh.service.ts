/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';

import { ipc } from '@main/core/ipc-decorators';
import { appLogger } from '@main/logging/logger';
import { SecurityService } from '@main/services/security/security.service';
import { SSHKeyManager } from '@main/services/workspace/ssh-key-manager';
import { SSHProfileManager } from '@main/services/workspace/ssh-profile-manager';
import { SSHSessionRecordingManager } from '@main/services/workspace/ssh-session-recording-manager';
import { SSHTunnelManager } from '@main/services/workspace/ssh-tunnel-manager';
import { validateCommand } from '@main/utils/command-validator.util';
import { fileOpSchema, sshConnectionSchema, sshProfileSchema } from '@main/utils/ipc-validation';
import { withRetry } from '@main/utils/retry.util';
import { SSH_CHANNELS } from '@shared/constants/ipc-channels';
import { RuntimeValue } from '@shared/types/common';
import { BrowserWindow, safeStorage } from 'electron';
import { Client, ClientChannel } from 'ssh2';
import { z } from 'zod';

/** Maximum content size for SSH file writes (50 MB) */
const MAX_SSH_CONTENT_SIZE = 50 * 1024 * 1024;

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
import { AppErrorCode, getErrorMessage } from '@shared/utils/error.util';

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

interface SSHDirectoryListResult {
    success: boolean;
    files?: SSHFile[];
    error?: string;
}

interface SSHDirectoryMetadataCacheEntry {
    files: SSHFile[];
    cachedAt: number;
    inflight?: Promise<SSHDirectoryListResult>;
}

const SSH_MESSAGE_KEY = {
    NOT_CONNECTED: 'mainProcess.sshService.notConnected',
    CONNECTION_PROFILE_NOT_FOUND: 'mainProcess.sshService.connectionProfileNotFound',
    RECONNECT_ATTEMPTS_EXHAUSTED: 'mainProcess.sshService.reconnectAttemptsExhausted'
} as const;
const SSH_ERROR_MESSAGE = {
    NOT_CONNECTED: 'error.ssh.not_connected',
    CONNECTION_PROFILE_NOT_FOUND: 'error.ssh.connection_profile_not_found',
    RECONNECT_ATTEMPTS_EXHAUSTED: 'error.ssh.reconnect_attempts_exhausted',
    PATH_TRAVERSAL_DETECTED: 'error.ssh.path_traversal_detected',
    PATH_MUST_BE_ABSOLUTE: 'error.ssh.path_must_be_absolute',
    PATH_MUST_BE_WITHIN_VAR_LOG: 'error.ssh.path_must_be_within_var_log'
} as const;

export class SSHService extends EventEmitter {
    static readonly serviceName = 'sshService';
    static readonly dependencies = ['storagePath', 'securityService', 'getMainWindow', 'allowedFileRoots'] as const;
    private static readonly DIRECTORY_METADATA_CACHE_TTL_MS = 5_000;
    private static readonly DIRECTORY_METADATA_STALE_TTL_MS = 60_000;
    private connections: Map<string, Client> = new Map();
    private connectionDetails: Map<string, SSHConnection> = new Map();
    private connectionStats: Map<string, SSHConnectionStats> = new Map();
    private shellSessions: Map<string, ShellSession> = new Map();
    private connectionPoolRefs: Map<string, number> = new Map();
    private transferQueue: SSHTransferTask[] = [];
    private transferQueueProcessing = false;
    private keepaliveTimers: Map<string, NodeJS.Timeout> = new Map();
    private directoryMetadataCache: Map<string, SSHDirectoryMetadataCacheEntry> = new Map();
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

    constructor(
        storagePath: string,
        securityService: SecurityService,
        private getMainWindow: () => BrowserWindow | null,
        private readonly allowedFileRoots?: Set<string>
    ) {
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

        this.setupIpcForwarding();
    }

    private broadcastEvent(channel: string, payload: RuntimeValue): void {
        const window = this.getMainWindow();
        if (window && !window.isDestroyed()) {
            window.webContents.send(channel, payload);
        }
    }

    private setupIpcForwarding(): void {
        this.on('stdout', (payload) => this.broadcastEvent('ssh:stdout', payload));
        this.on('stderr', (payload) => this.broadcastEvent('ssh:stderr', payload));
        this.on('connected', (id) => this.broadcastEvent('ssh:connected', id));
        this.on('disconnected', (id) => this.broadcastEvent('ssh:disconnected', id));
        this.on('error', (payload) => this.broadcastEvent('ssh:error', payload));
    }

    private sanitizeConnectionForRenderer(connection: SSHConnection): Omit<SSHConnection, 'password' | 'privateKey' | 'passphrase'> {
        const safeConnection = { ...connection };
        delete safeConnection.password;
        delete safeConnection.privateKey;
        delete safeConnection.passphrase;
        return safeConnection;
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
            throw new Error('error.ssh.path_outside_allowed_directories');
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

    @ipc({
        channel: 'ssh:getProfiles',
        defaultValue: []
    })
    async ipcGetProfiles(): Promise<Omit<SSHConnection, 'password' | 'privateKey' | 'passphrase'>[]> {
        const profiles = await this.getSavedProfiles();
        return profiles.map(p => this.sanitizeConnectionForRenderer(p));
    }

    async getSavedProfiles(): Promise<SSHConnection[]> {
        return this.profileManager.getSavedProfiles();
    }

    @ipc({
        channel: 'ssh:saveProfile',
        argsSchema: z.tuple([sshProfileSchema]),
        defaultValue: { success: false, error: 'Save failed' }
    })
    async ipcSaveProfile(profile: SSHConnection): Promise<{ success: boolean; error?: string; code?: string }> {
        try {
            const success = await this.profileManager.saveProfile(profile);
            return { success };
        } catch (error) {
            const message = getErrorMessage(error as Error);
            return {
                success: false,
                error: message,
                code: AppErrorCode.SSH_PROFILE_SAVE_FAILED
            };
        }
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

    @ipc({
        channel: 'ssh:listManagedKeys',
        defaultValue: []
    })
    async listManagedKeys(): Promise<SSHManagedKey[]> {
        return this.keyManager.listManagedKeys();
    }

    @ipc({
        channel: 'ssh:generateManagedKey',
        argsSchema: z.tuple([z.string(), z.string().optional()])
    })
    async generateManagedKey(name: string, passphrase?: string): Promise<{
        key: SSHManagedKey;
        privateKey: string;
        publicKey: string;
    }> {
        return this.keyManager.generateManagedKey(name, passphrase);
    }

    @ipc({
        channel: 'ssh:importManagedKey',
        argsSchema: z.tuple([z.string(), z.string(), z.string().optional()])
    })
    async importManagedKey(name: string, privateKey: string, passphrase?: string): Promise<SSHManagedKey> {
        return this.keyManager.importManagedKey(name, privateKey, passphrase);
    }

    @ipc({
        channel: 'ssh:deleteManagedKey',
        argsSchema: z.tuple([z.string()]),
        defaultValue: false
    })
    async deleteManagedKey(id: string): Promise<boolean> {
        return this.keyManager.deleteManagedKey(id);
    }

    @ipc({
        channel: 'ssh:rotateManagedKey',
        argsSchema: z.tuple([z.string(), z.string().optional()]),
        defaultValue: null
    })
    async rotateManagedKey(id: string, nextPassphrase?: string): Promise<SSHManagedKey | null> {
        return this.keyManager.rotateManagedKey(id, nextPassphrase);
    }

    @ipc({
        channel: 'ssh:backupManagedKey',
        argsSchema: z.tuple([z.string()]),
        defaultValue: null
    })
    async backupManagedKey(id: string): Promise<{ filename: string; privateKey: string } | null> {
        return this.keyManager.backupManagedKey(id);
    }

    @ipc({
        channel: 'ssh:listKnownHosts',
        defaultValue: []
    })
    async listKnownHosts(): Promise<SSHKnownHostEntry[]> {
        return this.keyManager.listKnownHosts();
    }

    @ipc(SSH_CHANNELS.ADD_KNOWN_HOST)
    async addKnownHost(entry: SSHKnownHostEntry): Promise<boolean> {
        return this.keyManager.addKnownHost(entry);
    }

    @ipc({
        channel: 'ssh:removeKnownHost',
        argsSchema: z.tuple([z.string(), z.string().optional()]),
        defaultValue: false
    })
    async removeKnownHost(host: string, keyType?: string): Promise<boolean> {
        return this.keyManager.removeKnownHost(host, keyType);
    }

    @ipc({
        channel: 'ssh:deleteProfile',
        argsSchema: z.tuple([z.string()]),
        defaultValue: { success: false, error: 'Delete failed' }
    })
    async ipcDeleteProfile(id: string): Promise<{ success: boolean; error?: string; code?: string }> {
        try {
            const success = await this.deleteProfile(id);
            return { success };
        } catch (error) {
            const message = getErrorMessage(error as Error);
            return {
                success: false,
                error: message,
                code: AppErrorCode.SSH_PROFILE_DELETE_FAILED
            };
        }
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

    @ipc({
        channel: 'ssh:connect',
        argsSchema: z.tuple([sshConnectionSchema]),
        defaultValue: { success: false, error: 'Connection failed' }
    })
    async connect(config: SSHConnection): Promise<{ success: boolean; error?: string; diagnostics?: SSHConnectDiagnostics }> {
        const id = config.id ?? randomUUID();
        const authType = config.authType ?? (config.privateKey ? 'key' : 'password');

        const payload: SSHConnection = {
            ...config,
            id,
            name: config.name ?? `${config.username}@${config.host}`,
            authType,
            connected: false
        };

        // Check if already connected
        if (this.connections.has(payload.id)) {
            return { success: true };
        }

        let privateKeyContent: Buffer | undefined;
        try {
            if (payload.privateKey) {
                privateKeyContent = await fs.promises.readFile(payload.privateKey);
            }
        } catch (error) {
            const message = getErrorMessage(error as Error);
            return { success: false, error: message, diagnostics: this.buildConnectDiagnostics(message) };
        }

        return new Promise(resolve => {
            const conn = new Client();
            const keepaliveInterval = payload.keepaliveInterval ?? 30000;

            this.setupConnectionHandlers(conn, payload, keepaliveInterval, resolve);

            try {
                // Decrypt credentials if needed
                const password = payload.password
                    ? this.decryptCredential(payload.password)
                    : undefined;
                const passphrase = payload.passphrase
                    ? this.decryptCredential(payload.passphrase)
                    : undefined;

                conn.connect({
                    host: payload.host,
                    port: payload.port,
                    username: payload.username,
                    password,
                    privateKey: privateKeyContent,
                    passphrase,
                    keepaliveInterval,
                    keepaliveCountMax: 3,
                    readyTimeout: 20000,
                    agentForward: payload.forwardAgent,
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
        this.clearConnectionDirectoryCache(connectionId);
        this.emit('disconnected', connectionId);
    }

    private getDirectoryCacheKey(connectionId: string, remotePath: string): string {
        return `${connectionId}:${remotePath}`;
    }

    private isDirectoryCacheFresh(entry: SSHDirectoryMetadataCacheEntry, now: number): boolean {
        return now - entry.cachedAt <= SSHService.DIRECTORY_METADATA_CACHE_TTL_MS;
    }

    private canReuseStaleDirectoryCache(
        entry: SSHDirectoryMetadataCacheEntry,
        now: number
    ): boolean {
        return now - entry.cachedAt <= SSHService.DIRECTORY_METADATA_STALE_TTL_MS;
    }

    private setDirectoryCacheEntry(
        connectionId: string,
        remotePath: string,
        files: SSHFile[]
    ): SSHDirectoryMetadataCacheEntry {
        const cacheEntry: SSHDirectoryMetadataCacheEntry = {
            files,
            cachedAt: Date.now(),
        };
        this.directoryMetadataCache.set(
            this.getDirectoryCacheKey(connectionId, remotePath),
            cacheEntry
        );
        return cacheEntry;
    }

    private clearConnectionDirectoryCache(connectionId: string): void {
        for (const cacheKey of Array.from(this.directoryMetadataCache.keys())) {
            if (cacheKey.startsWith(`${connectionId}:`)) {
                this.directoryMetadataCache.delete(cacheKey);
            }
        }
    }

    private invalidateDirectoryMetadataCache(
        connectionId: string,
        remotePath: string
    ): void {
        const normalizedPath = path.posix.normalize(remotePath);
        const parentPath = path.posix.dirname(normalizedPath);
        const rootDirectory = path.posix.dirname(parentPath);
        const pathsToInvalidate = new Set<string>([
            normalizedPath,
            parentPath,
        ]);

        if (parentPath !== normalizedPath) {
            pathsToInvalidate.add(rootDirectory);
        }

        for (const candidatePath of pathsToInvalidate) {
            this.directoryMetadataCache.delete(
                this.getDirectoryCacheKey(connectionId, candidatePath)
            );
        }
    }

    private async fetchDirectoryListing(
        conn: Client,
        connectionId: string,
        remotePath: string
    ): Promise<SSHDirectoryListResult> {
        const cacheKey = this.getDirectoryCacheKey(connectionId, remotePath);
        const existing = this.directoryMetadataCache.get(cacheKey);
        if (existing?.inflight) {
            return existing.inflight;
        }

        const inflight = new Promise<SSHDirectoryListResult>(resolve => {
            conn.sftp((err, sftp) => {
                if (err) {
                    this.directoryMetadataCache.delete(cacheKey);
                    resolve({ success: false, error: err.message });
                    return;
                }
                sftp.readdir(remotePath, (readdirError, list) => {
                    if (readdirError) {
                        this.directoryMetadataCache.delete(cacheKey);
                        resolve({ success: false, error: readdirError.message });
                        return;
                    }
                    const files = list.map(entry => this.mapSftpEntry(entry));
                    this.setDirectoryCacheEntry(connectionId, remotePath, files);
                    resolve({ success: true, files });
                });
            });
        });

        this.directoryMetadataCache.set(cacheKey, {
            files: existing?.files ?? [],
            cachedAt: existing?.cachedAt ?? 0,
            inflight,
        });

        return inflight;
    }

    private hydrateDirectoryMetadataCache(
        conn: Client,
        connectionId: string,
        remotePath: string
    ): void {
        void this.fetchDirectoryListing(conn, connectionId, remotePath).catch(error => {
            appLogger.warn(
                'SSHService',
                `Background directory cache hydration failed for ${remotePath}: ${getErrorMessage(error as Error)}`
            );
        });
    }

    /**
     * Get connection statistics
     */
    getConnectionStats(connectionId: string): SSHConnectionStats | null {
        return this.connectionStats.get(connectionId) ?? null;
    }

    @ipc({
        channel: 'ssh:disconnect',
        argsSchema: z.tuple([z.string()]),
        defaultValue: false
    })
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

    @ipc(SSH_CHANNELS.GET_CONNECTIONS)
    ipcGetConnections(): Omit<SSHConnection, 'password' | 'privateKey' | 'passphrase'>[] {
        return Array.from(this.connectionDetails.values()).map(c => this.sanitizeConnectionForRenderer(c));
    }

    getAllConnections(): SSHConnection[] {
        return Array.from(this.connectionDetails.values());
    }

    @ipc({
        channel: 'ssh:isConnected',
        argsSchema: z.tuple([z.string()]),
        defaultValue: false
    })
    isConnected(connectionId: string): boolean {
        return this.connections.has(connectionId);
    }

    @ipc({
        channel: 'ssh:execute',
        argsSchema: z.tuple([z.string(), z.string(), z.any().optional()]),
        defaultValue: { code: -1, stdout: '', stderr: 'Execution failed', success: false }
    })
    async executeCommand(
        connectionId: string,
        command: string,
        options?: SSHExecOptions
    ): Promise<{ stdout: string; stderr: string; code: number; success: boolean; error?: string }> {
        if (command.includes('\n') || command.includes('\r') || command.includes('\0')) {
            throw new Error('Invalid SSH command: command contains forbidden control characters');
        }

        const validation = validateCommand(command);
        if (!validation.allowed) {
            throw new Error(`Command blocked: ${validation.reason}`);
        }

        const conn = this.connections.get(connectionId);
        if (!conn) {
            throw new Error(SSH_ERROR_MESSAGE.NOT_CONNECTED);
        }

        try {
            const result = await this.executeCommandInternal(connectionId, command, options);
            return { ...result, success: result.code === 0 };
        } catch (error) {
            const message = getErrorMessage(error as Error);
            return { success: false, error: message, stdout: '', stderr: message, code: 1 };
        }
    }

    private async executeCommandInternal(
        connectionId: string,
        command: string,
        options?: SSHExecOptions
    ): Promise<{ stdout: string; stderr: string; code: number }> {
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

        return new Promise((resolve) => {
            const execOptions: Record<string, RuntimeValue> = {};
            if (options?.env) {
                execOptions.env = options.env;
            }
            if (options?.pty) {
                execOptions.pty = true;
            }

            conn.exec(command, execOptions, (err, stream) => {
                if (err) {
                    return resolve({ stdout: '', stderr: getErrorMessage(err), code: 1 });
                }
                let stdout = '';
                let stderr = '';

                // Handle timeout
                let timeout: NodeJS.Timeout | null = null;
                if (options?.timeout) {
                    timeout = setTimeout(() => {
                        stream.close();
                        resolve({ stdout: '', stderr: 'Command timed out', code: 1 });
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

    @ipc({
        channel: 'ssh:listDir',
        argsSchema: z.tuple([z.string(), z.string()]),
        defaultValue: { success: false, error: 'List failed' }
    })
    async listDirectory(
        connectionId: string,
        dirPath: string
    ): Promise<{ success: boolean; files?: SSHFile[]; error?: string }> {
        if (dirPath.includes('..') || dirPath.includes('\0') || dirPath.includes('\r') || dirPath.includes('\n')) {
            throw new Error(`Invalid SSH path for ssh:listDir: path contains forbidden characters`);
        }

        const conn = this.connections.get(connectionId);
        if (!conn) {
            throw new Error(SSH_ERROR_MESSAGE.NOT_CONNECTED);
        }

        const validPath = this.validateRemotePath(dirPath);
        const cacheKey = this.getDirectoryCacheKey(connectionId, validPath);
        const cachedEntry = this.directoryMetadataCache.get(cacheKey);
        const now = Date.now();

        if (cachedEntry?.files && this.isDirectoryCacheFresh(cachedEntry, now)) {
            return { success: true, files: cachedEntry.files };
        }

        if (cachedEntry?.inflight) {
            return cachedEntry.inflight;
        }

        if (cachedEntry?.files && this.canReuseStaleDirectoryCache(cachedEntry, now)) {
            this.hydrateDirectoryMetadataCache(conn, connectionId, validPath);
            return { success: true, files: cachedEntry.files };
        }

        return this.fetchDirectoryListing(conn, connectionId, validPath);
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

    @ipc({
        channel: 'ssh:readFile',
        argsSchema: z.tuple([z.string(), z.string()]),
        defaultValue: { success: false, error: 'Read failed' }
    })
    async ipcReadFile(connectionId: string, filePath: string): Promise<{ success: boolean; content?: string; error?: string }> {
        try {
            const content = await this.readFile(connectionId, filePath);
            return { success: true, content };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    async readFile(connectionId: string, filePath: string): Promise<string> {
        if (filePath.includes('..') || filePath.includes('\0') || filePath.includes('\r') || filePath.includes('\n')) {
            throw new Error(`Invalid SSH path for ssh:readFile: path contains forbidden characters`);
        }

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

    @ipc({
        channel: 'ssh:writeFile',
        argsSchema: z.tuple([z.string(), z.string(), z.string()]),
        defaultValue: { success: false, error: 'Write failed' }
    })
    async ipcWriteFile(connectionId: string, filePath: string, content: string): Promise<{ success: boolean; error?: string }> {
        try {
            const success = await this.writeFile(connectionId, filePath, content);
            return { success };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    async writeFile(connectionId: string, filePath: string, content: string): Promise<boolean> {
        if (filePath.includes('..') || filePath.includes('\0') || filePath.includes('\r') || filePath.includes('\n')) {
            throw new Error(`Invalid SSH path for ssh:writeFile: path contains forbidden characters`);
        }
        if (content.length > MAX_SSH_CONTENT_SIZE) {
            throw new Error(`Content exceeds maximum size of ${MAX_SSH_CONTENT_SIZE} bytes`);
        }

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
                stream.on('close', () => {
                    this.invalidateDirectoryMetadataCache(connectionId, validPath);
                    resolve(true);
                });
                stream.on('error', (err: Error) => reject(err));
            });
        });
    }

    @ipc(SSH_CHANNELS.DELETE_DIR)
    async ipcDeleteDir(connectionId: string, dirPath: string): Promise<{ success: boolean; error?: string }> {
        try {
            const success = await this.deleteDirectory(connectionId, dirPath);
            return { success };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    async deleteDirectory(connectionId: string, dirPath: string): Promise<boolean> {
        if (dirPath.includes('..') || dirPath.includes('\0') || dirPath.includes('\r') || dirPath.includes('\n')) {
            throw new Error(`Invalid SSH path for ssh:deleteDir: path contains forbidden characters`);
        }

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
                    this.invalidateDirectoryMetadataCache(connectionId, validPath);
                    resolve(true);
                });
            });
        });
    }

    @ipc({
        channel: 'ssh:deleteFile',
        argsSchema: z.tuple([z.string(), z.string()]),
        defaultValue: { success: false, error: 'Delete failed' }
    })
    async ipcDeleteFile(connectionId: string, filePath: string): Promise<{ success: boolean; error?: string }> {
        try {
            const success = await this.deleteFile(connectionId, filePath);
            return { success };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    async deleteFile(connectionId: string, filePath: string): Promise<boolean> {
        if (filePath.includes('..') || filePath.includes('\0') || filePath.includes('\r') || filePath.includes('\n')) {
            throw new Error(`Invalid SSH path for ssh:deleteFile: path contains forbidden characters`);
        }

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
                    this.invalidateDirectoryMetadataCache(connectionId, validPath);
                    resolve(true);
                });
            });
        });
    }

    @ipc({
        channel: 'ssh:mkdir',
        argsSchema: z.tuple([z.string(), z.string()]),
        defaultValue: { success: false, error: 'Mkdir failed' }
    })
    async ipcMkdir(connectionId: string, dirPath: string): Promise<{ success: boolean; error?: string }> {
        try {
            const success = await this.createDirectory(connectionId, dirPath);
            return { success };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    async createDirectory(connectionId: string, dirPath: string): Promise<boolean> {
        if (dirPath.includes('..') || dirPath.includes('\0') || dirPath.includes('\r') || dirPath.includes('\n')) {
            throw new Error(`Invalid SSH path for ssh:mkdir: path contains forbidden characters`);
        }

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
                    this.invalidateDirectoryMetadataCache(connectionId, validPath);
                    resolve(true);
                });
            });
        });
    }

    @ipc({
        channel: 'ssh:rename',
        argsSchema: z.tuple([z.string(), z.string(), z.string()]),
        defaultValue: { success: false, error: 'Rename failed' }
    })
    async ipcRename(connectionId: string, oldPath: string, newPath: string): Promise<{ success: boolean; error?: string }> {
        try {
            const success = await this.rename(connectionId, oldPath, newPath);
            return { success };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    async rename(connectionId: string, oldPath: string, newPath: string): Promise<boolean> {
        if (oldPath.includes('..') || oldPath.includes('\0') || oldPath.includes('\r') || oldPath.includes('\n')) {
            throw new Error(`Invalid SSH path for ssh:rename oldPath: path contains forbidden characters`);
        }
        if (newPath.includes('..') || newPath.includes('\0') || newPath.includes('\r') || newPath.includes('\n')) {
            throw new Error(`Invalid SSH path for ssh:rename newPath: path contains forbidden characters`);
        }

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
                    this.invalidateDirectoryMetadataCache(connectionId, validOldPath);
                    this.invalidateDirectoryMetadataCache(connectionId, validNewPath);
                    resolve(true);
                });
            });
        });
    }

    /** Minimum interval between progress emissions (ms) */
    private static readonly PROGRESS_THROTTLE_MS = 100;

    @ipc({
        channel: 'ssh:upload',
        argsSchema: z.tuple([fileOpSchema]),
        defaultValue: { success: false, error: 'Upload failed' }
    })
    async ipcUpload(payload: { connectionId: string; local: string; remote: string }): Promise<{ success: boolean; error?: string }> {
        try {
            const success = await this.uploadFile(payload.connectionId, payload.local, payload.remote, (transferred, total) => {
                this.broadcastEvent('ssh:uploadProgress', { connectionId: payload.connectionId, transferred, total });
            });
            return { success };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

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
                        this.invalidateDirectoryMetadataCache(connectionId, validRemotePath);
                        resolve(true);
                    }
                );
            });
        });
    }

    @ipc({
        channel: 'ssh:download',
        argsSchema: z.tuple([fileOpSchema]),
        defaultValue: { success: false, error: 'Download failed' }
    })
    async ipcDownload(payload: { connectionId: string; remote: string; local: string }): Promise<{ success: boolean; error?: string }> {
        try {
            const success = await this.downloadFile(payload.connectionId, payload.remote, payload.local, (transferred, total) => {
                this.broadcastEvent('ssh:downloadProgress', { connectionId: payload.connectionId, transferred, total });
            });
            return { success };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
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

    @ipc(SSH_CHANNELS.SHELL_START)
    async ipcShellStart(connectionId: string): Promise<{ success: boolean; error?: string }> {
        return this.startShell(
            connectionId,
            (data) => this.broadcastEvent('ssh:shellData', { connectionId, data }),
            () => this.broadcastEvent('ssh:disconnected', connectionId)
        );
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
    @ipc(SSH_CHANNELS.SHELL_RESIZE)
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
    @ipc(SSH_CHANNELS.SHELL_WRITE)
    ipcShellWrite(connectionId: string, data: string): { success: boolean } {
        const success = this.writeToShell(connectionId, data);
        return { success };
    }

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
    @ipc(SSH_CHANNELS.SHELL_CLOSE)
    closeShell(connectionId: string): boolean {
        const session = this.shellSessions.get(connectionId);
        if (!session) {
            return false;
        }

        session.stream.close();
        this.shellSessions.delete(connectionId);
        return true;
    }

    @ipc(SSH_CHANNELS.GET_LOG_FILES)
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

    @ipc(SSH_CHANNELS.READ_LOG_FILE)
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
    @ipc(SSH_CHANNELS.CREATE_TUNNEL)
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

    @ipc(SSH_CHANNELS.SAVE_TUNNEL_PRESET)
    async saveTunnelPreset(preset: Omit<SSHTunnelPreset, 'id' | 'createdAt' | 'updatedAt'>): Promise<SSHTunnelPreset> {
        return this._tunnelManager.saveTunnelPreset(preset);
    }

    @ipc(SSH_CHANNELS.LIST_TUNNEL_PRESETS)
    async listTunnelPresets(): Promise<SSHTunnelPreset[]> {
        return this._tunnelManager.listTunnelPresets();
    }

    @ipc(SSH_CHANNELS.DELETE_TUNNEL_PRESET)
    async deleteTunnelPreset(id: string): Promise<boolean> {
        return this._tunnelManager.deleteTunnelPreset(id);
    }

    /**
     * Get all active port forwards
     */
    @ipc(SSH_CHANNELS.LIST_TUNNELS)
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
    @ipc(SSH_CHANNELS.CLOSE_TUNNEL)
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
        this.directoryMetadataCache.clear();
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

    @ipc({
        channel: 'ssh:getSystemStats',
        argsSchema: z.tuple([z.string()]),
        defaultValue: { uptime: '-', memory: { total: 0, used: 0, percent: 0 }, cpu: 0, disk: '0%' }
    })
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

    @ipc({
        channel: 'ssh:getInstalledPackages',
        argsSchema: z.tuple([z.string(), z.enum(['apt', 'npm', 'pip']).optional()]),
        defaultValue: []
    })
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

    @ipc({
        channel: 'ssh:searchRemoteFiles',
        argsSchema: z.tuple([z.string(), z.string(), z.object({ path: z.string().optional(), contentSearch: z.boolean().optional(), limit: z.number().optional() }).optional()]),
        defaultValue: []
    })
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

    @ipc({
        channel: 'ssh:getSearchHistory',
        argsSchema: z.tuple([z.string().optional()]),
        defaultValue: []
    })
    async getSearchHistory(connectionId?: string): Promise<SSHSearchHistoryEntry[]> {
        return this.profileManager.getSearchHistory(connectionId);
    }

    @ipc({
        channel: 'ssh:exportSearchHistory',
        defaultValue: ''
    })
    async exportSearchHistory(): Promise<string> {
        return this.profileManager.exportSearchHistory();
    }

    @ipc({
        channel: 'ssh:reconnect',
        argsSchema: z.tuple([z.string(), z.number().optional()]),
        defaultValue: { success: false, error: 'Reconnect failed' }
    })
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

    @ipc({
        channel: 'ssh:acquireConnection',
        argsSchema: z.tuple([z.string()]),
        defaultValue: { success: false, error: 'Acquire failed' }
    })
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

    @ipc({
        channel: 'ssh:releaseConnection',
        argsSchema: z.tuple([z.string()]),
        defaultValue: false
    })
    async releaseConnection(connectionId: string): Promise<boolean> {
        const refs = this.connectionPoolRefs.get(connectionId) ?? 0;
        if (refs <= 1) {
            this.connectionPoolRefs.delete(connectionId);
            return this.disconnect(connectionId);
        }
        this.connectionPoolRefs.set(connectionId, refs - 1);
        return true;
    }

    @ipc({
        channel: 'ssh:getConnectionPoolStats',
        defaultValue: []
    })
    getConnectionPoolStats(): Array<{ connectionId: string; refs: number }> {
        return Array.from(this.connectionPoolRefs.entries()).map(([connectionId, refs]) => ({ connectionId, refs }));
    }

    @ipc({
        channel: 'ssh:enqueueTransfer',
        argsSchema: z.tuple([z.any()])
    })
    async enqueueTransfer(task: SSHTransferTask): Promise<void> {
        this.transferQueue.push(task);
        if (!this.transferQueueProcessing) {
            await this.processTransferQueue();
        }
    }

    @ipc({
        channel: 'ssh:getTransferQueue',
        defaultValue: []
    })
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

    @ipc({
        channel: 'ssh:runTransferBatch',
        argsSchema: z.tuple([z.array(z.any()), z.number().optional()]),
        defaultValue: []
    })
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

    @ipc({
        channel: 'ssh:listRemoteContainers',
        argsSchema: z.tuple([z.string()]),
        defaultValue: []
    })
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

    @ipc({
        channel: 'ssh:runRemoteContainer',
        argsSchema: z.tuple([z.string(), z.string(), z.string(), z.array(z.any()).optional()]),
        defaultValue: { success: false, error: 'Failed to run container' }
    })
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

    @ipc({
        channel: 'ssh:stopRemoteContainer',
        argsSchema: z.tuple([z.string(), z.string()]),
        defaultValue: false
    })
    async stopRemoteContainer(connectionId: string, containerId: string): Promise<boolean> {
        const { code } = await this.executeCommand(connectionId, `docker stop ${containerId}`);
        return code === 0;
    }

    @ipc({
        channel: 'ssh:saveProfileTemplate',
        argsSchema: z.tuple([z.any()])
    })
    async saveProfileTemplate(template: Omit<SSHProfileTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<SSHProfileTemplate> {
        return this.profileManager.saveProfileTemplate(template);
    }

    @ipc({
        channel: 'ssh:listProfileTemplates',
        defaultValue: []
    })
    async listProfileTemplates(): Promise<SSHProfileTemplate[]> {
        return this.profileManager.listProfileTemplates();
    }

    @ipc({
        channel: 'ssh:deleteProfileTemplate',
        argsSchema: z.tuple([z.string()]),
        defaultValue: false
    })
    async deleteProfileTemplate(id: string): Promise<boolean> {
        return this.profileManager.deleteProfileTemplate(id);
    }

    @ipc({
        channel: 'ssh:exportProfiles',
        argsSchema: z.tuple([z.array(z.string()).optional()]),
        defaultValue: '[]'
    })
    async exportProfiles(ids?: string[]): Promise<string> {
        return this.profileManager.exportProfiles(ids);
    }

    @ipc({
        channel: 'ssh:importProfiles',
        argsSchema: z.tuple([z.string()]),
        defaultValue: 0
    })
    async importProfiles(payload: string): Promise<number> {
        return this.profileManager.importProfiles(payload);
    }

    @ipc({
        channel: 'ssh:validateProfile',
        argsSchema: z.tuple([z.any()]),
        defaultValue: { valid: false, errors: ['Validation failed'] }
    })
    validateProfile(profile: Partial<SSHConnection>): { valid: boolean; errors: string[] } {
        return this.profileManager.validateProfile(profile);
    }

    @ipc({
        channel: 'ssh:testProfile',
        argsSchema: z.tuple([z.any()]),
        defaultValue: { success: false, error: 'Test failed' }
    })
    async testProfile(profile: Partial<SSHConnection>): Promise<SSHProfileTestResult> {
        return this.profileManager.testProfile(profile);
    }

    @ipc({
        channel: 'ssh:startSessionRecording',
        argsSchema: z.tuple([z.string()])
    })
    startSessionRecording(connectionId: string): SSHSessionRecording {
        return this.sessionRecordingManager.start(connectionId);
    }

    @ipc({
        channel: 'ssh:stopSessionRecording',
        argsSchema: z.tuple([z.string()]),
        defaultValue: null
    })
    stopSessionRecording(connectionId: string): SSHSessionRecording | null {
        return this.sessionRecordingManager.stop(connectionId);
    }

    private appendRecordingChunk(connectionId: string, chunk: string): void {
        this.sessionRecordingManager.append(connectionId, chunk);
    }

    @ipc({
        channel: 'ssh:getSessionRecording',
        argsSchema: z.tuple([z.string()]),
        defaultValue: null
    })
    getSessionRecording(connectionId: string): SSHSessionRecording | null {
        return this.sessionRecordingManager.get(connectionId);
    }

    @ipc({
        channel: 'ssh:searchSessionRecording',
        argsSchema: z.tuple([z.string(), z.string()]),
        defaultValue: []
    })
    searchSessionRecording(connectionId: string, query: string): string[] {
        return this.sessionRecordingManager.search(connectionId, query);
    }

    @ipc({
        channel: 'ssh:exportSessionRecording',
        argsSchema: z.tuple([z.string()]),
        defaultValue: ''
    })
    exportSessionRecording(connectionId: string): string {
        return this.sessionRecordingManager.export(connectionId);
    }

    @ipc({
        channel: 'ssh:listSessionRecordings',
        defaultValue: []
    })
    listSessionRecordings(): SSHSessionRecording[] {
        return this.sessionRecordingManager.list();
    }

    @ipc({
        channel: 'ssh:copyPath',
        argsSchema: z.tuple([z.object({ connectionId: z.string(), sourcePath: z.string(), destinationPath: z.string() })]),
        defaultValue: { success: false, error: 'Copy failed' }
    })
    async copyPath(payload: { connectionId: string; sourcePath: string; destinationPath: string }): Promise<{ success: boolean; error?: string }> {
        try {
            if (payload.sourcePath.includes('..') || payload.sourcePath.includes('\0') || payload.sourcePath.includes('\r') || payload.sourcePath.includes('\n')) {
                throw new Error('Invalid SSH path for sourcePath: path contains forbidden characters');
            }
            if (payload.destinationPath.includes('..') || payload.destinationPath.includes('\0') || payload.destinationPath.includes('\r') || payload.destinationPath.includes('\n')) {
                throw new Error('Invalid SSH path for destinationPath: path contains forbidden characters');
            }
            const parentPath = this.getSshParentPath(payload.destinationPath);
            const command = `mkdir -p -- ${this.quoteSshShellArgument(parentPath)} && cp -R -- ${this.quoteSshShellArgument(payload.sourcePath)} ${this.quoteSshShellArgument(payload.destinationPath)}`;
            const result = await this.executeCommand(payload.connectionId, command);
            if (result.code !== 0) {
                return {
                    success: false,
                    error: result.stderr || result.stdout || 'Failed to copy remote path'
                };
            }
            return { success: true };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    private quoteSshShellArgument(value: string): string {
        return `'${value.replace(/'/g, `'"'"'`)}'`;
    }

    private getSshParentPath(targetPath: string): string {
        const separatorIndex = targetPath.lastIndexOf('/');
        if (separatorIndex < 0) {
            return '.';
        }
        if (separatorIndex === 0) {
            return '/';
        }
        return targetPath.slice(0, separatorIndex);
    }
}



