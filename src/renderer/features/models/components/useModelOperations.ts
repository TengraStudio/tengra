import { useCallback, useState } from 'react';

import type { DbMarketplaceModel } from '@/electron';

import { HFFile, HFModel, UnifiedModel } from '../types';

/**
 * Hook for handling model detail loading and operations
 */
export function useModelOperations(loadInstalledOllamaModels: () => Promise<void>) {
    const [selectedModel, setSelectedModel] = useState<DbMarketplaceModel | null>(null);
    const [detailedModel, setDetailedModel] = useState<UnifiedModel | null>(null);
    const [selectedHfModelId, setSelectedHfModelId] = useState<string | null>(null);
    const [hfFiles, setHfFiles] = useState<HFFile[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);

    const handleModelSelect = useCallback(async (model: DbMarketplaceModel) => {
        setSelectedModel(model);
        setLoadingDetails(true);
        setHfFiles([]);
        setSelectedHfModelId(null);
        try {
            const details = await window.electron.marketplace.getModelDetails(model.name, model.provider);
            const isOllamaDetails = details !== null && 'versions' in details;
            if (model.provider === 'huggingface') {
                const [author, ...rest] = model.name.split('/');
                const hfName = rest.length > 0 ? rest.join('/') : model.name;
                const files = await window.electron.huggingface.getFiles(model.name);
                setSelectedHfModelId(model.name);
                setHfFiles(files);
                setDetailedModel({
                    id: model.name,
                    name: hfName,
                    author: model.author || author || 'unknown',
                    description: details?.shortDescription || model.shortDescription || '',
                    downloads: model.downloads || 0,
                    likes: model.likes || 0,
                    tags: model.categories || [],
                    lastModified: model.lastUpdated || new Date(model.updatedAt).toISOString(),
                    longDescriptionMarkdown: details && !isOllamaDetails && 'longDescriptionMarkdown' in details
                        ? details.longDescriptionMarkdown
                        : '',
                    provider: 'huggingface',
                } as HFModel);
            } else {
                setDetailedModel({
                    name: model.name,
                    description: details?.shortDescription || model.shortDescription || '',
                    tags: isOllamaDetails ? details.versions.map(v => v.version) : [],
                    provider: 'ollama',
                    pulls: model.pulls,
                    lastUpdated: model.lastUpdated,
                    longDescriptionHtml: isOllamaDetails ? details.longDescriptionHtml : '',
                    versions: isOllamaDetails ? details.versions : []
                });
            }
        } finally {
            setLoadingDetails(false);
        }
    }, []);

    const handlePullOllama = useCallback(async (modelName: string, tag: string) => {
        const fullModelName = `${modelName}:${tag}`;
        try {
            await window.electron.invoke('model-downloader:start', {
                provider: 'ollama',
                modelName,
                tag,
            });
            return fullModelName;
        } catch (err) {
            window.electron.log.error('Failed to pull model:', err);
            return null;
        }
    }, []);

    const handleRemoveOllama = useCallback(async (fullModelName: string) => {
        try {
            const result = await window.electron.deleteOllamaModel(fullModelName);
            if (!result?.success) {
                window.electron.log.error('Failed to remove Ollama model:', result?.error);
            } else {
                void loadInstalledOllamaModels();
            }
        } catch (err) {
            window.electron.log.error('Failed to remove Ollama model:', err);
        }
    }, [loadInstalledOllamaModels]);

    const handleDownloadHF = useCallback(async (file: HFFile, modelId: string) => {
        if (!modelId) {
            return;
        }
        try {
            await window.electron.invoke('model-downloader:start', {
                provider: 'huggingface',
                modelId,
                fileName: file.name,
            });
        } catch (err) {
            window.electron.log.error('Failed to download HF file:', err);
        }
    }, []);

    const handleCancelDownload = useCallback(async (downloadId: string) => {
        try {
            await window.electron.invoke('model-downloader:cancel', downloadId);
        } catch (err) {
            window.electron.log.error('Failed to cancel download:', err);
        }
    }, []);

    const handleCloseDetails = useCallback(() => {
        setSelectedModel(null);
        setDetailedModel(null);
        setHfFiles([]);
        setSelectedHfModelId(null);
    }, []);

    return {
        selectedModel,
        detailedModel,
        selectedHfModelId,
        hfFiles,
        loadingDetails,
        handleModelSelect,
        handlePullOllama,
        handleRemoveOllama,
        handleDownloadHF,
        handleCancelDownload,
        handleCloseDetails,
    };
}
