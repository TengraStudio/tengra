/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { promises as fs } from 'fs';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { HuggingFaceService } from '@main/services/llm/huggingface.service';
import { LlamaService } from '@main/services/llm/llama.service';
import { OllamaService } from '@main/services/llm/ollama.service';
import { getDataFilePath } from '@main/services/system/app-layout-paths.util';
import { getErrorMessage } from '@shared/utils/error.util';

export type DownloadProvider = 'ollama' | 'huggingface';

export interface HFDownloadFileInput {
    path: string;
    size: number;
    oid?: string;
    quantization?: string;
}

export type ModelDownloadRequest =
    | {
        provider: 'ollama';
        modelName: string;
        tag?: string;
    }
    | {
        provider: 'huggingface';
        modelId: string;
        file: HFDownloadFileInput;
        scheduleAtMs?: number;
    };

export interface ModelDownloadProgress {
    downloadId: string;
    provider: DownloadProvider;
    status:
    | 'queued'
    | 'starting'
    | 'downloading'
    | 'installing'
    | 'paused'
    | 'cancelled'
    | 'completed'
    | 'error';
    modelRef: string;
    received?: number;
    total?: number;
    speed?: number; // bytes per second
    eta?: number; // seconds remaining
    outputPath?: string;
    message?: string;
}

export interface ModelDownloadResult {
    success: boolean;
    downloadId?: string;
    provider: DownloadProvider;
    modelRef: string;
    outputPath?: string;
    error?: string;
}

export interface ModelDownloadHistoryEntry {
    id: string;
    downloadId: string;
    provider: DownloadProvider;
    modelRef: string;
    status: ModelDownloadProgress['status'];
    message?: string;
    outputPath?: string;
    received?: number;
    total?: number;
    speed?: number;
    eta?: number;
    startedAt: number;
    updatedAt: number;
    endedAt?: number;
    retryRequest?: ModelDownloadRequest;
}

interface ModelDownloaderDeps {
    ollamaService: OllamaService;
    huggingFaceService: HuggingFaceService;
    llamaService: LlamaService;
}

type DownloadEmitter = (progress: ModelDownloadProgress) => void;
type DownloadTaskState = 'queued' | 'running' | 'paused' | 'cancelled' | 'completed' | 'error';
const ALLOWED_STATE_TRANSITIONS: Record<DownloadTaskState, readonly DownloadTaskState[]> = {
    queued: ['running', 'paused', 'cancelled'],
    running: ['paused', 'cancelled', 'completed', 'error'],
    paused: ['queued', 'cancelled'],
    cancelled: [],
    completed: [],
    error: [],
};

interface ActiveDownloadTask {
    downloadId: string;
    provider: DownloadProvider;
    modelRef: string;
    request: ModelDownloadRequest;
    outputPath?: string;
    state: DownloadTaskState;
    abortController?: AbortController;
    emitter: DownloadEmitter;
    occupiesSlot: boolean;
}

interface PersistedDownloadTask {
    request: ModelDownloadRequest;
    modelRef: string;
    state: 'queued' | 'paused' | 'running';
}

interface DownloadProgressStats {
    lastReceived: number;
    lastTime: number;
    startTime: number;
    startReceived: number;
}

