/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as fs from 'fs';
import * as path from 'path';

import { ipc } from '@main/core/ipc-decorators';
import { BaseService } from '@main/services/base.service';
import { getManagedRuntimeTempDir } from '@main/services/system/runtime-path.service';
import { serializeToIpc } from '@main/utils/ipc-serializer.util';
import { RuntimeValue } from '@shared/types/common';
import { getErrorMessage } from '@shared/utils/error.util';

import { LocalImageAnalytics } from './local-image-analytics';
import { LocalImageProviders } from './local-image-providers';
import { LocalImageScheduler } from './local-image-scheduler';
import { SdCppManager } from './local-image-sdcpp.manager';
import { LocalImageStateManager } from './local-image-state.manager';

type UnsafeValue = ReturnType<typeof JSON.parse>;

export type {
    AntigravityAccount,
    AntigravityUpstreamQuotaResponse,
    ComfyWorkflowTemplate,
    GenerationQueueItem,
    GitHubRelease,
    GitHubReleaseAsset,
    ImageComparisonResult,
    ImageEditOptions,
    ImageGenerationOptions,
    ImageGenerationPreset,
    ImageGenerationRecord,
    ImageProvider,
    ImageResourceProfile,
    ImageSchedulePriority,
    ImageScheduleTask,
    LocalImageServiceDeps,
} from './local-image.types';

import type {
    ComfyWorkflowTemplate,
    ImageComparisonResult,
    ImageEditOptions,
    ImageGenerationOptions,
    ImageGenerationPreset,
    ImageGenerationRecord,
    ImageProvider,
    ImageResourceProfile,
    ImageSchedulePriority,
    ImageScheduleTask,
    LocalImageServiceDeps,
} from './local-image.types';

/**
 * Facade service for local image generation.
 * Delegates to domain-focused sub-services for generation, history, presets, scheduling, and SD-CPP management.
 */
export class LocalImageService extends BaseService {
    private static readonly ERROR_CODES = {
        SDCPP_FALLBACK_TRIGGERED: 'LOCAL_IMAGE_SDCPP_FALLBACK_TRIGGERED',
    } as const;
    private static readonly PERFORMANCE_BUDGET = {
        statusCheckMs: 300,
        generationFallbackMs: 5000,
        queueDepthWarnThreshold: 25,
    } as const;
    private static readonly UI_MESSAGE_KEYS = {
        ready: 'serviceHealth.localImage.ready',
        empty: 'serviceHealth.localImage.empty',
        failure: 'serviceHealth.localImage.failure',
    } as const;

    private readonly state: LocalImageStateManager;
    private readonly analytics: LocalImageAnalytics;
    private readonly providers: LocalImageProviders;
    private readonly scheduler: LocalImageScheduler;
    private readonly sdcpp: SdCppManager;
    private readonly settingsSvc: LocalImageServiceDeps['settingsService'];
    private initializationPromise: Promise<void> | null = null;
    private hasInitialized = false;

    constructor(deps: LocalImageServiceDeps) {
        super('LocalImageService');
        this.settingsSvc = deps.settingsService;
        this.state = new LocalImageStateManager();
        this.analytics = new LocalImageAnalytics({ telemetryService: deps.telemetryService });
        this.providers = new LocalImageProviders({
            settingsService: deps.settingsService,
            authService: deps.authService,
            llmService: deps.llmService,
            proxyService: deps.proxyService,
            advancedMemoryService: deps.advancedMemoryService,
        });
        this.sdcpp = new SdCppManager({
            settingsService: deps.settingsService,
            eventBusService: deps.eventBusService,
            telemetryService: deps.telemetryService,
        });
        this.scheduler = new LocalImageScheduler(
            {
                eventBusService: deps.eventBusService,
                generateImage: (options, source) => this.generateImage(options, source),
                persistState: () => this.state.persistState(),
            },
            this.state.scheduleTasks,
        );
    }

    /** Proxy for test compatibility: get generation history. */
    get generationHistory(): ImageGenerationRecord[] {
        return this.state.generationHistory;
    }

    /** Proxy for test compatibility: set generation history. */
    set generationHistory(value: ImageGenerationRecord[]) {
        this.state.generationHistory = value;
    }

