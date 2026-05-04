/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
    IconAdjustmentsHorizontal,
    IconCheck,
    IconChevronLeft,
    IconChevronRight,
    IconCrop,
    IconFocus2,
    IconPhoto,
    IconRefresh,
    IconSparkles,
    IconX,
} from '@tabler/icons-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { ModelDefinition } from '@/electron';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { pushNotification } from '@/store/notification-center.store';
import { appLogger } from '@/utils/renderer-logger';
import { toSafeFileUrl } from '@/utils/safe-file-url.util';

type ImageStudioResult = {
    id: string;
    url: string;
    modelId: string;
    prompt: string;
    createdAt: number;
};

type ImageStudioEditMode = 'img2img' | 'inpaint' | 'outpaint' | 'style-transfer';

type MaskRect = {
    x: number;
    y: number;
    width: number;
    height: number;
};

const REMOTE_EDIT_CONTEXT_MAX_BYTES = 80_000;
const REMOTE_EDIT_PATCH_MAX_BYTES = 520_000;
const REMOTE_EDIT_PATCH_MAX_EDGE = 512;
const REMOTE_EDIT_CONTEXT_MAX_EDGE = 320;

function normalizeRect(rect: MaskRect): MaskRect {
    return {
        x: rect.width < 0 ? rect.x + rect.width : rect.x,
        y: rect.height < 0 ? rect.y + rect.height : rect.y,
        width: Math.abs(rect.width),
        height: Math.abs(rect.height),
    };
}

function getDisplayModelName(modelId: string, models: ModelDefinition[]): string {
    const match = models.find(model => model.id === modelId);
    if (match?.name && match.name.trim().length > 0) {
        return match.name.trim();
    }
    if (modelId === '$imagegen' || modelId === 'codex/$imagegen') {
        return 'Codex Image Generation';
    }
    return modelId;
}

type CompositedImage = {
    dataUrl: string;
    width: number;
    height: number;
};

type EditPatchPlacement = {
    x: number;
    y: number;
    width: number;
    height: number;
    requestWidth: number;
    requestHeight: number;
};

type InpaintPatchContext = {
    requestSourceUrl: string;
    requestMaskUrl: string;
    contextImageUrl: string;
    baseSourceUrl: string;
    placement: EditPatchPlacement;
};

function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(new Error('Failed to read image blob.'));
        reader.readAsDataURL(blob);
    });
}

async function imageSourceToDataUrl(input: string): Promise<string> {
    if (input.startsWith('data:')) {
        return input;
    }

    const response = await fetch(toSafeFileUrl(input) ?? input);
    if (!response.ok) {
        throw new Error(`Failed to load image: HTTP ${response.status}`);
    }
    return blobToDataUrl(await response.blob());
}

function loadRasterImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Failed to decode image.'));
        image.src = src;
    });
}

function copyCanvasScaled(source: HTMLCanvasElement, width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Canvas context failed.');
    }
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas;
}

function encodeJpegWithinBudget(
    source: HTMLCanvasElement,
    maxBytes: number,
    initialQuality: number,
    minLongEdge: number
): string {
    let working = source;
    const qualities = [initialQuality, 0.68, 0.58, 0.48, 0.38];
    for (let pass = 0; pass < 8; pass += 1) {
        for (const quality of qualities) {
            const dataUrl = working.toDataURL('image/jpeg', quality);
            if (dataUrl.length <= maxBytes || Math.max(working.width, working.height) <= minLongEdge) {
                return dataUrl;
            }
        }

        const longEdge = Math.max(working.width, working.height);
        const nextLongEdge = Math.max(minLongEdge, Math.floor(longEdge * 0.82));
        const scale = nextLongEdge / longEdge;
        working = copyCanvasScaled(working, working.width * scale, working.height * scale);
    }

    return working.toDataURL('image/jpeg', 0.34);
}

function drawFeatheredMaskRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    feather: number
): void {
    ctx.fillStyle = 'white';
    if (feather > 0) {
        ctx.save();
        ctx.filter = `blur(${feather}px)`;
        ctx.fillRect(x, y, width, height);
        ctx.restore();
    }

    const innerX = x + feather;
    const innerY = y + feather;
    const innerW = width - (feather * 2);
    const innerH = height - (feather * 2);
    if (innerW > 0 && innerH > 0) {
        ctx.fillRect(innerX, innerY, innerW, innerH);
    } else {
        ctx.fillRect(x, y, width, height);
    }
}

async function compositeMaskedImage(sourceUrl: string, editedUrl: string, maskUrl: string): Promise<CompositedImage> {
    const [sourceDataUrl, editedDataUrl, maskDataUrl] = await Promise.all([
        imageSourceToDataUrl(sourceUrl),
        imageSourceToDataUrl(editedUrl),
        imageSourceToDataUrl(maskUrl),
    ]);
    const [sourceImage, editedImage, maskImage] = await Promise.all([
        loadRasterImage(sourceDataUrl),
        loadRasterImage(editedDataUrl),
        loadRasterImage(maskDataUrl),
    ]);

    const width = sourceImage.naturalWidth || sourceImage.width;
    const height = sourceImage.naturalHeight || sourceImage.height;
    const outputCanvas = document.createElement('canvas');
    const editedCanvas = document.createElement('canvas');
    const maskCanvas = document.createElement('canvas');
    outputCanvas.width = width;
    outputCanvas.height = height;
    editedCanvas.width = width;
    editedCanvas.height = height;
    maskCanvas.width = width;
    maskCanvas.height = height;

    const outputCtx = outputCanvas.getContext('2d');
    const editedCtx = editedCanvas.getContext('2d');
    const maskCtx = maskCanvas.getContext('2d');
    if (!outputCtx || !editedCtx || !maskCtx) {
        throw new Error('Canvas context failed.');
    }

    outputCtx.drawImage(sourceImage, 0, 0, width, height);
    editedCtx.drawImage(editedImage, 0, 0, width, height);
    maskCtx.drawImage(maskImage, 0, 0, width, height);

    const outputPixels = outputCtx.getImageData(0, 0, width, height);
    const editedPixels = editedCtx.getImageData(0, 0, width, height);
    const maskPixels = maskCtx.getImageData(0, 0, width, height);
    const outputData = outputPixels.data;
    const editedData = editedPixels.data;
    const maskData = maskPixels.data;

    for (let i = 0; i < outputData.length; i += 4) {
        const maskBrightness = (maskData[i] + maskData[i + 1] + maskData[i + 2]) / (255 * 3);
        const rawMaskAlpha = (maskData[i + 3] / 255) * maskBrightness;
        const maskAlpha = rawMaskAlpha * rawMaskAlpha * (3 - (2 * rawMaskAlpha));
        if (maskAlpha <= 0.001) {
            continue;
        }
        const keepAlpha = 1 - maskAlpha;
        outputData[i] = Math.round((editedData[i] * maskAlpha) + (outputData[i] * keepAlpha));
        outputData[i + 1] = Math.round((editedData[i + 1] * maskAlpha) + (outputData[i + 1] * keepAlpha));
        outputData[i + 2] = Math.round((editedData[i + 2] * maskAlpha) + (outputData[i + 2] * keepAlpha));
        outputData[i + 3] = Math.round((editedData[i + 3] * maskAlpha) + (outputData[i + 3] * keepAlpha));
    }

    outputCtx.putImageData(outputPixels, 0, 0);
    return {
        dataUrl: outputCanvas.toDataURL('image/png'),
        width,
        height,
    };
}

