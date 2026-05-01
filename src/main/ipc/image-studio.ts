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

import { IpcMainInvokeEvent, ipcMain } from 'electron';
import { nativeImage } from 'electron';

import { appLogger } from '@main/logging/logger';
import { ImagePersistenceService } from '@main/services/data/image-persistence.service';
import type { LocalImageService } from '@main/services/llm/local-image.service';
import type { ImageProvider } from '@main/services/llm/local-image.types';
import type { LLMService } from '@main/services/llm/llm.service';
import type { ModelProviderInfo, ModelRegistryService } from '@main/services/llm/model-registry.service';
import { createIpcHandler } from '@main/utils/ipc-wrapper.util';
import type { MessageContentPart } from '@shared/types/chat';
import { getErrorMessage } from '@shared/utils/error.util';

type ImageStudioGenerateRequest = {
    prompt: string;
    modelId: string;
    count?: number;
    width?: number;
    height?: number;
};

type ImageStudioEditRequest = {
    contextImage?: string;
    sourceImage: string;
    maskImage: string;
    prompt: string;
    mode: 'img2img' | 'inpaint' | 'outpaint' | 'style-transfer';
    strength?: number;
    modelId: string;
};

type ImageStudioSaveRequest = {
    image: string;
    prompt?: string;
    modelId?: string;
    width?: number;
    height?: number;
};

type ImageStudioGenerateResponse = string[];
const REMOTE_EDIT_REQUEST_SOFT_LIMIT_BYTES = 1_250_000;

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
    const n = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback;
    return Math.max(min, Math.min(max, n));
}

type ImageModelCandidate = {
    id?: string;
    name?: string;
    provider?: string;
    description?: string;
    quotaInfo?: {
        remainingQuota?: number;
        totalQuota?: number;
        remainingFraction?: number;
    };
    capabilities?: {
        image_generation?: boolean;
    };
};

type ImageModelRecord = ModelProviderInfo & ImageModelCandidate;

function normalizeModelId(modelId: string, provider: string): string {
    const slashIndex = modelId.indexOf('/');
    if (slashIndex > 0) {
        const prefix = modelId.slice(0, slashIndex).toLowerCase();
        const suffix = modelId.slice(slashIndex + 1);
        if (provider && prefix === provider && suffix.trim().length > 0) {
            return suffix.trim();
        }
    }
    return modelId;
}

function isCodexImageModel(modelId: string, provider: string): boolean {
    if (provider !== 'codex') {
        return false;
    }
    const normalized = modelId.trim().toLowerCase();
    return normalized === '$imagegen'
        || normalized === 'imagegen'
        || normalized === 'codex/$imagegen'
        || normalized === 'codex/imagegen';
}

function hasAvailableQuota(model: ImageModelCandidate | undefined): boolean {
    const quotaInfo = model?.quotaInfo;
    if (!quotaInfo) {
        return true;
    }
    if (typeof quotaInfo.remainingFraction === 'number') {
        return quotaInfo.remainingFraction > 0;
    }
    if (typeof quotaInfo.remainingQuota === 'number') {
        return quotaInfo.remainingQuota > 0;
    }
    if (
        typeof quotaInfo.remainingQuota === 'number'
        && typeof quotaInfo.totalQuota === 'number'
        && quotaInfo.totalQuota > 0
    ) {
        return quotaInfo.remainingQuota / quotaInfo.totalQuota > 0;
    }
    return true;
}

function isQuotaErrorMessage(message: string): boolean {
    const normalized = message.toLowerCase();
    return normalized.includes('quota')
        || normalized.includes('rate limit')
        || normalized.includes('resource has been exhausted')
        || normalized.includes('429')
        || normalized.includes('credits')
        || normalized.includes('usage limit');
}

function isFallbackEligibleEditError(message: string): boolean {
    const normalized = message.toLowerCase();
    return isQuotaErrorMessage(message)
        || normalized.includes('unsupported')
        || normalized.includes('not available')
        || normalized.includes('requires a newer version of codex')
        || normalized.includes('returned no images');
}

