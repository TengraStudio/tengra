/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

// Ollama service using Node http module with forced IPv4
import * as crypto from 'crypto';
import { EventEmitter } from 'events';
import * as http from 'http';

import { ipc } from '@main/core/ipc-decorators';
import { appLogger } from '@main/logging/logger';
import { LocalAIService } from '@main/services/llm/local/local-ai.service';
import { resolveContextWindowForModel } from '@main/services/llm/model-context-window.data.ts';
import { AuthService } from '@main/services/security/auth.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { SettingsService } from '@main/services/system/settings.service';
import { t } from '@main/utils/i18n.util';
import { withRetry } from '@main/utils/retry.util';
import { SERVICE_DEFAULTS } from '@shared/constants/defaults';
import { SESSION_CONVERSATION_CHANNELS } from '@shared/constants/ipc-channels';
import { ToolCall } from '@shared/types/chat';
import { JsonObject, JsonValue } from '@shared/types/common';
import { getErrorMessage } from '@shared/utils/error.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import axios from 'axios';
import { BrowserWindow, IpcMainInvokeEvent } from 'electron';

// --- OLLAMA-01: Model Health & Recommendation Types ---

export interface ModelHealthStatus {
    name: string;
    isHealthy: boolean;
    lastChecked: Date;
    responseTimeMs: number;
    error?: string;
    size: number;
    digest: string;
    details?: {
        format: string;
        family: string;
        parameter_size: string;
        quantization_level: string;
    };
}

export interface ModelRecommendation {
    name: string;
    reason: string;
    category: 'coding' | 'creative' | 'reasoning' | 'general' | 'multimodal';
    sizeEstimate: string;
    pulls?: string;
    tags: string[];
    suitabilityScore: number; // 0-100
}

// --- OLLAMA-02: Connection Pool Types ---

interface ConnectionPoolEntry {
    id: string;
    inUse: boolean;
    lastUsed: Date;
    requestCount: number;
}

export interface ConnectionStatus {
    isConnected: boolean;
    host: string;
    port: number;
    latency: number;
    lastChecked: Date;
    reconnectAttempts: number;
    poolSize: number;
    activeConnections: number;
}

// --- OLLAMA-03: GPU Monitoring Types ---

export interface GPUInfo {
    index: number;
    name: string;
    memoryUsed: number;
    memoryTotal: number;
    utilizationPercent: number;
    temperatureC: number | null;
}

export interface GPUStatus {
    available: boolean;
    gpus: GPUInfo[];
    lastChecked: Date;
    warnings: string[];
}

export interface GPUAlert {
    type: 'high_memory' | 'high_temperature' | 'low_memory';
    severity: 'warning' | 'critical';
    message: string;
    gpuIndex: number;
    timestamp: Date;
    value: number;
    threshold: number;
}


interface OllamaMessage {
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    images?: string[]; // Base64 encoded images
    tool_calls?: ToolCall[];
    tool_call_id?: string;
}

interface OllamaModel {
    name: string;
    modified_at: string;
    size: number;
    digest: string;
    [key: string]: JsonValue | undefined; // For JsonValue compatibility
    details?: {
        format: string;
        family: string;
        parameter_size: string;
        quantization_level: string;
    };
}

export interface OllamaResponse {
    model: string
    created_at: string
    message: OllamaMessage
    done: boolean
    total_duration?: number
    load_duration?: number
    prompt_eval_count?: number
    prompt_eval_duration?: number
    eval_count?: number
    eval_duration?: number
}

interface LibraryModel {
    name: string;
    description: string;
    tags: string[];
    pulls?: string;
}

export class OllamaService {
    private host: string = '127.0.0.1';
    private port: number = 11434;
    private currentRequest: http.ClientRequest | null = null;
    private settingsService: SettingsService;

    // OLLAMA-02: Connection pooling
    private connectionPool: ConnectionPoolEntry[] = [];
    private maxPoolSize: number = 5;
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = SERVICE_DEFAULTS.MAX_RECONNECT_ATTEMPTS;
    private reconnectDelayMs: number = SERVICE_DEFAULTS.RECONNECT_DELAY_MS;
    private lastConnectionCheck: Date = new Date();

    // OLLAMA-03: GPU monitoring
    private gpuEventEmitter: EventEmitter = new EventEmitter();
    private gpuAlertThresholds = {
        highMemoryPercent: 90,
        highTemperatureC: 85,
        lowMemoryMB: 500
    };
    private lastGPUCheck: Date = new Date();
    private gpuMonitoringInterval: NodeJS.Timeout | null = null;
    private eventBusService: EventBusService;
    private localAIService: LocalAIService;
    private authService: AuthService;

    constructor(
        settingsService: SettingsService,
        eventBusService: EventBusService,
        localAIService: LocalAIService,
        authService: AuthService
    ) {
        this.settingsService = settingsService;
        this.eventBusService = eventBusService;
        this.localAIService = localAIService;
        this.authService = authService;
        const settings = this.settingsService.getSettings();
        if (settings.ollama.url) {
            try {
                const url = new URL(settings.ollama.url);
                this.host = url.hostname;
                this.port = parseInt(url.port || '11434', 10);
            } catch (e) {
                appLogger.error('OllamaService', 'Invalid Ollama URL provided, using default', e as Error);
            }
        }

        // Initialize connection pool
        this.initializeConnectionPool();

        // Register hibernation listeners
        this.eventBusService.onCustom('power:hibernation-start', () => this.stopGPUMonitoring());
        this.eventBusService.onCustom('power:hibernation-stop', () => {
            // Only resume if it was supposed to be running
            // For now, we'll just restart it with default interval
            this.startGPUMonitoring();
        });
    }