async function createInpaintPatchContext(
    sourceUrl: string,
    naturalWidth: number,
    naturalHeight: number,
    selection: MaskRect
): Promise<InpaintPatchContext> {
    const sourceDataUrl = await imageSourceToDataUrl(sourceUrl);
    const sourceImage = await loadRasterImage(sourceDataUrl);
    const selected = normalizeRect(selection);
    const selX = Math.max(0, Math.floor(selected.x));
    const selY = Math.max(0, Math.floor(selected.y));
    const selW = Math.max(1, Math.ceil(Math.min(selected.width, naturalWidth - selX)));
    const selH = Math.max(1, Math.ceil(Math.min(selected.height, naturalHeight - selY)));
    const padding = Math.max(32, Math.ceil(Math.max(selW, selH) * 0.25));
    const cropX = Math.max(0, selX - padding);
    const cropY = Math.max(0, selY - padding);
    const cropRight = Math.min(naturalWidth, selX + selW + padding);
    const cropBottom = Math.min(naturalHeight, selY + selH + padding);
    const cropW = Math.max(1, cropRight - cropX);
    const cropH = Math.max(1, cropBottom - cropY);
    const maxPatchEdge = REMOTE_EDIT_PATCH_MAX_EDGE;
    const scale = Math.min(1, maxPatchEdge / Math.max(cropW, cropH));
    const requestWidth = Math.max(1, Math.round(cropW * scale));
    const requestHeight = Math.max(1, Math.round(cropH * scale));

    const sourceCanvas = document.createElement('canvas');
    const maskCanvas = document.createElement('canvas');
    sourceCanvas.width = requestWidth;
    sourceCanvas.height = requestHeight;
    maskCanvas.width = requestWidth;
    maskCanvas.height = requestHeight;

    const sourceCtx = sourceCanvas.getContext('2d');
    const maskCtx = maskCanvas.getContext('2d');
    if (!sourceCtx || !maskCtx) {
        throw new Error('Canvas context failed.');
    }

    const contextMaxEdge = REMOTE_EDIT_CONTEXT_MAX_EDGE;
    const contextScale = Math.min(1, contextMaxEdge / Math.max(naturalWidth, naturalHeight));
    const contextCanvas = document.createElement('canvas');
    contextCanvas.width = Math.max(1, Math.round(naturalWidth * contextScale));
    contextCanvas.height = Math.max(1, Math.round(naturalHeight * contextScale));
    const contextCtx = contextCanvas.getContext('2d');
    if (!contextCtx) {
        throw new Error('Canvas context failed.');
    }
    contextCtx.drawImage(sourceImage, 0, 0, contextCanvas.width, contextCanvas.height);

    sourceCtx.drawImage(sourceImage, cropX, cropY, cropW, cropH, 0, 0, requestWidth, requestHeight);
    maskCtx.fillStyle = 'black';
    maskCtx.fillRect(0, 0, requestWidth, requestHeight);
    const maskX = Math.round((selX - cropX) * scale);
    const maskY = Math.round((selY - cropY) * scale);
    const maskW = Math.round(selW * scale);
    const maskH = Math.round(selH * scale);
    drawFeatheredMaskRect(
        maskCtx,
        maskX,
        maskY,
        maskW,
        maskH,
        Math.max(4, Math.round(Math.min(maskW, maskH, 64) * 0.18))
    );

    return {
        requestSourceUrl: encodeJpegWithinBudget(
            sourceCanvas,
            REMOTE_EDIT_PATCH_MAX_BYTES,
            0.72,
            224
        ),
        requestMaskUrl: maskCanvas.toDataURL('image/png'),
        contextImageUrl: encodeJpegWithinBudget(
            contextCanvas,
            REMOTE_EDIT_CONTEXT_MAX_BYTES,
            0.58,
            160
        ),
        baseSourceUrl: sourceDataUrl,
        placement: {
            x: cropX,
            y: cropY,
            width: cropW,
            height: cropH,
            requestWidth,
            requestHeight,
        },
    };
}

