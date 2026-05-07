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

import { appLogger } from '@main/logging/logger';
import { getErrorMessage } from '@shared/utils/error.util';
import { app } from 'electron';
import { v4 as uuidv4 } from 'uuid';

import type {
    ComfyWorkflowTemplate,
    ImageGenerationPreset,
    ImageGenerationRecord,
    ImageProvider,
    ImageScheduleTask,
} from './local-image.types';

/** Manages persistent state for image generation history, presets, schedules, and workflow templates. */
export class LocalImageStateManager {
    private readonly storageRoot: string = path.join(app.getPath('userData'), 'ai', 'images');
    private readonly historyPath: string = path.join(this.storageRoot, 'generation-history.json');
    private readonly presetsPath: string = path.join(this.storageRoot, 'generation-presets.json');
    private readonly schedulePath: string = path.join(this.storageRoot, 'generation-schedule.json');
    private readonly workflowTemplatesPath: string = path.join(this.storageRoot, 'comfy-workflow-templates.json');

    generationHistory: ImageGenerationRecord[] = [];
    generationPresets: ImageGenerationPreset[] = [];
    comfyWorkflowTemplates: ComfyWorkflowTemplate[] = [];
    scheduleTasks: ImageScheduleTask[] = [];

    /** Ensure all storage directories and files exist. */
    async ensureStorageReady(): Promise<void> {
        await fs.promises.mkdir(this.storageRoot, { recursive: true });
        const files = [this.historyPath, this.presetsPath, this.schedulePath, this.workflowTemplatesPath];
        for (const file of files) {
            if (!(await this.pathExists(file))) {
                await fs.promises.writeFile(file, JSON.stringify([], null, 2), 'utf-8');
            }
        }
    }

    /** Load all state from disk. */
    async loadState(): Promise<void> {
        try {
            const [historyRaw, presetsRaw, scheduleRaw, workflowRaw] = await Promise.all([
                fs.promises.readFile(this.historyPath, 'utf-8'),
                fs.promises.readFile(this.presetsPath, 'utf-8'),
                fs.promises.readFile(this.schedulePath, 'utf-8'),
                fs.promises.readFile(this.workflowTemplatesPath, 'utf-8')
            ]);
            this.generationHistory = JSON.parse(historyRaw) as ImageGenerationRecord[];
            this.generationPresets = JSON.parse(presetsRaw) as ImageGenerationPreset[];
            this.scheduleTasks = this.normalizeScheduleTasks(JSON.parse(scheduleRaw) as ImageScheduleTask[]);
            this.comfyWorkflowTemplates = JSON.parse(workflowRaw) as ComfyWorkflowTemplate[];
        } catch (error) {
            appLogger.warn('LocalImageStateManager', `Failed to load image state, resetting: ${getErrorMessage(error as Error)}`);
            this.generationHistory = [];
            this.generationPresets = [];
            this.scheduleTasks = [];
            this.comfyWorkflowTemplates = [];
        }
    }

    /** Persist all state to disk with bounded sizes. */
    async persistState(): Promise<void> {
        await fs.promises.mkdir(this.storageRoot, { recursive: true });
        await Promise.all([
            fs.promises.writeFile(this.historyPath, JSON.stringify(this.generationHistory.slice(-1000), null, 2), 'utf-8'),
            fs.promises.writeFile(this.presetsPath, JSON.stringify(this.generationPresets.slice(-300), null, 2), 'utf-8'),
            fs.promises.writeFile(this.schedulePath, JSON.stringify(this.scheduleTasks.slice(-500), null, 2), 'utf-8'),
            fs.promises.writeFile(
                this.workflowTemplatesPath,
                JSON.stringify(this.comfyWorkflowTemplates.slice(-120), null, 2),
                'utf-8'
            )
        ]);
    }