    /**
     * Initialize the service.
     * Triggers non-blocking SD-CPP readiness check if it's the preferred provider.
     */
    override async initialize(): Promise<void> {
        if (this.hasInitialized) {
            return;
        }
        if (this.initializationPromise) {
            return this.initializationPromise;
        }
        this.initializationPromise = this.performInitialize().finally(() => {
            this.initializationPromise = null;
        });
        return this.initializationPromise;
    }

    private async performInitialize(): Promise<void> {
        this.logInfo('Initializing LocalImageService');
        void this.cleanupStaleTempFiles().catch(err => {
            this.logWarn('Failed to cleanup stale temp files', err);
        });
        await this.state.ensureStorageReady();
        await this.state.loadState();
        this.providers.setWorkflowTemplates(this.state.comfyWorkflowTemplates);
        this.scheduler.scheduleTasks = this.state.scheduleTasks;
        this.scheduler.restoreScheduledTasks();

        const preferredProvider = this.settingsSvc.getSettings().images?.provider;
        if (preferredProvider === 'sd-cpp') {
            this.logInfo('SD-CPP is the preferred provider, starting non-blocking readiness check...');
            void this.ensureSDCppReady().catch(err => {
                this.logError('Non-blocking SD-CPP readiness check failed', err);
            });
        }
        this.hasInitialized = true;
    }

    /**
     * Generate an image using available providers.
     * Priority: Antigravity (with quota) > selected local provider
     */
    async generateImage(
        options: ImageGenerationOptions,
        source: 'generate' | 'edit' | 'schedule' | 'batch' = 'generate'
    ): Promise<string> {
        const startedAt = Date.now();
        const normalizedOptions = this.normalizeGenerationOptions(options);
        this.assertNonEmptyText(normalizedOptions.prompt, 'Prompt');
        const preferredProvider = (this.settingsSvc.getSettings().images?.provider ?? 'antigravity') as ImageProvider;
        this.logInfo(`Generating image with preferred provider: ${preferredProvider}`);

        let generatedPath: string | null = null;
        generatedPath = await this.providers.tryGenerateWithAntigravity(normalizedOptions);

        if (!generatedPath) {
            this.logInfo(`Falling back to ${preferredProvider}`);
            try {
                generatedPath = await this.generateWithProvider(preferredProvider, normalizedOptions);
            } catch (error) {
                if (preferredProvider === 'sd-cpp') {
                    this.logWarn('SD-CPP generation failed', error as Error);
                    this.trackSdCppMetric('sd-cpp-fallback-triggered', {
                        errorCode: LocalImageService.ERROR_CODES.SDCPP_FALLBACK_TRIGGERED,
                        error: getErrorMessage(error as Error),
                    });
                } else {
                    throw error;
                }
                throw error;
            }
        }

        await this.state.recordGeneration({ provider: preferredProvider, options: normalizedOptions, imagePath: generatedPath, source });
        this.analytics.recordDuration(Date.now() - startedAt);
        return generatedPath;
    }

    /** Edit an image using the configured provider. */
    async editImage(options: ImageEditOptions): Promise<string> {
        this.assertNonEmptyText(options.prompt, 'Prompt');
        this.assertNonEmptyText(options.sourceImage, 'Source image');
        const provider = (this.settingsSvc.getSettings().images?.provider ?? 'antigravity') as ImageProvider;
        const imagePath = await this.editImageWithProvider(provider, options);
        await this.recordEditGeneration(provider, options, imagePath);
        return imagePath;
    }

    /** Edit an image using a specific image provider. */
    async editImageWithProvider(provider: ImageProvider, options: ImageEditOptions): Promise<string> {
        this.assertNonEmptyText(options.prompt, 'Prompt');
        this.assertNonEmptyText(options.sourceImage, 'Source image');
        const imagePath = provider === 'sd-cpp'
            ? await this.sdcpp.edit(options)
            : await this.providers.editImageWithProvider(provider, options);
        return imagePath;
    }

