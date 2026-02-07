/**
 * Database Client Service
 *
 * HTTP client for communicating with the standalone Rust database service.
 * This service provides the same interface as DatabaseService but uses
 * HTTP calls to the external db-service.
 */

import * as fs from 'fs';
import * as http from 'http';
import * as net from 'net';
import * as path from 'path';

import { BaseService } from '@main/services/base.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { ProcessManagerService } from '@main/services/system/process-manager.service';
import {
    DbApiResponse,
    DbChat,
    DbCodeSymbol,
    DbCreateChatRequest,
    DbCreateFolderRequest,
    DbCreateMessageRequest,
    DbCreateProjectRequest,
    DbCreatePromptRequest,
    DbFolder,
    DbHealthResponse,
    DbMessage,
    DbProject,
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
    DbUpdateProjectRequest,
    DbUpdatePromptRequest,
    DbVectorSearchRequest
} from '@shared/types/db-api';
import { getErrorMessage } from '@shared/utils/error.util';
import axios, { AxiosInstance } from 'axios';
import { app } from 'electron';

const SERVICE_NAME = 'db-service';
const MAX_HEALTH_RETRIES = 30;
const HEALTH_RETRY_DELAY_MS = 500;

// PERF-003-4: HTTP agent configuration for connection pooling
const HTTP_AGENT_CONFIG = {
    keepAlive: true,           // Enable keep-alive connections
    keepAliveMsecs: 1000,      // Initial delay for keep-alive probes
    maxSockets: 10,            // Maximum concurrent sockets per host
    maxFreeSockets: 5,         // Maximum idle sockets to keep in pool
    timeout: 60000             // Socket timeout in ms
};

/**
 * Database Client Service - communicates with the standalone Rust database service
 */
export class DatabaseClientService extends BaseService {
    private apiClient: AxiosInstance;
    private servicePort: number | null = null;
    private isReady = false;
    // PERF-003-4: HTTP agent for connection pooling
    private httpAgent: http.Agent;

