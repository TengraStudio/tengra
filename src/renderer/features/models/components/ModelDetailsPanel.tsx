import { BadgeQ } from '@renderer/features/models/components/BadgeQ';
import { HFFile, HFModel, OllamaLibraryModel, UnifiedModel } from '@renderer/features/models/types';
import { formatSize } from '@renderer/features/models/utils/explorer-utils';
import DOMPurify from 'dompurify';
import { Download, Loader2, Server, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import { motion } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';

interface HFPreview {
    requirements?: {
        minRamGB?: number;
        recommendedRamGB?: number;
        minVramGB?: number;
        diskGB?: number;
    };
}

interface HFInstallOptions {
    scheduleAtMs?: number;
    testAfterInstall?: boolean;
    profile?: 'balanced' | 'quality' | 'speed';
}

interface OllamaVersion {
    version: string;
    size: string;
    maxContext: string;
    inputType: string;
    digest: string;
}

interface ModelDetailsPanelProps {
    selectedModel: UnifiedModel;
    setSelectedModel: (model: UnifiedModel | null) => void;
    loadingFiles: boolean;
    files: HFFile[];
    modelsDir: string;
    downloading: { [key: string]: { received: number; total: number } };
    handleDownloadHF: (file: HFFile, options?: HFInstallOptions) => void | Promise<void>;
    handlePullOllama: (modelName: string, tag: string) => void | Promise<void>;
    handleRemoveOllama?: (fullModelName: string) => void | Promise<void>;
    pullingOllama: string | null;
    activeDownloads?: Record<string, { downloadId: string; status: string }>;
    onPauseDownload?: (modelRef: string) => void | Promise<void>;
    onCancelDownload?: (modelRef: string) => void | Promise<void>;
    onResumeDownload?: (modelRef: string) => void | Promise<void>;
    installedOllamaModels?: Set<string>;
    modelPreview?: RendererDataValue;
    isWatchlisted?: boolean;
    toggleWatchlist?: (modelId: string) => void | Promise<void>;
    toggleComparison?: (modelId: string) => void;
    isInComparison?: boolean;
    comparisonCount?: number;
    installTests?: Record<string, { success: boolean; message: string }>;
    lastInstallConfig?: Record<string, HFInstallOptions>;
    t: (key: string, options?: Record<string, string | number>) => string;
}

const sanitizeFileSegment = (value: string): string => value.replace(/[^a-zA-Z0-9._-]/g, '_');
const getHfModelRef = (model: HFModel, file: HFFile): string => `${model.id}/${file.path}`;

const getLegacyHfPathByAuthorName = (model: HFModel, file: HFFile, modelsDir: string): string =>
    `${modelsDir}/${`${model.author}-${model.name}-${file.quantization}.gguf`.replace(/[^a-zA-Z0-9.-]/g, '_').toLowerCase()}`.replace(/\\/g, '/');

const getLegacyHfPathByModelQuant = (model: HFModel, file: HFFile, modelsDir: string): string => {
    const modelSlug = sanitizeFileSegment(model.id.replace(/\//g, '-')).toLowerCase();
    const quant = sanitizeFileSegment(file.quantization || 'gguf').toLowerCase();
    const sourceExtMatch = file.path.match(/(\.[^.\\/]+)$/u);
    const sourceExt = sourceExtMatch ? sourceExtMatch[1].toLowerCase() : '.bin';
    return `${modelsDir}/${modelSlug}-${quant}${sourceExt}`.replace(/\\/g, '/');
};

const getHfDownloadOutputPath = (model: HFModel, file: HFFile, modelsDir: string): string => {
    const modelSlug = sanitizeFileSegment(model.id.replace(/\//g, '-')).toLowerCase();
    const quant = sanitizeFileSegment(file.quantization || 'gguf').toLowerCase();
    const fileSlug = sanitizeFileSegment(file.path.replace(/[\\/]/g, '-').replace(/\.[^.]+$/u, '')).toLowerCase();
    const sourceExtMatch = file.path.match(/(\.[^.\\/]+)$/u);
    const sourceExt = sourceExtMatch ? sourceExtMatch[1].toLowerCase() : '.bin';
    return `${modelsDir}/${modelSlug}-${fileSlug}-${quant}${sourceExt}`.replace(/\\/g, '/');
};

const isOllamaVersionInstalled = (installed: Set<string>, modelName: string, tag: string): boolean => {
    const normalizedName = modelName.trim().toLowerCase();
    const full = `${normalizedName}:${tag.trim().toLowerCase()}`;
    for (const item of installed) {
        const normalized = item.trim().toLowerCase();
        if (normalized === full || normalized === normalizedName) {
            return true;
        }
        if (normalized.startsWith(`${normalizedName}:`) && tag.trim().toLowerCase() === 'latest') {
            return true;
        }
    }
    return false;
};

const HFFileCard: React.FC<{
    file: HFFile;
    model: HFModel;
    downloading: { [key: string]: { received: number; total: number } };
    isDownloaded: boolean;
    activeStatus?: string;
    queuePosition?: number;
    onDownload: () => void;
    onPause?: () => void;
    onResume?: () => void;
    onCancel?: () => void;
    t: (key: string, options?: Record<string, string | number>) => string;
}> = ({ file, model, downloading, isDownloaded, activeStatus, queuePosition, onDownload, onPause, onResume, onCancel, t }) => {
    const modelRef = getHfModelRef(model, file);
    const status = (activeStatus ?? '').toLowerCase();
    const progress = downloading[modelRef];
    const isDownloading = !!progress;
    const isQueued = status === 'queued';
    const isStarting = status === 'starting';
    const isInstalling = status === 'installing';
    const isPaused = status === 'paused';
    const hasActiveTask = isDownloading || isQueued || isStarting || isInstalling || isPaused;
    const showActiveTask = hasActiveTask && !isDownloaded;

    return (
        <div className="p-4 rounded-xl border border-border/50 bg-muted/20 space-y-3">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <BadgeQ quantization={file.quantization} />
                    <span className="text-xs text-muted-foreground truncate">{file.path}</span>
                </div>
                <span className="text-xs font-mono font-bold">{formatSize(file.size)}</span>
            </div>

            {isDownloading && progress.total > 0 && (
                <div className="space-y-1">
                    <div className="flex justify-between text-xxs font-black uppercase tracking-widest text-primary">
                        <span>{t('modelExplorer.downloading')}</span>
                        <span>{Math.round((progress.received / progress.total) * 100)}%</span>
                    </div>
                    <div className="h-2 w-full bg-muted/50 rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${(progress.received / progress.total) * 100}%` }} />
                    </div>
                </div>
            )}

            {!isDownloading && showActiveTask && (
                <div className="text-xxs px-3 py-2 rounded-lg border bg-primary/10 text-primary border-primary/20">
                    {isQueued && (queuePosition ? `${t('common.pending')} #${queuePosition}` : t('common.pending'))}
                    {isStarting && `${t('common.processing')}...`}
                    {isInstalling && `${t('workspaceAgent.toolSummary.editing')}...`}
                    {isPaused && t('workspaceAgent.statePanel.status.paused')}
                </div>
            )}

            {isDownloaded && (
                <div className="text-xxs px-3 py-2 rounded-lg border bg-success/10 text-success border-success/20">
                    {t('modelExplorer.installed')}
                </div>
            )}

            <div className="grid grid-cols-2 gap-2">
                <button
                    onClick={onDownload}
                    disabled={isDownloaded || showActiveTask}
                    className="py-2 rounded-lg bg-foreground text-background text-xxs font-black uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <span className="inline-flex items-center gap-2"><Download className="w-3 h-3" /> {t('modelExplorer.downloadPackage')}</span>
                </button>
                {showActiveTask && (isPaused ? (
                    <button onClick={onResume} className="py-2 rounded-lg border border-border/40 text-xxs font-bold uppercase tracking-wider">{t('common.resume')}</button>
                ) : (
                    <button onClick={onPause} disabled={isStarting || isInstalling} className="py-2 rounded-lg border border-border/40 text-xxs font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed">{t('common.pause')}</button>
                ))}
            </div>
            {showActiveTask && (
                <button onClick={onCancel} className="w-full py-2 rounded-lg border border-destructive/40 text-destructive text-xxs font-bold uppercase tracking-wider">
                    {t('common.cancel')}
                </button>
            )}
        </div>
    );
};

export const ModelDetailsPanel: React.FC<ModelDetailsPanelProps> = ({
    selectedModel,
    setSelectedModel,
    loadingFiles,
    files,
    modelsDir,
    downloading,
    handleDownloadHF,
    handlePullOllama,
    handleRemoveOllama,
    pullingOllama,
    activeDownloads,
    onPauseDownload,
    onCancelDownload,
    onResumeDownload,
    installedOllamaModels,
    modelPreview,
    t,
}) => {
    const isHF = selectedModel.provider === 'huggingface';
    const hfModel = isHF ? (selectedModel as HFModel) : null;
    const ollamaModel = !isHF ? (selectedModel as OllamaLibraryModel) : null;
    const preview = (modelPreview ?? null) as HFPreview | null;

    const [downloadedFilePaths, setDownloadedFilePaths] = useState<Record<string, boolean>>({});
    const [ollamaPage, setOllamaPage] = useState(1);
    const OLLAMA_ROWS_PER_PAGE = 8;

    const [prevSelectedModel, setPrevSelectedModel] = useState(selectedModel);
    if (selectedModel !== prevSelectedModel) {
        setPrevSelectedModel(selectedModel);
        setOllamaPage(1);
    }

    const queuedOrderByModelRef = useMemo(() => {
        const entries = Object.entries(activeDownloads ?? {})
            .filter(([, task]) => (task?.status || '').toLowerCase() === 'queued')
            .map(([modelRef], index) => [modelRef, index + 1] as const);
        return Object.fromEntries(entries) as Record<string, number>;
    }, [activeDownloads]);

    const currentKey = `${isHF}-${hfModel?.id}-${modelsDir}-${files.length}`;
    const [prevHfKey, setPrevHfKey] = useState(currentKey);

    if (currentKey !== prevHfKey) {
        setPrevHfKey(currentKey);
        if (!isHF || !hfModel || !modelsDir || files.length === 0) {
            setDownloadedFilePaths({});
        }
    }

    useEffect(() => {
        let cancelled = false;

        // Skip if conditions aren't met
        if (!isHF || !hfModel || !modelsDir || files.length === 0) {
            return;
        }

        void (async () => {
            const checks = await Promise.all(files.map(async (file) => {
                try {
                    const candidates = [
                        getHfDownloadOutputPath(hfModel, file, modelsDir),
                        getLegacyHfPathByAuthorName(hfModel, file, modelsDir),
                        getLegacyHfPathByModelQuant(hfModel, file, modelsDir),
                    ];
                    for (const p of candidates) {
                        if (await window.electron.files.exists(p)) {
                            return [file.path, true] as const;
                        }
                    }
                    return [file.path, false] as const;
                } catch {
                    return [file.path, false] as const;
                }
            }));
            if (!cancelled) {
                setDownloadedFilePaths(Object.fromEntries(checks));
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [isHF, hfModel, modelsDir, files]);

    const hfShardGroups = useMemo(() => {
        if (!isHF || !hfModel) {
            return [];
        }
        const groups = new Map<string, { key: string; displayName: string; totalParts: number; files: HFFile[] }>();
        for (const file of files) {
            const fileName = file.path.split('/').pop() || file.path;
            const match = fileName.match(/^(.*)-(\d{5})-of-(\d{5})(\.[^.]+)$/i);
            if (!match) {
                continue;
            }
            const [, baseName, , totalRaw, ext] = match;
            const totalParts = Number.parseInt(totalRaw, 10);
            const key = `${baseName}|${totalParts}|${ext.toLowerCase()}`;
            const current = groups.get(key);
            if (current) {
                current.files.push(file);
            } else {
                groups.set(key, {
                    key,
                    displayName: `${baseName}${ext}`,
                    totalParts,
                    files: [file]
                });
            }
        }
        return Array.from(groups.values()).map((group) => ({
            ...group,
            files: [...group.files].sort((a, b) => a.path.localeCompare(b.path))
        }));
    }, [isHF, hfModel, files]);

    const downloadFullShardSet = async (groupFiles: HFFile[]) => {
        for (const file of groupFiles) {
            const alreadyDownloaded = downloadedFilePaths[file.path] === true;
            const modelRef = hfModel ? getHfModelRef(hfModel, file) : '';
            const inProgress = !!modelRef && modelRef in downloading;
            if (!alreadyDownloaded && !inProgress) {
                await handleDownloadHF(file);
            }
        }
    };

    const ollamaVersions: OllamaVersion[] = useMemo(() => {
        if (!ollamaModel) {
            return [];
        }
        if (Array.isArray(ollamaModel.versions) && ollamaModel.versions.length > 0) {
            return ollamaModel.versions;
        }
        return (ollamaModel.tags || []).map(tag => ({
            version: tag,
            size: '-',
            maxContext: '-',
            inputType: '-',
            digest: '-'
        }));
    }, [ollamaModel]);

    const sanitizedOllamaDescriptionHtml = useMemo(() => {
        if (!ollamaModel?.longDescriptionHtml) {
            return '';
        }
        return DOMPurify.sanitize(ollamaModel.longDescriptionHtml, {
            USE_PROFILES: { html: true },
            ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|\/|#)/i,
        });
    }, [ollamaModel]);

    const ollamaTotalPages = Math.max(1, Math.ceil(ollamaVersions.length / OLLAMA_ROWS_PER_PAGE));
    const safeOllamaPage = Math.min(ollamaPage, ollamaTotalPages);
    const pagedOllamaVersions = useMemo(() => {
        const start = (safeOllamaPage - 1) * OLLAMA_ROWS_PER_PAGE;
        return ollamaVersions.slice(start, start + OLLAMA_ROWS_PER_PAGE);
    }, [ollamaVersions, safeOllamaPage]);

    return (
        <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 360, damping: 36 }}
            className="w-1/2 max-w-5xl min-w-96 border-l border-border/50 bg-card/60 backdrop-blur-2xl flex flex-col relative z-40"
        >
            <div className="p-6 border-b border-border/50 flex items-center justify-between bg-muted/30">
                <h2 className="font-black truncate pr-4 text-lg">{isHF ? hfModel?.name : ollamaModel?.name}</h2>
                <button onClick={() => setSelectedModel(null)} className="p-2 hover:bg-muted/40 rounded-xl transition-all active:scale-90">
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="p-6 border-b border-border/50 space-y-3 bg-muted/30">
                <div className="text-xxs uppercase tracking-widest text-muted-foreground">{isHF ? t('modelExplorer.sourceHuggingFace') : t('modelExplorer.ollamaLibrary')}</div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    {selectedModel.description || t('modelExplorer.defaultDescription')}
                </p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-lg border border-border/30 p-3">
                        <div className="text-muted-foreground">{t('modelExplorer.provider')}</div>
                        <div className="font-bold uppercase">{selectedModel.provider}</div>
                    </div>
                    <div className="rounded-lg border border-border/30 p-3">
                        <div className="text-muted-foreground">{t('modelExplorer.updated')}</div>
                        <div className="font-bold">
                            {isHF ? hfModel?.lastModified?.split('T')[0] : (ollamaModel?.lastUpdated || '-')}
                        </div>
                    </div>
                    <div className="rounded-lg border border-border/30 p-3">
                        <div className="text-muted-foreground">{t('modelExplorer.popularity')}</div>
                        <div className="font-bold">{isHF ? (hfModel?.downloads?.toLocaleString() || '0') : (ollamaModel?.pulls || '-')}</div>
                    </div>
                    <div className="rounded-lg border border-border/30 p-3">
                        <div className="text-muted-foreground">{t('modelExplorer.diskRam')}</div>
                        <div className="font-bold">{preview?.requirements?.diskGB ? `${preview.requirements.diskGB}GB` : '-'}</div>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {isHF ? (
                    <>
                        {'longDescriptionMarkdown' in selectedModel && selectedModel.longDescriptionMarkdown && (
                            <div className="rounded-xl border border-border/40 bg-muted/10 p-4">
                                <h3 className="text-xxs font-black uppercase tracking-widest text-muted-foreground mb-2">{t('common.details')}</h3>
                                <div className="text-sm whitespace-pre-wrap leading-relaxed">{selectedModel.longDescriptionMarkdown}</div>
                            </div>
                        )}

                        <div className="space-y-3">
                            <h3 className="text-xxs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                <Server className="w-4 h-4" /> {t('modelExplorer.pullVersion')}
                            </h3>

                            {loadingFiles ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-7 h-7 animate-spin text-primary" />
                                </div>
                            ) : (
                                <>
                                    {hfShardGroups.length > 0 && (
                                        <div className="space-y-2 rounded-xl border border-border/40 bg-muted/10 p-3">
                                            <div className="text-xxs font-black uppercase tracking-widest text-muted-foreground">{t('modelExplorer.shardedModelSets')}</div>
                                            {hfShardGroups.map((group) => {
                                                const downloadedCount = group.files.filter((f) => downloadedFilePaths[f.path]).length;
                                                const progressPct = Math.round((downloadedCount / group.totalParts) * 100);
                                                return (
                                                    <div key={group.key} className="rounded-lg border border-border/40 bg-background/60 p-3 space-y-2">
                                                        <div className="flex items-center justify-between text-xxs">
                                                            <div className="font-semibold truncate">{group.displayName}</div>
                                                            <div className="text-muted-foreground">{downloadedCount}/{group.totalParts}</div>
                                                        </div>
                                                        <div className="h-2 w-full bg-muted/50 rounded-full overflow-hidden">
                                                            <div className="h-full bg-primary" style={{ width: `${progressPct}%` }} />
                                                        </div>
                                                        <button
                                                            onClick={() => void downloadFullShardSet(group.files)}
                                                            disabled={downloadedCount >= group.totalParts}
                                                            className={cn('w-full py-2 rounded-lg text-xxs font-black uppercase tracking-wider', downloadedCount >= group.totalParts ? 'bg-success/15 text-success border border-success/30' : 'bg-foreground text-background')}
                                                        >
                                                            {downloadedCount >= group.totalParts ? t('modelExplorer.fullSetDownloaded') : t('modelExplorer.downloadMissingParts')}
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {files.map((file) => {
                                        const modelRef = getHfModelRef(hfModel as HFModel, file);
                                        const activeTask = activeDownloads?.[modelRef];
                                        return (
                                            <HFFileCard
                                                key={file.path}
                                                file={file}
                                                model={hfModel as HFModel}
                                                downloading={downloading}
                                                isDownloaded={downloadedFilePaths[file.path] === true}
                                                activeStatus={activeTask?.status}
                                                queuePosition={queuedOrderByModelRef[modelRef]}
                                                onDownload={() => void handleDownloadHF(file)}
                                                onPause={() => void onPauseDownload?.(modelRef)}
                                                onResume={() => void onResumeDownload?.(modelRef)}
                                                onCancel={() => void onCancelDownload?.(modelRef)}
                                                t={t}
                                            />
                                        );
                                    })}

                                    {files.length === 0 && (
                                        <div className="text-center text-xs text-muted-foreground/50 py-10 border-2 border-dashed border-border/20 rounded-2xl">
                                            {t('modelExplorer.noCompatible')}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        {sanitizedOllamaDescriptionHtml && (
                            <div className="rounded-xl border border-border/40 bg-muted/10 p-4">
                                <h3 className="text-xxs font-black uppercase tracking-widest text-muted-foreground mb-2">{t('common.details')}</h3>
                                <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: sanitizedOllamaDescriptionHtml }} />
                            </div>
                        )}

                        <div className="space-y-3">
                            <h3 className="text-xxs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                <Server className="w-4 h-4" /> {t('modelExplorer.availableVersions')}
                            </h3>

                            <div className="rounded-xl border border-border/40 overflow-hidden">
                                <table className="w-full text-xs">
                                    <thead className="bg-muted/30">
                                        <tr className="text-left">
                                            <th className="px-3 py-2">{t('common.version')}</th>
                                            <th className="px-3 py-2">{t('common.size')}</th>
                                            <th className="px-3 py-2">{t('modelExplorer.context')}</th>
                                            <th className="px-3 py-2">{t('common.type')}</th>
                                            <th className="px-3 py-2">{t('modelExplorer.digest')}</th>
                                            <th className="px-3 py-2">{t('modelExplorer.action')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pagedOllamaVersions.map((v) => {
                                            const versionTag = v.version.includes(':') ? v.version.split(':').slice(1).join(':') : v.version;
                                            const fullModelName = `${ollamaModel?.name}:${versionTag}`;
                                            const installed = isOllamaVersionInstalled(installedOllamaModels ?? new Set(), ollamaModel?.name || '', versionTag || 'latest');
                                            const isPulling = pullingOllama === fullModelName;
                                            return (
                                                <tr key={v.version} className="border-t border-border/30">
                                                    <td className="px-3 py-2 font-mono">{v.version}</td>
                                                    <td className="px-3 py-2">{v.size || '-'}</td>
                                                    <td className="px-3 py-2">{v.maxContext || '-'}</td>
                                                    <td className="px-3 py-2">{v.inputType || '-'}</td>
                                                    <td className="px-3 py-2 font-mono">{v.digest || '-'}</td>
                                                    <td className="px-3 py-2">
                                                        {installed ? (
                                                            <button
                                                                onClick={() => void handleRemoveOllama?.(fullModelName)}
                                                                className="px-2 py-1 rounded-md border border-destructive/40 text-destructive font-bold"
                                                            >
                                                                {t('common.delete')}
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => void handlePullOllama(ollamaModel?.name || '', versionTag || 'latest')}
                                                                disabled={!!pullingOllama}
                                                                className="px-2 py-1 rounded-md bg-foreground text-background font-bold disabled:opacity-50"
                                                            >
                                                                {isPulling ? `${t('modelExplorer.pulling')}...` : t('modelExplorer.pullVersion')}
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {ollamaTotalPages > 1 && (
                                <div className="flex items-center justify-center gap-2">
                                    <button
                                        onClick={() => setOllamaPage(p => Math.max(1, p - 1))}
                                        disabled={safeOllamaPage <= 1}
                                        className="px-3 py-1 rounded-md border border-border/40 disabled:opacity-50"
                                    >
                                        {t('common.previous')}
                                    </button>
                                    <span className="text-xs text-muted-foreground">
                                        {t('common.pageOf', { current: safeOllamaPage, total: ollamaTotalPages })}
                                    </span>
                                    <button
                                        onClick={() => setOllamaPage(p => Math.min(ollamaTotalPages, p + 1))}
                                        disabled={safeOllamaPage >= ollamaTotalPages}
                                        className="px-3 py-1 rounded-md border border-border/40 disabled:opacity-50"
                                    >
                                        {t('common.next')}
                                    </button>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </motion.div>
    );
};
