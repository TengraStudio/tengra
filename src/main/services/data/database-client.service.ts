/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Database Client Service
 *
 * HTTP client for communicating with the standalone Rust database service.
 * This service provides the same interface as DatabaseService but uses
 * HTTP calls to the external db-service.
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as http from 'http';
import * as net from 'net';
import * as path from 'path';

import { BaseService } from '@main/services/base.service';
import { DataService } from '@main/services/data/data.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { ProcessManagerService } from '@main/services/system/process-manager.service';
import { WORKSPACE_COMPAT_SCHEMA_VALUES } from '@shared/constants';
import { OPERATION_TIMEOUTS } from '@shared/constants/timeouts';
import {
    DbApiResponse,
    DbChat,
    DbCodeSymbol,
    DbCreateChatRequest,
    DbCreateFolderRequest,
    DbCreateMessageRequest,
    DbCreatePromptRequest,
    DbCreateWorkspaceRequest,
    DbFolder,
    DbHealthResponse,
    DbMessage,
    DbPrompt,
    DbQueryRequest,
    DbQueryResponse,
    DbSemanticFragment,
    DbStats,
    DbStoreCodeSymbolRequest,
    DbStoreSemanticFragmentRequest,
    DbUpdateChatRequest,
    DbUpdateFolderRequest,
    DbUpdateMessageRequest,
    DbUpdatePromptRequest,
    DbUpdateWorkspaceRequest,
    DbVectorSearchRequest,
    DbWorkspace,
} from '@shared/types/db-api';
import { delay } from '@shared/utils/delay.util';
import { getErrorMessage } from '@shared/utils/error.util';
import axios, { AxiosError, AxiosInstance } from 'axios';
import { app } from 'electron';

/** PERF-117: Cached port file entry with TTL */
interface PortFileCacheEntry {
    content: string;
    timestamp: number;
}

interface WorkspaceListCacheEntry {
    data: DbWorkspace[];
    expiresAt: number;
}

/** PERF-117: TTL for port file cache in milliseconds */
const PORT_FILE_CACHE_TTL_MS = 5_000;
const WORKSPACE_LIST_CACHE_TTL_MS = 5_000;

const SERVICE_NAME = 'db-service';
const MAX_HEALTH_RETRIES = 40; // Increased for slower startups under load
const HEALTH_RETRY_DELAY_MS = 800;
const WORKSPACE_COMPAT_PATH_FIELD = WORKSPACE_COMPAT_SCHEMA_VALUES.PATH_COLUMN;
const DB_SERVICE_TOKEN_ENV = 'TENGRA_DB_SERVICE_TOKEN';
const DB_SERVICE_TOKEN_FILE = 'db-service.token';

// PERF-003-4: HTTP agent configuration for connection pooling
const HTTP_AGENT_CONFIG = {
    keepAlive: true, // Enable keep-alive connections
    keepAliveMsecs: 1000, // Initial delay for keep-alive probes
    maxSockets: 10, // Maximum concurrent sockets per host
    maxFreeSockets: 5, // Maximum idle sockets to keep in pool
    timeout: 60000, // Socket timeout in ms
};

/**
 * Database Client Service - communicates with the standalone Rust database service
 */
export class DatabaseClientService extends BaseService {
    private apiClient: AxiosInstance;
    private servicePort: number | null = null;
    private isReady = false;
    private isInitializing = false;
    private initPromise: Promise<void> | null = null;
    private httpAgent: http.Agent;
    private pendingRequests = 0;
    private maxPendingRequests = 200;
    private totalRequests = 0;
    private failedRequests = 0;
    private lastRequestAt?: number;

    /** PERF-117: Cache for port file reads to avoid repeated synchronous I/O */
    private portFileCache = new Map<string, PortFileCacheEntry>();
    private workspaceListCache: WorkspaceListCacheEntry | null = null;