    @ipc('ollama:abort')
    @ipc('ollama:abortPull')
    abort() {
        if (this.currentRequest) {
            this.currentRequest.destroy();
            this.currentRequest = null;
            appLogger.info('ollama.service', 'Ollama request aborted by user');
        }
    }

    setConnection(host: string, port: number) {
        this.host = host;
        this.port = port;
    }

    // IPv4-only HTTP request helper (Instance Method)
    private httpRequest(
        options: {
            method?: string
            path: string
            body?: string
            timeout?: number
        }
    ): Promise<{ ok: boolean; status: number; data: string }> {
        return new Promise((resolve, reject) => {
            const req = http.request({
                hostname: this.host,
                port: this.port,
                path: options.path,
                method: options.method ?? 'GET',
                headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
                family: 4 // Force IPv4
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    resolve({
                        ok: (res.statusCode ?? 500) >= 200 && (res.statusCode ?? 500) < 300,
                        status: res.statusCode ?? 500,
                        data
                    });
                });
            });

            req.on('error', reject);
            req.setTimeout(options.timeout ?? 10000, () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            if (options.body) {
                req.write(options.body);
            }
            req.end();
        });
    }

    // Streaming HTTP request for chat (Instance Method)
    private httpStreamRequest(
        options: {
            path: string
            body: string
            onData: (chunk: string) => void
            timeout?: number
        }
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const req = http.request({
                hostname: this.host,
                port: this.port,
                path: options.path,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                family: 4
            }, (res) => {
                res.on('data', chunk => options.onData(chunk.toString()));
                res.on('end', () => resolve());
                res.on('error', reject);
            });

            req.on('error', reject);
            req.setTimeout(options.timeout ?? 0, () => {
                if (options.timeout && options.timeout > 0) {
                    req.destroy();
                    reject(new Error('Streaming request timeout'));
                }
            });

            this.currentRequest = req;

            req.write(options.body);
            req.end();
        });
    }

    async getModels(): Promise<OllamaModel[]> {
        try {
            const response = await this.httpRequest({ path: '/api/tags', timeout: 5000 });
            const data = safeJsonParse<{ models?: OllamaModel[] }>(response.data, { models: [] });
            return data.models ?? [];
        } catch (error) {
            appLogger.error('OllamaService', 'Failed to get models', error as Error);
            return [];
        }
    }

    async ps(): Promise<JsonObject[]> {
        try {
            const response = await this.httpRequest({ path: '/api/ps', timeout: 5000 });
            const data = safeJsonParse<{ models?: JsonObject[] }>(response.data, { models: [] });
            return (data.models ?? []) as JsonObject[];
        } catch (error) {
            appLogger.error('OllamaService', 'Failed to get running models', error as Error);
            return [];
        }
    }

    private getEffectiveNumCtx(model: string): number {
        const settings = this.settingsService.getSettings();
        
        // 1. Check for per-model override
        const modelKey = `ollama/${model}`;
        const modelCtx = settings.modelSettings?.[modelKey]?.numCtx;
        if (modelCtx) {
            return modelCtx;
        }

        // 2. Resolve based on known model limits if global is set to default or a low value
        const resolved = resolveContextWindowForModel({
            id: modelKey,
            name: model,
            provider: 'ollama'
        });

        // If the model is a known large-context model, use that instead of the 16k/32k default
        // We consider 16384 as the "legacy" default that we want to override if known better
        if (resolved && (settings.ollama.numCtx === undefined || settings.ollama.numCtx <= 16384)) {
            return Math.max(resolved, 32768); // Minimum 32k for agentic models
        }

        return settings.ollama.numCtx || 32768; // Default to 32k instead of 16k
    }

    @ipc('ollama:chat')
    async chatIpc(messagesRaw: RuntimeValue, modelRaw: RuntimeValue): Promise<OllamaResponse> {
        const messages = this.validateMessages(messagesRaw);
        const model = this.validateModel(modelRaw);
        if (!model || messages.length === 0) {
            throw new Error('Invalid model or messages');
        }
        return await this.chat(messages, model);
    }

    async chat(messages: OllamaMessage[], model: string): Promise<OllamaResponse> {

        try {
            const response = await this.httpRequest({
                method: 'POST',
                path: '/api/chat',
                body: JSON.stringify({
                    model,
                    messages,
                    stream: false,
                    options: {
                        num_ctx: this.getEffectiveNumCtx(model),
                    },
                })
            });
            const data = safeJsonParse<OllamaResponse>(response.data, {
                model: '',
                created_at: '',
                message: { role: 'assistant', content: '' },
                done: true
            });
            return data;
        } catch (error) {
            appLogger.error('OllamaService', 'Chat error', error as Error);
            throw error;
        }
    }


    @ipc({ channel: 'ollama:chatStream', withEvent: true })
    async chatStreamIpc(event: IpcMainInvokeEvent, messagesRaw: RuntimeValue, modelRaw: RuntimeValue): Promise<{ content: string; role: string } | { error: string }> {
        const messages = this.validateMessages(messagesRaw);
        const model = this.validateModel(modelRaw);
        if (!model || messages.length === 0) {
            throw new Error('Invalid model or messages');
        }
        try {
            const response = await this.chatStream(
                messages,
                model,
                undefined,
                (chunk) => {
                    event.sender.send(SESSION_CONVERSATION_CHANNELS.STREAM_CHUNK, { content: chunk, reasoning: '' });
                }
            );
            return { content: response.content, role: 'assistant' };
        } catch (err) {
            const message = getErrorMessage(err as Error);
            appLogger.error('OllamaService', 'Chat Error', err as Error);
            return { error: message };
        }
    }

    async chatStream(
        messages: OllamaMessage[],
        model: string,
        tools?: ToolCall[],
        onChunk?: (chunk: string) => void
    ): Promise<{
        content: string;
        tool_calls?: ToolCall[];
        promptTokens: number;
        completionTokens: number;
    }> {
        let fullResponse = '';
        let toolCalls: ToolCall[] = [];
        let promptTokens = 0;
        let completionTokens = 0;

        try {
            await this.httpStreamRequest({
                path: '/api/chat',
                body: JSON.stringify({
                    model,
                    messages,
                    stream: true,
                    tools: tools && tools.length > 0 ? tools : undefined,
                    options: {
                        num_ctx: this.getEffectiveNumCtx(model),
                    },
                }),
                onData: (chunk) => {
                    const lines = chunk.toString().split('\n').filter(Boolean);
                    for (const line of lines) {
                        try {
                            const data = safeJsonParse<OllamaResponse>(line, {} as OllamaResponse);
                            if (data.message.content) {
                                fullResponse += data.message.content;
                                onChunk?.(data.message.content);
                            }
                            if (data.message.tool_calls) {
                                toolCalls = data.message.tool_calls;
                            }
                            if (data.done) {
                                if (data.prompt_eval_count) { promptTokens = data.prompt_eval_count; }
                                if (data.eval_count) { completionTokens = data.eval_count; }
                            }
                        } catch {
                            // Ignore parse errors
                        }
                    }
                }
            });

            this.currentRequest = null;

            return {
                content: fullResponse,
                tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
                promptTokens,
                completionTokens
            };
        } catch (error) {
            this.currentRequest = null;
            appLogger.error('OllamaService', 'Stream chat error', error as Error);
            throw error;
        }
    }

    async getEmbeddings(model: string, input: string): Promise<number[]> {
        try {
            const response = await this.httpRequest({
                method: 'POST',
                path: '/api/embed',
                body: JSON.stringify({
                    model,
                    input
                })
            });
            const data = safeJsonParse<{ embeddings?: number[][] }>(response.data, { embeddings: [] });
            return data.embeddings?.[0] ?? [];
        } catch (error) {
            appLogger.error('OllamaService', 'Error generating embeddings with Ollama', error as Error);
            throw error;
        }
    }

    @ipc('ollama:pull')
    async pullModelIpc(modelNameRaw: RuntimeValue): Promise<{ success: boolean; error?: string }> {
        const modelName = this.validateModel(modelNameRaw);
        if (!modelName) {
            throw new Error('Invalid model name');
        }
        return await this.pullModel(modelName, (progress: { status: string; completed?: number; total?: number }) => {
            const windows = BrowserWindow.getAllWindows();
            windows.forEach(win => {
                if (!win.isDestroyed()) {
                    win.webContents.send('ollama:pullProgress', {
                        ...progress,
                        modelName
                    });
                }
            });
        });
    }

    async pullModel(
        modelName: string,
        onProgress?: (progress: { status: string; completed?: number; total?: number }) => void
    ): Promise<{ success: boolean; error?: string }> {
        try {
            await this.httpStreamRequest({
                path: '/api/pull',
                body: JSON.stringify({ name: modelName, stream: true }),
                timeout: 3600000,
                onData: (chunk) => {
                    const lines = chunk.split('\n').filter(Boolean);
                    for (const line of lines) {
                        try {
                            const data = safeJsonParse<Record<string, RuntimeValue>>(line, {});
                            onProgress?.({
                                status: (data.status as string) || 'downloading',
                                completed: data.completed as number | undefined,
                                total: data.total as number | undefined
                            });
                        } catch {
                            // Ignore
                        }
                    }
                }
            });
            return { success: true };
        } catch (error) {
            this.currentRequest = null;
            const message = getErrorMessage(error as Error);
            return { success: false, error: message };
        }
    }

    @ipc('ollama:deleteModel')
    async deleteModelIpc(modelNameRaw: RuntimeValue): Promise<{ success: boolean; error?: string }> {
        const modelName = this.validateModel(modelNameRaw);
        if (!modelName) {
            throw new Error('Invalid model name');
        }
        return await this.deleteModel(modelName);
    }

    async deleteModel(modelName: string): Promise<{ success: boolean; error?: string }> {
        try {
            const response = await this.httpRequest({
                method: 'DELETE',
                path: '/api/delete',
                body: JSON.stringify({ name: modelName })
            });

            if (response.ok) {
                return { success: true };
            } else {
                const data = safeJsonParse<{ error?: string }>(response.data, {});
                return { success: false, error: data.error ?? 'Failed to delete model' };
            }
        } catch (error) {
            const message = getErrorMessage(error as Error);
            return { success: false, error: message };
        }
    }

    @ipc('ollama:getLibraryModels')
    async getLibraryModels(): Promise<LibraryModel[]> {
        const staticList: LibraryModel[] = [
            { name: 'llama2', description: 'Meta\'s Llama 2 model', tags: ['7b', '13b', '70b'] },
            { name: 'llama3', description: 'Meta\'s Llama 3 model', tags: ['8b', '70b'] },
            { name: 'llama3.1', description: 'Meta\'s Llama 3.1 model', tags: ['8b', '70b', '405b'] },
            { name: 'llama3.2', description: 'Meta\'s Llama 3.2 - multimodal', tags: ['1b', '3b', '11b', '90b'] },
            { name: 'mistral', description: t('auto.mistral7bModel'), tags: ['7b'] },
            { name: 'mixtral', description: t('auto.mixtralMoeModel'), tags: ['8x7b', '8x22b'] },
            { name: 'codellama', description: t('auto.codeGenerationModel'), tags: ['7b', '13b', '34b', '70b'] },
            { name: 'deepseek-r1', description: t('auto.deepseekR1ReasoningModel'), tags: ['1.5b', '7b', '8b', '14b', '32b', '70b', '671b'] },
            { name: 'deepseek-coder', description: t('auto.deepseekCoder'), tags: ['1.3b', '6.7b', '33b'] },
            { name: 'phi3', description: t('auto.microsoftPhi3'), tags: ['mini', 'medium'] },
            { name: 'gemma', description: 'Google Gemma', tags: ['2b', '7b'] },
            { name: 'gemma2', description: 'Google Gemma 2', tags: ['2b', '9b', '27b'] },
            { name: 'qwen', description: t('auto.alibabaQwen'), tags: ['0.5b', '1.8b', '4b', '7b', '14b', '72b'] },
            { name: 'qwen2.5', description: t('auto.alibabaQwen25'), tags: ['0.5b', '1.5b', '3b', '7b', '14b', '32b', '72b'] },
            { name: 'command-r', description: t('auto.cohereCommandR'), tags: ['35b'] },
            { name: 'starcoder2', description: t('auto.starcoder2'), tags: ['3b', '7b', '15b'] },
            { name: 'yi', description: t('auto.yiBy01ai'), tags: ['6b', '9b', '34b'] },
            { name: 'orca-mini', description: t('auto.orcaMini'), tags: ['3b', '7b', '13b'] },
            { name: 'neural-chat', description: t('auto.intelNeuralChat'), tags: ['7b'] },
            { name: 'vicuna', description: 'Vicuna', tags: ['7b', '13b', '33b'] }
        ];

        try {
            // Attempt to fetch most popular from registry to get real "pulls" count
            const response = await axios.get('https://ollama.com/library?sort=popular', { timeout: 3000 });
            const html = response.data;

            // Build a map of name -> pulls from the library page
            const pullsMap: Record<string, string> = {};
            const regex = /href="\/library\/([^"]+)"[\s\S]*?x-test-pull-count>([^<]+)<\/span>/gi;
            let match;
            while ((match = regex.exec(html)) !== null) {
                pullsMap[match[1]] = match[2].trim();
            }

            const results = [...staticList];
            for (const model of results) {
                if (pullsMap[model.name]) {
                    model.pulls = pullsMap[model.name];
                }
            }
            appLogger.info('ollama.service', `[OllamaService] Library enriched with Pulls. Found counts for ${Object.keys(pullsMap).length} models.`);
            return results;
        } catch (e) {
            appLogger.warn('OllamaService', 'Could not fetch live pulls from registry, using static list', e as Error);
            return staticList;
        }
    }

    async isAvailable(): Promise<boolean> {
        try {
            const response = await this.httpRequest({ path: '/api/tags', timeout: 3000 });
            return response.ok;
        } catch {
            return false;
        }
    }

    async isOllamaRunning(): Promise<boolean> {
        return this.isAvailable();
    }

    // ========================================
    // OLLAMA-01: Model Management Improvements
    // ========================================

    /**
     * Check health status of a specific model
     */
    @ipc('ollama:checkModelHealth')
    async checkModelHealth(modelName: string): Promise<ModelHealthStatus> {
        const startTime = Date.now();
        try {
            // Try to get model info and run a minimal inference
            const response = await this.httpRequest({
                method: 'POST',
                path: '/api/generate',
                body: JSON.stringify({
                    model: modelName,
                    prompt: 'test',
                    stream: false,
                    options: { num_predict: 1 }
                }),
                timeout: 30000
            });

            const responseTimeMs = Date.now() - startTime;

            if (response.ok) {
                const models = await this.getModels();
                const modelInfo = models.find(m => m.name === modelName);

                return {
                    name: modelName,
                    isHealthy: true,
                    lastChecked: new Date(),
                    responseTimeMs,
                    size: modelInfo?.size ?? 0,
                    digest: modelInfo?.digest ?? '',
                    details: modelInfo?.details
                };
            } else {
                return {
                    name: modelName,
                    isHealthy: false,
                    lastChecked: new Date(),
                    responseTimeMs,
                    error: `HTTP ${response.status}: ${response.data}`,
                    size: 0,
                    digest: ''
                };
            }
        } catch (error) {
            return {
                name: modelName,
                isHealthy: false,
                lastChecked: new Date(),
                responseTimeMs: Date.now() - startTime,
                error: getErrorMessage(error as Error),
                size: 0,
                digest: ''
            };
        }
    }

    /**
     * Check health status of all installed models
     */
    @ipc('ollama:checkAllModelsHealth')
    async checkAllModelsHealth(): Promise<ModelHealthStatus[]> {
        const models = await this.getModels();
        const healthChecks: ModelHealthStatus[] = [];

        for (const model of models) {
            const health = await this.checkModelHealth(model.name);
            healthChecks.push(health);
        }

        return healthChecks;
    }

    /**
     * Get model recommendations based on use case
     */
    @ipc('ollama:getModelRecommendations')
    async getModelRecommendations(
        category?: 'coding' | 'creative' | 'reasoning' | 'general' | 'multimodal'
    ): Promise<ModelRecommendation[]> {
        const recommendations: ModelRecommendation[] = [
            // Coding models
            {
                name: 'deepseek-coder',
                reason: 'Excellent for code generation, completion, and understanding. Supports multiple programming languages.',
                category: 'coding',
                sizeEstimate: '1.3B - 33B',
                tags: ['1.3b', '6.7b', '33b'],
                suitabilityScore: 95
            },
            {
                name: 'codellama',
                reason: 'Meta\'s code-specialized model, great for code completion and generation.',
                category: 'coding',
                sizeEstimate: '7B - 70B',
                tags: ['7b', '13b', '34b', '70b'],
                suitabilityScore: 88
            },
            {
                name: 'starcoder2',
                reason: 'State-of-the-art code generation model with broad language support.',
                category: 'coding',
                sizeEstimate: '3B - 15B',
                tags: ['3b', '7b', '15b'],
                suitabilityScore: 85
            },
            // Reasoning models
            {
                name: 'deepseek-r1',
                reason: 'Advanced reasoning model with chain-of-thought capabilities. Best for complex problem solving.',
                category: 'reasoning',
                sizeEstimate: '1.5B - 671B',
                tags: ['1.5b', '7b', '8b', '14b', '32b', '70b', '671b'],
                suitabilityScore: 98
            },
            {
                name: 'llama3.1',
                reason: 'Strong general reasoning and instruction following capabilities.',
                category: 'reasoning',
                sizeEstimate: '8B - 405B',
                tags: ['8b', '70b', '405b'],
                suitabilityScore: 82
            },
            // Creative models
            {
                name: 'llama3.2',
                reason: 'Great for creative writing, storytelling, and content generation.',
                category: 'creative',
                sizeEstimate: '1B - 90B',
                tags: ['1b', '3b', '11b', '90b'],
                suitabilityScore: 85
            },
            {
                name: 'mistral',
                reason: 'Excellent balance of creativity and coherence for writing tasks.',
                category: 'creative',
                sizeEstimate: '7B',
                tags: ['7b'],
                suitabilityScore: 80
            },
            // Multimodal models
            {
                name: 'llama3.2-vision',
                reason: 'Vision-language model for image understanding and description.',
                category: 'multimodal',
                sizeEstimate: '11B - 90B',
                tags: ['11b', '90b'],
                suitabilityScore: 88
            },
            {
                name: 'qwen2.5',
                reason: 'Strong multimodal capabilities with vision and language understanding.',
                category: 'multimodal',
                sizeEstimate: '0.5B - 72B',
                tags: ['0.5b', '1.5b', '3b', '7b', '14b', '32b', '72b'],
                suitabilityScore: 85
            },
            // General purpose
            {
                name: 'llama3.1',
                reason: 'Best all-around model for general tasks, good balance of speed and quality.',
                category: 'general',
                sizeEstimate: '8B - 405B',
                tags: ['8b', '70b', '405b'],
                suitabilityScore: 92
            },
            {
                name: 'gemma2',
                reason: 'Google\'s efficient model, great for general tasks with lower resource usage.',
                category: 'general',
                sizeEstimate: '2B - 27B',
                tags: ['2b', '9b', '27b'],
                suitabilityScore: 78
            },
            {
                name: 'phi3',
                reason: 'Microsoft\'s compact but capable model, excellent for resource-constrained environments.',
                category: 'general',
                sizeEstimate: '3.8B - 14B',
                tags: ['mini', 'medium'],
                suitabilityScore: 75
            }
        ];

        // Filter by category if specified
        let filtered = category
            ? recommendations.filter(r => r.category === category)
            : recommendations;

        // Sort by suitability score
        filtered = filtered.sort((a, b) => b.suitabilityScore - a.suitabilityScore);

        // Try to enrich with pull counts
        try {
            const libraryModels = await this.getLibraryModels();
            filtered = filtered.map(rec => {
                const libModel = libraryModels.find(m => m.name === rec.name);
                return {
                    ...rec,
                    pulls: libModel?.pulls
                };
            });
        } catch {
            // Ignore errors enriching with pulls
        }

        return filtered;
    }

    /**
     * Get recommended model for a specific task
     */
    @ipc('ollama:getRecommendedModelForTask')
    async getRecommendedModelForTask(task: string): Promise<ModelRecommendation | null> {
        const taskLower = task.toLowerCase();

        // Detect task category from description
        let category: 'coding' | 'creative' | 'reasoning' | 'general' | 'multimodal' = 'general';

        if (taskLower.includes('code') || taskLower.includes('program') || taskLower.includes('function') || taskLower.includes('debug')) {
            category = 'coding';
        } else if (taskLower.includes('write') || taskLower.includes('story') || taskLower.includes('creative') || taskLower.includes('article')) {
            category = 'creative';
        } else if (taskLower.includes('analyze') || taskLower.includes('reason') || taskLower.includes('solve') || taskLower.includes('explain')) {
            category = 'reasoning';
        } else if (taskLower.includes('image') || taskLower.includes('visual') || taskLower.includes('picture') || taskLower.includes('screenshot')) {
            category = 'multimodal';
        }

        const recommendations = await this.getModelRecommendations(category);
        return recommendations[0] || null;
    }

    // ========================================
    // OLLAMA-02: Connection Handling
    // ========================================

    /**
     * Initialize connection pool
     */
    private initializeConnectionPool(): void {
        for (let i = 0; i < this.maxPoolSize; i++) {
            this.connectionPool.push({
                id: `conn-${i}`,
                inUse: false,
                lastUsed: new Date(),
                requestCount: 0
            });
        }
        appLogger.info('OllamaService', `Connection pool initialized with ${this.maxPoolSize} connections`);
    }

    /**
     * Get current connection status
     */
    @ipc('ollama:getConnectionStatus')
    async getConnectionStatus(): Promise<ConnectionStatus> {
        const startTime = Date.now();
        let isConnected = false;
        let latency = 0;

        try {
            isConnected = await this.isAvailable();
            latency = Date.now() - startTime;
        } catch {
            latency = -1;
        }

        this.lastConnectionCheck = new Date();

        return {
            isConnected,
            host: this.host,
            port: this.port,
            latency,
            lastChecked: this.lastConnectionCheck,
            reconnectAttempts: this.reconnectAttempts,
            poolSize: this.maxPoolSize,
            activeConnections: this.connectionPool.filter(c => c.inUse).length
        };
    }

    /**
     * Test connection with detailed diagnostics
     */
    @ipc('ollama:testConnection')
    async testConnection(): Promise<{
        success: boolean;
        latency: number;
        error?: string;
        serverInfo?: {
            version?: string;
            modelsCount: number;
        };
    }> {
        const startTime = Date.now();

        try {
            const [available, models] = await Promise.all([
                this.isAvailable(),
                this.getModels()
            ]);

            const latency = Date.now() - startTime;

            if (available) {
                this.reconnectAttempts = 0; // Reset on successful connection
                return {
                    success: true,
                    latency,
                    serverInfo: {
                        modelsCount: models.length
                    }
                };
            } else {
                return {
                    success: false,
                    latency,
                    error: 'Ollama server not responding'
                };
            }
        } catch (error) {
            return {
                success: false,
                latency: Date.now() - startTime,
                error: getErrorMessage(error as Error)
            };
        }
    }

    /**
     * Attempt to reconnect with exponential backoff
     */
    @ipc('ollama:reconnect')
    async reconnect(): Promise<boolean> {
        this.reconnectAttempts = 0;
        try {
            await withRetry(
                async () => {
                    const connected = await this.isAvailable();
                    if (!connected) {
                        throw new Error('Ollama not available');
                    }
                },
                {
                    maxRetries: this.maxReconnectAttempts - 1,
                    baseDelayMs: this.reconnectDelayMs,
                    maxDelayMs: this.reconnectDelayMs * 4,
                    shouldRetry: () => true,
                    onRetry: (_err, attempt) => {
                        this.reconnectAttempts = attempt + 1;
                        const delay = this.reconnectDelayMs * Math.pow(2, attempt);
                        appLogger.info('OllamaService', `Reconnect attempt ${attempt + 1}/${this.maxReconnectAttempts} after ${delay}ms`);
                    }
                }
            );
            this.reconnectAttempts = 0;
            appLogger.info('OllamaService', 'Reconnection successful');
            return true;
        } catch {
            appLogger.warn('OllamaService', `Max reconnect attempts (${this.maxReconnectAttempts}) reached`);
            return false;
        }
    }

    // ========================================
    // OLLAMA-03: GPU Monitoring
    // ========================================

    /**
     * Get GPU information from Ollama
     */
    @ipc('ollama:getGPUInfo')
    async getGPUInfo(): Promise<GPUStatus> {
        const warnings: string[] = [];
        const gpus: GPUInfo[] = [];

        try {
            // Ollama exposes GPU info through /api/ps endpoint
            const response = await this.httpRequest({ path: '/api/ps', timeout: 5000 });

            if (response.ok) {
                const data = safeJsonParse<{
                    models?: Array<{
                        name: string;
                        details?: {
                            gpu_memory?: number;
                            total_memory?: number;
                        };
                    }>
                }>(response.data, { models: [] });

                // Parse GPU info from running models
                // Note: Ollama doesn't expose detailed GPU metrics directly
                // This is a best-effort implementation
                for (const model of data.models || []) {
                    if (model.details?.gpu_memory) {
                        gpus.push({
                            index: 0,
                            name: 'GPU 0',
                            memoryUsed: model.details.gpu_memory,
                            memoryTotal: model.details.total_memory || model.details.gpu_memory,
                            utilizationPercent: model.details.total_memory
                                ? (model.details.gpu_memory / model.details.total_memory) * 100
                                : 0,
                            temperatureC: null // Ollama doesn't expose temperature
                        });
                    }
                }
            }

            this.lastGPUCheck = new Date();

            // Generate warnings based on thresholds
            for (const gpu of gpus) {
                if (gpu.utilizationPercent > this.gpuAlertThresholds.highMemoryPercent) {
                    warnings.push(`GPU ${gpu.index} memory usage is high: ${gpu.utilizationPercent.toFixed(1)}%`);
                }
                if (gpu.temperatureC !== null && gpu.temperatureC > this.gpuAlertThresholds.highTemperatureC) {
                    warnings.push(`GPU ${gpu.index} temperature is high: ${gpu.temperatureC}°C`);
                }
                const availableMemory = gpu.memoryTotal - gpu.memoryUsed;
                if (availableMemory < this.gpuAlertThresholds.lowMemoryMB * 1024 * 1024) {
                    warnings.push(`GPU ${gpu.index} has low available memory: ${(availableMemory / 1024 / 1024).toFixed(0)}MB`);
                }
            }

            return {
                available: gpus.length > 0,
                gpus,
                lastChecked: this.lastGPUCheck,
                warnings
            };
        } catch (error) {
            appLogger.error('OllamaService', 'Failed to get GPU info', error as Error);
            return {
                available: false,
                gpus: [],
                lastChecked: new Date(),
                warnings: ['Unable to retrieve GPU information']
            };
        }
    }

    /**
     * Start continuous GPU monitoring
     */
    @ipc('ollama:startGPUMonitoring')
    startGPUMonitoring(intervalMs: number = 10000): void {
        if (this.gpuMonitoringInterval) {
            this.stopGPUMonitoring();
        }

        this.gpuMonitoringInterval = setInterval(() => {
            void (async () => {
                try {
                    const status = await this.getGPUInfo();

                    // Emit alerts for any warnings
                    for (const warning of status.warnings) {
                        const alert: GPUAlert = {
                        type: warning.includes('temperature') ? 'high_temperature' :
                            warning.includes('low') ? 'low_memory' : 'high_memory',
                        severity: warning.includes('critical') ? 'critical' : 'warning',
                        message: warning,
                        gpuIndex: 0,
                        timestamp: new Date(),
                        value: 0,
                        threshold: 0
                    };
                    this.gpuEventEmitter.emit('alert', alert);
                }

                    this.gpuEventEmitter.emit('status', status);
                } catch (error) {
                    appLogger.error('OllamaService', 'GPU monitoring error', error as Error);
                }
            })();
        }, intervalMs);

        appLogger.debug('OllamaService', `GPU monitoring started with ${intervalMs}ms interval`);
    }

    /**
     * Stop GPU monitoring
     */
    @ipc('ollama:stopGPUMonitoring')
    stopGPUMonitoring(): void {
        if (this.gpuMonitoringInterval) {
            clearInterval(this.gpuMonitoringInterval);
            this.gpuMonitoringInterval = null;
            appLogger.debug('OllamaService', 'GPU monitoring stopped');
        }
    }

    /**
     * Subscribe to GPU alerts
     */
    onGPUAlert(callback: (alert: GPUAlert) => void): () => void {
        this.gpuEventEmitter.on('alert', callback);
        return () => this.gpuEventEmitter.off('alert', callback);
    }

    /**
     * Subscribe to GPU status updates
     */
    onGPUStatus(callback: (status: GPUStatus) => void): () => void {
        this.gpuEventEmitter.on('status', callback);
        return () => this.gpuEventEmitter.off('status', callback);
    }

    /**
     * Set GPU alert thresholds
     */
    @ipc('ollama:setGPUAlertThresholds')
    setGPUAlertThresholds(thresholds: Partial<typeof OllamaService.prototype.gpuAlertThresholds>): void {
        this.gpuAlertThresholds = {
            ...this.gpuAlertThresholds,
            ...thresholds
        };
        appLogger.info('OllamaService', 'GPU alert thresholds updated', this.gpuAlertThresholds);
    }

    /**
     * Get current GPU alert thresholds
     */
    @ipc('ollama:getGPUAlertThresholds')
    getGPUAlertThresholds(): typeof OllamaService.prototype.gpuAlertThresholds {
        return { ...this.gpuAlertThresholds };
    }

    // ========================================
    // OLLAMA-04: Cloud Account Authentication (ollama.com/connect)
    // ========================================

    /**
     * Generate a fresh Ed25519 keypair.
     * The public key is sent to ollama.com to initiate the handshake.
     * The private key is stored (encrypted) in `linked_accounts`.
     *
     * @returns Base64-encoded DER public and private keys.
     */
    generateEd25519KeyPair(): { publicKeyB64: string; privateKeyB64: string } {
        const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
            publicKeyEncoding:  { type: 'spki',  format: 'der' },
            privateKeyEncoding: { type: 'pkcs8', format: 'der' },
        });
        return {
            publicKeyB64:  (publicKey  as unknown as Buffer).toString('base64'),
            privateKeyB64: (privateKey as unknown as Buffer).toString('base64'),
        };
    }

    /**
     * Initiate the ollama.com/connect authentication handshake.
     *
     * Sends the Ed25519 public key to `https://ollama.com/api/connect` and
     * returns a one-time `{ code, expiresAt }` pair the user must approve at
     * `https://ollama.com/connect?code=<code>` in their browser.
     *
     * @param publicKeyB64 - Base64-encoded DER public key from `generateEd25519KeyPair()`.
     */
    @ipc('ollama:initiate-connect')
    async initiateOllamaConnect(publicKeyB64: string): Promise<{
        code: string;
        expiresAt: number;
    }> {
        try {
            const response = await axios.post(
                'https://ollama.com/api/connect',
                { public_key: publicKeyB64 },
                {
                    timeout: 15_000,
                    headers: { 'Content-Type': 'application/json' },
                }
            );

            const data = response.data as { code?: string; expires_at?: number | string; nonce?: string };
            const code = data.code ?? data.nonce;
            const expiresAt = typeof data.expires_at === 'number'
                ? data.expires_at
                : typeof data.expires_at === 'string'
                    ? new Date(data.expires_at).getTime()
                    : Date.now() + 5 * 60 * 1000; // default 5 min

            if (!code) {
                throw new Error('ollama.com/api/connect returned no code');
            }

            appLogger.info('OllamaService', `Ollama connect initiated — code: ${code}`);
            return { code, expiresAt };
        } catch (error) {
            appLogger.error('OllamaService', 'Failed to initiate Ollama connect', error as Error);
            throw error;
        }
    }

    /**
     * Poll `https://ollama.com/api/connect/<code>` until the user approves the
     * request or the session expires.
     *
     * On success returns the token data that should be stored in `linked_accounts`.
     *
     * @param code         - The one-time code returned by `initiateOllamaConnect`.
     * @param privateKeyB64 - Base64-encoded DER private key (stored encrypted).
     * @param timeoutMs    - Maximum polling duration (default 5 min).
     * @param intervalMs   - Polling interval (default 3 s).
     */
    @ipc('ollama:poll-connect-status')
    async pollOllamaConnectStatus(
        code: string,
        privateKeyB64: string,
        timeoutMs = 5 * 60 * 1000,
        intervalMs = 3_000
    ): Promise<{
        accessToken: string;
        email?: string;
        displayName?: string;
        metadata: JsonObject;
    }> {
        const deadline = Date.now() + timeoutMs;

        while (Date.now() < deadline) {
            await new Promise<void>(resolve => setTimeout(resolve, intervalMs));

            try {
                const response = await axios.get(
                    `https://ollama.com/api/connect/${encodeURIComponent(code)}`,
                    { timeout: 10_000 }
                );

                const data = response.data as {
                    status?: string;
                    token?: string;
                    access_token?: string;
                    email?: string;
                    username?: string;
                    name?: string;
                };

                const status = data.status ?? 'pending';

                if (status === 'pending' || status === 'waiting') {
                    continue;
                }

                if (status === 'approved' || status === 'success' || status === 'authorized') {
                    const accessToken = data.token ?? data.access_token ?? '';
                    if (!accessToken) {
                        throw new Error('Ollama connect approved but no token returned');
                    }

                    appLogger.info('OllamaService', `Ollama connect authorized for: ${data.email ?? data.username ?? 'unknown'}`);

                    return {
                        accessToken,
                        email:       data.email,
                        displayName: data.name ?? data.username,
                        metadata: {
                            auth_type:      'ollama_connect',
                            type:           'ollama_connect',
                            private_key_b64: privateKeyB64,
                            public_key_b64:  '', // stored separately; caller should pass it
                        },
                    };
                }

                // Any other status (expired, denied, cancelled) → throw
                throw new Error(`Ollama connect failed with status: ${status}`);
            } catch (error) {
                // 404 / 410 means expired
                const axiosError = error as { response?: { status?: number }; message?: string };
                const httpStatus = axiosError.response?.status;
                if (httpStatus === 404 || httpStatus === 410) {
                    throw new Error('Ollama connect session expired or cancelled');
                }

                // For non-HTTP errors keep retrying until deadline
                if (!axiosError.response) {
                    appLogger.warn('OllamaService', `Ollama connect poll network error: ${axiosError.message ?? 'unknown'}`);
                    continue;
                }

                throw error;
            }
        }

        throw new Error('Ollama connect timed out — the user did not approve within the allowed window');
    }

    /**
     * Release all held resources: GPU monitoring interval, event listeners, and connection pool.
     * Called automatically by the DI container on shutdown.
     */
    async cleanup(): Promise<void> {
        this.stopGPUMonitoring();
        this.gpuEventEmitter.removeAllListeners();
        this.connectionPool = [];
        appLogger.info('OllamaService', 'Service destroyed and resources cleaned up');
    }

    /**
     * Legacy entry point — delegates to {@link cleanup} for backwards compatibility.
     * @deprecated Prefer calling `cleanup()` directly.
     */
    destroy(): void {
        void this.cleanup();
    }
    @ipc('ollama:checkCuda')
    async checkCuda(): Promise<boolean> {
        const support = await this.localAIService.checkCudaSupport();
        return support.hasCuda;
    }

    @ipc('ollama:get-ollama-accounts')
    async getOllamaAccounts(): Promise<unknown[]> {
        return this.authService.getAccountsByProvider('ollama');
    }

    @ipc({ channel: 'ollama:start', withEvent: true })
    async startIpc(event: IpcMainInvokeEvent): Promise<unknown> {
        const { startOllama } = await import('@main/startup/ollama');
        const getWin = () => BrowserWindow.fromWebContents(event.sender);
        return await startOllama(getWin, true);
    }

    /**
     * Validates a model name
     */
    private validateModel(value: RuntimeValue): string | null {
        if (typeof value !== 'string') {
            return null;
        }
        const trimmed = value.trim();
        if (!trimmed || trimmed.length > 256) {
            return null;
        }
        return trimmed;
    }

    /**
     * Validates a messages array
     */
    private validateMessages(value: RuntimeValue): OllamaMessage[] {
        if (!Array.isArray(value)) {
            return [];
        }
        const validRoles = ['system', 'user', 'assistant', 'tool'];
        return value.filter((msg): msg is OllamaMessage =>
            msg && typeof msg === 'object' &&
            typeof msg.role === 'string' &&
            validRoles.includes(msg.role) &&
            typeof msg.content === 'string'
        );
    }
}