function isPayloadTooLargeError(message: string): boolean {
    const normalized = message.toLowerCase();
    return normalized.includes('413')
        || normalized.includes('payload too large')
        || normalized.includes('length limit exceeded')
        || normalized.includes('failed to buffer the request body');
}

function buildEditContent(
    editInstruction: string,
    sourceImageData: string,
    maskImageData: string,
    contextImageData: string
): MessageContentPart[] {
    const editContent: MessageContentPart[] = [
        { type: 'text', text: editInstruction },
    ];
    if (contextImageData) {
        editContent.push({ type: 'image_url', image_url: { url: contextImageData } });
    }
    editContent.push({ type: 'image_url', image_url: { url: sourceImageData } });
    if (maskImageData) {
        editContent.push({ type: 'image_url', image_url: { url: maskImageData } });
    }
    return editContent;
}

function estimateEditContentBytes(content: MessageContentPart[]): number {
    return JSON.stringify(content).length;
}

function resolveLocalImagePath(pathOrUri: string): string {
    const normalized = pathOrUri.trim();
    if (normalized.startsWith('safe-file://') || normalized.startsWith('file://')) {
        let localPath = normalized
            .replace(/^safe-file:\/+/i, '')
            .replace(/^file:\/+/i, '');
        localPath = decodeURIComponent(localPath);
        if (/^\/[A-Za-z]:\//.test(localPath)) {
            localPath = localPath.slice(1);
        }
        return process.platform === 'win32' ? localPath.replace(/\//g, '\\') : `/${localPath}`;
    }
    return normalized;
}

async function toDataImageUri(input: string): Promise<string> {
    if (input.startsWith('data:')) {
        return input;
    }
    if (input.startsWith('http://') || input.startsWith('https://')) {
        const response = await fetch(input);
        const arrayBuffer = await response.arrayBuffer();
        return `data:image/png;base64,${Buffer.from(arrayBuffer).toString('base64')}`;
    }

    const resolvedPath = resolveLocalImagePath(input);
    const buffer = await fs.promises.readFile(resolvedPath);
    const extension = path.extname(resolvedPath).toLowerCase().replace('.', '') || 'png';
    const mimeType = extension === 'jpg' || extension === 'jpeg'
        ? 'image/jpeg'
        : extension === 'webp'
            ? 'image/webp'
            : extension === 'svg'
                ? 'image/svg+xml'
                : 'image/png';
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

function getImageSizeFromInput(input: string): { width: number; height: number } | null {
    try {
        const image = input.startsWith('data:')
            ? nativeImage.createFromDataURL(input)
            : nativeImage.createFromPath(resolveLocalImagePath(input));
        const size = image.getSize();
        if (size.width > 0 && size.height > 0) {
            return size;
        }
    } catch {
        // Ignore and fall back to defaults below.
    }
    return null;
}

function buildEditInstruction(
    prompt: string,
    mode: ImageStudioEditRequest['mode'],
    hasMask: boolean,
    hasContext: boolean
): string {
    const modeInstruction = mode === 'style-transfer'
        ? 'Apply the requested style change while preserving the subject and composition.'
        : mode === 'outpaint'
            ? 'Extend the image only where needed and preserve the original image elsewhere.'
            : mode === 'inpaint'
                ? 'Edit only the selected region.'
                : 'Modify the source image while preserving identity and composition.';

    const maskInstruction = hasMask
        ? hasContext
            ? 'The first image is a low-resolution full-scene reference. The second image is the actual high-detail patch to edit. The third image is a black-and-white mask for that patch. Edit only the white areas of the patch and preserve the black areas exactly.'
            : 'The second image is a black-and-white mask. Edit only the white areas and preserve the black areas exactly.'
        : 'Preserve all key identity details from the source image unless the prompt explicitly requests a change.';

    return [
        'You are editing an existing image, not generating a completely new scene.',
        hasContext ? 'Use the full-scene reference only to understand identity, pose, lighting, camera, background, and style. Do not return the reference image.' : '',
        modeInstruction,
        maskInstruction,
        hasContext ? 'Return the edited patch image, matching the second image dimensions and perspective, not the full scene.' : '',
        'Keep the same person, face, pose, lighting, background, framing, and overall composition unless explicitly asked otherwise.',
        'Do not create a collage, split-screen image, before-and-after comparison, duplicate subject, fashion catalog photo, or any unrelated person/object.',
        'If the request changes clothing, color, texture, or an object, alter the existing selected pixels in place instead of replacing the selected area with a new scene.',
        `Requested edit: ${prompt}`,
        'Return only the edited image.',
    ].filter(Boolean).join('\n');
}

function isLocalImageModel(provider: string, modelId: string): boolean {
    return provider === 'sd-cpp' || modelId.toLowerCase().includes('local');
}

function isLocalEditModel(provider: string, modelId: string): boolean {
    const normalizedProvider = provider.toLowerCase();
    const normalizedModelId = modelId.toLowerCase();
    return normalizedProvider === 'sd-webui'
        || normalizedProvider === 'comfyui'
        || normalizedProvider === 'sd-cpp'
        || normalizedModelId.includes('local');
}

function isExplicitLocalImageProvider(provider: string): provider is ImageProvider {
    return provider === 'sd-cpp' || provider === 'sd-webui' || provider === 'comfyui';
}

function isSupportedRemoteImageModel(model: ImageModelCandidate | undefined, modelId: string): boolean {
    if (!model) {
        return false;
    }
    if (model.capabilities?.image_generation === true) {
        return true;
    }

    const provider = (model.provider ?? '').toLowerCase();
    const id = (model.id ?? modelId).toLowerCase();
    const name = (model.name ?? '').toLowerCase();
    const description = (model.description ?? '').toLowerCase();
    const searchable = `${id} ${name} ${description}`;

    if (provider === 'openai' || provider === 'codex') {
        return /\bgpt[-_]?image\b/.test(searchable)
            || /dall[-_ ]?e/.test(searchable)
            || /\$?imagegen\b/.test(searchable)
            || /\bimage_gen\b/.test(searchable);
    }
    if (provider === 'antigravity' || provider === 'google' || provider === 'gemini' || provider === 'nvidia') {
        return searchable.includes('image');
    }
    return false;
}

function isEditCapableRemoteImageModel(model: ImageModelCandidate | undefined, modelId: string): boolean {
    if (!isSupportedRemoteImageModel(model, modelId)) {
        return false;
    }

    const provider = (model?.provider ?? '').toLowerCase();
    const id = (model?.id ?? modelId).toLowerCase();
    const name = (model?.name ?? '').toLowerCase();
    const description = (model?.description ?? '').toLowerCase();
    const searchable = `${id} ${name} ${description}`;

    if (provider === 'codex') {
        return isCodexImageModel(model?.id ?? modelId, provider);
    }

    if (provider === 'openai') {
        // Current proxy route maps gpt-image/DALL-E to /images/generations, which drops
        // source/mask images. Exclude it from edit until a true images/edits route exists.
        return false;
    }

    return searchable.includes('edit')
        || searchable.includes('inpaint')
        || searchable.includes('image')
        || provider === 'antigravity'
        || provider === 'google'
        || provider === 'gemini'
        || provider === 'nvidia';
}

export function registerImageStudioIpc(deps: {
    llmService: LLMService;
    localImageService: LocalImageService;
    modelRegistryService: ModelRegistryService;
    imagePersistenceService: ImagePersistenceService;
}): void {
    ipcMain.handle('image-studio:save', createIpcHandler(
        'image-studio:save',
        async (_event: IpcMainInvokeEvent, raw: RuntimeValue): Promise<string> => {
            if (typeof raw !== 'object' || raw === null) {
                throw new Error('Invalid request payload');
            }

            const payload = raw as Partial<ImageStudioSaveRequest>;
            const image = typeof payload.image === 'string' ? payload.image.trim() : '';
            if (!image) {
                throw new Error('Missing image');
            }

            return deps.imagePersistenceService.saveImage(image, {
                prompt: typeof payload.prompt === 'string' ? payload.prompt : undefined,
                width: clampInt(payload.width, 1024, 1, 16384),
                height: clampInt(payload.height, 1024, 1, 16384),
                model: typeof payload.modelId === 'string' ? payload.modelId : undefined,
            });
        }
    ));

    ipcMain.handle('image-studio:generate', createIpcHandler(
        'image-studio:generate',
        async (_event: IpcMainInvokeEvent, raw: RuntimeValue): Promise<ImageStudioGenerateResponse> => {
            if (typeof raw !== 'object' || raw === null) {
                throw new Error('Invalid request payload');
            }

            const payload = raw as Partial<ImageStudioGenerateRequest>;
            const prompt = typeof payload.prompt === 'string' ? payload.prompt.trim() : '';
            const modelId = typeof payload.modelId === 'string' ? payload.modelId.trim() : '';
            if (!prompt) {
                throw new Error('Missing prompt');
            }
            if (!modelId) {
                throw new Error('Missing modelId');
            }

            const count = clampInt(payload.count, 1, 1, 8);
            const width = clampInt(payload.width, 1024, 256, 4096);
            const height = clampInt(payload.height, 1024, 256, 4096);

            const allModels = await deps.modelRegistryService.getAllModels();
            const model = allModels.find((m: { id?: string; provider?: string }) => m.id === modelId);
            const provider = (model?.provider ?? '').toLowerCase();
            const isLocal = isLocalImageModel(provider, modelId);
            if (!isLocal && !isSupportedRemoteImageModel(model, modelId)) {
                throw new Error('Selected model is not available for image generation. Choose an image-capable model such as gpt-image-1, DALL-E, or a local image model.');
            }
            const effectiveModelId = normalizeModelId(modelId, provider);

            const results: string[] = [];

            const persist = async (image: string): Promise<string> => {
                return deps.imagePersistenceService.saveImage(image, {
                    prompt,
                    width,
                    height,
                    model: modelId,
                });
            };

            // Local backend path
            if (isLocal) {
                for (let i = 0; i < count; i += 1) {
                    const imagePath = await deps.localImageService.generateImage({ prompt, width, height });
                    results.push(await persist(imagePath));
                }
                return results;
            }

            // Remote / provider-backed path (OpenAI API, Codex $imagegen, Antigravity/Google/NVIDIA/etc.)
            try {
                while (results.length < count) {
                    const remaining = count - results.length;
                    const isCodexImageStream = provider === 'codex' && effectiveModelId.toLowerCase() === '$imagegen';
                    const images: string[] = [];

                    if (isCodexImageStream) {
                        for await (const chunk of deps.llmService.chatStream(
                            [{ role: 'user', content: prompt }],
                            effectiveModelId,
                            [],
                            provider || undefined,
                            {
                                metadata: {
                                    source: 'image_studio',
                                    width,
                                    height,
                                },
                            }
                        )) {
                            if (Array.isArray(chunk.images) && chunk.images.length > 0) {
                                images.push(...chunk.images);
                            }
                        }
                    } else {
                        const response = await deps.llmService.chat(
                            [{ role: 'user', content: prompt }],
                            effectiveModelId,
                            [],
                            provider || undefined,
                            {
                                n: remaining,
                                metadata: {
                                    source: 'image_studio',
                                    width,
                                    height,
                                },
                            }
                        );
                        images.push(...(Array.isArray(response.images) ? response.images : []));
                    }

                    if (images.length === 0) {
                        throw new Error('Image generation returned no images.');
                    }

                    for (const img of images.slice(0, remaining)) {
                        results.push(await persist(img));
                    }
                }
                return results;
            } catch (error) {
                throw new Error(getErrorMessage(error as Error));
            }
        }
    ));

    ipcMain.handle('image-studio:edit', createIpcHandler(
        'image-studio:edit',
        async (_event: IpcMainInvokeEvent, raw: RuntimeValue): Promise<ImageStudioGenerateResponse> => {
            if (typeof raw !== 'object' || raw === null) {
                throw new Error('Invalid request payload');
            }

            const payload = raw as Partial<ImageStudioEditRequest>;
            const prompt = typeof payload.prompt === 'string' ? payload.prompt.trim() : '';
            const modelId = typeof payload.modelId === 'string' ? payload.modelId.trim() : '';
            const contextImage = typeof payload.contextImage === 'string' ? payload.contextImage.trim() : '';
            const sourceImage = typeof payload.sourceImage === 'string' ? payload.sourceImage.trim() : '';
            const maskImage = typeof payload.maskImage === 'string' ? payload.maskImage.trim() : '';
            const mode = payload.mode ?? 'inpaint';
            const strength = typeof payload.strength === 'number' ? payload.strength : 0.75;
            if (!prompt) {
                throw new Error('Missing prompt');
            }
            if (!modelId) {
                throw new Error('Missing modelId');
            }
            if (!sourceImage) {
                throw new Error('Missing sourceImage');
            }

            const allModels = await deps.modelRegistryService.getAllModels() as ImageModelRecord[];
            const model = allModels.find((m: { id?: string; provider?: string }) => m.id === modelId);
            const provider = (model?.provider ?? '').toLowerCase();
            const contextImageData = contextImage ? await toDataImageUri(contextImage) : '';
            const sourceImageData = await toDataImageUri(sourceImage);
            const maskImageData = maskImage ? await toDataImageUri(maskImage) : '';
            const sourceSize = getImageSizeFromInput(sourceImageData) ?? getImageSizeFromInput(sourceImage) ?? { width: 1024, height: 1024 };
            appLogger.info('ImageStudio', `Editing image with source model ${modelId} (${provider || 'unknown provider'})`);

            // Local backend path. Keep this explicit; the local image service uses the
            // global image provider setting, so remote edits must not fall through here.
            if (isLocalEditModel(provider, modelId)) {
                const result = await deps.localImageService.editImage({
                    sourceImage,
                    maskImage,
                    prompt,
                    mode,
                    strength,
                    width: sourceSize.width,
                    height: sourceSize.height,
                });
                return [result];
            }

            const candidateModels: ImageModelRecord[] = [];
            const seenCandidates = new Set<string>();
            const pushCandidate = (candidate: ImageModelRecord | undefined) => {
                if (!candidate?.id) {
                    return;
                }
                const key = `${candidate.provider}:${candidate.id}`;
                if (seenCandidates.has(key)) {
                    return;
                }
                seenCandidates.add(key);
                candidateModels.push(candidate);
            };

            pushCandidate(model);
            for (const candidate of allModels) {
                const candidateProvider = (candidate.provider ?? '').toLowerCase();
                const candidateModelId = candidate.id ?? '';
                if (
                    isEditCapableRemoteImageModel(candidate, candidateModelId)
                    && hasAvailableQuota(candidate)
                ) {
                    pushCandidate(candidate);
                }
            }
            for (const candidate of allModels) {
                const candidateProvider = (candidate.provider ?? '').toLowerCase();
                const candidateModelId = candidate.id ?? '';
                if (
                    isLocalEditModel(candidateProvider, candidateModelId)
                    && hasAvailableQuota(candidate)
                ) {
                    pushCandidate(candidate);
                }
            }

            const fallbackErrors: string[] = [];
            const editInstruction = buildEditInstruction(prompt, mode, Boolean(maskImageData), Boolean(contextImageData));
            const compactEditInstruction = buildEditInstruction(prompt, mode, Boolean(maskImageData), false);
            const editContent = buildEditContent(editInstruction, sourceImageData, maskImageData, contextImageData);
            const compactEditContent = buildEditContent(compactEditInstruction, sourceImageData, maskImageData, '');
            const preferredEditContent = estimateEditContentBytes(editContent) <= REMOTE_EDIT_REQUEST_SOFT_LIMIT_BYTES
                ? editContent
                : compactEditContent;
            if (preferredEditContent === compactEditContent && contextImageData) {
                appLogger.warn(
                    'ImageStudio',
                    `Dropping edit context image before request; estimated payload ${estimateEditContentBytes(editContent)} bytes exceeds ${REMOTE_EDIT_REQUEST_SOFT_LIMIT_BYTES}`
                );
            }

            for (const candidate of candidateModels) {
                const candidateProvider = (candidate.provider ?? '').toLowerCase();
                const candidateModelId = candidate.id ?? '';
                const effectiveCandidateModelId = normalizeModelId(candidateModelId, candidateProvider);
                if (isLocalEditModel(candidateProvider, candidateModelId)) {
                    if (!isExplicitLocalImageProvider(candidateProvider)) {
                        fallbackErrors.push(`[${candidateModelId}] local provider ${candidateProvider || 'unknown'} is not supported for image edits`);
                        continue;
                    }
                    try {
                        appLogger.info('ImageStudio', `Trying local image edit with provider ${candidateProvider}`);
                        const result = await deps.localImageService.editImageWithProvider(candidateProvider, {
                            sourceImage,
                            maskImage,
                            prompt,
                            mode,
                            strength,
                            width: sourceSize.width,
                            height: sourceSize.height,
                        });
                        return [result];
                    } catch (error) {
                        const message = getErrorMessage(error as Error);
                        fallbackErrors.push(`[${candidateModelId}] ${message}`);
                        appLogger.warn('ImageStudio', `Local image edit provider ${candidateProvider} failed: ${message}`);
                        continue;
                    }
                }
                if (!isEditCapableRemoteImageModel(candidate, candidateModelId)) {
                    fallbackErrors.push(`[${candidateModelId}] not edit-capable`);
                    continue;
                }
                if (!hasAvailableQuota(candidate)) {
                    fallbackErrors.push(`[${candidateModelId}] quota unavailable`);
                    appLogger.warn('ImageStudio', `Skipping image edit model ${candidateModelId}: quota unavailable`);
                    continue;
                }

                try {
                    appLogger.info('ImageStudio', `Trying image edit with model ${candidateModelId}`);
                    const metadata = {
                        source: 'image_studio_edit',
                        width: sourceSize.width,
                        height: sourceSize.height,
                    };
                    const runEdit = async (content: MessageContentPart[]): Promise<string[]> => {
                        const images: string[] = [];
                        if (isCodexImageModel(effectiveCandidateModelId, candidateProvider)) {
                            for await (const chunk of deps.llmService.chatStream(
                                [{ role: 'user', content }],
                                effectiveCandidateModelId,
                                [],
                                candidateProvider,
                                {
                                    metadata,
                                    persistImages: false,
                                }
                            )) {
                                if (Array.isArray(chunk.images) && chunk.images.length > 0) {
                                    images.push(...chunk.images);
                                }
                            }
                        } else {
                            const response = await deps.llmService.chat(
                                [{ role: 'user', content }],
                                effectiveCandidateModelId,
                                [],
                                candidateProvider || undefined,
                                {
                                    n: 1,
                                    metadata,
                                }
                            );
                            if (Array.isArray(response.images) && response.images.length > 0) {
                                images.push(...response.images);
                            }
                        }
                        return images;
                    };

                    let images: string[];
                    try {
                        images = await runEdit(preferredEditContent);
                    } catch (error) {
                        const message = getErrorMessage(error as Error);
                        if (preferredEditContent === compactEditContent || !contextImageData || !isPayloadTooLargeError(message)) {
                            throw error;
                        }
                        appLogger.warn('ImageStudio', `Image edit payload too large for ${candidateModelId}; retrying without context image`);
                        images = await runEdit(compactEditContent);
                    }

                    if (images.length > 0) {
                        return [images[0]];
                    }

                    fallbackErrors.push(`[${candidateModelId}] Image generation returned no images.`);
                } catch (error) {
                    const message = getErrorMessage(error as Error);
                    fallbackErrors.push(`[${candidateModelId}] ${message}`);
                    appLogger.warn('ImageStudio', `Image edit model ${candidateModelId} failed: ${message}`);
                    if (!isFallbackEligibleEditError(message)) {
                        break;
                    }
                }
            }

            const details = fallbackErrors.length > 0 ? ` ${fallbackErrors.join(' | ')}` : '';
            throw new Error(`Image edit failed for source model ${modelId}.${details}`);
        }
    ));
}
