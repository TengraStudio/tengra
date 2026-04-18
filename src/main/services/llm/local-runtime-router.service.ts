/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { HuggingFaceService } from '@main/services/llm/huggingface.service';
import type { LlamaService } from '@main/services/llm/llama.service';
import {
    LocalModelFileFormat,
    LocalModelRuntimeProvider,
    resolveLocalModelFileFormat,
    resolveRuntimeProviderForLocalModel,
} from '@main/services/llm/local-runtime.types';
import { ValidationError } from '@shared/utils/error.util';

export interface HuggingFaceLocalRouteTarget {
    modelId: string;
    path: string;
    fileFormat: LocalModelFileFormat;
    runtimeProvider: LocalModelRuntimeProvider;
}

export function normalizeHuggingFaceLocalModelId(model: string): string {
    const trimmed = model.trim();
    if (trimmed.toLowerCase().startsWith('huggingface/')) {
        return trimmed.slice('huggingface/'.length);
    }
    return trimmed;
}

export async function resolveHuggingFaceLocalRouteTarget(
    model: string,
    huggingFaceService: HuggingFaceService
): Promise<HuggingFaceLocalRouteTarget> {
    const modelId = normalizeHuggingFaceLocalModelId(model);
    const versions = await huggingFaceService.getModelVersions(modelId);
    const latest = versions[0];
    if (!latest?.path) {
        throw new ValidationError(`Installed Hugging Face model not found: ${modelId}`);
    }
    return {
        modelId,
        path: latest.path,
        fileFormat: latest.fileFormat ?? resolveLocalModelFileFormat(latest.path),
        runtimeProvider: latest.runtimeProvider ?? resolveRuntimeProviderForLocalModel(latest.path),
    };
}

export async function resolveLocalRuntimeBaseUrl(
    target: HuggingFaceLocalRouteTarget,
    llamaService?: LlamaService
): Promise<string> {
    if (target.runtimeProvider === 'llama.cpp') {
        return ensureLlamaRoute(target.path, llamaService);
    }
    return ensureHFNativeRoute(target);
}

async function ensureLlamaRoute(modelPath: string, llamaService?: LlamaService): Promise<string> {
    if (!llamaService) {
        throw new ValidationError('Llama service is unavailable for local Hugging Face models');
    }

    const loadedModel = llamaService.getLoadedModel();
    const isRunning = await llamaService.isServerRunning();
    if (loadedModel !== modelPath || !isRunning) {
        const result = await llamaService.loadModel(modelPath);
        if (!result.success) {
            throw new ValidationError(result.error ?? `Failed to load local Hugging Face model: ${modelPath}`);
        }
    }

    const config = llamaService.getConfig();
    const host = typeof config.host === 'string' && config.host.trim() !== '' ? config.host.trim() : '127.0.0.1';
    const port = typeof config.port === 'number' && Number.isFinite(config.port) ? config.port : 8080;
    return `http://${host}:${port}/v1`;
}

function ensureHFNativeRoute(target: HuggingFaceLocalRouteTarget): never {
    throw new ValidationError(
        `Native Hugging Face runtime is not configured for ${target.fileFormat} model ${target.modelId}. ` +
        'GGUF models use llama.cpp; non-GGUF models need a native runtime adapter exposed through the local /v1 contract.'
    );
}