    private async recordEditGeneration(provider: ImageProvider, options: ImageEditOptions, imagePath: string): Promise<void> {
        await this.state.recordGeneration({
            provider,
            options: { prompt: options.prompt, negativePrompt: options.negativePrompt, width: options.width, height: options.height, steps: 24, cfgScale: 7 },
            imagePath,
            source: 'edit',
        });
    }

    /** Get generation history entries. */
    getGenerationHistory(limit: number = 100): ImageGenerationRecord[] {
        const bounded = Math.max(1, Math.min(limit, 1000));
        return this.state.generationHistory.slice(-bounded).reverse();
    }

    /** Search generation history by query. */
    searchGenerationHistory(query: string, limit: number = 100): ImageGenerationRecord[] {
        return this.analytics.searchHistory(this.state.generationHistory, query, limit);
    }

    /** Regenerate an image from a history entry. */
    async regenerateFromHistory(id: string): Promise<string> {
        this.assertNonEmptyText(id, 'Generation history id');
        const entry = this.state.generationHistory.find(item => item.id === id);
        if (!entry) { throw new Error('Generation history entry not found'); }
        return this.generateImage({
            prompt: entry.prompt, negativePrompt: entry.negativePrompt,
            width: entry.width, height: entry.height, steps: entry.steps,
            cfgScale: entry.cfgScale, seed: entry.seed,
        });
    }

    /** Export generation history as JSON or CSV. */
    async exportGenerationHistory(format: 'json' | 'csv' = 'json'): Promise<string> {
        return this.analytics.exportHistory(this.state.generationHistory, format);
    }

    /** Get analytics summary for generation history. */
    getImageAnalytics(): {
        totalGenerated: number; byProvider: Record<string, number>; averageSteps: number;
        bySource: Record<string, number>; averageDurationMs: number; editModeCounts: Record<string, number>;
    } {
        return this.analytics.getImageAnalytics(this.state.generationHistory);
    }

    /** Compare multiple generation records by file stats. */
    async compareGenerations(ids: string[]): Promise<ImageComparisonResult> {
        return this.analytics.compareGenerations(this.state.generationHistory, ids);
    }

    /** Export a comparison as JSON or CSV. */
    async exportComparison(ids: string[], format: 'json' | 'csv' = 'json'): Promise<string> {
        return this.analytics.exportComparison(this.state.generationHistory, ids, format);
    }

    /** Share a comparison as a base64 encoded string. */
    async shareComparison(ids: string[]): Promise<string> {
        return this.analytics.shareComparison(this.state.generationHistory, ids);
    }

    /** List all generation presets (user + defaults). */
    listGenerationPresets(): ImageGenerationPreset[] {
        const defaults = this.analytics.getDefaultPresets();
        const merged = [...this.state.generationPresets];
        defaults.forEach(d => { if (!merged.some(m => m.id === d.id)) { merged.push(d); } });
        return merged.sort((l, r) => r.updatedAt - l.updatedAt);
    }

    /** Save or update a generation preset. */
    async saveGenerationPreset(
        input: Omit<ImageGenerationPreset, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
    ): Promise<ImageGenerationPreset> {
        this.assertNonEmptyText(input.name, 'Preset name');
        this.validateGenerationPreset(input);
        return this.state.savePreset(input);
    }

    /** Delete a generation preset by id. */
    async deleteGenerationPreset(id: string): Promise<boolean> {
        this.assertNonEmptyText(id, 'Preset id');
        return this.state.deletePreset(id);
    }

    /** Apply a preset to generation options. */
    applyPresetToOptions(options: ImageGenerationOptions, presetId?: string): ImageGenerationOptions {
        return this.analytics.applyPresetToOptions(options, this.state.generationPresets, presetId);
    }

    /** Export a preset as a share code. */
    exportGenerationPresetShareCode(id: string): string {
        this.assertNonEmptyText(id, 'Preset id');
        return this.analytics.exportPresetShareCode(this.listGenerationPresets(), id);
    }

    /** Import a preset from a share code. */
    async importGenerationPresetShareCode(code: string): Promise<ImageGenerationPreset> {
        this.assertNonEmptyText(code, 'Preset share code');
        let parsed: { preset?: Omit<ImageGenerationPreset, 'id' | 'createdAt' | 'updatedAt'> & { name: string } };
        try {
            parsed = JSON.parse(Buffer.from(code, 'base64').toString('utf-8')) as typeof parsed;
        } catch (error) {
            throw new Error(`Invalid preset share code: ${getErrorMessage(error as Error)}`);
        }
        if (!parsed.preset) { throw new Error('Preset payload missing'); }
        return this.saveGenerationPreset(parsed.preset);
    }

