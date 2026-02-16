import { promises as fs } from 'fs';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { HuggingFaceService } from '@main/services/llm/huggingface.service';
import { LlamaService } from '@main/services/llm/llama.service';
import { OllamaService } from '@main/services/llm/ollama.service';
import { getErrorMessage } from '@shared/utils/error.util';
import { app } from 'electron';

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

interface ModelDownloaderDeps {
    ollamaService: OllamaService;
    huggingFaceService: HuggingFaceService;
    llamaService: LlamaService;
}

type DownloadEmitter = (progress: ModelDownloadProgress) => void;
type DownloadTaskState = 'queued' | 'running' | 'paused' | 'cancelled' | 'completed' | 'error';

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

    private getPersistencePath(): string {
        return path.join(app.getPath('userData'), 'model-download-queue.json');
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
            task.state = 'paused';
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

        task.state = 'paused';
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
        task.state = 'cancelled';
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

        task.state = 'queued';
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
                    state: item.state === 'paused' ? 'paused' : 'queued',
                    emitter: () => undefined,
                    abortController: request.provider === 'huggingface' ? new AbortController() : undefined,
                    occupiesSlot: false,
                };
                this.tasks.set(downloadId, task);
                this.modelRefToDownloadId.set(modelRef, downloadId);
                this.emitProgress(task, {
                    downloadId: task.downloadId,
                    provider: task.provider,
                    status: task.state === 'paused' ? 'paused' : 'queued',
                    modelRef: task.modelRef,
                    message: task.state === 'paused' ? 'Restored paused download' : 'Restored queued download',
                });
            }
            this.scheduleDownloads();
            appLogger.info(this.name, `Restored ${tasks.length} persisted download task(s)`);
        } catch (error) {
            const message = getErrorMessage(error as Error);
            if (!message.toLowerCase().includes('enoent')) {
                appLogger.warn(this.name, `Failed to restore persisted queue: ${message}`);
            }
        } finally {
            this.isRestoring = false;
        }
    }

    private emitProgress(task: ActiveDownloadTask, progress: ModelDownloadProgress): void {
        task.emitter(progress);
        for (const listener of this.globalListeners) {
            listener(progress);
        }
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
            task.state = 'running';
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
            task.state = 'error';
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

        task.state = 'completed';
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

            const downloadResult = await this.deps.huggingFaceService.downloadFile(
                downloadUrl,
                outputPath,
                {
                    expectedSize: file.size,
                    expectedSha256: file.oid || '',
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
                'Installed via marketplace downloader'
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