    constructor(
        private eventBus: EventBusService,
        private processManager: ProcessManagerService,
        private dataService: DataService
    ) {
        super('DatabaseClientService');

        // PERF-003-4: Create reusable HTTP agent with connection pooling
        this.httpAgent = new http.Agent(HTTP_AGENT_CONFIG);

        this.apiClient = axios.create({
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
            },
            // PERF-003-4: Use connection pooling agent
            httpAgent: this.httpAgent,
        });
    }

    /** Validates that a value is a non-empty string safe for URL path segments. */
    private validatePathId(value: RuntimeValue, label: string): asserts value is string {
        if (typeof value !== 'string' || value.trim().length === 0) {
            throw new Error(`${label} must be a non-empty string`);
        }
        if (!/^[\w\-.:]+$/.test(value)) {
            throw new Error(`${label} contains invalid characters`);
        }
    }

    /** Validates that a value is a non-empty string. */
    private validateRequiredString(value: RuntimeValue, label: string): asserts value is string {
        if (typeof value !== 'string' || value.trim().length === 0) {
            throw new Error(`${label} must be a non-empty string`);
        }
    }

    /** Validates that a value is an array. */
    private validateArray(value: RuntimeValue, label: string): asserts value is RuntimeValue[] {
        if (!Array.isArray(value)) {
            throw new Error(`${label} must be an array`);
        }
    }

    /**
     * Initialize the database client
     */
    override async initialize(): Promise<void> {
        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = this.doInitialize();
        return this.initPromise;
    }

    private async doInitialize(): Promise<void> {
        this.isInitializing = true;
        this.logInfo('Initializing database client...');

        try {
            await this.ensureDbServiceToken();
            // Discover or start the db-service
            this.servicePort = await this.discoverOrStartService();

            if (!this.servicePort) {
                throw new Error('Failed to discover or start db-service');
            }

            // discoverOrStartService validates health before returning.

            // Listen for service restarts
            this.processManager.on(`${SERVICE_NAME}:ready`, (newPort: number) => {
                this.logInfo(`db-service restarted, updating port to ${newPort}`);
                this.servicePort = newPort;
                this.isReady = true;
            });

            this.isReady = true;
            this.eventBus.emit('db:ready', { timestamp: Date.now() });
            this.logInfo(`Connected to db-service on port ${this.servicePort}`);
        } catch (error) {
            this.logError('Failed to initialize database client', error);
            this.eventBus.emit('db:error', { error: getErrorMessage(error) });
            throw error;
        } finally {
            this.isInitializing = false;
        }
    }

    /**
     * Discover existing service or start a new one
     */
    private async discoverOrStartService(): Promise<number | null> {
        this.servicePort = 42000;
        this.logInfo(`Using fixed db-service port: ${this.servicePort}`);

        // Try to see if it's already running
        const isOpen = await this.isPortOpen(this.servicePort);
        if (isOpen) {
            this.logInfo(`Port ${this.servicePort} is occupied. Checking health...`);
            try {
                const health = await this.getHealth();
                if (this.isCompatibleHealthyResponse(health)) {
                    this.logInfo('Existing db-service is healthy.');
                    return this.servicePort;
                }
            } catch {
                // Not responding or not our service
            }
            this.logWarn(`Existing process on port ${this.servicePort} is unhealthy or unknown. Killing it.`);
            await this.processManager.killProcessOnPort(this.servicePort);
        }

        // Start new service
        this.logInfo(`Ensuring port ${this.servicePort} is free...`);
        await this.processManager.killProcessOnPort(this.servicePort);

        this.logInfo(`Starting db-service on fixed port ${this.servicePort}...`);
        const dbDir = this.dataService.getPath('db');
        const dbPath = path.join(dbDir, 'Tengra.db');

        await this.processManager.startService({
            name: SERVICE_NAME,
            executable: 'tengra-db-service',
            args: ['--console', '--db-path', dbPath, '--port', this.servicePort.toString()],
            persistent: true,
        });

        // Wait for port to open before health check to avoid ECONNREFUSED logs
        let portOpen = false;
        for (let i = 0; i < 10; i++) {
            portOpen = await this.isPortOpen(this.servicePort);
            if (portOpen) break;
            await delay(200);
        }

        if (!portOpen) {
            this.logError(`Port ${this.servicePort} never opened after starting db-service`);
            return null;
        }

        // Wait for health check (max 10s)
        try {
            await this.waitForHealth();
            return this.servicePort;
        } catch (e) {
            this.logError('Timed out waiting for db-service to become healthy on port 42000');
            return null;
        }
    }

    private isCompatibleHealthyResponse(response: DbApiResponse<DbHealthResponse>): boolean {
        if (!response.success || response.data?.status !== 'healthy') {
            return false;
        }

        const runningVersion = response.data.version?.trim();
        const expectedVersion = app.getVersion?.().trim();
        if (runningVersion && expectedVersion && runningVersion !== expectedVersion) {
            this.logWarn(
                `Existing db-service version ${runningVersion} does not match app ${expectedVersion}; restarting.`
            );
            return false;
        }

        return true;
    }

    /**
     * Discover the service port from the port file
     */
    private async discoverService(): Promise<number | null> {
        const portFiles = this.getPortFileCandidates();
        for (const portFile of portFiles) {
            try {
                await fsPromises.access(portFile, fs.constants.F_OK);
            } catch {
                continue;
            }

            try {
                const content = this.readPortFileCached(portFile);
                const port = parseInt(content, 10);
                if (isNaN(port)) {
                    continue;
                }

                // Verify the port is open
                const isOpen = await this.isPortOpen(port);
                if (!isOpen) {
                    // Clean up stale port file
                    try {
                        await fsPromises.unlink(portFile);
                        this.portFileCache.delete(portFile);
                    } catch {
                        /* ignore */
                    }
                    continue;
                }

                return port;
            } catch {
                continue;
            }
        }

        return null;
    }

    /** PERF-117: Read port file with caching to avoid repeated synchronous I/O */
    private readPortFileCached(filePath: string): string {
        const now = Date.now();
        const cached = this.portFileCache.get(filePath);
        if (cached && (now - cached.timestamp) < PORT_FILE_CACHE_TTL_MS) {
            return cached.content;
        }

        const content = fs.readFileSync(filePath, 'utf8').trim();
        this.portFileCache.set(filePath, { content, timestamp: now });
        return content;
    }

    /**
     * Get the port file path
     */
    private getPortFileCandidates(): string[] {
        const userDataServices = path.join(app.getPath('userData'), 'services', `${SERVICE_NAME}.port`);
        const legacyRoots = ['Tengra', 'tengra'].map(root => path.join(app.getPath('appData'), root, 'services', `${SERVICE_NAME}.port`));
        return [userDataServices, ...legacyRoots];
    }

    private getServiceTokenFilePath(): string {
        return path.join(app.getPath('userData'), 'services', DB_SERVICE_TOKEN_FILE);
    }

    private getLegacyServiceTokenFilePath(): string {
        return path.join(app.getPath('appData'), 'Tengra', 'services', DB_SERVICE_TOKEN_FILE);
    }

    private async ensureDbServiceToken(): Promise<string> {
        const existingEnvToken = process.env[DB_SERVICE_TOKEN_ENV]?.trim();
        if (existingEnvToken) {
            return existingEnvToken;
        }

        const tokenFile = this.getServiceTokenFilePath();
        try {
            const existingFileToken = (await fsPromises.readFile(tokenFile, 'utf8')).trim();
            if (existingFileToken) {
                process.env[DB_SERVICE_TOKEN_ENV] = existingFileToken;
                return existingFileToken;
            }
        } catch {
            try {
                const legacyFileToken = (await fsPromises.readFile(this.getLegacyServiceTokenFilePath(), 'utf8')).trim();
                if (legacyFileToken) {
                    await fsPromises.mkdir(path.dirname(tokenFile), { recursive: true });
                    await fsPromises.writeFile(tokenFile, legacyFileToken, { encoding: 'utf8', mode: 0o600 });
                    process.env[DB_SERVICE_TOKEN_ENV] = legacyFileToken;
                    return legacyFileToken;
                }
            } catch {
                // Token file will be created below.
            }
        }

        const token = crypto.randomBytes(32).toString('hex');
        await fsPromises.mkdir(path.dirname(tokenFile), { recursive: true });
        await fsPromises.writeFile(tokenFile, token, { encoding: 'utf8', mode: 0o600 });
        process.env[DB_SERVICE_TOKEN_ENV] = token;
        return token;
    }

    /**
     * Check if a port is open
     */
    private isPortOpen(port: number): Promise<boolean> {
        return new Promise(resolve => {
            const socket = new net.Socket();
            socket.setTimeout(OPERATION_TIMEOUTS.PORT_CHECK_FAST);
            socket.on('connect', () => {
                socket.destroy();
                resolve(true);
            });
            socket.on('timeout', () => {
                socket.destroy();
                resolve(false);
            });
            socket.on('error', () => {
                socket.destroy();
                resolve(false);
            });
            socket.connect(port, '127.0.0.1');
        });
    }

    /**
     * Wait for the service to become healthy
     */
    private async waitForHealth(): Promise<void> {
        for (let i = 0; i < MAX_HEALTH_RETRIES; i++) {
            try {
                const response = await this.getHealth();
                if (response.success && response.data?.status === 'healthy') {
                    this.logInfo(`db-service healthy (v${response.data.version})`);
                    return;
                }
            } catch {
                // Continue retrying
            }
            await delay(HEALTH_RETRY_DELAY_MS);
        }
        throw new Error('db-service health check timed out');
    }

    /**
     * Make an API call to the db-service with retry on connection failure
     */
    private async apiCall<T>(
        method: 'GET' | 'POST' | 'PUT' | 'DELETE',
        path: string,
        data?: unknown,
        retryCount = 0
    ): Promise<DbApiResponse<T>> {
        const MAX_RETRIES = 5;
        const INITIAL_RETRY_DELAY_MS = 500;

        // Wait for initialization if in progress, but NOT if we are the one initializing
        if (!this.isReady && this.initPromise && !this.isInitializing) {
            await this.initPromise;
        }

        if (!this.servicePort) {
            // Try to discover port if missing
            this.servicePort = await this.discoverService();
            if (!this.servicePort) {
                // Fallback to fixed port for this project
                this.servicePort = 42000;
            }
        }

        if (this.pendingRequests >= this.maxPendingRequests) {
            return {
                success: false,
                error: `Connection pool overflow: pending=${this.pendingRequests}, max=${this.maxPendingRequests}`
            };
        }

        const url = `http://127.0.0.1:${this.servicePort}${path}`;
        this.pendingRequests += 1;
        this.totalRequests += 1;
        this.lastRequestAt = Date.now();

        try {
            const response = await this.apiClient.request({
                method,
                url,
                data,
                headers: {
                    Authorization: `Bearer ${process.env[DB_SERVICE_TOKEN_ENV] ?? ''}`,
                },
            });
            return response.data as DbApiResponse<T>;
        } catch (error) {
            this.failedRequests += 1;
            const isConnectionError =
                axios.isAxiosError(error) &&
                (error.code === 'ECONNREFUSED' ||
                    error.code === 'ETIMEDOUT' ||
                    error.code === 'ECONNRESET');

            if (isConnectionError && retryCount < MAX_RETRIES) {
                const backoff = INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount);
                this.logWarn(
                    `Connection to db-service failed (${(error as AxiosError).code}). Retrying ${retryCount + 1}/${MAX_RETRIES} in ${backoff}ms...`
                );
                
                // Clear cached port and try to re-discover before retry
                // Only re-discover if we are not on the fixed port
                if (this.servicePort !== 42000) {
                    this.servicePort = await this.discoverService();
                }
                await delay(backoff);
                
                return this.apiCall<T>(method, path, data, retryCount + 1);
            }

            this.logError(`API call failed: ${method} ${path}`, error as Error);
            return {
                success: false,
                error: getErrorMessage(error as Error),
            };
        } finally {
            this.pendingRequests = Math.max(0, this.pendingRequests - 1);
        }
    }

    private requireResponseData<T>(
        response: DbApiResponse<T>,
        operation: string
    ): T {
        if (!response.success) {
            throw new Error(response.error ?? `${operation} failed`);
        }

        if (response.data === undefined) {
            throw new Error(`${operation} completed without response data`);
        }

        return response.data;
    }

    private cloneWorkspaceList(workspaces: DbWorkspace[]): DbWorkspace[] {
        return workspaces.map(workspace => ({ ...workspace }));
    }

    private readWorkspaceListCache(): DbWorkspace[] | null {
        if (!this.workspaceListCache) {
            return null;
        }
        if (this.workspaceListCache.expiresAt <= Date.now()) {
            this.workspaceListCache = null;
            return null;
        }
        return this.cloneWorkspaceList(this.workspaceListCache.data);
    }

    private writeWorkspaceListCache(workspaces: DbWorkspace[]): DbWorkspace[] {
        const clonedWorkspaces = this.cloneWorkspaceList(workspaces);
        this.workspaceListCache = {
            data: clonedWorkspaces,
            expiresAt: Date.now() + WORKSPACE_LIST_CACHE_TTL_MS,
        };
        return this.cloneWorkspaceList(clonedWorkspaces);
    }

    private invalidateWorkspaceListCache(): void {
        this.workspaceListCache = null;
    }

    setPoolLimits(config: { maxSockets?: number; maxFreeSockets?: number; maxPendingRequests?: number }): void {
        if (typeof config.maxPendingRequests === 'number') {
            this.maxPendingRequests = Math.max(1, config.maxPendingRequests);
        }
        if (typeof config.maxSockets === 'number') {
            this.httpAgent.maxSockets = Math.max(1, config.maxSockets);
        }
        if (typeof config.maxFreeSockets === 'number') {
            this.httpAgent.maxFreeSockets = Math.max(1, config.maxFreeSockets);
        }
    }

    async recycleConnectionPool(): Promise<void> {
        this.httpAgent.destroy();
        this.httpAgent = new http.Agent({
            ...HTTP_AGENT_CONFIG,
            maxSockets: this.httpAgent.maxSockets,
            maxFreeSockets: this.httpAgent.maxFreeSockets
        });
        this.apiClient.defaults.httpAgent = this.httpAgent;
    }

    async testConnection(timeoutMs = 5_000): Promise<{ healthy: boolean; latencyMs: number }> {
        const startedAt = Date.now();
        const healthPromise = this.getHealth();
        let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
        const timeoutPromise = new Promise<DbApiResponse<DbHealthResponse>>((resolve) => {
            timeoutHandle = setTimeout(() => resolve({ success: false, error: 'timeout' }), timeoutMs);
            if (timeoutHandle?.unref) { timeoutHandle.unref(); }
        });
        try {
            const health = await Promise.race([healthPromise, timeoutPromise]);
            const latencyMs = Date.now() - startedAt;
            return { healthy: health.success, latencyMs };
        } finally {
            if (timeoutHandle !== null) {
                clearTimeout(timeoutHandle);
            }
        }
    }

    getConnectionPoolMetrics(): {
        maxSockets: number;
        maxFreeSockets: number;
        pendingRequests: number;
        maxPendingRequests: number;
        totalRequests: number;
        failedRequests: number;
        errorRate: number;
        lastRequestAt?: number;
    } {
        const errorRate = this.totalRequests > 0 ? this.failedRequests / this.totalRequests : 0;
        return {
            maxSockets: this.httpAgent.maxSockets,
            maxFreeSockets: this.httpAgent.maxFreeSockets,
            pendingRequests: this.pendingRequests,
            maxPendingRequests: this.maxPendingRequests,
            totalRequests: this.totalRequests,
            failedRequests: this.failedRequests,
            errorRate,
            lastRequestAt: this.lastRequestAt
        };
    }

    // ========================================================================
    // Health
    // ========================================================================

    async getHealth(): Promise<DbApiResponse<DbHealthResponse>> {
        return this.apiCall<DbHealthResponse>('GET', '/health');
    }

    // ========================================================================
    // Chat Operations
    // ========================================================================

    async getAllChats(): Promise<DbChat[]> {
        const response = await this.apiCall<DbChat[]>('GET', '/api/v1/chats');
        return response.data ?? [];
    }

    async getChat(id: string): Promise<DbChat | null> {
        this.validatePathId(id, 'chatId');
        const response = await this.apiCall<DbChat | null>('GET', `/api/v1/chats/${id}`);
        return response.data ?? null;
    }

    async createChat(
        req: DbCreateChatRequest
    ): Promise<{ success: boolean; chat?: DbChat; error?: string }> {
        this.validateRequiredString(req.title, 'title');
        const response = await this.apiCall<DbChat>('POST', '/api/v1/chats', req);
        return {
            success: response.success,
            chat: response.data,
            error: response.error,
        };
    }

    async updateChat(id: string, updates: DbUpdateChatRequest): Promise<boolean> {
        this.validatePathId(id, 'chatId');
        const response = await this.apiCall<boolean>('PUT', `/api/v1/chats/${id}`, updates);
        return response.data ?? false;
    }

    async deleteChat(id: string): Promise<boolean> {
        this.validatePathId(id, 'chatId');
        const response = await this.apiCall<boolean>('DELETE', `/api/v1/chats/${id}`);
        return response.data ?? false;
    }

    // ========================================================================
    // Message Operations
    // ========================================================================

    async getMessages(chatId: string): Promise<DbMessage[]> {
        this.validatePathId(chatId, 'chatId');
        const response = await this.apiCall<DbMessage[]>('GET', `/api/v1/chats/${chatId}/messages`);
        return response.data ?? [];
    }

    async addMessage(
        req: DbCreateMessageRequest
    ): Promise<{ success: boolean; message?: DbMessage; error?: string }> {
        this.validateRequiredString(req.chat_id, 'chat_id');
        this.validateRequiredString(req.role, 'role');
        const response = await this.apiCall<DbMessage>('POST', '/api/v1/messages', req);
        return {
            success: response.success,
            message: response.data,
            error: response.error,
        };
    }

    async updateMessage(id: string, updates: DbUpdateMessageRequest): Promise<boolean> {
        this.validatePathId(id, 'messageId');
        const response = await this.apiCall<boolean>('PUT', `/api/v1/messages/${id}`, updates);
        return response.data ?? false;
    }

    async deleteMessage(id: string): Promise<boolean> {
        this.validatePathId(id, 'messageId');
        const response = await this.apiCall<boolean>('DELETE', `/api/v1/messages/${id}`);
        return response.data ?? false;
    }

    // ========================================================================
    // Workspace Operations
    // ========================================================================

    async getWorkspaces(): Promise<DbWorkspace[]> {
        const cachedWorkspaces = this.readWorkspaceListCache();
        if (cachedWorkspaces) {
            return cachedWorkspaces;
        }
        const response = await this.apiCall<DbWorkspace[]>('GET', '/api/v1/workspaces');
        return this.writeWorkspaceListCache(
            this.requireResponseData(response, 'List workspaces')
        );
    }

    async getWorkspace(id: string): Promise<DbWorkspace | null> {
        this.validatePathId(id, 'workspaceId');
        const response = await this.apiCall<DbWorkspace | null>('GET', `/api/v1/workspaces/${id}`);
        return this.requireResponseData(response, 'Get workspace');
    }

    async createWorkspace(req: DbCreateWorkspaceRequest): Promise<DbWorkspace> {
        this.validateRequiredString(req.title, 'title');
        this.validateRequiredString(req.path, 'path');
        const response = await this.apiCall<DbWorkspace>('POST', '/api/v1/workspaces', req);
        this.invalidateWorkspaceListCache();
        return this.requireResponseData(response, 'Create workspace');
    }

    async updateWorkspace(id: string, updates: DbUpdateWorkspaceRequest): Promise<boolean> {
        this.validatePathId(id, 'workspaceId');
        const response = await this.apiCall<boolean>('PUT', `/api/v1/workspaces/${id}`, updates);
        this.invalidateWorkspaceListCache();
        return response.data ?? false;
    }

    async deleteWorkspace(id: string): Promise<boolean> {
        this.validatePathId(id, 'workspaceId');
        const response = await this.apiCall<boolean>('DELETE', `/api/v1/workspaces/${id}`);
        this.invalidateWorkspaceListCache();
        return response.data ?? false;
    }

    // ========================================================================
    // Folder Operations
    // ========================================================================

    async getFolders(): Promise<DbFolder[]> {
        const response = await this.apiCall<DbFolder[]>('GET', '/api/v1/folders');
        return response.data ?? [];
    }

    async createFolder(
        req: DbCreateFolderRequest
    ): Promise<{ success: boolean; folder?: DbFolder; error?: string }> {
        this.validateRequiredString(req.name, 'name');
        const response = await this.apiCall<DbFolder>('POST', '/api/v1/folders', req);
        return {
            success: response.success,
            folder: response.data,
            error: response.error,
        };
    }

    async updateFolder(id: string, updates: DbUpdateFolderRequest): Promise<boolean> {
        this.validatePathId(id, 'folderId');
        const response = await this.apiCall<boolean>('PUT', `/api/v1/folders/${id}`, updates);
        return response.data ?? false;
    }

    async deleteFolder(id: string): Promise<boolean> {
        this.validatePathId(id, 'folderId');
        const response = await this.apiCall<boolean>('DELETE', `/api/v1/folders/${id}`);
        return response.data ?? false;
    }

    // ========================================================================
    // Prompt Operations
    // ========================================================================

    async getPrompts(): Promise<DbPrompt[]> {
        const response = await this.apiCall<DbPrompt[]>('GET', '/api/v1/prompts');
        return response.data ?? [];
    }

    async createPrompt(
        req: DbCreatePromptRequest
    ): Promise<{ success: boolean; prompt?: DbPrompt; error?: string }> {
        this.validateRequiredString(req.title, 'title');
        this.validateRequiredString(req.content, 'content');
        const response = await this.apiCall<DbPrompt>('POST', '/api/v1/prompts', req);
        return {
            success: response.success,
            prompt: response.data,
            error: response.error,
        };
    }

    async updatePrompt(id: string, updates: DbUpdatePromptRequest): Promise<boolean> {
        this.validatePathId(id, 'promptId');
        const response = await this.apiCall<boolean>('PUT', `/api/v1/prompts/${id}`, updates);
        return response.data ?? false;
    }

    async deletePrompt(id: string): Promise<boolean> {
        this.validatePathId(id, 'promptId');
        const response = await this.apiCall<boolean>('DELETE', `/api/v1/prompts/${id}`);
        return response.data ?? false;
    }

    // ========================================================================
    // Knowledge Operations
    // ========================================================================

    async storeCodeSymbol(req: DbStoreCodeSymbolRequest): Promise<void> {
        this.validateRequiredString(req.name, 'name');
        this.validateRequiredString(
            req[WORKSPACE_COMPAT_PATH_FIELD],
            WORKSPACE_COMPAT_PATH_FIELD
        );
        this.validateRequiredString(req.file_path, 'file_path');
        await this.apiCall<void>('POST', '/api/v1/knowledge/symbols', req);
    }

    async searchCodeSymbols(req: DbVectorSearchRequest): Promise<DbCodeSymbol[]> {
        this.validateArray(req.embedding, 'embedding');
        const response = await this.apiCall<DbCodeSymbol[]>(
            'POST',
            '/api/v1/knowledge/symbols/search',
            req
        );
        return response.data ?? [];
    }

    async storeSemanticFragment(req: DbStoreSemanticFragmentRequest): Promise<void> {
        this.validateRequiredString(req.content, 'content');
        this.validateRequiredString(req.source, 'source');
        this.validateRequiredString(req.source_id, 'source_id');
        this.validateArray(req.embedding, 'embedding');
        await this.apiCall<void>('POST', '/api/v1/knowledge/fragments', req);
    }

    async searchSemanticFragments(req: DbVectorSearchRequest): Promise<DbSemanticFragment[]> {
        this.validateArray(req.embedding, 'embedding');
        const response = await this.apiCall<DbSemanticFragment[]>(
            'POST',
            '/api/v1/knowledge/fragments/search',
            req
        );
        return response.data ?? [];
    }

    async executeQuery(req: DbQueryRequest): Promise<DbQueryResponse> {
        this.validateRequiredString(req.sql, 'sql');
        if (req.params !== undefined) {
            this.validateArray(req.params, 'params');
        }

        const response = await this.apiCall<DbQueryResponse>('POST', '/api/v1/query', req);
        return this.requireResponseData(response, 'Execute query');
    }

    // ========================================================================
    // Stats Operations
    // ========================================================================

    async getStats(): Promise<DbStats> {
        const response = await this.apiCall<DbStats>('GET', '/api/v1/stats');
        return (
            response.data ?? {
                chatCount: 0,
                messageCount: 0,
                dbSize: 0,
            }
        );
    }
    /**
     * Check if the service is ready
     */
    isConnected(): boolean {
        return this.isReady && this.servicePort !== null;
    }

    /**
     * Cleanup resources
     */
    override async cleanup(): Promise<void> {
        this.logInfo('Cleaning up database client...');
        this.isReady = false;

        // PERF-003-4: Destroy HTTP agent and close all pooled connections
        this.httpAgent.destroy();

        // PERF-117: Clear port file cache
        this.portFileCache.clear();
        this.invalidateWorkspaceListCache();

        // Note: We don't stop the service as it's persistent
    }
}