    /** Get preset analytics. */
    getPresetAnalytics(): { totalPresets: number; providerCounts: Record<string, number>; customPresets: number } {
        return this.analytics.getPresetAnalytics(this.listGenerationPresets());
    }

    /** List ComfyUI workflow templates. */
    listComfyWorkflowTemplates(): ComfyWorkflowTemplate[] {
        return [...this.state.comfyWorkflowTemplates].sort((l, r) => r.updatedAt - l.updatedAt);
    }

    /** Save or update a ComfyUI workflow template. */
    async saveComfyWorkflowTemplate(input: {
        id?: string; name: string; description?: string; workflow: Record<string, RuntimeValue>;
    }): Promise<ComfyWorkflowTemplate> {
        this.assertNonEmptyText(input.name, 'Workflow template name');
        if (!input.workflow || Object.keys(input.workflow).length === 0) {
            throw new Error('Workflow template must contain at least one node');
        }
        const result = await this.state.saveWorkflowTemplate(input);
        this.providers.setWorkflowTemplates(this.state.comfyWorkflowTemplates);
        return result;
    }

    /** Delete a ComfyUI workflow template. */
    async deleteComfyWorkflowTemplate(id: string): Promise<boolean> {
        this.assertNonEmptyText(id, 'Workflow template id');
        const result = await this.state.deleteWorkflowTemplate(id);
        this.providers.setWorkflowTemplates(this.state.comfyWorkflowTemplates);
        return result;
    }

    /** Export a workflow template as a share code. */
    exportComfyWorkflowTemplateShareCode(id: string): string {
        this.assertNonEmptyText(id, 'Workflow template id');
        return this.analytics.exportWorkflowTemplateShareCode(this.state.comfyWorkflowTemplates, id);
    }

    /** Import a workflow template from a share code. */
    async importComfyWorkflowTemplateShareCode(code: string): Promise<ComfyWorkflowTemplate> {
        this.assertNonEmptyText(code, 'Workflow template share code');
        let parsed: { template?: { id?: string; name: string; description?: string; workflow: Record<string, RuntimeValue> } };
        try {
            parsed = JSON.parse(Buffer.from(code, 'base64').toString('utf-8')) as typeof parsed;
        } catch (error) {
            throw new Error(`Invalid workflow template share code: ${getErrorMessage(error as Error)}`);
        }
        if (!parsed.template) { throw new Error('Workflow template payload missing'); }
        return this.saveComfyWorkflowTemplate({
            name: parsed.template.name, description: parsed.template.description, workflow: parsed.template.workflow,
        });
    }

    /** Schedule an image generation at a future time. */
    async scheduleGeneration(
        runAt: number,
        options: ImageGenerationOptions,
        scheduling?: { priority?: ImageSchedulePriority; resourceProfile?: ImageResourceProfile }
    ): Promise<ImageScheduleTask> {
        return this.scheduler.scheduleGeneration(runAt, options, scheduling);
    }

    /** List all scheduled generations. */
    listScheduledGenerations(): ImageScheduleTask[] {
        return this.scheduler.listScheduledGenerations();
    }

    /** Cancel a scheduled generation. */
    async cancelScheduledGeneration(id: string): Promise<boolean> {
        return this.scheduler.cancelScheduledGeneration(id);
    }

    /** Run a batch of generation requests. */
    async runBatchGeneration(requests: ImageGenerationOptions[]): Promise<string[]> {
        return this.scheduler.runBatchGeneration(requests);
    }

    /** Get queue statistics. */
    getQueueStats(): { queued: number; running: boolean; byPriority: Record<string, number> } {
        return this.scheduler.getQueueStats();
    }

    /** Get schedule analytics. */
    getScheduleAnalytics(): { total: number; byStatus: Record<string, number>; byPriority: Record<string, number> } {
        return this.scheduler.getScheduleAnalytics();
    }

