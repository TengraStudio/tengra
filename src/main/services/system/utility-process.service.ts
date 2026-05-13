/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { getErrorMessage } from '@shared/utils/error.util';
import { UtilityProcess, utilityProcess } from 'electron';

export interface UtilityProcessOptions {
    name: string;
    entryPoint: string;
    args?: string[];
    env?: Record<string, string>;
}

interface UtilityProcessRequest {
    requestId: string;
    type: string;
    payload?: RuntimeValue;
}

interface UtilityProcessResponse {
    requestId: string;
    success: boolean;
    payload?: RuntimeValue;
    error?: string;
}

type UtilityProcessMessage = RuntimeValue | UtilityProcessResponse;

interface PendingUtilityProcessRequest {
    resolve: (value: RuntimeValue) => void;
    reject: (reason?: Error) => void;
    timeout: NodeJS.Timeout;
}

/**
 * Service to manage Electron's UtilityProcess workers.
 * These are more efficient than full BrowserWindow workers and isolated from the main process.
 */
export class UtilityProcessService extends BaseService {
    static readonly serviceName = 'utilityProcessService';
    static readonly dependencies = [] as const;
    private readonly processes = new Map<string, UtilityProcess>();
    private readonly pendingRequests = new Map<string, PendingUtilityProcessRequest>();
    private readonly messageListeners = new Map<string, Set<(message: RuntimeValue) => void>>();

    constructor() {
        super('UtilityProcessService');
    }

    async initialize(): Promise<void> {
        appLogger.debug('UtilityProcessService', 'Utility process service initialized.');
    }

    /**
     * Spawns a new utility process for background work.
     */
    spawn(options: UtilityProcessOptions): string {
        try {
            const processId = `${options.name}-${Math.random().toString(36).substring(2, 9)}`;

            const child = utilityProcess.fork(options.entryPoint, options.args || [], {
                env: { ...process.env, ...options.env },
                execArgv: ['--no-warnings'],
                serviceName: options.name
            });

            child.on('spawn', () => {
                appLogger.debug('UtilityProcessService', `Process ${options.name} (${processId}) spawned successfully.`);
            });

            child.on('exit', (code) => {
                appLogger.info('UtilityProcessService', `Process ${options.name} (${processId}) exited with code ${code}.`);
                this.clearPendingRequestsForProcess(processId, `Process exited with code ${code}`);
                this.messageListeners.delete(processId);
                this.processes.delete(processId);
            });

            child.on('error', (error) => {
                appLogger.error('UtilityProcessService', `Process ${options.name} (${processId}) encountered an error: ${getErrorMessage(error)}`);
            });

            this.processes.set(processId, child);
            child.on('message', (message: UtilityProcessMessage) => {
                this.handleProcessMessage(processId, message);
            });
            return processId;
        } catch (error) {
            appLogger.error('UtilityProcessService', `Failed to spawn ${options.name}: ${getErrorMessage(error)}`);
            throw error;
        }
    }

    postMessage(processId: string, message: RuntimeValue): void {
        const child = this.processes.get(processId);
        if (child) {
            child.postMessage(message);
        } else {
            appLogger.warn('UtilityProcessService', `Cannot post message: Process ${processId} not found.`);
        }
    }

    onMessage(processId: string, callback: (message: RuntimeValue) => void): void {
        const child = this.processes.get(processId);
        if (child) {
            const listeners = this.messageListeners.get(processId) ?? new Set<(message: RuntimeValue) => void>();
            listeners.add(callback);
            this.messageListeners.set(processId, listeners);
        }
    }

    request(processId: string, type: string, payload?: RuntimeValue, timeoutMs = 10_000): Promise<RuntimeValue> {
        const child = this.processes.get(processId);
        if (!child) {
            return Promise.reject(new Error(`Process ${processId} not found.`));
        }

        const requestId = `${processId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        return new Promise<RuntimeValue>((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error(`Utility process request timed out: ${type}`));
            }, timeoutMs);

            this.pendingRequests.set(requestId, { resolve, reject, timeout });
            const message: UtilityProcessRequest = {
                requestId,
                type,
                payload,
            };
            child.postMessage(message);
        });
    }

    terminate(processId: string): boolean {
        const child = this.processes.get(processId);
        if (child) {
            child.kill();
            this.clearPendingRequestsForProcess(processId, 'Process terminated');
            this.messageListeners.delete(processId);
            this.processes.delete(processId);
            return true;
        }
        return false;
    }

    async dispose(): Promise<void> {
        appLogger.info('UtilityProcessService', 'Terminating all utility processes...');
        for (const [id, child] of this.processes.entries()) {
            child.kill();
            appLogger.debug('UtilityProcessService', `Terminated ${id}`);
        }
        for (const pendingRequest of this.pendingRequests.values()) {
            clearTimeout(pendingRequest.timeout);
        }
        this.pendingRequests.clear();
        this.messageListeners.clear();
        this.processes.clear();
    }

    private handleProcessMessage(processId: string, message: UtilityProcessMessage): void {
        if (this.isUtilityProcessResponse(message)) {
            const pendingRequest = this.pendingRequests.get(message.requestId);
            if (!pendingRequest) {
                return;
            }

            clearTimeout(pendingRequest.timeout);
            this.pendingRequests.delete(message.requestId);
            if (message.success) {
                pendingRequest.resolve(message.payload ?? null);
            } else {
                pendingRequest.reject(new Error(message.error ?? 'Utility process request failed'));
            }
            return;
        }

        const listeners = this.messageListeners.get(processId);
        if (!listeners) {
            return;
        }
        listeners.forEach(listener => listener(message as RuntimeValue));
    }

    private clearPendingRequestsForProcess(processId: string, reason: string): void {
        for (const [requestId, pendingRequest] of this.pendingRequests.entries()) {
            if (!requestId.startsWith(`${processId}-`)) {
                continue;
            }
            clearTimeout(pendingRequest.timeout);
            pendingRequest.reject(new Error(reason));
            this.pendingRequests.delete(requestId);
        }
    }

    private isUtilityProcessResponse(message: UtilityProcessMessage): message is UtilityProcessResponse {
        if (!message || typeof message !== 'object' || Array.isArray(message)) {
            return false;
        }
        return (
            'requestId' in message
            && typeof message.requestId === 'string'
            && 'success' in message
            && typeof message.success === 'boolean'
        );
    }
}

