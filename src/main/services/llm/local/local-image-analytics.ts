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

import type {
    ComfyWorkflowTemplate,
    ImageComparisonResult,
    ImageGenerationOptions,
    ImageGenerationPreset,
    ImageGenerationRecord,
} from './local-image.types';
import type { RuntimeValue } from '@shared/types/common';



/** Analytics, comparison, and export utilities for image generation data. */
export class LocalImageAnalytics {
    private generationDurationsMs: number[] = [];
    constructor() {}

    /** Record a generation duration for averaging. */
    recordDuration(durationMs: number): void {
        if (!Number.isFinite(durationMs) || durationMs <= 0) { return; }
        this.generationDurationsMs.push(durationMs);
        if (this.generationDurationsMs.length > 100) {
            this.generationDurationsMs = this.generationDurationsMs.slice(-100);
        }
    }

    /** Get average generation duration. */
    getAverageDurationMs(): number {
        if (this.generationDurationsMs.length === 0) { return 0; }
        return Math.round(
            this.generationDurationsMs.reduce((sum, v) => sum + v, 0) / this.generationDurationsMs.length
        );
    }

    /** Get history search results. */
    searchHistory(history: ImageGenerationRecord[], query: string, limit: number = 100): ImageGenerationRecord[] {
        const trimmed = query.trim().toLowerCase();
        const bounded = Math.max(1, Math.min(limit, 1000));
        if (!trimmed) {
            return history.slice(-bounded).reverse();
        }
        return history
            .filter(entry =>
                entry.prompt.toLowerCase().includes(trimmed) ||
                (entry.negativePrompt ?? '').toLowerCase().includes(trimmed) ||
                entry.provider.toLowerCase().includes(trimmed) ||
                (entry.source ?? '').toLowerCase().includes(trimmed)
            )
            .slice(-bounded)
            .reverse();
    }

    /** Get analytics summary for generation history. */
    getImageAnalytics(history: ImageGenerationRecord[]): {
        totalGenerated: number;
        byProvider: Record<string, number>;
        averageSteps: number;
        bySource: Record<string, number>;
        averageDurationMs: number;
        editModeCounts: Record<string, number>;
    } {
        const byProvider: Record<string, number> = {};
        const bySource: Record<string, number> = {};
        const editModeCounts: Record<string, number> = {};
        let totalSteps = 0;

        history.forEach(entry => {
            byProvider[entry.provider] = (byProvider[entry.provider] ?? 0) + 1;
            bySource[entry.source ?? 'generate'] = (bySource[entry.source ?? 'generate'] ?? 0) + 1;
            const editMode = this.extractEditMode(entry.prompt);
            if (entry.source === 'edit' && editMode) {
                editModeCounts[editMode] = (editModeCounts[editMode] ?? 0) + 1;
            }
            totalSteps += entry.steps;
        });

        return {
            totalGenerated: history.length,
            byProvider,
            bySource,
            averageSteps: history.length > 0 ? Math.round(totalSteps / history.length) : 0,
            averageDurationMs: this.getAverageDurationMs(),
            editModeCounts
        };
    }

    /** Get preset analytics. */
    getPresetAnalytics(presets: ImageGenerationPreset[]): {
        totalPresets: number;
        providerCounts: Record<string, number>;
        customPresets: number;
    } {
        const providerCounts: Record<string, number> = {};
        presets.forEach(preset => {
            const provider = preset.provider ?? 'all';
            providerCounts[provider] = (providerCounts[provider] ?? 0) + 1;
        });
        return {
            totalPresets: presets.length,
            providerCounts,
            customPresets: presets.filter(p =>
                !p.id.startsWith('style-') && !p.id.startsWith('size-') && !p.id.startsWith('quality-')
            ).length
        };
    }

    /** Compare multiple generation records by file stats. */
    async compareGenerations(history: ImageGenerationRecord[], ids: string[]): Promise<ImageComparisonResult> {
        const uniqueIds = ids.map(id => id.trim()).filter(id => id.length > 0);
        if (uniqueIds.length < 2) {
            throw new Error('At least two history entries are required for comparison');
        }
        const records = uniqueIds
            .map(id => history.find(item => item.id === id))
            .filter((item): item is ImageGenerationRecord => Boolean(item));
        if (records.length < 2) {
            throw new Error('At least two history entries are required for comparison');
        }

        const entries = await Promise.all(records.map(async record => {
            const stats = await fs.promises.stat(record.imagePath);
            return {
                id: record.id,
                path: record.imagePath,
                width: record.width,
                height: record.height,
                steps: record.steps,
                cfgScale: record.cfgScale,
                seed: record.seed,
                prompt: record.prompt,
                fileSizeBytes: stats.size,
                bytesPerPixel: Number((stats.size / Math.max(1, record.width * record.height)).toFixed(4))
            };
        }));

        const sortedBySize = [...entries].sort((l, r) => l.fileSizeBytes - r.fileSizeBytes);
        const averageFileSizeBytes = Math.round(entries.reduce((s, e) => s + e.fileSizeBytes, 0) / entries.length);
        const averageBytesPerPixel = Number((entries.reduce((s, e) => s + e.bytesPerPixel, 0) / entries.length).toFixed(4));

        return {
            ids: records.map(r => r.id),
            comparedAt: Date.now(),
            entries,
            summary: {
                averageFileSizeBytes,
                averageBytesPerPixel,
                smallestFileId: sortedBySize[0]?.id,
                largestFileId: sortedBySize[sortedBySize.length - 1]?.id
            }
        };
    }