    /** Get the current status of the SD-CPP runtime. */
    async getSDCppStatus(): Promise<string> {
        return this.sdcpp.getStatus();
    }

    /** Force a reinstallation / repair of the SD-CPP runtime. */
    async repairSDCpp(): Promise<void> {
        return this.sdcpp.repair();
    }

    /**
     * Ensures sd-cpp runtime (binary + model) is installed and configured.
     * Safe to call multiple times; concurrent calls share the same in-flight promise.
     */
    async ensureSDCppReady(): Promise<{ binaryPath: string; modelPath: string }> {
        return this.sdcpp.ensureReady();
    }

    /** Trigger a full reinstallation of the sd-cpp runtime. */
    async reinstallSDCpp(): Promise<void> {
        return this.sdcpp.reinstall();
    }

    /** Get dashboard-friendly health metrics. */
    async getHealthMetrics(): Promise<{
        status: 'healthy' | 'degraded'; uiState: 'ready' | 'empty' | 'failure'; messageKey: string;
        performanceBudget: typeof LocalImageService.PERFORMANCE_BUDGET; provider: string;
        sdCppStatus: string; queueDepth: number; scheduledTaskCount: number;
        historyCount: number; averageGenerationDurationMs: number;
    }> {
        const sdStatus = await this.getSDCppStatus();
        const provider = this.settingsSvc.getSettings().images?.provider ?? 'antigravity';
        const uiState = sdStatus === 'failed' ? 'failure' : sdStatus === 'ready' ? 'ready' : 'empty';
        const queueStats = this.scheduler.getQueueStats();
        return {
            status: sdStatus === 'failed' ? 'degraded' : 'healthy',
            uiState,
            messageKey: LocalImageService.UI_MESSAGE_KEYS[uiState],
            performanceBudget: LocalImageService.PERFORMANCE_BUDGET,
            provider,
            sdCppStatus: sdStatus,
            queueDepth: queueStats.queued,
            scheduledTaskCount: this.state.scheduleTasks.length,
            historyCount: this.state.generationHistory.length,
            averageGenerationDurationMs: this.analytics.getAverageDurationMs(),
        };
    }

    // ── Private delegation methods (kept for test spy compatibility) ──

    private async generateWithProvider(provider: string, options: ImageGenerationOptions): Promise<string> {
        switch (provider) {
            case 'sd-cpp':
                return this.generateWithSDCpp(options);
            case 'ollama':
            case 'sd-webui':
            case 'comfyui':
                return this.providers.generateWithProvider(provider, options);
            case 'antigravity':
                return this.providers.generateWithProvider('antigravity', options);
            default:
                throw new Error(`Unsupported image provider: ${provider}`);
        }
    }

    private async generateWithSDCpp(options: ImageGenerationOptions): Promise<string> {
        return this.sdcpp.generate(options);
    }

    private trackSdCppMetric(name: string, properties?: Record<string, RuntimeValue>): void {
        this.sdcpp.trackMetric(name, properties);
    }

    private normalizeGenerationOptions(options: ImageGenerationOptions): ImageGenerationOptions {
        const width = options.width ?? 1024;
        const height = options.height ?? 1024;
        const maxPixels = this.getMaxPixelBudget();
        const currentPixels = width * height;
        if (currentPixels <= maxPixels) { return options; }
        const scale = Math.sqrt(maxPixels / currentPixels);
        const normalizedWidth = Math.max(256, Math.floor(width * scale / 64) * 64);
        const normalizedHeight = Math.max(256, Math.floor(height * scale / 64) * 64);
        this.trackSdCppMetric('image-resolution-normalized', {
            originalWidth: width, originalHeight: height, normalizedWidth, normalizedHeight,
        });
        return { ...options, width: normalizedWidth, height: normalizedHeight };
    }

    private getMaxPixelBudget(): number {
        const imagesSettings = this.settingsSvc.getSettings().images as Record<string, RuntimeValue> | undefined;
        const configured = imagesSettings?.maxPixels;
        if (typeof configured === 'number' && Number.isFinite(configured) && configured > 100_000) {
            return configured;
        }
        return 2_359_296;
    }

