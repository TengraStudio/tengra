import { BadgeQ } from '@renderer/features/models/components/BadgeQ';
import { HFFile, HFModel, OllamaLibraryModel, UnifiedModel } from '@renderer/features/models/types';
import { formatSize } from '@renderer/features/models/utils/explorer-utils';
import { Database, Download, GitCompare, Loader2, Server, Star, TestTube2, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import { motion } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';

interface HFPreview {
    benchmark?: {
        quality?: number;
        speed?: number;
        memoryEfficiency?: number;
    };
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

interface HFVersionRecord {
    versionId: string;
    modelId: string;
    path: string;
    createdAt: number;
    notes?: string;
    pinned?: boolean;
}

interface HFFineTuneJob {
    id: string;
    modelId: string;
    datasetPath: string;
    outputPath: string;
    status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
    progress: number;
    startedAt: number;
    updatedAt: number;
    epochs: number;
    learningRate: number;
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
    pullingOllama: string | null;
    modelPreview?: unknown;
    isWatchlisted?: boolean;
    toggleWatchlist?: (modelId: string) => void | Promise<void>;
    toggleComparison?: (modelId: string) => void;
    isInComparison?: boolean;
    comparisonCount?: number;
    installTests?: Record<string, { success: boolean; message: string }>;
    lastInstallConfig?: Record<string, HFInstallOptions>;
    t: (key: string) => string;
}

const getInstallPath = (model: HFModel, file: HFFile, modelsDir: string): string => {
    const safeName = `${model.author}-${model.name}-${file.quantization}.gguf`
        .replace(/[^a-zA-Z0-9.-]/g, '_')
        .toLowerCase();
    return `${modelsDir}/${safeName}`.replace(/\\/g, '/');
};

const HFMetadata: React.FC<{ model: HFModel; t: (key: string, options?: Record<string, string | number>) => string }> = ({ model, t }) => (
    <div className="flex items-center gap-2 text-xxs font-black uppercase tracking-widest text-muted-foreground">
        <span className="text-foreground">{model.author}</span>
        <span className="opacity-30 px-1">•</span>
        <span>{t('modelExplorer.likes', { count: model.likes })}</span>
        <span className="opacity-30 px-1">•</span>
        <span>{model.lastModified.split('T')[0]}</span>
    </div>
);

const OllamaMetadata: React.FC<{ t: (key: string) => string }> = ({ t }) => (
    <div className="flex items-center gap-2 text-xxs font-black uppercase tracking-widest text-muted-foreground">
        <span className="text-foreground">{t('modelExplorer.ollamaLibrary')}</span>
    </div>
);

const MetadataGrid: React.FC<{ model: UnifiedModel; t: (key: string) => string }> = ({ model, t }) => {
    const isOllama = model.provider === 'ollama';
    const modelName = isOllama ? (model as OllamaLibraryModel).name : (model as HFModel).name;

    const architecture = isOllama
        ? (modelName.toLowerCase().includes('llama') ? t('modelExplorer.architectureLlama3') : t('modelExplorer.architectureTransformer'))
        : t('modelExplorer.architectureGguf');

    const context = isOllama
        ? (modelName.includes('3.2') || modelName.includes('3.1') ? t('modelExplorer.context128k') : t('modelExplorer.context8k'))
        : t('modelExplorer.contextVariable');

    const updated = isOllama ? t('modelExplorer.updatedLibraryLatest') : (model as HFModel).lastModified.split('T')[0];

    return (
        <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/10 border border-border/30 rounded-2xl p-4 flex flex-col gap-1">
                <span className="text-xxxs font-black uppercase tracking-[0.2em] text-muted-foreground/60">{t('modelExplorer.architecture')}</span>
                <span className="text-xs font-bold text-foreground">{architecture}</span>
            </div>
            <div className="bg-muted/10 border border-border/30 rounded-2xl p-4 flex flex-col gap-1">
                <span className="text-xxxs font-black uppercase tracking-[0.2em] text-muted-foreground/60">{t('modelExplorer.context')}</span>
                <span className="text-xs font-bold text-foreground">{context}</span>
            </div>
            <div className="bg-muted/10 border border-border/30 rounded-2xl p-4 flex flex-col gap-1">
                <span className="text-xxxs font-black uppercase tracking-[0.2em] text-muted-foreground/60">{t('modelExplorer.updated')}</span>
                <span className="text-xs font-bold text-foreground">{updated}</span>
            </div>
            <div className="bg-muted/10 border border-border/30 rounded-2xl p-4 flex flex-col gap-1">
                <span className="text-xxxs font-black uppercase tracking-[0.2em] text-muted-foreground/60">{t('modelExplorer.provider')}</span>
                <span className="text-xs font-bold text-foreground uppercase">{model.provider}</span>
            </div>
        </div>
    );
};

const HardwareStats: React.FC<{ model: UnifiedModel; t: (key: string) => string; preview: HFPreview | null }> = ({ model, t, preview }) => {
    const isOllama = model.provider === 'ollama';
    const modelName = isOllama ? (model as OllamaLibraryModel).name : '';

    const minVram = isOllama
        ? (modelName.includes('70b') ? '~40GB' : modelName.includes('13b') ? '~10GB' : '~6GB')
        : `${preview?.requirements?.minVramGB ?? 8}GB`;

    const systemRam = isOllama
        ? (modelName.includes('70b') ? '64GB+' : '16GB+')
        : `${preview?.requirements?.recommendedRamGB ?? 16}GB`;

    return (
        <div className="p-6 rounded-2xl bg-primary/5 border border-primary/20 space-y-4">
            <h3 className="text-xxs font-black uppercase tracking-[0.3em] text-primary flex items-center gap-3">
                <Database className="w-4 h-4" /> {t('modelExplorer.hardwareReq')}
            </h3>
            <div className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">{t('modelExplorer.minVram')}</span>
                    <span className="font-mono font-bold text-primary">{minVram}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">{t('modelExplorer.systemRam')}</span>
                    <span className="font-mono font-bold text-foreground">{systemRam}</span>
                </div>
                {preview?.requirements?.diskGB && (
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground">Disk</span>
                        <span className="font-mono font-bold text-foreground">{preview.requirements.diskGB}GB</span>
                    </div>
                )}
            </div>
        </div>
    );
};

const HFFileItem: React.FC<{
    file: HFFile;
    model: HFModel;
    modelsDir: string;
    downloading: { [key: string]: { received: number; total: number } };
    handleDownloadHF: (file: HFFile, options?: HFInstallOptions) => void | Promise<void>;
    testResult?: { success: boolean; message: string };
}> = ({ file, model, modelsDir, downloading, handleDownloadHF, testResult }) => {
    const [showWizard, setShowWizard] = useState(false);
    const [profile, setProfile] = useState<'balanced' | 'quality' | 'speed'>('balanced');
    const [schedule, setSchedule] = useState<'now' | 'night'>('now');
    const [testAfterInstall, setTestAfterInstall] = useState(true);
    const universalPath = getInstallPath(model, file, modelsDir);
    const isRecommendation = file.quantization.includes('Q4_K_M') || file.quantization.includes('Q5_K_M');
    const isDownloading = universalPath in downloading;

    const scheduleAtMs = useMemo(() => {
        if (schedule === 'now') {
            return undefined;
        }
        const date = new Date();
        date.setHours(2, 0, 0, 0);
        if (date.getTime() <= Date.now()) {
            date.setDate(date.getDate() + 1);
        }
        return date.getTime();
    }, [schedule]);

    const install = () => {
        void handleDownloadHF(file, { profile, scheduleAtMs, testAfterInstall });
    };

    return (
        <div className={cn('p-5 rounded-2xl border transition-all duration-300 group', isRecommendation ? 'border-primary/40 bg-primary/10 shadow-lg shadow-primary/5' : 'border-border/50 bg-muted/20 hover:border-primary/40 hover:bg-muted/40')}>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                    <BadgeQ quantization={file.quantization} />
                    {isRecommendation && <span className="text-xxxs bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-black tracking-widest uppercase">Best</span>}
                </div>
                <span className="text-xs text-foreground font-black font-mono">{formatSize(file.size)}</span>
            </div>
            <div className="text-xxs text-muted-foreground/50 mb-4 truncate font-mono">{file.path}</div>
            {file.compatibility && (
                <div className={cn('text-xxs mb-3 px-3 py-2 rounded-lg border', file.compatibility.compatible ? 'bg-success/10 text-success border-success/20' : 'bg-warning/10 text-warning border-warning/20')}>
                    {file.compatibility.compatible
                        ? `Compatible • ~${file.compatibility.estimatedRamGB}GB RAM`
                        : file.compatibility.reasons.join(' | ')}
                </div>
            )}
            {testResult && (
                <div className={cn('text-xxs mb-3 px-3 py-2 rounded-lg border', testResult.success ? 'bg-success/10 text-success border-success/20' : 'bg-destructive/10 text-destructive border-destructive/20')}>
                    <TestTube2 className="w-3 h-3 inline mr-1" />
                    {testResult.message}
                </div>
            )}
            {isDownloading ? (
                <div className="space-y-2">
                    <div className="flex justify-between text-xxs font-black uppercase tracking-widest text-primary">
                        <span>Downloading</span>
                        <span>{Math.round((downloading[universalPath].received / downloading[universalPath].total) * 100)}%</span>
                    </div>
                    <div className="h-2 w-full bg-muted/50 rounded-full overflow-hidden">
                        <div className="h-full bg-primary transition-all duration-500 shadow-[0_0_15px_hsl(var(--primary)/0.5)]" style={{ width: `${(downloading[universalPath].received / downloading[universalPath].total) * 100}%` }} />
                    </div>
                </div>
            ) : (
                <div className="space-y-2">
                    <button
                        onClick={() => void handleDownloadHF(file)}
                        className="w-full py-3 bg-foreground text-background text-xxs font-black uppercase tracking-widest rounded-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 shadow-lg group-hover:shadow-primary/20"
                    >
                        <Download className="w-4 h-4" /> Quick Install
                    </button>
                    <button
                        onClick={() => setShowWizard(v => !v)}
                        className="w-full py-2 border border-border/40 text-xxs font-bold uppercase tracking-wider rounded-xl hover:bg-muted/40 transition-colors"
                    >
                        {showWizard ? 'Hide Wizard' : 'Installation Wizard'}
                    </button>
                    {showWizard && (
                        <div className="rounded-xl border border-border/40 bg-background/60 p-3 space-y-3">
                            <div className="grid grid-cols-2 gap-2 text-xxs">
                                <label className="space-y-1">
                                    <span className="text-muted-foreground">Profile</span>
                                    <select value={profile} onChange={e => setProfile(e.target.value as 'balanced' | 'quality' | 'speed')} className="w-full rounded-md bg-muted/30 border border-border/40 px-2 py-1">
                                        <option value="balanced">Balanced</option>
                                        <option value="quality">Quality</option>
                                        <option value="speed">Speed</option>
                                    </select>
                                </label>
                                <label className="space-y-1">
                                    <span className="text-muted-foreground">Schedule</span>
                                    <select value={schedule} onChange={e => setSchedule(e.target.value as 'now' | 'night')} className="w-full rounded-md bg-muted/30 border border-border/40 px-2 py-1">
                                        <option value="now">Install now</option>
                                        <option value="night">Tonight 02:00</option>
                                    </select>
                                </label>
                            </div>
                            <label className="flex items-center gap-2 text-xxs">
                                <input type="checkbox" checked={testAfterInstall} onChange={e => setTestAfterInstall(e.target.checked)} />
                                Run GGUF test after download
                            </label>
                            <button onClick={install} className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-xxs font-black uppercase tracking-wider">
                                Apply Configuration & Install
                            </button>
                        </div>
                    )}
                </div>
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
    pullingOllama,
    modelPreview,
    isWatchlisted = false,
    toggleWatchlist,
    toggleComparison,
    isInComparison = false,
    comparisonCount = 0,
    installTests = {},
    lastInstallConfig = {},
    t
}) => {
    const isHF = selectedModel.provider === 'huggingface';
    const hfModel = isHF ? selectedModel as HFModel : null;
    const preview = (modelPreview ?? null) as HFPreview | null;
    const [conversionPreset, setConversionPreset] = useState<'balanced' | 'quality' | 'speed' | 'tiny'>('balanced');
    const [conversionQuantization, setConversionQuantization] = useState<'F16' | 'Q8_0' | 'Q6_K' | 'Q5_K_M' | 'Q4_K_M'>('Q4_K_M');
    const [conversionSourcePath, setConversionSourcePath] = useState('');
    const [conversionOutputPath, setConversionOutputPath] = useState('');
    const [conversionProgress, setConversionProgress] = useState<{ stage: string; percent: number; message: string } | null>(null);
    const [conversionStatus, setConversionStatus] = useState<{ success: boolean; message: string } | null>(null);
    const [conversionLoading, setConversionLoading] = useState(false);
    const [optimizationSuggestions, setOptimizationSuggestions] = useState<string[]>([]);
    const [versions, setVersions] = useState<HFVersionRecord[]>([]);
    const [versionNotes, setVersionNotes] = useState('');
    const [selectedVersionA, setSelectedVersionA] = useState('');
    const [selectedVersionB, setSelectedVersionB] = useState('');
    const [versionCompareResult, setVersionCompareResult] = useState<unknown>(null);
    const [versionNotifications, setVersionNotifications] = useState<string[]>([]);
    const [datasetInputPath, setDatasetInputPath] = useState('');
    const [datasetOutputPath, setDatasetOutputPath] = useState('');
    const [preparedDatasetInfo, setPreparedDatasetInfo] = useState<{ outputPath: string; records: number } | null>(null);
    const [fineTuneJobs, setFineTuneJobs] = useState<HFFineTuneJob[]>([]);
    const [activeFineTuneJob, setActiveFineTuneJob] = useState<HFFineTuneJob | null>(null);
    const [fineTuneStatus, setFineTuneStatus] = useState<string>('');

    useEffect(() => {
        if (!isHF || !hfModel) {
            return;
        }
        setConversionSourcePath('');
        if (modelsDir) {
            setConversionOutputPath(`${modelsDir}/${hfModel.author}-${hfModel.name}-converted.gguf`.replace(/[^a-zA-Z0-9./_-]/g, '_'));
            setDatasetOutputPath(`${modelsDir}/${hfModel.author}-${hfModel.name}-dataset.jsonl`.replace(/[^a-zA-Z0-9./_-]/g, '_'));
        }
    }, [hfModel, isHF, modelsDir]);

    useEffect(() => {
        const unsubscribe = window.electron.huggingface.onConversionProgress((progress) => {
            setConversionProgress(progress);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!isHF || !hfModel) {
            return;
        }
        void window.electron.huggingface.getModelVersions(hfModel.id).then((list) => {
            setVersions(list as HFVersionRecord[]);
            if (list.length > 0) {
                setSelectedVersionA(list[0].versionId);
                setSelectedVersionB(list.length > 1 ? list[1].versionId : list[0].versionId);
            }
        });
        void window.electron.huggingface.getVersionNotifications(hfModel.id).then(setVersionNotifications);
        void window.electron.huggingface.listFineTuneJobs(hfModel.id).then((jobs) => {
            setFineTuneJobs(jobs as HFFineTuneJob[]);
            setActiveFineTuneJob((jobs[0] as HFFineTuneJob | undefined) ?? null);
        });
        const unsubscribe = window.electron.huggingface.onFineTuneProgress((job) => {
            const typed = job as HFFineTuneJob;
            if (typed.modelId !== hfModel.id) {
                return;
            }
            setFineTuneJobs(prev => {
                const rest = prev.filter(j => j.id !== typed.id);
                return [typed, ...rest].sort((a, b) => b.updatedAt - a.updatedAt);
            });
            setActiveFineTuneJob(typed);
            setFineTuneStatus(`Fine-tuning ${typed.status} (${typed.progress}%)`);
        });
        return () => unsubscribe();
    }, [hfModel, isHF]);

    const runConversion = async () => {
        if (!hfModel) {
            return;
        }
        setConversionLoading(true);
        setConversionStatus(null);
        setConversionProgress({ stage: 'validate', percent: 0, message: 'Validating conversion request' });
        try {
            const payload = {
                sourcePath: conversionSourcePath,
                outputPath: conversionOutputPath,
                quantization: conversionQuantization,
                preset: conversionPreset,
                modelId: hfModel.id
            };
            const validation = await window.electron.huggingface.validateConversion(payload);
            if (!validation.valid) {
                setConversionStatus({ success: false, message: validation.errors.join(' | ') });
                setConversionLoading(false);
                return;
            }
            const suggestions = await window.electron.huggingface.getOptimizationSuggestions(payload);
            setOptimizationSuggestions(suggestions);
            const result = await window.electron.huggingface.convertModel(payload);
            if (result.success) {
                setConversionStatus({
                    success: true,
                    message: result.warnings && result.warnings.length > 0
                        ? `Completed with warnings: ${result.warnings.join(' | ')}`
                        : 'Conversion completed successfully'
                });
            } else {
                setConversionStatus({ success: false, message: result.error || 'Conversion failed' });
            }
        } catch (error) {
            setConversionStatus({
                success: false,
                message: error instanceof Error ? error.message : String(error)
            });
        } finally {
            setConversionLoading(false);
        }
    };

    const refreshVersions = async () => {
        if (!hfModel) {
            return;
        }
        const list = await window.electron.huggingface.getModelVersions(hfModel.id);
        setVersions(list as HFVersionRecord[]);
        const notices = await window.electron.huggingface.getVersionNotifications(hfModel.id);
        setVersionNotifications(notices);
    };

    const registerCurrentAsVersion = async () => {
        if (!hfModel || !conversionOutputPath) {
            return;
        }
        await window.electron.huggingface.registerModelVersion(hfModel.id, conversionOutputPath, versionNotes || undefined);
        setVersionNotes('');
        await refreshVersions();
    };

    const compareVersions = async () => {
        if (!hfModel || !selectedVersionA || !selectedVersionB) {
            return;
        }
        const result = await window.electron.huggingface.compareModelVersions(hfModel.id, selectedVersionA, selectedVersionB);
        setVersionCompareResult(result);
    };

    const rollbackVersion = async (versionId: string) => {
        if (!hfModel || !conversionOutputPath) {
            return;
        }
        const result = await window.electron.huggingface.rollbackModelVersion(hfModel.id, versionId, conversionOutputPath);
        setVersionCompareResult(result);
        await refreshVersions();
    };

    const togglePinVersion = async (version: HFVersionRecord) => {
        if (!hfModel) {
            return;
        }
        await window.electron.huggingface.pinModelVersion(hfModel.id, version.versionId, !version.pinned);
        await refreshVersions();
    };

    const prepareDataset = async () => {
        const result = await window.electron.huggingface.prepareFineTuneDataset(datasetInputPath, datasetOutputPath);
        if (result.success) {
            setPreparedDatasetInfo({ outputPath: result.outputPath, records: result.records });
            setFineTuneStatus(`Dataset ready (${result.records} records)`);
        } else {
            setFineTuneStatus(result.error || 'Dataset preparation failed');
        }
    };

    const startFineTuning = async () => {
        if (!hfModel || !preparedDatasetInfo) {
            return;
        }
        const result = await window.electron.huggingface.startFineTune(
            hfModel.id,
            preparedDatasetInfo.outputPath,
            conversionOutputPath.replace(/\.gguf$/i, '.finetuned.gguf'),
            { epochs: 3, learningRate: 0.0001 }
        );
        if (result) {
            setActiveFineTuneJob(result as HFFineTuneJob);
            setFineTuneStatus('Fine-tuning started');
        }
        const jobs = await window.electron.huggingface.listFineTuneJobs(hfModel.id);
        setFineTuneJobs(jobs as HFFineTuneJob[]);
    };

    const evaluateActiveJob = async () => {
        if (!activeFineTuneJob) {
            return;
        }
        const result = await window.electron.huggingface.evaluateFineTuneJob(activeFineTuneJob.id) as { success?: boolean; metrics?: Record<string, number>; error?: string };
        if (result.success) {
            setFineTuneStatus(`Eval: ${JSON.stringify(result.metrics)}`);
        } else {
            setFineTuneStatus(result.error || 'Evaluation failed');
        }
    };

    const exportActiveJob = async () => {
        if (!activeFineTuneJob || !modelsDir) {
            return;
        }
        const exportPath = `${modelsDir}/${hfModel?.author ?? 'hf'}-${hfModel?.name ?? 'model'}-finetune-export.json`.replace(/[^a-zA-Z0-9./_-]/g, '_');
        const result = await window.electron.huggingface.exportFineTunedModel(activeFineTuneJob.id, exportPath);
        setFineTuneStatus(result.success ? `Exported: ${exportPath}` : (result.error || 'Export failed'));
    };

    return (
        <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 40 }}
            className="w-[450px] border-l border-border/50 bg-card/60 backdrop-blur-2xl flex flex-col shadow-[-20px_0_50px_rgba(0,0,0,0.2)] relative z-40"
        >
            <div className="p-6 border-b border-border/50 flex items-center justify-between bg-white/5">
                <h2 className="font-black truncate pr-4 text-lg">
                    {selectedModel.provider === 'ollama' ? (selectedModel as OllamaLibraryModel).name : (selectedModel as HFModel).name}
                </h2>
                <div className="flex items-center gap-2">
                    {isHF && toggleComparison && hfModel && (
                        <button
                            onClick={() => toggleComparison(hfModel.id)}
                            className={cn('p-2 rounded-xl transition-all active:scale-90 shadow-sm border', isInComparison ? 'bg-info/15 border-info/30 text-info' : 'hover:bg-white/10 border-transparent hover:border-white/10')}
                            title={isInComparison ? 'Remove from comparison' : 'Add to comparison'}
                        >
                            <GitCompare className="w-5 h-5" />
                        </button>
                    )}
                    {isHF && toggleWatchlist && hfModel && (
                        <button
                            onClick={() => void toggleWatchlist(hfModel.id)}
                            className={cn('p-2 rounded-xl transition-all active:scale-90 shadow-sm border', isWatchlisted ? 'bg-warning/15 border-warning/30 text-warning' : 'hover:bg-white/10 border-transparent hover:border-white/10')}
                            title={isWatchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
                        >
                            <Star className="w-5 h-5" />
                        </button>
                    )}
                    <button onClick={() => setSelectedModel(null)} className="p-2 hover:bg-white/10 rounded-xl transition-all active:scale-90 shadow-sm border border-transparent hover:border-white/10">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="p-8 space-y-4 border-b border-border/50 bg-white/5">
                {isHF && hfModel ? <HFMetadata model={hfModel} t={t} /> : <OllamaMetadata t={t} />}
                <p className="text-sm text-muted-foreground leading-relaxed max-h-[120px] overflow-y-auto pr-4 scrollbar-thin">
                    {selectedModel.description || t('modelExplorer.defaultDescription')}
                </p>
                {isHF && (
                    <div className="flex items-center gap-2 text-xxs text-muted-foreground">
                        <GitCompare className="w-3 h-3" />
                        <span>{comparisonCount} model(s) in comparison list</span>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-thin">
                <MetadataGrid model={selectedModel} t={t} />
                <HardwareStats model={selectedModel} t={t} preview={preview} />

                {isHF && preview?.benchmark && (
                    <div className="p-6 rounded-2xl bg-muted/15 border border-border/40 space-y-2">
                        <h3 className="text-xxs font-black uppercase tracking-[0.3em] text-primary">Benchmarks</h3>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                            <div className="rounded-lg bg-background/60 border border-border/30 p-3">
                                <div className="text-muted-foreground">Quality</div>
                                <div className="font-black">{String(preview.benchmark.quality ?? '-')}</div>
                            </div>
                            <div className="rounded-lg bg-background/60 border border-border/30 p-3">
                                <div className="text-muted-foreground">Speed</div>
                                <div className="font-black">{String(preview.benchmark.speed ?? '-')}</div>
                            </div>
                            <div className="rounded-lg bg-background/60 border border-border/30 p-3">
                                <div className="text-muted-foreground">Memory</div>
                                <div className="font-black">{String(preview.benchmark.memoryEfficiency ?? '-')}</div>
                            </div>
                        </div>
                    </div>
                )}

                {isHF && hfModel && (
                    <div className="p-6 rounded-2xl bg-muted/10 border border-border/40 space-y-4">
                        <h3 className="text-xxs font-black uppercase tracking-[0.3em] text-primary">
                            Conversion Tools
                        </h3>
                        <div className="grid grid-cols-2 gap-3 text-xxs">
                            <label className="space-y-1">
                                <span className="text-muted-foreground">Preset</span>
                                <select
                                    value={conversionPreset}
                                    onChange={e => setConversionPreset(e.target.value as 'balanced' | 'quality' | 'speed' | 'tiny')}
                                    className="w-full rounded-md bg-muted/30 border border-border/40 px-2 py-1"
                                >
                                    <option value="balanced">Balanced</option>
                                    <option value="quality">Quality</option>
                                    <option value="speed">Speed</option>
                                    <option value="tiny">Tiny</option>
                                </select>
                            </label>
                            <label className="space-y-1">
                                <span className="text-muted-foreground">Quantization</span>
                                <select
                                    value={conversionQuantization}
                                    onChange={e => setConversionQuantization(e.target.value as 'F16' | 'Q8_0' | 'Q6_K' | 'Q5_K_M' | 'Q4_K_M')}
                                    className="w-full rounded-md bg-muted/30 border border-border/40 px-2 py-1"
                                >
                                    <option value="Q4_K_M">Q4_K_M</option>
                                    <option value="Q5_K_M">Q5_K_M</option>
                                    <option value="Q6_K">Q6_K</option>
                                    <option value="Q8_0">Q8_0</option>
                                    <option value="F16">F16</option>
                                </select>
                            </label>
                        </div>
                        <label className="space-y-1 text-xxs block">
                            <span className="text-muted-foreground">Source Path (HF checkpoint / safetensors / gguf)</span>
                            <input
                                value={conversionSourcePath}
                                onChange={e => setConversionSourcePath(e.target.value)}
                                className="w-full rounded-md bg-muted/30 border border-border/40 px-2 py-1.5"
                                placeholder="C:/models/original-model"
                            />
                        </label>
                        <label className="space-y-1 text-xxs block">
                            <span className="text-muted-foreground">Output GGUF Path</span>
                            <input
                                value={conversionOutputPath}
                                onChange={e => setConversionOutputPath(e.target.value)}
                                className="w-full rounded-md bg-muted/30 border border-border/40 px-2 py-1.5"
                                placeholder="C:/models/output.gguf"
                            />
                        </label>
                        <button
                            onClick={() => void runConversion()}
                            disabled={conversionLoading || !conversionSourcePath || !conversionOutputPath}
                            className={cn(
                                'w-full py-2 rounded-lg text-xxs font-black uppercase tracking-wider',
                                conversionLoading || !conversionSourcePath || !conversionOutputPath
                                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                                    : 'bg-primary text-primary-foreground'
                            )}
                        >
                            {conversionLoading ? 'Converting...' : 'Convert to GGUF'}
                        </button>
                        {conversionProgress && (
                            <div className="text-xxs rounded-lg border border-border/40 bg-background/60 px-3 py-2">
                                <div className="flex justify-between mb-1">
                                    <span className="uppercase">{conversionProgress.stage}</span>
                                    <span>{conversionProgress.percent}%</span>
                                </div>
                                <div className="h-2 rounded bg-muted/30 overflow-hidden">
                                    <div className="h-full bg-primary" style={{ width: `${conversionProgress.percent}%` }} />
                                </div>
                                <div className="mt-1 text-muted-foreground">{conversionProgress.message}</div>
                            </div>
                        )}
                        {conversionStatus && (
                            <div className={cn(
                                'text-xxs rounded-lg border px-3 py-2',
                                conversionStatus.success
                                    ? 'border-success/30 bg-success/10 text-success'
                                    : 'border-destructive/30 bg-destructive/10 text-destructive'
                            )}>
                                {conversionStatus.message}
                            </div>
                        )}
                        {optimizationSuggestions.length > 0 && (
                            <div className="text-xxs rounded-lg border border-border/40 bg-background/60 px-3 py-2">
                                <div className="font-semibold mb-1">Optimization Suggestions</div>
                                {optimizationSuggestions.map((tip) => (
                                    <div key={tip} className="text-muted-foreground">- {tip}</div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {isHF && hfModel && (
                    <div className="p-6 rounded-2xl bg-muted/10 border border-border/40 space-y-4">
                        <h3 className="text-xxs font-black uppercase tracking-[0.3em] text-primary">
                            Versioning
                        </h3>
                        <div className="text-xxs text-muted-foreground">
                            {versionNotifications.map(msg => <div key={msg}>- {msg}</div>)}
                        </div>
                        <div className="flex gap-2">
                            <input
                                value={versionNotes}
                                onChange={e => setVersionNotes(e.target.value)}
                                className="flex-1 rounded-md bg-muted/30 border border-border/40 px-2 py-1.5 text-xxs"
                                placeholder="Version notes (optional)"
                            />
                            <button onClick={() => void registerCurrentAsVersion()} className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xxs font-bold">
                                Save Version
                            </button>
                        </div>
                        {versions.length > 0 && (
                            <>
                                <div className="grid grid-cols-2 gap-2">
                                    <select value={selectedVersionA} onChange={e => setSelectedVersionA(e.target.value)} className="rounded-md bg-muted/30 border border-border/40 px-2 py-1 text-xxs">
                                        {versions.map(v => <option key={v.versionId} value={v.versionId}>{v.versionId}</option>)}
                                    </select>
                                    <select value={selectedVersionB} onChange={e => setSelectedVersionB(e.target.value)} className="rounded-md bg-muted/30 border border-border/40 px-2 py-1 text-xxs">
                                        {versions.map(v => <option key={v.versionId} value={v.versionId}>{v.versionId}</option>)}
                                    </select>
                                </div>
                                <button onClick={() => void compareVersions()} className="w-full py-1.5 rounded-md border border-border/40 text-xxs font-bold">Compare Versions</button>
                                {versionCompareResult && (
                                    <pre className="text-xxs rounded-lg border border-border/40 bg-background/60 px-3 py-2 whitespace-pre-wrap break-words">
                                        {JSON.stringify(versionCompareResult, null, 2)}
                                    </pre>
                                )}
                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                    {versions.map(v => (
                                        <div key={v.versionId} className="rounded-md border border-border/30 px-2 py-2 text-xxs flex items-center justify-between gap-2">
                                            <div className="truncate">
                                                <div className="font-semibold">{v.versionId}</div>
                                                <div className="text-muted-foreground">{new Date(v.createdAt).toLocaleString()}</div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => void togglePinVersion(v)} className={cn('px-2 py-1 rounded border text-xxs', v.pinned ? 'border-warning/40 text-warning' : 'border-border/40')}>{v.pinned ? 'Unpin' : 'Pin'}</button>
                                                <button onClick={() => void rollbackVersion(v.versionId)} className="px-2 py-1 rounded border border-border/40 text-xxs">Rollback</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {isHF && hfModel && (
                    <div className="p-6 rounded-2xl bg-muted/10 border border-border/40 space-y-4">
                        <h3 className="text-xxs font-black uppercase tracking-[0.3em] text-primary">
                            Fine-Tuning
                        </h3>
                        <label className="space-y-1 text-xxs block">
                            <span className="text-muted-foreground">Dataset Input Path</span>
                            <input value={datasetInputPath} onChange={e => setDatasetInputPath(e.target.value)} className="w-full rounded-md bg-muted/30 border border-border/40 px-2 py-1.5" placeholder="C:/data/train.jsonl" />
                        </label>
                        <label className="space-y-1 text-xxs block">
                            <span className="text-muted-foreground">Prepared Dataset Output</span>
                            <input value={datasetOutputPath} onChange={e => setDatasetOutputPath(e.target.value)} className="w-full rounded-md bg-muted/30 border border-border/40 px-2 py-1.5" placeholder="C:/data/prepared.jsonl" />
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => void prepareDataset()} className="py-1.5 rounded-md border border-border/40 text-xxs font-bold">Prepare Dataset</button>
                            <button onClick={() => void startFineTuning()} disabled={!preparedDatasetInfo} className={cn('py-1.5 rounded-md text-xxs font-bold', preparedDatasetInfo ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>Start Training</button>
                        </div>
                        {activeFineTuneJob && (
                            <div className="text-xxs rounded-lg border border-border/40 bg-background/60 px-3 py-2">
                                <div className="flex justify-between mb-1">
                                    <span>{activeFineTuneJob.status}</span>
                                    <span>{activeFineTuneJob.progress}%</span>
                                </div>
                                <div className="h-2 rounded bg-muted/30 overflow-hidden">
                                    <div className="h-full bg-primary" style={{ width: `${activeFineTuneJob.progress}%` }} />
                                </div>
                            </div>
                        )}
                        <div className="grid grid-cols-3 gap-2">
                            <button onClick={() => void evaluateActiveJob()} disabled={!activeFineTuneJob} className="py-1.5 rounded-md border border-border/40 text-xxs font-bold">Evaluate</button>
                            <button onClick={() => activeFineTuneJob && void window.electron.huggingface.cancelFineTuneJob(activeFineTuneJob.id)} disabled={!activeFineTuneJob} className="py-1.5 rounded-md border border-border/40 text-xxs font-bold">Cancel</button>
                            <button onClick={() => void exportActiveJob()} disabled={!activeFineTuneJob} className="py-1.5 rounded-md border border-border/40 text-xxs font-bold">Export</button>
                        </div>
                        {fineTuneStatus && (
                            <div className="text-xxs rounded-lg border border-border/40 bg-background/60 px-3 py-2">{fineTuneStatus}</div>
                        )}
                        {fineTuneJobs.length > 0 && (
                            <div className="max-h-40 overflow-y-auto space-y-1">
                                {fineTuneJobs.map(job => (
                                    <button key={job.id} onClick={() => setActiveFineTuneJob(job)} className="w-full text-left text-xxs rounded-md border border-border/30 px-2 py-1 hover:bg-muted/30">
                                        {job.id} - {job.status} ({job.progress}%)
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div className="space-y-6">
                    <h3 className="text-xxs font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-3">
                        <Server className="w-4 h-4 text-muted-foreground/50" /> {t('modelExplorer.availableVersions')}
                    </h3>

                    {selectedModel.provider === 'huggingface' && hfModel ? (
                        <div className="space-y-3">
                            {loadingFiles ? (
                                <div className="flex flex-col items-center justify-center p-12 space-y-4">
                                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                    <p className="text-xxs font-bold text-muted-foreground animate-pulse">{t('modelExplorer.scanningFiles')}</p>
                                </div>
                            ) : (
                                files.map(file => (
                                    <HFFileItem
                                        key={file.path}
                                        file={file}
                                        model={hfModel}
                                        modelsDir={modelsDir}
                                        downloading={downloading}
                                        handleDownloadHF={handleDownloadHF}
                                        testResult={installTests[getInstallPath(hfModel, file, modelsDir)]}
                                    />
                                ))
                            )}
                            {!loadingFiles && files.length === 0 && (
                                <div className="text-center text-xs text-muted-foreground/50 py-12 border-2 border-dashed border-border/20 rounded-2xl">
                                    {t('modelExplorer.noCompatible')}
                                </div>
                            )}
                            {lastInstallConfig[hfModel.id] && (
                                <div className="rounded-xl border border-border/40 bg-muted/10 p-3 text-xxs">
                                    Last install config:
                                    {' '}
                                    {lastInstallConfig[hfModel.id].profile ?? 'balanced'}
                                    {' / '}
                                    {(lastInstallConfig[hfModel.id].scheduleAtMs ? 'scheduled' : 'immediate')}
                                    {' / '}
                                    {(lastInstallConfig[hfModel.id].testAfterInstall ? 'tested' : 'untested')}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {(selectedModel as OllamaLibraryModel).tags.map(tag => {
                                const fullModelName = `${(selectedModel as OllamaLibraryModel).name}:${tag}`;
                                const isPulling = pullingOllama === fullModelName;
                                return (
                                    <div key={tag} className="p-5 rounded-2xl border border-border/50 bg-muted/20 hover:border-orange/40 hover:bg-warning/5 transition-all group">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <span className="px-3 py-1 bg-warning/20 text-orange rounded-lg text-xs font-black uppercase tracking-widest font-mono">{tag}</span>
                                            </div>
                                            <Database className="w-4 h-4 text-orange/50" />
                                        </div>
                                        <button
                                            onClick={() => void handlePullOllama((selectedModel as OllamaLibraryModel).name, tag)}
                                            disabled={!!pullingOllama}
                                            className={cn('w-full py-3 text-xxs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg active:scale-95 disabled:opacity-50', isPulling ? 'bg-warning text-foreground animate-pulse' : 'bg-foreground text-background hover:scale-[1.02] group-hover:bg-warning-600 group-hover:text-foreground')}
                                        >
                                            {isPulling ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('modelExplorer.pulling')}</> : <><Download className="w-4 h-4" /> {t('modelExplorer.pullVersion')}</>}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
};