async function compositeEditedPatch(
    baseSourceUrl: string,
    editedPatchUrl: string,
    patchMaskUrl: string,
    placement: EditPatchPlacement
): Promise<CompositedImage> {
    const [baseDataUrl, editedDataUrl, maskDataUrl] = await Promise.all([
        imageSourceToDataUrl(baseSourceUrl),
        imageSourceToDataUrl(editedPatchUrl),
        imageSourceToDataUrl(patchMaskUrl),
    ]);
    const [baseImage, editedImage, maskImage] = await Promise.all([
        loadRasterImage(baseDataUrl),
        loadRasterImage(editedDataUrl),
        loadRasterImage(maskDataUrl),
    ]);

    const width = baseImage.naturalWidth || baseImage.width;
    const height = baseImage.naturalHeight || baseImage.height;
    const outputCanvas = document.createElement('canvas');
    const editedCanvas = document.createElement('canvas');
    const maskCanvas = document.createElement('canvas');
    outputCanvas.width = width;
    outputCanvas.height = height;
    editedCanvas.width = width;
    editedCanvas.height = height;
    maskCanvas.width = width;
    maskCanvas.height = height;

    const outputCtx = outputCanvas.getContext('2d');
    const editedCtx = editedCanvas.getContext('2d');
    const maskCtx = maskCanvas.getContext('2d');
    if (!outputCtx || !editedCtx || !maskCtx) {
        throw new Error('Canvas context failed.');
    }

    outputCtx.drawImage(baseImage, 0, 0, width, height);
    editedCtx.drawImage(
        editedImage,
        0,
        0,
        editedImage.naturalWidth || editedImage.width,
        editedImage.naturalHeight || editedImage.height,
        placement.x,
        placement.y,
        placement.width,
        placement.height
    );
    maskCtx.drawImage(
        maskImage,
        0,
        0,
        placement.requestWidth,
        placement.requestHeight,
        placement.x,
        placement.y,
        placement.width,
        placement.height
    );

    const outputPixels = outputCtx.getImageData(0, 0, width, height);
    const editedPixels = editedCtx.getImageData(0, 0, width, height);
    const maskPixels = maskCtx.getImageData(0, 0, width, height);
    const outputData = outputPixels.data;
    const editedData = editedPixels.data;
    const maskData = maskPixels.data;

    for (let i = 0; i < outputData.length; i += 4) {
        const maskBrightness = (maskData[i] + maskData[i + 1] + maskData[i + 2]) / (255 * 3);
        const rawMaskAlpha = (maskData[i + 3] / 255) * maskBrightness;
        const maskAlpha = rawMaskAlpha * rawMaskAlpha * (3 - (2 * rawMaskAlpha));
        if (maskAlpha <= 0.001) {
            continue;
        }
        const keepAlpha = 1 - maskAlpha;
        outputData[i] = Math.round((editedData[i] * maskAlpha) + (outputData[i] * keepAlpha));
        outputData[i + 1] = Math.round((editedData[i + 1] * maskAlpha) + (outputData[i + 1] * keepAlpha));
        outputData[i + 2] = Math.round((editedData[i + 2] * maskAlpha) + (outputData[i + 2] * keepAlpha));
        outputData[i + 3] = Math.round((editedData[i + 3] * maskAlpha) + (outputData[i + 3] * keepAlpha));
    }

    outputCtx.putImageData(outputPixels, 0, 0);
    return {
        dataUrl: outputCanvas.toDataURL('image/png'),
        width,
        height,
    };
}