    private validateGenerationPreset(input: { width: number; height: number; steps: number; cfgScale: number }): void {
        if (!Number.isFinite(input.width) || input.width < 256 || input.width > 4096) {
            throw new Error('Preset width must be between 256 and 4096');
        }
        if (!Number.isFinite(input.height) || input.height < 256 || input.height > 4096) {
            throw new Error('Preset height must be between 256 and 4096');
        }
        if (!Number.isFinite(input.steps) || input.steps < 1 || input.steps > 120) {
            throw new Error('Preset steps must be between 1 and 120');
        }
        if (!Number.isFinite(input.cfgScale) || input.cfgScale < 1 || input.cfgScale > 30) {
            throw new Error('Preset cfgScale must be between 1 and 30');
        }
    }

    private assertNonEmptyText(value: string, fieldName: string): void {
        if (typeof value !== 'string' || value.trim().length === 0) {
            throw new Error(`${fieldName} is required`);
        }
    }

    private async cleanupStaleTempFiles(): Promise<void> {
        const tempDir = path.join(getManagedRuntimeTempDir(), 'generated');
        try {
            await fs.promises.access(tempDir, fs.constants.F_OK);
        } catch {
            return;
        }
        const files = await fs.promises.readdir(tempDir);
        const failedFiles: string[] = [];
        for (const file of files) {
            const filePath = path.join(tempDir, file);
            try {
                await fs.promises.unlink(filePath);
            } catch (error) {
                failedFiles.push(filePath);
                this.logWarn(`Failed to remove stale temp file ${filePath}: ${getErrorMessage(error as Error)}`);
            }
        }
        if (failedFiles.length > 0) {
            throw new Error(`Failed to cleanup ${failedFiles.length} stale temp files`);
        }
        this.logDebug(`Cleaned up ${files.length} stale temp files`);
    }

    // --- IPC Decorated Methods ---

    @ipc('sd-cpp:getStatus')
    async getSDCppStatusIpc(): Promise<RuntimeValue> {
        const status = await this.getSDCppStatus();
        return serializeToIpc(status);
    }

    @ipc('sd-cpp:reinstall')
    async repairSDCppIpc(): Promise<RuntimeValue> {
        await this.repairSDCpp();
        return serializeToIpc(void 0);
    }

    @ipc('sd-cpp:getHistory')
    async getHistoryIpc(limit?: number): Promise<RuntimeValue> {
        const result = this.getGenerationHistory(limit);
        return serializeToIpc(result);
    }

    @ipc('sd-cpp:regenerate')
    async regenerateIpc(historyId: string): Promise<RuntimeValue> {
        const result = await this.regenerateFromHistory(historyId);
        return serializeToIpc(result);
    }

    @ipc('sd-cpp:getAnalytics')
    async getAnalyticsIpc(): Promise<RuntimeValue> {
        const result = this.getImageAnalytics();
        return serializeToIpc(result);
    }

    @ipc('sd-cpp:getPresetAnalytics')
    async getPresetAnalyticsIpc(): Promise<RuntimeValue> {
        const result = this.getPresetAnalytics();
        return serializeToIpc(result);
    }

    @ipc('sd-cpp:getScheduleAnalytics')
    async getScheduleAnalyticsIpc(): Promise<RuntimeValue> {
        const result = this.getScheduleAnalytics();
        return serializeToIpc(result);
    }

    @ipc('sd-cpp:listPresets')
    async listPresetsIpc(): Promise<RuntimeValue> {
        const result = this.listGenerationPresets();
        return serializeToIpc(result);
    }

    @ipc('sd-cpp:savePreset')
    async savePresetIpc(preset: UnsafeValue): Promise<RuntimeValue> {
        const result = await this.saveGenerationPreset(preset);
        return serializeToIpc(result);
    }

    @ipc('sd-cpp:deletePreset')
    async deletePresetIpc(id: string): Promise<RuntimeValue> {
        const result = await this.deleteGenerationPreset(id);
        return serializeToIpc(result);
    }

    @ipc('sd-cpp:exportPresetShare')
    async exportPresetShareIpc(id: string): Promise<RuntimeValue> {
        const result = this.exportGenerationPresetShareCode(id);
        return serializeToIpc(result);
    }