    constructor(
        private eventBus: EventBusService,
        private processManager: ProcessManagerService
    ) {
        super('DatabaseClientService');

        // PERF-003-4: Create reusable HTTP agent with connection pooling
        this.httpAgent = new http.Agent(HTTP_AGENT_CONFIG);

        this.apiClient = axios.create({
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json'
            },
            // PERF-003-4: Use connection pooling agent
            httpAgent: this.httpAgent
        });
    }

    /**
     * Initialize the database client
     */
    override async initialize(): Promise<void> {
        this.logInfo('Initializing database client...');

        try {
            // Discover or start the db-service
            this.servicePort = await this.discoverOrStartService();

            if (!this.servicePort) {
                throw new Error('Failed to discover or start db-service');
            }

            // Wait for health check
            await this.waitForHealth();

            this.isReady = true;
            this.eventBus.emit('db:ready', { timestamp: Date.now() });
            this.logInfo(`Connected to db-service on port ${this.servicePort}`);
        } catch (error) {
            this.logError('Failed to initialize database client', error);
            this.eventBus.emit('db:error', { error: getErrorMessage(error) });
            throw error;
        }
    }

    /**
     * Discover existing service or start a new one
     */
    private async discoverOrStartService(): Promise<number | null> {
        // Try to discover existing service
        const existingPort = await this.discoverService();
        if (existingPort) {
            this.logInfo(`Discovered existing db-service on port ${existingPort}`);
            return existingPort;
        }

        // Start new service
        this.logInfo('Starting db-service...');
        await this.processManager.startService({
            name: SERVICE_NAME,
            executable: 'tandem-db-service',
            args: ['--console'], // Run in console mode, not as Windows Service
            persistent: true
        });

        // Wait for port file to appear
        const maxAttempts = 50;
        for (let i = 0; i < maxAttempts; i++) {
            const port = await this.discoverService();
            if (port) {
                return port;
            }
            await this.sleep(100);
        }

        return null;
    }

    /**
     * Discover the service port from the port file
     */
    private async discoverService(): Promise<number | null> {
        const portFile = this.getPortFilePath();
        if (!fs.existsSync(portFile)) {
            return null;
        }

        try {
            const content = fs.readFileSync(portFile, 'utf8').trim();
            const port = parseInt(content, 10);
            if (isNaN(port)) {
                return null;
            }

            // Verify the port is open
            const isOpen = await this.isPortOpen(port);
            if (!isOpen) {
                // Clean up stale port file
                try { fs.unlinkSync(portFile); } catch { /* ignore */ }
                return null;
            }

            return port;
        } catch {
            return null;
        }
    }

    /**
     * Get the port file path
     */
    private getPortFilePath(): string {
        const appData = app.getPath('appData');
        return path.join(appData, 'tandem', 'services', `${SERVICE_NAME}.port`);
    }

    /**
     * Check if a port is open
     */
    private isPortOpen(port: number): Promise<boolean> {
        return new Promise((resolve) => {
            const socket = new net.Socket();
            socket.setTimeout(200);
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
            await this.sleep(HEALTH_RETRY_DELAY_MS);
        }
        throw new Error('db-service health check timed out');
    }

    /**
     * Sleep utility
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Make an API call to the db-service
     */
    private async apiCall<T>(
        method: 'GET' | 'POST' | 'PUT' | 'DELETE',
        path: string,
        data?: unknown
    ): Promise<DbApiResponse<T>> {
        if (!this.servicePort) {
            throw new Error('db-service not connected');
        }

        const url = `http://127.0.0.1:${this.servicePort}${path}`;

        try {
            const response = await this.apiClient.request({
                method,
                url,
                data
            });
            return response.data as DbApiResponse<T>;
        } catch (error) {
            this.logError(`API call failed: ${method} ${path}`, error);
            return {
                success: false,
                error: getErrorMessage(error)
            };
        }
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
        const response = await this.apiCall<DbChat | null>('GET', `/api/v1/chats/${id}`);
        return response.data ?? null;
    }

    async createChat(req: DbCreateChatRequest): Promise<{ success: boolean; chat?: DbChat; error?: string }> {
        const response = await this.apiCall<DbChat>('POST', '/api/v1/chats', req);
        return {
            success: response.success,
            chat: response.data,
            error: response.error
        };
    }

    async updateChat(id: string, updates: DbUpdateChatRequest): Promise<boolean> {
        const response = await this.apiCall<boolean>('PUT', `/api/v1/chats/${id}`, updates);
        return response.data ?? false;
    }

    async deleteChat(id: string): Promise<boolean> {
        const response = await this.apiCall<boolean>('DELETE', `/api/v1/chats/${id}`);
        return response.data ?? false;
    }

    // ========================================================================
    // Message Operations
    // ========================================================================

    async getMessages(chatId: string): Promise<DbMessage[]> {
        const response = await this.apiCall<DbMessage[]>('GET', `/api/v1/chats/${chatId}/messages`);
        return response.data ?? [];
    }

    async addMessage(req: DbCreateMessageRequest): Promise<{ success: boolean; message?: DbMessage; error?: string }> {
        const response = await this.apiCall<DbMessage>('POST', '/api/v1/messages', req);
        return {
            success: response.success,
            message: response.data,
            error: response.error
        };
    }

    async updateMessage(id: string, updates: DbUpdateMessageRequest): Promise<boolean> {
        const response = await this.apiCall<boolean>('PUT', `/api/v1/messages/${id}`, updates);
        return response.data ?? false;
    }

    async deleteMessage(id: string): Promise<boolean> {
        const response = await this.apiCall<boolean>('DELETE', `/api/v1/messages/${id}`);
        return response.data ?? false;
    }

    // ========================================================================
    // Project Operations
    // ========================================================================

    async getProjects(): Promise<DbProject[]> {
        const response = await this.apiCall<DbProject[]>('GET', '/api/v1/projects');
        return response.data ?? [];
    }

    async getProject(id: string): Promise<DbProject | null> {
        const response = await this.apiCall<DbProject | null>('GET', `/api/v1/projects/${id}`);
        return response.data ?? null;
    }

    async createProject(req: DbCreateProjectRequest): Promise<{ success: boolean; project?: DbProject; error?: string }> {
        const response = await this.apiCall<DbProject>('POST', '/api/v1/projects', req);
        return {
            success: response.success,
            project: response.data,
            error: response.error
        };
    }

    async updateProject(id: string, updates: DbUpdateProjectRequest): Promise<boolean> {
        const response = await this.apiCall<boolean>('PUT', `/api/v1/projects/${id}`, updates);
        return response.data ?? false;
    }

    async deleteProject(id: string): Promise<boolean> {
        const response = await this.apiCall<boolean>('DELETE', `/api/v1/projects/${id}`);
        return response.data ?? false;
    }

    // ========================================================================
    // Folder Operations
    // ========================================================================

    async getFolders(): Promise<DbFolder[]> {
        const response = await this.apiCall<DbFolder[]>('GET', '/api/v1/folders');
        return response.data ?? [];
    }

    async createFolder(req: DbCreateFolderRequest): Promise<{ success: boolean; folder?: DbFolder; error?: string }> {
        const response = await this.apiCall<DbFolder>('POST', '/api/v1/folders', req);
        return {
            success: response.success,
            folder: response.data,
            error: response.error
        };
    }

    async updateFolder(id: string, updates: DbUpdateFolderRequest): Promise<boolean> {
        const response = await this.apiCall<boolean>('PUT', `/api/v1/folders/${id}`, updates);
        return response.data ?? false;
    }

    async deleteFolder(id: string): Promise<boolean> {
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

    async createPrompt(req: DbCreatePromptRequest): Promise<{ success: boolean; prompt?: DbPrompt; error?: string }> {
        const response = await this.apiCall<DbPrompt>('POST', '/api/v1/prompts', req);
        return {
            success: response.success,
            prompt: response.data,
            error: response.error
        };
    }

    async updatePrompt(id: string, updates: DbUpdatePromptRequest): Promise<boolean> {
        const response = await this.apiCall<boolean>('PUT', `/api/v1/prompts/${id}`, updates);
        return response.data ?? false;
    }

    async deletePrompt(id: string): Promise<boolean> {
        const response = await this.apiCall<boolean>('DELETE', `/api/v1/prompts/${id}`);
        return response.data ?? false;
    }

    // ========================================================================
    // Knowledge Operations
    // ========================================================================

    async storeCodeSymbol(req: DbStoreCodeSymbolRequest): Promise<void> {
        await this.apiCall<void>('POST', '/api/v1/knowledge/symbols', req);
    }

    async searchCodeSymbols(req: DbVectorSearchRequest): Promise<DbCodeSymbol[]> {
        const response = await this.apiCall<DbCodeSymbol[]>('POST', '/api/v1/knowledge/symbols/search', req);
        return response.data ?? [];
    }

    async storeSemanticFragment(req: DbStoreSemanticFragmentRequest): Promise<void> {
        await this.apiCall<void>('POST', '/api/v1/knowledge/fragments', req);
    }

    async searchSemanticFragments(req: DbVectorSearchRequest): Promise<DbSemanticFragment[]> {
        const response = await this.apiCall<DbSemanticFragment[]>('POST', '/api/v1/knowledge/fragments/search', req);
        return response.data ?? [];
    }

    // ========================================================================
    // Stats Operations
    // ========================================================================

    async getStats(): Promise<DbStats> {
        const response = await this.apiCall<DbStats>('GET', '/api/v1/stats');
        return response.data ?? {
            chatCount: 0,
            messageCount: 0,
            dbSize: 0
        };
    }

    // ========================================================================
    // Raw Query Operations
    // ========================================================================

    async executeQuery(req: DbQueryRequest): Promise<DbQueryResponse> {
        const response = await this.apiCall<DbQueryResponse>('POST', '/api/v1/query', req);
        return response.data ?? { rows: [], affected_rows: 0 };
    }

    // ========================================================================
    // Lifecycle
    // ========================================================================

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

        // Note: We don't stop the service as it's persistent
    }
}