export function ImageStudioView(): JSX.Element {
    const { t } = useTranslation();
    const [models, setModels] = useState<ModelDefinition[]>([]);
    const [loadingModels, setLoadingModels] = useState(false);

    const [modelId, setModelId] = useState<string>('');
    const [prompt, setPrompt] = useState('');
    const [count, setCount] = useState(1);
    const [width, setWidth] = useState(1024);
    const [height, setHeight] = useState(1024);

    const [isGenerating, setIsGenerating] = useState(false);
    const [results, setResults] = useState<ImageStudioResult[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const [editMode, setEditMode] = useState<ImageStudioEditMode>('inpaint');
    const [editPrompt, setEditPrompt] = useState('');
    const [editStrength, setEditStrength] = useState(0.55);
    const [isEditing, setIsEditing] = useState(false);
    const [isSelectingMask, setIsSelectingMask] = useState(false);
    const [maskRect, setMaskRect] = useState<MaskRect | null>(null);
    const selectionRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const dragStartRef = useRef<{ x: number; y: number } | null>(null);
    const [draggingRect, setDraggingRect] = useState<MaskRect | null>(null);
    const draggingRectRef = useRef<MaskRect | null>(null);

    const selected = useMemo(
        () => results.find(r => r.id === selectedId) ?? null,
        [results, selectedId]
    );
    const modelNameById = useMemo(
        () => new Map(models.map(model => [model.id, getDisplayModelName(model.id, models)])),
        [models]
    );

    const isExplicitImageModel = useCallback((model: ModelDefinition): boolean => {
        const provider = (model.provider ?? '').toLowerCase();
        const id = (model.id ?? '').toLowerCase();
        const name = typeof model.name === 'string' ? model.name.toLowerCase() : '';
        const description = typeof model.description === 'string' ? model.description.toLowerCase() : '';
        const searchable = `${id} ${name} ${description}`;
        if (provider === 'codex' || provider === 'openai') {
            return /\bgpt[-_]?image\b/.test(searchable)
                || /dall[-_ ]?e/.test(searchable)
                || /\$?imagegen\b/.test(searchable)
                || /\bimage_gen\b/.test(searchable);
        }
        if (provider === 'antigravity' || provider === 'google' || provider === 'gemini') {
            return searchable.includes('image');
        }
        return false;
    }, []);

    const loadModels = useCallback(async () => {
        setLoadingModels(true);
        try {
            const allModels = await window.electron.modelRegistry.getAllModels();
            const hasAntigravity = await window.electron.hasLinkedAccount('antigravity');
            const hasOpenAI = await window.electron.hasLinkedAccount('openai');
            const hasCodex = await window.electron.hasLinkedAccount('codex');
            const hasNvidia = await window.electron.hasLinkedAccount('nvidia');

            const providerAllowed = (providerRaw: string) => {
                const provider = providerRaw.toLowerCase();
                if (provider === 'ollama') { return true; }
                if (provider === 'antigravity' || provider === 'google') { return hasAntigravity; }
                if (provider === 'openai') { return hasOpenAI; }
                if (provider === 'codex') { return hasCodex; }
                if (provider === 'nvidia') { return hasNvidia; }
                const isSd = ['sd-cpp', 'sd-webui', 'comfyui'].includes(provider);
                return isSd;
            };

            const imageModels = allModels.filter(m =>
                (Boolean(m.capabilities?.image_generation) || isExplicitImageModel(m)) &&
                providerAllowed(m.provider ?? '')
            );
            setModels(imageModels);
            setModelId(prev => prev || (imageModels[0]?.id ?? ''));
        } catch (error) {
            appLogger.error('ImageStudioView', 'Failed to load models', error as Error);
        } finally {
            setLoadingModels(false);
        }
    }, [isExplicitImageModel]);

    const loadHistory = useCallback(async () => {
        try {
            const items = await window.electron.gallery.list();
            const history = items
                .filter(item => item.type === 'image')
                .map(item => ({
                    id: item.name,
                    url: item.url,
                    modelId: item.metadata?.model ?? '',
                    prompt: item.metadata?.prompt ?? '',
                    createdAt: item.metadata?.created_at ?? item.mtime,
                } satisfies ImageStudioResult));

            setResults(prev => {
                const combined = [...prev, ...history];
                const seen = new Set<string>();
                return combined.filter(item => {
                    const dedupeKey = item.url || item.id;
                    if (seen.has(dedupeKey)) { return false; }
                    seen.add(dedupeKey);
                    return true;
                }).sort((a, b) => b.createdAt - a.createdAt);
            });

            if (!selectedId && history.length > 0) {
                setSelectedId(history[0].id);
            }
        } catch (error) {
            appLogger.error('ImageStudioView', 'Failed to load history', error as Error);
        }
    }, [selectedId]);

    useEffect(() => {
        // Use a microtask or a slight delay to avoid the "cascading render" warning
        // for synchronous state updates during initial mount
        const timer = setTimeout(() => {
            void loadModels();
            void loadHistory();
        }, 0);
        return () => clearTimeout(timer);
    }, [loadModels, loadHistory]);

    const handleGenerate = useCallback(async () => {
        const trimmedPrompt = prompt.trim();
            if (!trimmedPrompt || !modelId) {
                return;
            }
        setIsGenerating(true);
        try {
            const images = await window.electron.imageStudio.generate({
                prompt: trimmedPrompt,
                modelId,
                count: Math.max(1, Math.min(count, 8)),
                width: Math.max(256, Math.min(width, 4096)),
                height: Math.max(256, Math.min(height, 4096)),
            });
            const now = Date.now();
            const nextResults = images.map((url) => ({
                id: url,
                url,
                modelId,
                prompt: trimmedPrompt,
                createdAt: now,
            } satisfies ImageStudioResult));
            setResults(prev => {
                const combined = [...nextResults, ...prev];
                const seen = new Set<string>();
                return combined.filter(item => {
                    const dedupeKey = item.url || item.id;
                    if (seen.has(dedupeKey)) {
                        return false;
                    }
                    seen.add(dedupeKey);
                    return true;
                });
            });
            setSelectedId(nextResults[0]?.id ?? null);
            setEditPrompt('');
        } catch (error) {
            appLogger.error('ImageStudioView', 'Image generation failed', error as Error);
            pushNotification({
                type: 'error',
                message: error instanceof Error ? error.message : 'Image generation failed.',
                source: 'image-studio',
            });
        } finally {
            setIsGenerating(false);
        }
    }, [count, height, modelId, prompt, width]);


    const handleRunEdit = useCallback(async () => {
        if (!selected || !maskRect || isEditing) {
            return;
        }

        const sourceModelId = selected.modelId.trim();
        const trimmedEditPrompt = editPrompt.trim();
        if (!sourceModelId) {
            pushNotification({
                type: 'error',
                message: 'This image has no source model metadata. Regenerate it before editing so Image Studio can reuse the original model.',
                source: 'image-studio',
            });
            return;
        }
        if (!trimmedEditPrompt) {
            return;
        }

        const stage = selectionRef.current;
        const img = imageRef.current;
            if (!stage || !img) {
                return;
            }

        setIsEditing(true);
        try {
            const stageRect = stage.getBoundingClientRect();
            const imgRect = img.getBoundingClientRect();

            // Calculate image dimensions in natural pixels
            const naturalWidth = img.naturalWidth;
            const naturalHeight = img.naturalHeight;
            const scaleX = naturalWidth / imgRect.width;
            const scaleY = naturalHeight / imgRect.height;

            // Selection relative to image (in natural pixels)
            const relX = (maskRect.x - (imgRect.left - stageRect.left)) * scaleX;
            const relY = (maskRect.y - (imgRect.top - stageRect.top)) * scaleY;
            const relW = maskRect.width * scaleX;
            const relH = maskRect.height * scaleY;

            // Detect if we need outpainting (selection is outside 0-naturalWidth/Height)
            const isOutpaint = relX < -1 || relY < -1 || (relX + relW) > naturalWidth + 1 || (relY + relH) > naturalHeight + 1;

            const originalSourceImageUrl = toSafeFileUrl(selected.url) ?? selected.url;
            let sourceImageUrl = originalSourceImageUrl;
            let maskImageUrl = '';
            let patchPlacement: EditPatchPlacement | null = null;
            let patchBaseSourceUrl = originalSourceImageUrl;
            let contextImageUrl: string | undefined;

            if (isOutpaint || editMode === 'outpaint') {
                const canvas = document.createElement('canvas');
                const outLeft = Math.min(0, relX);
                const outTop = Math.min(0, relY);
                const outRight = Math.max(naturalWidth, relX + relW);
                const outBottom = Math.max(naturalHeight, relY + relH);
                const targetW = Math.round(outRight - outLeft);
                const targetH = Math.round(outBottom - outTop);
                const longEdge = Math.max(targetW, targetH);
                const scaleDown = longEdge > 2048 ? 2048 / longEdge : 1;
                const canvasW = Math.round(targetW * scaleDown);
                const canvasH = Math.round(targetH * scaleDown);
                canvas.width = canvasW;
                canvas.height = canvasH;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    throw new Error('Canvas context failed');
                }

                if (scaleDown < 1) {
                    ctx.scale(scaleDown, scaleDown);
                }

                const offsetX = -outLeft;
                const offsetY = -outTop;
                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, targetW, targetH);
                const imageObj = new Image();
                const sourceDataUrl = await imageSourceToDataUrl(sourceImageUrl);
                await new Promise((resolve, reject) => { 
                    imageObj.onload = resolve; 
                    imageObj.onerror = reject;
                    imageObj.src = sourceDataUrl;
                });
                ctx.drawImage(imageObj, offsetX, offsetY);

                const expandedSourceUrl = canvas.toDataURL('image/jpeg', 0.92);
                const patchContext = await createInpaintPatchContext(
                    expandedSourceUrl,
                    canvasW,
                    canvasH,
                    {
                        x: (relX + offsetX) * scaleDown,
                        y: (relY + offsetY) * scaleDown,
                        width: relW * scaleDown,
                        height: relH * scaleDown,
                    }
                );
                sourceImageUrl = patchContext.requestSourceUrl;
                maskImageUrl = patchContext.requestMaskUrl;
                contextImageUrl = patchContext.contextImageUrl;
                patchPlacement = patchContext.placement;
                patchBaseSourceUrl = patchContext.baseSourceUrl;
            } else {
                const patchContext = await createInpaintPatchContext(
                    originalSourceImageUrl,
                    naturalWidth,
                    naturalHeight,
                    { x: relX, y: relY, width: relW, height: relH }
                );
                sourceImageUrl = patchContext.requestSourceUrl;
                maskImageUrl = patchContext.requestMaskUrl;
                contextImageUrl = patchContext.contextImageUrl;
                patchPlacement = patchContext.placement;
                patchBaseSourceUrl = patchContext.baseSourceUrl;
            }

            const results = await window.electron.imageStudio.edit({
                contextImage: contextImageUrl,
                sourceImage: sourceImageUrl,
                maskImage: maskImageUrl,
                prompt: trimmedEditPrompt,
                mode: editMode,
                strength: editStrength,
                modelId: sourceModelId
            });

            if (results && results.length > 0) {
                const now = Date.now();
                const savedResults = await Promise.all(results.map(async (url: string) => {
                    const composited = patchPlacement
                        ? await compositeEditedPatch(patchBaseSourceUrl, url, maskImageUrl, patchPlacement)
                        : await compositeMaskedImage(sourceImageUrl, url, maskImageUrl);
                    return window.electron.imageStudio.save({
                        image: composited.dataUrl,
                        prompt: trimmedEditPrompt,
                        modelId: sourceModelId,
                        width: composited.width,
                        height: composited.height,
                    });
                }));
                const newResults = savedResults.map((url: string) => ({
                    id: url,
                    url,
                    modelId: sourceModelId,
                    prompt: trimmedEditPrompt,
                    createdAt: now
                } satisfies ImageStudioResult));

                setResults(prev => {
                    const combined = [...newResults, ...prev];
                    const seen = new Set<string>();
                    return combined.filter(item => {
                        const dedupeKey = item.url || item.id;
                        if (seen.has(dedupeKey)) {
                            return false;
                        }
                        seen.add(dedupeKey);
                        return true;
                    });
                });
                setSelectedId(newResults[0].id);
                setMaskRect(null);
                setEditPrompt('');
                setIsSelectingMask(false);
            }
        } catch (err) {
            appLogger.error('ImageStudio', 'Edit failed', err as Error);
            pushNotification({
                type: 'error',
                message: err instanceof Error ? err.message : 'Image edit failed.',
                source: 'image-studio',
            });
        } finally {
            setIsEditing(false);
        }
    }, [selected, maskRect, isEditing, editPrompt, editMode, editStrength]);

    const handlePrev = useCallback(() => {
        const currentIndex = results.findIndex(r => r.id === selectedId);
        setSelectedId(currentIndex > 0 ? results[currentIndex - 1].id : results[results.length - 1].id);
    }, [results, selectedId]);

    const handleNext = useCallback(() => {
        const currentIndex = results.findIndex(r => r.id === selectedId);
        setSelectedId(currentIndex < results.length - 1 ? results[currentIndex + 1].id : results[0].id);
    }, [results, selectedId]);

    const rectForOverlay = useMemo(() => {
        const rect = draggingRect ?? maskRect;
        if (!rect) { return null; }
        // For free canvas, we don't normalize to 0-1 here, 
        // we just pass the raw pixels/percents relative to the STAGE
        return {
            left: `${rect.x}px`,
            top: `${rect.y}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
        };
    }, [draggingRect, maskRect]);

    return (
        <div className="h-full w-full overflow-hidden bg-tech-grid bg-tech-grid-sm">
            <div className="h-full w-full p-6">
                <div className="h-full grid grid-cols-12 gap-6">
                    <SidebarPanel
                        t={t}
                        modelId={modelId}
                        setModelId={setModelId}
                        models={models}
                        loadingModels={loadingModels}
                        prompt={prompt}
                        setPrompt={setPrompt}
                        count={count}
                        setCount={setCount}
                        width={width}
                        setWidth={setWidth}
                        height={height}
                        setHeight={setHeight}
                        isGenerating={isGenerating}
                        onGenerate={() => { void handleGenerate(); }}
                    />

                    <Card className="col-span-12 lg:col-span-9 h-full border-border/50 bg-card/80 backdrop-blur-sm relative z-10">
                        {results.length === 0 ? (
                            <EmptyPlaceholder t={t} />
                        ) : (
                            <div className="h-full flex flex-col min-h-0">
                                <GalleryHeader
                                    results={results}
                                    selectedId={selectedId}
                                    setSelectedId={setSelectedId}
                                    getModelName={(id) => modelNameById.get(id) ?? id}
                                />
                                <div className="flex-1 relative min-h-0 p-4">
                                    {selected && (
                                        <ImageWorkspace
                                            t={t}
                                            selected={selected}
                                            selectedModelName={modelNameById.get(selected.modelId) ?? selected.modelId}
                                            imageRef={imageRef}
                                            selectionRef={selectionRef}
                                            resultsCount={results.length}
                                            isSelectingMask={isSelectingMask}
                                            setIsSelectingMask={setIsSelectingMask}
                                            maskRect={maskRect}
                                            setMaskRect={setMaskRect}
                                            draggingRect={draggingRect}
                                            setDraggingRect={setDraggingRect}
                                            draggingRectRef={draggingRectRef}
                                            dragStartRef={dragStartRef}
                                            rectForOverlay={rectForOverlay}
                                            editPrompt={editPrompt}
                                            setEditPrompt={setEditPrompt}
                                            isEditing={isEditing}
                                            editMode={editMode}
                                            setEditMode={setEditMode}
                                            editStrength={editStrength}
                                            setEditStrength={setEditStrength}
                                            onPrev={handlePrev}
                                            onNext={handleNext}
                                            onRunEdit={() => { void handleRunEdit(); }}
                                        />
                                    )}
                                </div>
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
}

// --- Sub-components ---

interface SidebarPanelProps {
    t: (key: string) => string;
    modelId: string;
    setModelId: (v: string) => void;
    models: ModelDefinition[];
    loadingModels: boolean;
    prompt: string;
    setPrompt: (v: string) => void;
    count: number;
    setCount: (v: number) => void;
    width: number;
    setWidth: (v: number) => void;
    height: number;
    setHeight: (v: number) => void;
    isGenerating: boolean;
    onGenerate: () => void;
}

function SidebarPanel({ t, modelId, setModelId, models, loadingModels, prompt, setPrompt, count, setCount, width, setWidth, height, setHeight, isGenerating, onGenerate }: SidebarPanelProps) {
    return (
        <Card className="col-span-12 lg:col-span-3 h-full overflow-hidden border-border/50 bg-card/80 backdrop-blur-sm">
            <ScrollArea className="h-full">
                <div className="p-5 space-y-5">
                    <div className="text-base font-bold text-foreground">{t('frontend.images.title')}</div>
                    <div className="space-y-2">
                        <div className="typo-overline font-bold uppercase text-muted-foreground/60">{t('frontend.images.model')}</div>
                        <Select value={modelId} onValueChange={setModelId} disabled={loadingModels || models.length === 0}>
                            <SelectTrigger className="h-11 rounded-xl bg-background/60">
                                <SelectValue placeholder={loadingModels ? t('common.loading') : t('frontend.images.selectModel')} />
                            </SelectTrigger>
                            <SelectContent>
                                {models.map((m) => (
                                    <SelectItem key={m.id} value={m.id}>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-sm font-medium">{m.name}</span>
                                            <span className="text-[10px] opacity-50 uppercase">{m.provider}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {models.length === 0 && !loadingModels && <div className="text-sm text-muted-foreground">{t('frontend.workspaces.noImageModelsFound')}</div>}
                    </div>
                    <div className="space-y-2">
                        <div className="typo-overline font-bold uppercase text-muted-foreground/60">{t('frontend.images.prompt')}</div>
                        <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={t('frontend.images.promptPlaceholder')} className="min-h-[130px] rounded-xl bg-background/60 resize-none" />
                    </div>
                    <div className="space-y-2">
                        <div className="typo-overline font-bold uppercase text-muted-foreground/60">{t('frontend.images.count')}</div>
                        <Input type="number" min={1} max={8} value={count} onChange={(e) => setCount(Number(e.target.value) || 1)} className="h-11 rounded-xl bg-background/60" />
                        <div className="typo-caption text-muted-foreground">{t('frontend.images.countHelp')}</div>
                    </div>
                    <div className="space-y-2">
                        <div className="typo-overline font-bold uppercase text-muted-foreground/60">Resolution</div>
                        <div className="grid grid-cols-2 gap-3">
                            <Input
                                type="number"
                                min={256}
                                max={4096}
                                step={64}
                                value={width}
                                onChange={(e) => setWidth(Number(e.target.value) || 1024)}
                                className="h-11 rounded-xl bg-background/60"
                                placeholder="Width"
                            />
                            <Input
                                type="number"
                                min={256}
                                max={4096}
                                step={64}
                                value={height}
                                onChange={(e) => setHeight(Number(e.target.value) || 1024)}
                                className="h-11 rounded-xl bg-background/60"
                                placeholder="Height"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <Button type="button" variant="outline" className="h-9 rounded-xl" onClick={() => { setWidth(1024); setHeight(1024); }}>1:1</Button>
                            <Button type="button" variant="outline" className="h-9 rounded-xl" onClick={() => { setWidth(1536); setHeight(1024); }}>3:2</Button>
                            <Button type="button" variant="outline" className="h-9 rounded-xl" onClick={() => { setWidth(1024); setHeight(1536); }}>2:3</Button>
                            <Button type="button" variant="outline" className="h-9 rounded-xl" onClick={() => { setWidth(1792); setHeight(1024); }}>16:9</Button>
                        </div>
                    </div>
                    <div className="pt-1">
                        <Button className="w-full h-11 rounded-xl font-bold gap-2" onClick={onGenerate} disabled={isGenerating || !modelId || !prompt.trim() || models.length === 0}>
                            {isGenerating ? <IconRefresh className="w-4 h-4 animate-spin" /> : <IconPhoto className="w-4 h-4" />}
                            {t('frontend.images.generate')}
                        </Button>
                    </div>
                </div>
            </ScrollArea>
        </Card>
    );
}

function EmptyPlaceholder({ t }: { t: (key: string) => string }) {
    return (
        <div className="h-full flex items-center justify-center">
            <div className="text-center text-muted-foreground">
                <IconPhoto className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <div className="font-medium">{t('frontend.images.emptyTitle')}</div>
                <div className="typo-caption">{t('frontend.images.emptySubtitle')}</div>
            </div>
        </div>
    );
}

interface GalleryHeaderProps {
    results: ImageStudioResult[];
    selectedId: string | null;
    setSelectedId: (id: string | null) => void;
    getModelName: (id: string) => string;
}

function GalleryHeader({ results, selectedId, setSelectedId, getModelName }: GalleryHeaderProps) {
    const { t } = useTranslation();
    return (
        <div className="flex-none p-3 border-b border-border/40 bg-background/20 backdrop-blur-md">
            <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-2">
                    <IconPhoto className="w-4 h-4 text-primary" />
                    <h3 className="text-xs font-bold uppercase tracking-wider">{t('frontend.images.results')}</h3>
                </div>
                <span className="text-[10px] font-medium text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full">
                    {t('frontend.images.resultsCount', { count: results.length })}
                </span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
                {results.map((r) => (
                    <button
                        key={r.id}
                        onClick={() => setSelectedId(r.id)}
                        className={cn(
                            "w-16 h-16 shrink-0 rounded-xl overflow-hidden border transition-all duration-200 group relative",
                            selectedId === r.id ? "border-primary ring-2 ring-primary/20 scale-105" : "border-border/60 hover:border-primary/40 hover:scale-105"
                        )}
                    >
                        <img src={toSafeFileUrl(r.url) ?? r.url} alt="" className="w-full h-full object-cover" />
                        {r.modelId && (
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-1">
                                <span className="text-[8px] font-bold text-white truncate text-center">{getModelName(r.modelId)}</span>
                            </div>
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
}

interface ImageWorkspaceProps {
    t: (key: string) => string;
    selected: ImageStudioResult;
    selectedModelName: string;
    imageRef: React.RefObject<HTMLImageElement>;
    selectionRef: React.RefObject<HTMLDivElement>;
    resultsCount: number;
    isSelectingMask: boolean;
    setIsSelectingMask: (v: boolean) => void;
    maskRect: MaskRect | null;
    setMaskRect: (r: MaskRect | null) => void;
    draggingRect: MaskRect | null;
    setDraggingRect: (r: MaskRect | null) => void;
    draggingRectRef: React.MutableRefObject<MaskRect | null>;
    dragStartRef: React.MutableRefObject<{ x: number; y: number } | null>;
    rectForOverlay: { left: string; top: string; width: string; height: string } | null;
    editPrompt: string;
    setEditPrompt: (v: string) => void;
    isEditing: boolean;
    editMode: ImageStudioEditMode;
    setEditMode: (m: ImageStudioEditMode) => void;
    editStrength: number;
    setEditStrength: (v: number) => void;
    onPrev: () => void;
    onNext: () => void;
    onRunEdit: () => void;
}

function ImageWorkspace({ t, selected, selectedModelName, imageRef, selectionRef, resultsCount, isSelectingMask, setIsSelectingMask, maskRect, setMaskRect, draggingRect, setDraggingRect, draggingRectRef, dragStartRef, rectForOverlay, editPrompt, setEditPrompt, isEditing, editMode, setEditMode, editStrength, setEditStrength, onPrev, onNext, onRunEdit }: ImageWorkspaceProps) {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div 
            className="h-full w-full flex flex-col relative overflow-hidden bg-black/60 rounded-2xl border border-white/5 group"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* The Stage / Infinite Grid */}
            <div className="absolute inset-0 bg-tech-grid bg-tech-grid-sm opacity-20 pointer-events-none" />
            
            <div className="relative flex-1 w-full overflow-auto scrollbar-hide">
                <div className="relative min-h-full w-full flex items-center justify-center px-16 py-10 md:px-24 md:py-14">
                    <div className="relative z-10 shadow-[0_0_100px_rgba(0,0,0,0.8)] rounded-lg overflow-hidden border border-white/10">
                        <img
                            ref={imageRef}
                            src={toSafeFileUrl(selected.url) ?? selected.url}
                            alt={t('frontend.images.imageAlt')}
                            className="block w-auto h-auto max-w-[min(100%,1100px)] max-h-[calc(100vh-320px)] object-contain select-none pointer-events-none"
                            onLoad={() => {
                                setMaskRect(null);
                                setIsSelectingMask(false);
                                setDraggingRect(null);
                                draggingRectRef.current = null;
                                dragStartRef.current = null;
                            }}
                        />

                        <div className="absolute top-4 left-4 z-20">
                            <Badge variant="secondary" className="bg-background/80 backdrop-blur-md border-border/50 text-[10px] font-mono py-0 px-2 h-5">
                                {selectedModelName}
                            </Badge>
                        </div>
                    </div>

                    {!isSelectingMask && (
                        <div className={cn("absolute bottom-6 left-1/2 -translate-x-1/2 z-20 transition-opacity", isHovered ? "opacity-100" : "opacity-0 pointer-events-none")}>
                            <div className="bg-background/80 backdrop-blur-xl p-2 rounded-xl border border-border/50 shadow-2xl flex items-center gap-3">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-9 rounded-lg bg-background/50 hover:bg-primary hover:text-primary-foreground border-border/50 transition-colors"
                                    onClick={() => setIsSelectingMask(true)}
                                >
                                    <IconFocus2 className="w-4 h-4 mr-2" />
                                    <span className="text-[11px] font-bold uppercase">{t('frontend.images.maskSelect')}</span>
                                </Button>
                            </div>
                        </div>
                    )}

                    {isSelectingMask && (
                        <MaskSelectionOverlay
                            selectionRef={selectionRef}
                            imageRef={imageRef}
                            dragStartRef={dragStartRef}
                            draggingRectRef={draggingRectRef}
                            setDraggingRect={setDraggingRect}
                            setMaskRect={setMaskRect}
                            rectForOverlay={rectForOverlay}
                            draggingRect={draggingRect}
                            maskRect={maskRect}
                            t={t}
                            editPrompt={editPrompt}
                            setEditPrompt={setEditPrompt}
                            isEditing={isEditing}
                            onRunEdit={onRunEdit}
                        />
                    )}
                </div>
            </div>

            {/* Navigation Arrows (Absolute to Stage) */}
            {resultsCount > 1 && !isSelectingMask && (
                <>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="absolute left-8 top-1/2 -translate-y-1/2 z-30 h-14 w-14 rounded-full bg-black/40 backdrop-blur-xl border border-white/5 hover:bg-primary hover:text-primary-foreground transition-all duration-500 shadow-2xl" 
                        onClick={onPrev}
                    >
                        <IconChevronLeft className="w-8 h-8" />
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="absolute right-8 top-1/2 -translate-y-1/2 z-30 h-14 w-14 rounded-full bg-black/40 backdrop-blur-xl border border-white/5 hover:bg-primary hover:text-primary-foreground transition-all duration-500 shadow-2xl" 
                        onClick={onNext}
                    >
                        <IconChevronRight className="w-8 h-8" />
                    </Button>
                </>
            )}

            <FloatingControls
                t={t}
                isSelectingMask={isSelectingMask}
                setIsSelectingMask={setIsSelectingMask}
                setMaskRect={setMaskRect}
                editMode={editMode}
                setEditMode={setEditMode}
                editStrength={editStrength}
                setEditStrength={setEditStrength}
                isHovered={isHovered}
            />
        </div>
    );
}

interface MaskSelectionOverlayProps {
    selectionRef: React.RefObject<HTMLDivElement>;
    imageRef: React.RefObject<HTMLImageElement>;
    dragStartRef: React.MutableRefObject<{ x: number; y: number } | null>;
    draggingRectRef: React.MutableRefObject<MaskRect | null>;
    setDraggingRect: (r: MaskRect | null) => void;
    setMaskRect: (r: MaskRect | null) => void;
    rectForOverlay: { left: string; top: string; width: string; height: string } | null;
    draggingRect: MaskRect | null;
    maskRect: MaskRect | null;
    t: (key: string) => string;
    editPrompt: string;
    setEditPrompt: (v: string) => void;
    isEditing: boolean;
    onRunEdit: () => void;
}

function MaskSelectionOverlay({ selectionRef, dragStartRef, draggingRectRef, setDraggingRect, setMaskRect, rectForOverlay, draggingRect, maskRect, t, editPrompt, setEditPrompt, isEditing, onRunEdit }: MaskSelectionOverlayProps) {
    return (
        <div
            ref={selectionRef}
            className="absolute inset-0 cursor-crosshair z-30"
            onPointerDown={(e) => {
                const stage = selectionRef.current;
                if (!stage) {
                    return;
                }
                const rect = stage.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                dragStartRef.current = { x, y };
                setMaskRect(null);
            }}
            onPointerMove={(e) => {
                if (!dragStartRef.current || !selectionRef.current) {
                    return;
                }
                const rect = selectionRef.current.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                const nextRect = {
                    x: Math.min(x, dragStartRef.current.x),
                    y: Math.min(y, dragStartRef.current.y),
                    width: Math.abs(x - dragStartRef.current.x),
                    height: Math.abs(y - dragStartRef.current.y),
                };
                setDraggingRect(nextRect);
                draggingRectRef.current = nextRect;
            }}
            onPointerUp={() => {
                if (draggingRectRef.current) {
                    setMaskRect(normalizeRect(draggingRectRef.current));
                }
                dragStartRef.current = null;
                setDraggingRect(null);
                draggingRectRef.current = null;
            }}
        >
            {rectForOverlay && (
                <div className="absolute border-2 border-primary bg-primary/10 rounded-lg shadow-sm" style={rectForOverlay}>
                    {!draggingRect && maskRect && (
                        <div className={cn("absolute left-1/2 -translate-x-1/2 w-[520px] max-w-[min(92vw,520px)] bg-black/85 backdrop-blur-3xl p-2 rounded-2xl border border-white/20 shadow-[0_30px_60px_rgba(0,0,0,0.8)] z-50 flex items-center gap-2", maskRect.y > 180 ? "bottom-full mb-4" : "top-full mt-4")} onPointerDown={(e) => e.stopPropagation()}>
                            <Textarea
                                value={editPrompt}
                                onChange={(e) => setEditPrompt(e.target.value)}
                                placeholder={t('frontend.images.editPromptPlaceholder')}
                                className="flex-1 min-h-[88px] rounded-xl bg-white/10 border-none text-white text-sm placeholder:text-white/40 focus-visible:ring-0 resize-none"
                                autoFocus
                                onKeyDown={(e) => { if (e.key === 'Enter' && editPrompt.trim() && !isEditing) { void onRunEdit(); } }}
                            />
                            <Button className="h-[88px] min-w-[104px] shrink-0 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20" onClick={(e) => { e.stopPropagation(); void onRunEdit(); }} disabled={isEditing || !editPrompt.trim()}>
                                <IconSparkles className={cn("w-5 h-5 mr-2", isEditing && "animate-spin")} />
                                Generate
                            </Button>
                            <button onClick={(e) => { e.stopPropagation(); setMaskRect(null); }} className="p-2 text-white/40 hover:text-white transition-colors">
                                <IconX className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

interface FloatingControlsProps {
    t: (key: string) => string;
    isSelectingMask: boolean;
    setIsSelectingMask: (v: boolean) => void;
    setMaskRect: (r: MaskRect | null) => void;
    editMode: ImageStudioEditMode;
    setEditMode: (m: ImageStudioEditMode) => void;
    editStrength: number;
    setEditStrength: (v: number) => void;
    isHovered: boolean;
}

function FloatingControls({ t, isSelectingMask, setIsSelectingMask, setMaskRect, editMode, setEditMode, editStrength, setEditStrength, isHovered }: FloatingControlsProps) {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    return (
        <div 
            className={cn(
                "absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/80 backdrop-blur-2xl p-2 rounded-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all duration-300 z-40",
                (isSelectingMask || isDropdownOpen || isHovered) ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none"
            )}
            onPointerDown={(e) => e.stopPropagation()}
        >
            <Button variant={isSelectingMask ? "default" : "ghost"} size="icon" className={cn("h-10 w-10 rounded-xl transition-all", isSelectingMask && "bg-primary text-primary-foreground shadow-lg shadow-primary/30")} onClick={() => { setIsSelectingMask(!isSelectingMask); if (isSelectingMask) { setMaskRect(null); } }} title={isSelectingMask ? t('frontend.images.maskDone') : t('frontend.images.maskSelect')}>
                {isSelectingMask ? <IconCheck className="w-5 h-5" /> : <IconCrop className="w-5 h-5" />}
            </Button>
            <div className="h-6 w-px bg-white/10 mx-1" />
            <Select
                value={editMode}
                onValueChange={(v) => setEditMode(v as ImageStudioEditMode)}
                onOpenChange={setIsDropdownOpen}
            >
                <SelectTrigger className="h-10 w-44 rounded-xl bg-transparent border-none text-white hover:bg-white/5 font-bold text-sm focus:ring-0">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-black/90 backdrop-blur-xl border-white/10 text-white z-50">
                    <SelectItem value="inpaint">{t('frontend.images.modeInpaint')}</SelectItem>
                    <SelectItem value="outpaint">{t('frontend.images.modeOutpaint')}</SelectItem>
                    <SelectItem value="img2img">{t('frontend.images.modeImg2img')}</SelectItem>
                    <SelectItem value="style-transfer">{t('frontend.images.modeStyle')}</SelectItem>
                </SelectContent>
            </Select>
            <div className="flex items-center gap-3 px-3">
                <IconAdjustmentsHorizontal className="w-4 h-4 text-white/40" />
                <div className="flex flex-col -space-y-1">
                    <span className="typo-overline text-white/30 tracking-tighter">{t('frontend.images.variationLabel')}</span>
                    <input type="number" min={0.05} max={0.95} step={0.01} value={editStrength} onChange={(e) => setEditStrength(Number(e.target.value) || 0.55)} className="w-10 bg-transparent text-white text-10 font-bold outline-none" />
                </div>
            </div>
        </div>
    );
}