function sanitizeFileSegment(value: string): string {
    return value.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function makeDownloadId(provider: DownloadProvider, modelRef: string): string {
    return `${provider}:${modelRef}:${Date.now()}`;
}

function computeModelRef(request: ModelDownloadRequest): string {
    if (request.provider === 'ollama') {
        const tag = (request.tag || 'latest').trim() || 'latest';
        return `${request.modelName.trim()}:${tag}`;
    }
    return `${request.modelId.trim()}/${request.file.path}`;
}

export class ModelDownloaderService extends BaseService {
    private readonly tasks = new Map<string, ActiveDownloadTask>();
    private readonly modelRefToDownloadId = new Map<string, string>();
    private readonly providerLimits: Record<DownloadProvider, number> = {
        ollama: 1,
        huggingface: 2,
    };
    private readonly globalConcurrency = 3;
    private readonly providerRunningCount: Record<DownloadProvider, number> = {
        ollama: 0,
        huggingface: 0,
    };
    private runningCount = 0;
    private readonly globalListeners = new Set<DownloadEmitter>();
    private isRestoring = false;
    private readonly history = new Map<string, ModelDownloadHistoryEntry>();
    private readonly historyOrder: string[] = [];
    private readonly MAX_HISTORY_ENTRIES = 500;
    private readonly taskStats = new Map<string, DownloadProgressStats>();
    private historyPersistTimer: NodeJS.Timeout | null = null;
    private historyPersistDirty = false;
    private historyPersistInFlight = false;

    private getPersistencePath(): string {
        return getDataFilePath('downloads', 'model-download-queue.json');
    }

    private getHistoryPersistencePath(): string {
        return getDataFilePath('downloads', 'model-download-history.json');
    }

    constructor(private readonly deps: ModelDownloaderDeps) {
        super('ModelDownloaderService');
    }

    startDownload(
        request: ModelDownloadRequest,
        onProgress?: (progress: ModelDownloadProgress) => void
    ): ModelDownloadResult {
        const modelRef = computeModelRef(request);
        const existingId = this.modelRefToDownloadId.get(modelRef);
        if (existingId) {
            const existingTask = this.tasks.get(existingId);
            if (existingTask && !['cancelled', 'completed', 'error'].includes(existingTask.state)) {
                return {
                    success: true,
                    downloadId: existingTask.downloadId,
                    provider: existingTask.provider,
                    modelRef: existingTask.modelRef,
                    outputPath: existingTask.outputPath,
                };
            }
        }

        const downloadId = makeDownloadId(request.provider, modelRef);
        const emitter: DownloadEmitter = (progress) => {
            onProgress?.(progress);
        };
        const task: ActiveDownloadTask = {
            downloadId,
            provider: request.provider,
            modelRef,
            request,
            state: 'queued',
            emitter,
            abortController: request.provider === 'huggingface' ? new AbortController() : undefined,
            occupiesSlot: false,
        };

        this.tasks.set(downloadId, task);
        this.modelRefToDownloadId.set(modelRef, downloadId);
        this.emitProgress(task, {
            downloadId: task.downloadId,
            provider: task.provider,
            status: 'queued',
            modelRef: task.modelRef,
            message: 'Download queued',
        });
        void this.persistQueue();
        this.scheduleDownloads();

        return {
            success: true,
            downloadId,
            provider: request.provider,
            modelRef,
        };
    }

    pauseDownload(downloadId: string): boolean {
        const task = this.tasks.get(downloadId);
        if (!task) {
            return false;
        }
        if (task.state === 'queued') {
            if (!this.transitionTaskState(task, 'paused', 'pause queued')) {
                return false;
            }
            this.emitProgress(task, {
                downloadId: task.downloadId,
                provider: task.provider,
                status: 'paused',
                modelRef: task.modelRef,
                outputPath: task.outputPath,
                message: 'Queued download paused',
            });
            void this.persistQueue();
            return true;
        }
        if (task.state !== 'running') {
            return false;
        }

        if (!this.transitionTaskState(task, 'paused', 'pause running')) {
            return false;
        }
        if (task.provider === 'huggingface') {
            task.abortController?.abort();
        } else {
            this.deps.ollamaService.abort();
        }
        this.emitProgress(task, {
            downloadId: task.downloadId,
            provider: task.provider,
            status: 'paused',
            modelRef: task.modelRef,
            outputPath: task.outputPath,
            message: 'Download paused',
        });
        void this.persistQueue();
        return true;
    }

    cancelDownload(downloadId: string): boolean {
        const task = this.tasks.get(downloadId);
        if (!task) {
            return false;
        }

        const previousState = task.state;
        if (!this.transitionTaskState(task, 'cancelled', 'cancel')) {
            return false;
        }
        if (previousState === 'queued' || previousState === 'paused') {
            this.emitProgress(task, {
                downloadId: task.downloadId,
                provider: task.provider,
                status: 'cancelled',
                modelRef: task.modelRef,
                outputPath: task.outputPath,
                message: 'Download cancelled',
            });
            this.cleanupTask(task);
            void this.persistQueue();
            this.scheduleDownloads();
            return true;
        }

        if (task.provider === 'huggingface') {
            task.abortController?.abort();
        } else {
            this.deps.ollamaService.abort();
        }
        this.emitProgress(task, {
            downloadId: task.downloadId,
            provider: task.provider,
            status: 'cancelled',
            modelRef: task.modelRef,
            outputPath: task.outputPath,
            message: 'Download cancelled',
        });
        void this.persistQueue();
        return true;
    }

    resumeDownload(downloadId: string): ModelDownloadResult {
        const task = this.tasks.get(downloadId);
        if (task?.state !== 'paused') {
            return { success: false, provider: 'ollama', modelRef: '', error: 'Task is not paused' };
        }

        if (!this.transitionTaskState(task, 'queued', 'resume')) {
            return { success: false, provider: task.provider, modelRef: task.modelRef, error: 'Invalid state transition' };
        }
        if (task.provider === 'huggingface') {
            task.abortController = new AbortController();
        }
        this.emitProgress(task, {
            downloadId: task.downloadId,
            provider: task.provider,
            status: 'queued',
            modelRef: task.modelRef,
            outputPath: task.outputPath,
            message: 'Download resumed and queued',
        });
        void this.persistQueue();
        this.scheduleDownloads();
        return {
            success: true,
            downloadId: task.downloadId,
            provider: task.provider,
            modelRef: task.modelRef,
            outputPath: task.outputPath,
        };
    }

    subscribeProgress(listener: DownloadEmitter): () => void {
        this.globalListeners.add(listener);
        return () => {
            this.globalListeners.delete(listener);
        };
    }

    getHistory(limit = 100): ModelDownloadHistoryEntry[] {
        const safeLimit = Math.max(1, Math.min(this.MAX_HISTORY_ENTRIES, limit));
        const items: ModelDownloadHistoryEntry[] = [];
        for (let i = this.historyOrder.length - 1; i >= 0 && items.length < safeLimit; i--) {
            const id = this.historyOrder[i];
            const entry = this.history.get(id);
            if (entry) {
                items.push({ ...entry });
            }
        }
        return items;
    }

    retryFromHistory(historyId: string): ModelDownloadResult {
        const entry = this.history.get(historyId);
        if (!entry?.retryRequest) {
            return {
                success: false,
                provider: 'ollama',
                modelRef: '',
                error: 'Retry request not found',
            };
        }
        return this.startDownload(entry.retryRequest);
    }

    async restorePersistedQueue(): Promise<void> {
        if (this.isRestoring) {
            return;
        }
        this.isRestoring = true;
        try {
            const raw = await fs.readFile(this.getPersistencePath(), 'utf8');
            const parsed = JSON.parse(raw) as { tasks?: PersistedDownloadTask[] };
            const tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
            for (const item of tasks) {
                if (!this.isValidPersistedState(item.state)) {
                    appLogger.warn(this.name, `Skipping persisted task with invalid state: ${String(item.state)}`);
                    continue;
                }
                const request = item.request;
                const modelRef = computeModelRef(request);
                if (modelRef !== item.modelRef) {
                    continue;
                }
                const existingId = this.modelRefToDownloadId.get(modelRef);
                if (existingId) {
                    continue;
                }
                const downloadId = makeDownloadId(request.provider, modelRef);
                const task: ActiveDownloadTask = {
                    downloadId,
                    provider: request.provider,
                    modelRef,
                    request,
                    state: 'paused',
                    emitter: () => undefined,
                    abortController: request.provider === 'huggingface' ? new AbortController() : undefined,
                    occupiesSlot: false,
                };
                this.tasks.set(downloadId, task);
                this.modelRefToDownloadId.set(modelRef, downloadId);
                this.emitProgress(task, {
                    downloadId: task.downloadId,
                    provider: task.provider,
                    status: 'paused',
                    modelRef: task.modelRef,
                    message: item.state === 'paused' ? 'Restored paused download' : 'Stopped during app shutdown - paused',
                });
            }
            this.scheduleDownloads();
            appLogger.info(this.name, `Restored ${tasks.length} persisted download task(s)`);
            await this.restorePersistedHistory();
        } catch (error) {
            const message = getErrorMessage(error as Error);
            if (!message.toLowerCase().includes('enoent')) {
                appLogger.warn(this.name, `Failed to restore persisted queue: ${message}`);
            }
        } finally {
            this.isRestoring = false;
        }
    }

    private isValidPersistedState(state: RuntimeValue): state is PersistedDownloadTask['state'] {
        return state === 'queued' || state === 'paused' || state === 'running';
    }

    private transitionTaskState(task: ActiveDownloadTask, nextState: DownloadTaskState, reason: string): boolean {
        if (task.state === nextState) {
            return true;
        }
        const allowedTransitions = ALLOWED_STATE_TRANSITIONS[task.state];
        if (!allowedTransitions.includes(nextState)) {
            appLogger.warn(
                this.name,
                `Invalid transition blocked (${task.downloadId}): ${task.state} -> ${nextState} (${reason})`
            );
            return false;
        }
        task.state = nextState;
        return true;
    }

    private emitProgress(task: ActiveDownloadTask, progress: ModelDownloadProgress): void {
        // Calculate speed and ETA if downloading
        if (progress.status === 'downloading' && progress.received !== undefined && progress.total !== undefined) {
            const now = Date.now();
            let stats = this.taskStats.get(task.downloadId);
            
            if (!stats) {
                stats = {
                    lastReceived: progress.received,
                    lastTime: now,
                    startTime: now,
                    startReceived: progress.received
                };
                this.taskStats.set(task.downloadId, stats);
            }

            const timeDiff = (now - stats.lastTime) / 1000; // seconds
            if (timeDiff >= 0.5) { // Update speed every 500ms
                const bytesDiff = progress.received - stats.lastReceived;
                const speed = bytesDiff / timeDiff; // bps
                
                // Average speed since start for smoother ETA
                const totalTime = (now - stats.startTime) / 1000;
                const totalBytes = progress.received - stats.startReceived;
                const avgSpeed = totalTime > 0 ? totalBytes / totalTime : speed;

                progress.speed = speed;
                if (avgSpeed > 0) {
                    progress.eta = Math.max(0, (progress.total - progress.received) / avgSpeed);
                }

                stats.lastReceived = progress.received;
                stats.lastTime = now;
            } else {
                // Keep previous values if diff is too small
                const lastHistory = Array.from(this.history.values())
                    .find(h => h.downloadId === task.downloadId);
                if (lastHistory) {
                    progress.speed = lastHistory.speed;
                    progress.eta = lastHistory.eta;
                }
            }
        } else if (['completed', 'error', 'cancelled'].includes(progress.status)) {
            this.taskStats.delete(task.downloadId);
        }

        this.trackHistory(task, progress);
        task.emitter(progress);
        for (const listener of this.globalListeners) {
            listener(progress);
        }
    }

    private trackHistory(task: ActiveDownloadTask, progress: ModelDownloadProgress): void {
        const existingId = this.historyOrder.find(
            id => this.history.get(id)?.downloadId === task.downloadId
        );
        const now = Date.now();
        const historyId = existingId ?? `${task.downloadId}:${now}`;
        const previous = existingId ? this.history.get(historyId) : undefined;
        const entry: ModelDownloadHistoryEntry = {
            id: historyId,
            downloadId: task.downloadId,
            provider: progress.provider,
            modelRef: progress.modelRef,
            status: progress.status,
            message: progress.message,
            outputPath: progress.outputPath ?? previous?.outputPath,
            received: progress.received,
            total: progress.total,
            speed: progress.speed,
            eta: progress.eta,
            startedAt: previous?.startedAt ?? now,
            updatedAt: now,
            endedAt: ['completed', 'cancelled', 'error'].includes(progress.status) ? now : previous?.endedAt,
            retryRequest: ['completed', 'cancelled', 'error'].includes(progress.status)
                ? task.request
                : previous?.retryRequest,
        };
        this.history.set(historyId, entry);
        if (!existingId) {
            this.historyOrder.push(historyId);
            while (this.historyOrder.length > this.MAX_HISTORY_ENTRIES) {
                const removed = this.historyOrder.shift();
                if (removed) {
                    this.history.delete(removed);
                }
            }
        }
        this.scheduleHistoryPersistence();
    }

    private async persistQueue(): Promise<void> {
        const tasks: PersistedDownloadTask[] = [];
        for (const task of this.tasks.values()) {
            if (task.state === 'cancelled' || task.state === 'completed' || task.state === 'error') {
                continue;
            }
            tasks.push({
                request: task.request,
                modelRef: task.modelRef,
                state: task.state === 'running' ? 'queued' : task.state,
            });
        }
        await this.writePersistedQueue({ tasks });
    }

    private async writePersistedQueue(payload: { tasks: PersistedDownloadTask[] }): Promise<void> {
        try {
            await fs.writeFile(this.getPersistencePath(), JSON.stringify(payload, null, 2), 'utf8');
        } catch (error) {
            appLogger.warn(this.name, `Failed to persist queue: ${getErrorMessage(error as Error)}`);
        }
    }

    private scheduleHistoryPersistence(): void {
        this.historyPersistDirty = true;
        if (this.historyPersistTimer) {
            return;
        }
        this.historyPersistTimer = setTimeout(() => {
            this.historyPersistTimer = null;
            void this.flushHistoryPersistence();
        }, 500);
    }

    private async flushHistoryPersistence(): Promise<void> {
        if (this.historyPersistInFlight) {
            this.scheduleHistoryPersistence();
            return;
        }
        if (!this.historyPersistDirty) {
            return;
        }
        this.historyPersistDirty = false;
        this.historyPersistInFlight = true;
        const items = this.historyOrder
            .map(id => this.history.get(id))
            .filter((entry): entry is ModelDownloadHistoryEntry => Boolean(entry));
        try {
            await fs.writeFile(
                this.getHistoryPersistencePath(),
                JSON.stringify({ items }, null, 2),
                'utf8'
            );
        } catch (error) {
            appLogger.warn(this.name, `Failed to persist history: ${getErrorMessage(error as Error)}`);
        } finally {
            this.historyPersistInFlight = false;
            if (this.historyPersistDirty) {
                this.scheduleHistoryPersistence();
            }
        }
    }

    private async restorePersistedHistory(): Promise<void> {
        try {
            const raw = await fs.readFile(this.getHistoryPersistencePath(), 'utf8');
            const parsed = JSON.parse(raw) as { items?: ModelDownloadHistoryEntry[] };
            const items = Array.isArray(parsed.items) ? parsed.items : [];
            for (const item of items.slice(-this.MAX_HISTORY_ENTRIES)) {
                if (!item?.id || !item.downloadId || !item.modelRef) {
                    continue;
                }

                // Check for stale "active" statuses from previous sessions
                const isActive = ['queued', 'starting', 'downloading', 'installing'].includes(item.status);
                if (isActive && !this.tasks.has(item.downloadId)) {
                    item.status = 'cancelled';
                    item.message = 'System restarted - task abandoned';
                    item.updatedAt = Date.now();
                }

                this.history.set(item.id, item);
                this.historyOrder.push(item.id);
            }
        } catch (error) {
            const message = getErrorMessage(error as Error);
            if (!message.toLowerCase().includes('enoent')) {
                appLogger.warn(this.name, `Failed to restore persisted history: ${message}`);
            }
        }
    }

    override async cleanup(): Promise<void> {
        if (this.historyPersistTimer) {
            clearTimeout(this.historyPersistTimer);
            this.historyPersistTimer = null;
        }
        this.historyPersistDirty = false;
        this.tasks.clear();
        this.modelRefToDownloadId.clear();
        this.globalListeners.clear();
        this.taskStats.clear();
        this.history.clear();
        this.historyOrder.length = 0;
        this.logInfo('Model downloader cleaned up');
    }

    private canStart(provider: DownloadProvider): boolean {
        if (this.runningCount >= this.globalConcurrency) {
            return false;
        }
        return this.providerRunningCount[provider] < this.providerLimits[provider];
    }

    private occupySlot(task: ActiveDownloadTask): void {
        if (task.occupiesSlot) {
            return;
        }
        task.occupiesSlot = true;
        this.runningCount += 1;
        this.providerRunningCount[task.provider] += 1;
    }

    private releaseSlot(task: ActiveDownloadTask): void {
        if (!task.occupiesSlot) {
            return;
        }
        task.occupiesSlot = false;
        this.runningCount = Math.max(0, this.runningCount - 1);
        this.providerRunningCount[task.provider] = Math.max(0, this.providerRunningCount[task.provider] - 1);
    }

    private cleanupTask(task: ActiveDownloadTask): void {
        this.tasks.delete(task.downloadId);
        const mappedId = this.modelRefToDownloadId.get(task.modelRef);
        if (mappedId === task.downloadId) {
            this.modelRefToDownloadId.delete(task.modelRef);
        }
    }

    private scheduleDownloads(): void {
        for (const task of this.tasks.values()) {
            if (task.state !== 'queued') {
                continue;
            }
            if (!this.canStart(task.provider)) {
                continue;
            }
            if (!this.transitionTaskState(task, 'running', 'schedule')) {
                continue;
            }
            if (task.provider === 'huggingface' && (!task.abortController || task.abortController.signal.aborted)) {
                task.abortController = new AbortController();
            }
            this.occupySlot(task);
            void this.persistQueue();
            void this.runTask(task.downloadId);
        }
    }

    private async runTask(downloadId: string): Promise<void> {
        const task = this.tasks.get(downloadId);
        if (task?.state !== 'running') {
            return;
        }

        const result = task.provider === 'ollama'
            ? await this.downloadOllamaTask(task)
            : await this.downloadHuggingFaceTask(task);

        const latestState = this.tasks.get(downloadId)?.state;
        if (latestState === 'cancelled') {
            this.releaseSlot(task);
            this.cleanupTask(task);
            void this.persistQueue();
            this.scheduleDownloads();
            return;
        }
        if (latestState === 'paused') {
            this.releaseSlot(task);
            void this.persistQueue();
            this.scheduleDownloads();
            return;
        }
        if (!result.success) {
            if (!this.transitionTaskState(task, 'error', 'run failure')) {
                this.releaseSlot(task);
                this.cleanupTask(task);
                void this.persistQueue();
                this.scheduleDownloads();
                return;
            }
            this.emitProgress(task, {
                downloadId: task.downloadId,
                provider: task.provider,
                status: 'error',
                modelRef: task.modelRef,
                outputPath: task.outputPath,
                message: result.error || 'Download failed',
            });
            this.releaseSlot(task);
            this.cleanupTask(task);
            void this.persistQueue();
            this.scheduleDownloads();
            return;
        }

        if (!this.transitionTaskState(task, 'completed', 'run success')) {
            this.releaseSlot(task);
            this.cleanupTask(task);
            void this.persistQueue();
            this.scheduleDownloads();
            return;
        }
        this.emitProgress(task, {
            downloadId: task.downloadId,
            provider: task.provider,
            status: 'completed',
            modelRef: task.modelRef,
            outputPath: task.outputPath,
        });
        this.releaseSlot(task);
        this.cleanupTask(task);
        void this.persistQueue();
        this.scheduleDownloads();
    }

    private async downloadOllamaTask(
        task: ActiveDownloadTask
    ): Promise<{ success: boolean; error?: string }> {
        const request = task.request as Extract<ModelDownloadRequest, { provider: 'ollama' }>;
        const modelName = request.modelName.trim();
        const tag = (request.tag || 'latest').trim() || 'latest';
        const modelRef = `${modelName}:${tag}`;

        try {
            this.emitProgress(task, {
                downloadId: task.downloadId,
                provider: 'ollama',
                status: 'starting',
                modelRef,
                message: 'Starting Ollama pull',
            });

            const result = await this.deps.ollamaService.pullModel(modelRef, (progress) => {
                if (task.state !== 'running') {
                    return;
                }
                this.emitProgress(task, {
                    downloadId: task.downloadId,
                    provider: 'ollama',
                    status: 'downloading',
                    modelRef,
                    received: progress.completed,
                    total: progress.total,
                });
            });

            if (!result.success) {
                if (task.state === 'paused' || task.state === 'cancelled') {
                    return { success: false, error: task.state };
                }
                return { success: false, error: result.error || 'Ollama pull failed' };
            }

            return { success: true };
        } catch (error) {
            if (task.state === 'paused' || task.state === 'cancelled') {
                return { success: false, error: task.state };
            }
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    private async downloadHuggingFaceTask(
        task: ActiveDownloadTask
    ): Promise<{ success: boolean; error?: string }> {
        const request = task.request as Extract<ModelDownloadRequest, { provider: 'huggingface' }>;
        const modelId = request.modelId.trim();
        const file = request.file;
        const modelRef = `${modelId}/${file.path}`;

        try {
            const modelsDir = this.deps.llamaService.getModelsDir();
            const modelSlug = sanitizeFileSegment(modelId.replace(/\//g, '-')).toLowerCase();
            const quant = sanitizeFileSegment(file.quantization || 'gguf').toLowerCase();
            const fileSlug = sanitizeFileSegment(
                file.path
                    .replace(/[\\/]/g, '-')
                    .replace(/\.[^.]+$/u, '')
            ).toLowerCase();
            const sourceExt = path.extname(file.path).toLowerCase();
            const outputExt = sourceExt && sourceExt !== '.' ? sourceExt : '.bin';
            const outputFileName = `${modelSlug}-${fileSlug}-${quant}${outputExt}`;
            const outputPath = path.join(modelsDir, outputFileName);
            const downloadUrl = `https://huggingface.co/${modelId}/resolve/main/${file.path}?download=true`;
            task.outputPath = outputPath;

            this.emitProgress(task, {
                downloadId: task.downloadId,
                provider: 'huggingface',
                status: 'starting',
                modelRef,
                outputPath,
                message: 'Starting HuggingFace download',
            });

            // AUD-SEC-038: Enforce mandatory checksum verification
            // Require a valid SHA256 checksum before downloading
            const checksum = file.oid;
            if (!checksum || checksum.trim() === '' || !/^[a-fA-F0-9]{64}$/.test(checksum)) {
                appLogger.error(this.name, `Missing or invalid checksum for HuggingFace download: ${modelRef}`);
                return {
                    success: false,
                    error: 'Missing or invalid SHA256 checksum - download rejected for security',
                };
            }

            const downloadResult = await this.deps.huggingFaceService.downloadFile(
                downloadUrl,
                outputPath,
                {
                    expectedSize: file.size,
                    expectedSha256: checksum,
                    scheduleAtMs: request.scheduleAtMs,
                    signal: task.abortController?.signal,
                    onProgress: (received, total) => {
                        if (task.state !== 'running') {
                            return;
                        }
                        this.emitProgress(task, {
                            downloadId: task.downloadId,
                            provider: 'huggingface',
                            status: 'downloading',
                            modelRef,
                            outputPath,
                            received,
                            total,
                        });
                    }
                }
            );

            if (!downloadResult.success) {
                if (task.state === 'paused' || task.state === 'cancelled') {
                    return { success: false, error: task.state };
                }
                return {
                    success: false,
                    error: downloadResult.error || 'HuggingFace download failed',
                };
            }

            this.emitProgress(task, {
                downloadId: task.downloadId,
                provider: 'huggingface',
                status: 'installing',
                modelRef,
                outputPath,
                message: 'Registering installed model',
            });

            await this.deps.huggingFaceService.registerModelVersion(
                modelId,
                outputPath,
                'Installed via model downloader'
            );

            return { success: true };
        } catch (error) {
            if (task.state === 'paused' || task.state === 'cancelled') {
                return { success: false, error: task.state };
            }
            const message = getErrorMessage(error as Error);
            appLogger.error(this.name, `HuggingFace download failed: ${message}`);
            return { success: false, error: message };
        }
    }
}
