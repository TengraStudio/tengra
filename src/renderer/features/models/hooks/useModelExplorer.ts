import { HFFile, HFModel, OllamaLibraryModel, UnifiedModel } from '@renderer/features/models/types';
import { parsePulls } from '@renderer/features/models/utils/explorer-utils';
import type { ModelInfo } from '@renderer/features/models/utils/model-fetcher';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface UseModelExplorerProps {
    onRefreshModels?: () => void;
    installedModels: ModelInfo[];
}

const getFilteredOllama = (ollamaLibrary: OllamaLibraryModel[], query: string, activeSource: string, page: number) => {
    if (activeSource === 'huggingface' || page > 0) { return []; }

    let filtered = ollamaLibrary;
    if (query) {
        const q = query.toLowerCase();
        filtered = ollamaLibrary.filter(m =>
            m.name.toLowerCase().includes(q) ||
            m.description.toLowerCase().includes(q)
        );
    }
    if (activeSource === 'all' && filtered.length > 12) {
        return [...filtered].sort((a, b) => parsePulls(b.pulls) - parsePulls(a.pulls)).slice(0, 12);
    }
    return filtered;
};

const getSortedModels = (hfResults: HFModel[], filteredOllama: OllamaLibraryModel[], sortBy: string, activeSource: string) => {
    const base = [...hfResults, ...(activeSource === 'all' || activeSource === 'ollama' ? filteredOllama : [])];
    return base.sort((a, b) => {
        if (sortBy === 'name') { return a.name.localeCompare(b.name); }
        if (sortBy === 'popularity') {
            const aVal = a.provider === 'huggingface' ? (a as HFModel).downloads : parsePulls((a as OllamaLibraryModel).pulls);
            const bVal = b.provider === 'huggingface' ? (b as HFModel).downloads : parsePulls((b as OllamaLibraryModel).pulls);
            return bVal - aVal;
        }
        if (a.provider === 'huggingface' && b.provider === 'huggingface') {
            return new Date((b as HFModel).lastModified).getTime() - new Date((a as HFModel).lastModified).getTime();
        }
        return 0;
    });
};

export function useModelExplorer({ onRefreshModels, installedModels }: UseModelExplorerProps) {
    const [query, setQuery] = useState('');
    const [activeSource, setActiveSource] = useState<'all' | 'ollama' | 'huggingface'>('all');
    const [sortBy, setSortBy] = useState<'name' | 'popularity' | 'updated'>('popularity');
    const [page, setPage] = useState(0);

    const [ollamaLibrary, setOllamaLibrary] = useState<OllamaLibraryModel[]>([]);
    const [hfResults, setHfResults] = useState<HFModel[]>([]);
    const [loading, setLoading] = useState(false);
    const [totalHf, setTotalHf] = useState(0);

    const isInstalled = useMemo(() => {
        const ids = new Set(installedModels.map(m => m.id));
        return (id: string) => ids.has(id);
    }, [installedModels]);

    const [selectedModel, setSelectedModel] = useState<UnifiedModel | null>(null);
    const [files, setFiles] = useState<HFFile[]>([]);
    const [loadingFiles, setLoadingFiles] = useState(false);
    const [downloading, setDownloading] = useState<{ [key: string]: { received: number, total: number } }>({});
    const [modelsDir, setModelsDir] = useState<string>('');
    const [pullingOllama, setPullingOllama] = useState<string | null>(null);

    useEffect(() => {
        void window.electron.getLibraryModels().then((libs) => {
            const typedLibs = libs.map(l => ({ ...l, provider: 'ollama' as const, pulls: undefined }));
            setOllamaLibrary(typedLibs);
        });
        void window.electron.llama.getModelsDir().then(setModelsDir);

        window.electron.huggingface.onDownloadProgress((p) => {
            setDownloading(prev => ({ ...prev, [p.filename]: { received: p.received, total: p.total } }));
        });

        window.electron.onPullProgress((progress) => {
            if (progress.status === 'success') {
                setPullingOllama(null);
                onRefreshModels?.();
            }
        });

        return () => {
            window.electron.removePullProgressListener();
        };
    }, [onRefreshModels]);

    const fetchModels = useCallback(async () => {
        setLoading(true);
        try {
            if (activeSource !== 'ollama') {
                const hfSort = sortBy === 'popularity' ? 'downloads' : (sortBy === 'updated' ? 'updated' : 'name');
                const result = await window.electron.huggingface.searchModels(query, 40, page, hfSort);
                setHfResults(result.models.map((r) => ({ ...r, provider: 'huggingface' as const })));
                setTotalHf(result.total);
            } else {
                setHfResults([]);
                setTotalHf(0);
            }
        } catch (e) {
            console.error(e);
            setHfResults([]);
        } finally {
            setLoading(false);
        }
    }, [activeSource, query, page, sortBy]);

    useEffect(() => {
        if (!query && hfResults.length === 0) {
            void fetchModels();
            return;
        }
        const timer = setTimeout(() => { void fetchModels(); }, 500);
        return () => clearTimeout(timer);
    }, [query, hfResults.length, fetchModels]);

    const filteredOllama = useMemo(() => getFilteredOllama(ollamaLibrary, query, activeSource, page), [ollamaLibrary, query, activeSource, page]);
    const displayModels = useMemo(() => getSortedModels(hfResults, filteredOllama, sortBy, activeSource), [hfResults, filteredOllama, sortBy, activeSource]);

    const handleModelSelect = async (model: UnifiedModel) => {
        setSelectedModel(model);
        if (model.provider === 'huggingface') {
            setLoadingFiles(true);
            try {
                const fileList = await window.electron.huggingface.getFiles(model.id);
                setFiles(fileList.sort((a, b) => a.size - b.size));
            } catch (e) { console.error(e); } finally { setLoadingFiles(false); }
        }
    };

    const handlePullOllama = async (modelName: string, tag: string) => {
        const fullModelName = `${modelName}:${tag}`;
        setPullingOllama(fullModelName);
        try {
            await window.electron.pullModel(fullModelName);
            onRefreshModels?.();
        } catch (e) { console.error(e); } finally { setPullingOllama(null); }
    };

    const handleDownloadHF = async (file: HFFile) => {
        if (!modelsDir || selectedModel?.provider !== 'huggingface') { return; }
        const safeName = `${selectedModel.author}-${selectedModel.name}-${file.quantization}.gguf`.replace(/[^a-zA-Z0-9.-]/g, '_').toLowerCase();
        const universalPath = `${modelsDir}/${safeName}`.replace(/\\/g, '/');

        try {
            setDownloading(prev => ({ ...prev, [universalPath]: { received: 0, total: file.size } }));
            const downloadUrl = `https://huggingface.co/${selectedModel.id}/resolve/main/${file.path}`;
            const res = await window.electron.huggingface.downloadFile(downloadUrl, universalPath, file.size, file.oid);

            setDownloading(prev => {
                const next = { ...prev };
                delete next[universalPath];
                return next;
            });
            if (res.success) { onRefreshModels?.(); }
        } catch (e) { console.error(e); }
    };

    return {
        query, setQuery,
        activeSource, setActiveSource,
        sortBy, setSortBy,
        page, setPage,
        loading, hfResults, totalHf, displayModels,
        selectedModel, setSelectedModel,
        files, loadingFiles,
        downloading, modelsDir,
        pullingOllama,
        isInstalled,
        handleModelSelect, handlePullOllama, handleDownloadHF
    };
}