    /** Export a comparison as JSON or CSV. */
    async exportComparison(history: ImageGenerationRecord[], ids: string[], format: 'json' | 'csv' = 'json'): Promise<string> {
        const comparison = await this.compareGenerations(history, ids);
        if (format === 'json') { return JSON.stringify(comparison, null, 2); }
        const header = ['id', 'path', 'width', 'height', 'steps', 'cfgScale', 'seed', 'fileSizeBytes', 'bytesPerPixel', 'prompt'];
        const rows = comparison.entries.map(entry => {
            const cells = [entry.id, entry.path, String(entry.width), String(entry.height), String(entry.steps), String(entry.cfgScale), String(entry.seed), String(entry.fileSizeBytes), String(entry.bytesPerPixel), entry.prompt];
            return cells.map(c => `"${c.replace(/"/g, '""')}"`).join(',');
        });
        return [header.join(','), ...rows].join('\n');
    }

    /** Share a comparison as a base64 encoded string. */
    async shareComparison(history: ImageGenerationRecord[], ids: string[]): Promise<string> {
        const comparison = await this.compareGenerations(history, ids);
        return Buffer.from(JSON.stringify({ version: 1, generatedAt: Date.now(), comparison }), 'utf-8').toString('base64');
    }

    /** Export generation history as JSON or CSV. */
    exportHistory(history: ImageGenerationRecord[], format: 'json' | 'csv' = 'json'): string {
        if (format === 'json') { return JSON.stringify(history, null, 2); }
        const header = ['id', 'provider', 'prompt', 'negativePrompt', 'width', 'height', 'steps', 'cfgScale', 'seed', 'imagePath', 'source', 'createdAt'];
        const rows = history.map(entry => {
            const row = [entry.id, entry.provider, entry.prompt, entry.negativePrompt ?? '', String(entry.width), String(entry.height), String(entry.steps), String(entry.cfgScale), String(entry.seed), entry.imagePath, entry.source ?? '', String(entry.createdAt)];
            return row.map(v => `"${v.replace(/"/g, '""')}"`).join(',');
        });
        return [header.join(','), ...rows].join('\n');
    }

    /** Export a preset as a share code. */
    exportPresetShareCode(presets: ImageGenerationPreset[], id: string): string {
        const preset = presets.find(item => item.id === id);
        if (!preset) { throw new Error('Preset not found'); }
        return Buffer.from(JSON.stringify({ version: 1, exportedAt: Date.now(), preset }), 'utf-8').toString('base64');
    }

    /** Export a workflow template as a share code. */
    exportWorkflowTemplateShareCode(templates: ComfyWorkflowTemplate[], id: string): string {
        const template = templates.find(item => item.id === id);
        if (!template) { throw new Error('Workflow template not found'); }
        return Buffer.from(JSON.stringify({ version: 1, exportedAt: Date.now(), template }), 'utf-8').toString('base64');
    }

    /** Get default generation presets. */
    getDefaultPresets(): ImageGenerationPreset[] {
        const now = Date.now();
        return [
            { id: 'style-cinematic', name: 'Style: Cinematic', promptPrefix: 'cinematic lighting, rich colors, dramatic composition', width: 1024, height: 1024, steps: 28, cfgScale: 7.5, createdAt: now, updatedAt: now },
            { id: 'size-wide-hd', name: 'Size: Wide HD', width: 1536, height: 896, steps: 24, cfgScale: 7, createdAt: now, updatedAt: now },
            { id: 'quality-draft-fast', name: 'Quality: Draft Fast', width: 896, height: 896, steps: 14, cfgScale: 6, createdAt: now, updatedAt: now }
        ];
    }

    /** Apply a preset to generation options. */
    applyPresetToOptions(
        options: ImageGenerationOptions,
        presets: ImageGenerationPreset[],
        presetId?: string
    ): ImageGenerationOptions {
        if (!presetId) { return options; }
        const preset = presets.find(item => item.id === presetId);
        if (!preset) { return options; }
        return {
            ...options,
            prompt: preset.promptPrefix ? `${preset.promptPrefix} ${options.prompt}` : options.prompt,
            width: options.width ?? preset.width,
            height: options.height ?? preset.height,
            steps: options.steps ?? preset.steps,
            cfgScale: options.cfgScale ?? preset.cfgScale
        };
    }

    private extractEditMode(prompt: string): string | null {
        const lower = prompt.toLowerCase();
        if (lower.startsWith('style transfer:')) { return 'style-transfer'; }
        if (lower.startsWith('inpaint:')) { return 'inpaint'; }
        if (lower.startsWith('outpaint:')) { return 'outpaint'; }
        if (lower.startsWith('image to image:')) { return 'img2img'; }
        return null;
    }
}