    @ipc('sd-cpp:importPresetShare')
    async importPresetShareIpc(code: string): Promise<RuntimeValue> {
        const result = await this.importGenerationPresetShareCode(code);
        return serializeToIpc(result);
    }

    @ipc('sd-cpp:listWorkflowTemplates')
    async listWorkflowTemplatesIpc(): Promise<RuntimeValue> {
        const result = this.listComfyWorkflowTemplates();
        return serializeToIpc(result);
    }

    @ipc('sd-cpp:saveWorkflowTemplate')
    async saveWorkflowTemplateIpc(payload: UnsafeValue): Promise<RuntimeValue> {
        const result = await this.saveComfyWorkflowTemplate(payload);
        return serializeToIpc(result);
    }

    @ipc('sd-cpp:deleteWorkflowTemplate')
    async deleteWorkflowTemplateIpc(id: string): Promise<RuntimeValue> {
        const result = await this.deleteComfyWorkflowTemplate(id);
        return serializeToIpc(result);
    }

    @ipc('sd-cpp:exportWorkflowTemplateShare')
    async exportWorkflowTemplateShareIpc(id: string): Promise<RuntimeValue> {
        const result = this.exportComfyWorkflowTemplateShareCode(id);
        return serializeToIpc(result);
    }

    @ipc('sd-cpp:importWorkflowTemplateShare')
    async importWorkflowTemplateShareIpc(code: string): Promise<RuntimeValue> {
        const result = await this.importComfyWorkflowTemplateShareCode(code);
        return serializeToIpc(result);
    }

    @ipc('sd-cpp:schedule')
    async scheduleIpc(payload: UnsafeValue): Promise<RuntimeValue> {
        const result = await this.scheduleGeneration(payload.runAt, payload.options, {
            priority: payload.priority,
            resourceProfile: payload.resourceProfile
        });
        return serializeToIpc(result);
    }

    @ipc('sd-cpp:listSchedules')
    async listSchedulesIpc(): Promise<RuntimeValue> {
        const result = this.listScheduledGenerations();
        return serializeToIpc(result);
    }

    @ipc('sd-cpp:cancelSchedule')
    async cancelScheduleIpc(id: string): Promise<RuntimeValue> {
        const result = await this.cancelScheduledGeneration(id);
        return serializeToIpc(result);
    }

    @ipc('sd-cpp:compare')
    async compareIpc(ids: string[]): Promise<RuntimeValue> {
        const result = await this.compareGenerations(ids);
        return serializeToIpc(result);
    }

    @ipc('sd-cpp:exportComparison')
    async exportComparisonIpc(payload: UnsafeValue): Promise<RuntimeValue> {
        const result = await this.exportComparison(payload.ids, payload.format ?? 'json');
        return serializeToIpc(result);
    }

    @ipc('sd-cpp:shareComparison')
    async shareComparisonIpc(ids: string[]): Promise<RuntimeValue> {
        const result = await this.shareComparison(ids);
        return serializeToIpc(result);
    }

    @ipc('sd-cpp:batchGenerate')
    async batchGenerateIpc(requests: UnsafeValue[]): Promise<RuntimeValue> {
        const result = await this.runBatchGeneration(requests);
        return serializeToIpc(result);
    }

    @ipc('sd-cpp:getQueueStats')
    async getQueueStatsIpc(): Promise<RuntimeValue> {
        const result = this.getQueueStats();
        return serializeToIpc(result);
    }

    @ipc('sd-cpp:searchHistory')
    async searchHistoryIpc(query: string, limit?: number): Promise<RuntimeValue> {
        const result = this.searchGenerationHistory(query, limit);
        return serializeToIpc(result);
    }

    @ipc('sd-cpp:exportHistory')
    async exportHistoryIpc(format?: 'json' | 'csv'): Promise<RuntimeValue> {
        const result = await this.exportGenerationHistory(format ?? 'json');
        return serializeToIpc(result);
    }

    @ipc('sd-cpp:edit')
    async editIpc(options: UnsafeValue): Promise<RuntimeValue> {
        const result = await this.editImage(options);
        return serializeToIpc(result);
    }
}