    /** Record a generation event in history. */
    async recordGeneration(input: {
        provider: ImageProvider;
        options: { prompt: string; negativePrompt?: string; width?: number; height?: number; steps?: number; cfgScale?: number; seed?: number };
        imagePath: string;
        source: 'generate' | 'edit' | 'schedule' | 'batch';
    }): Promise<void> {
        const record: ImageGenerationRecord = {
            id: uuidv4(),
            provider: input.provider,
            prompt: input.options.prompt,
            negativePrompt: input.options.negativePrompt,
            width: input.options.width ?? 1024,
            height: input.options.height ?? 1024,
            steps: input.options.steps ?? 24,
            cfgScale: input.options.cfgScale ?? 7,
            seed: typeof input.options.seed === 'number' ? input.options.seed : -1,
            imagePath: input.imagePath,
            source: input.source,
            createdAt: Date.now()
        };
        this.generationHistory.push(record);
        if (this.generationHistory.length > 1000) {
            this.generationHistory = this.generationHistory.slice(-1000);
        }
        await this.persistState();
    }

    /** Save or update a generation preset. */
    async savePreset(
        input: Omit<ImageGenerationPreset, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
    ): Promise<ImageGenerationPreset> {
        const now = Date.now();
        const existingIndex = input.id
            ? this.generationPresets.findIndex(p => p.id === input.id)
            : -1;
        const next: ImageGenerationPreset = {
            id: input.id ?? uuidv4(),
            name: input.name.trim(),
            promptPrefix: input.promptPrefix,
            width: input.width,
            height: input.height,
            steps: input.steps,
            cfgScale: input.cfgScale,
            provider: input.provider,
            createdAt: existingIndex >= 0 ? this.generationPresets[existingIndex].createdAt : now,
            updatedAt: now
        };
        if (existingIndex >= 0) {
            this.generationPresets[existingIndex] = next;
        } else {
            this.generationPresets.push(next);
        }
        await this.persistState();
        return next;
    }

    /** Delete a preset by id. */
    async deletePreset(id: string): Promise<boolean> {
        const filtered = this.generationPresets.filter(p => p.id !== id);
        if (filtered.length === this.generationPresets.length) {
            return false;
        }
        this.generationPresets = filtered;
        await this.persistState();
        return true;
    }

    /** Save or update a ComfyUI workflow template. */
    async saveWorkflowTemplate(input: {
        id?: string;
        name: string;
        description?: string;
        workflow: Record<string, RuntimeValue>;
    }): Promise<ComfyWorkflowTemplate> {
        const now = Date.now();
        const existingIndex = input.id
            ? this.comfyWorkflowTemplates.findIndex(t => t.id === input.id)
            : -1;
        const template: ComfyWorkflowTemplate = {
            id: input.id ?? uuidv4(),
            name: input.name.trim(),
            description: input.description?.trim() || undefined,
            workflow: input.workflow,
            createdAt: existingIndex >= 0 ? this.comfyWorkflowTemplates[existingIndex].createdAt : now,
            updatedAt: now
        };
        if (existingIndex >= 0) {
            this.comfyWorkflowTemplates[existingIndex] = template;
        } else {
            this.comfyWorkflowTemplates.push(template);
        }
        await this.persistState();
        return template;
    }

    /** Delete a workflow template by id. */
    async deleteWorkflowTemplate(id: string): Promise<boolean> {
        const filtered = this.comfyWorkflowTemplates.filter(t => t.id !== id);
        if (filtered.length === this.comfyWorkflowTemplates.length) {
            return false;
        }
        this.comfyWorkflowTemplates = filtered;
        await this.persistState();
        return true;
    }

    private normalizeScheduleTasks(tasks: ImageScheduleTask[]): ImageScheduleTask[] {
        return tasks.map(task => ({
            ...task,
            priority: task.priority ?? 'normal',
            resourceProfile: task.resourceProfile ?? 'balanced'
        }));
    }

    private async pathExists(targetPath: string): Promise<boolean> {
        try {
            await fs.promises.access(targetPath, fs.constants.F_OK);
            return true;
        } catch {
            return false;
        }
    }
}

