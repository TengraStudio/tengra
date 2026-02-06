import { BadgeQ } from '@renderer/features/models/components/BadgeQ';
import { HFFile, HFModel, OllamaLibraryModel, UnifiedModel } from '@renderer/features/models/types';
import { formatSize } from '@renderer/features/models/utils/explorer-utils';
import { Database, Download, Loader2, Server, X } from 'lucide-react';
import React from 'react';

import { motion } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';

interface ModelDetailsPanelProps {
    selectedModel: UnifiedModel;
    setSelectedModel: (model: UnifiedModel | null) => void;
    loadingFiles: boolean;
    files: HFFile[];
    modelsDir: string;
    downloading: { [key: string]: { received: number, total: number } };
    handleDownloadHF: (file: HFFile) => void | Promise<void>;
    handlePullOllama: (modelName: string, tag: string) => void | Promise<void>;
    pullingOllama: string | null;
    t: (key: string) => string;
}

interface HFMetadataProps {
    model: HFModel;
    t: (key: string, options?: Record<string, string | number>) => string;
}

const HFMetadata: React.FC<HFMetadataProps> = ({ model, t }) => (
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

interface MetadataGridProps {
    model: UnifiedModel;
    t: (key: string) => string;
}

const MetadataGrid: React.FC<MetadataGridProps> = ({ model, t }) => {
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

interface HardwareStatsProps {
    model: UnifiedModel;
    t: (key: string) => string;
}

const HardwareStats: React.FC<HardwareStatsProps> = ({ model, t }) => {
    const isOllama = model.provider === 'ollama';
    const modelName = isOllama ? (model as OllamaLibraryModel).name : '';
    
    const minVram = isOllama
        ? (modelName.includes('70b') ? '~40GB' : modelName.includes('13b') ? '~10GB' : '~6GB')
        : '~8GB (Rec.)';
    
    const systemRam = isOllama
        ? (modelName.includes('70b') ? '64GB+' : '16GB+')
        : '16GB (Min)';

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
            </div>
        </div>
    );
};

interface DownloadProgressProps {
    downloading: { [key: string]: { received: number, total: number } };
    universalPath: string;
    t: (key: string) => string;
}

const DownloadProgress: React.FC<DownloadProgressProps> = ({ downloading, universalPath, t }) => (
    <div className="space-y-2">
        <div className="flex justify-between text-xxs font-black uppercase tracking-widest text-primary">
            <span>{t('modelExplorer.downloading')}</span>
            <span>{Math.round((downloading[universalPath].received / downloading[universalPath].total) * 100)}%</span>
        </div>
        <div className="h-2 w-full bg-muted/50 rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all duration-500 shadow-[0_0_15px_hsl(var(--primary)/0.5)]" style={{ width: `${(downloading[universalPath].received / downloading[universalPath].total) * 100}%` }} />
        </div>
    </div>
);

interface HFFileItemProps {
    file: HFFile;
    model: HFModel;
    modelsDir: string;
    downloading: { [key: string]: { received: number, total: number } };
    handleDownloadHF: (file: HFFile) => void | Promise<void>;
    t: (key: string) => string;
}

const HFFileItem: React.FC<HFFileItemProps> = ({ file, model, modelsDir, downloading, handleDownloadHF, t }) => {
    const safeName = `${model.author}-${model.name}-${file.quantization}.gguf`.replace(/[^a-zA-Z0-9.-]/g, '_').toLowerCase();
    const universalPath = `${modelsDir}/${safeName}`.replace(/\\/g, '/');
    const isRecommendation = file.quantization.includes('Q4_K_M') || file.quantization.includes('Q5_K_M');
    const isDownloading = universalPath in downloading;

    return (
        <div key={file.path} className={cn("p-5 rounded-2xl border transition-all duration-300 group", isRecommendation ? "border-primary/40 bg-primary/10 shadow-lg shadow-primary/5" : "border-border/50 bg-muted/20 hover:border-primary/40 hover:bg-muted/40")}>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                    <BadgeQ quantization={file.quantization} />
                    {isRecommendation && <span className="text-xxxs bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-black tracking-widest uppercase">{t('modelExplorer.bestChoice')}</span>}
                </div>
                <span className="text-xs text-foreground font-black font-mono">{formatSize(file.size)}</span>
            </div>
            <div className="text-xxs text-muted-foreground/50 mb-4 truncate font-mono">{file.path}</div>
            {isDownloading ? (
                <DownloadProgress downloading={downloading} universalPath={universalPath} t={t} />
            ) : (
                <button
                    onClick={() => void handleDownloadHF(file)}
                    className="w-full py-3 bg-foreground text-background text-xxs font-black uppercase tracking-widest rounded-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 shadow-lg group-hover:shadow-primary/20"
                >
                    <Download className="w-4 h-4" /> {t('modelExplorer.downloadPackage')}
                </button>
            )}
        </div>
    );
};

interface HFFilesListProps {
    files: HFFile[];
    model: HFModel;
    modelsDir: string;
    downloading: { [key: string]: { received: number, total: number } };
    loadingFiles: boolean;
    handleDownloadHF: (file: HFFile) => void | Promise<void>;
    t: (key: string) => string;
}

const HFFilesList: React.FC<HFFilesListProps> = ({ files, model, modelsDir, downloading, loadingFiles, handleDownloadHF, t }) => {
    if (loadingFiles) {
        return (
            <div className="flex flex-col items-center justify-center p-12 space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-xxs font-bold text-muted-foreground animate-pulse">{t('modelExplorer.scanningFiles')}</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {files.map(f => (
                <HFFileItem key={f.path} file={f} model={model} modelsDir={modelsDir} downloading={downloading} handleDownloadHF={handleDownloadHF} t={t} />
            ))}
            {files.length === 0 && <div className="text-center text-xs text-muted-foreground/50 py-12 border-2 border-dashed border-border/20 rounded-2xl">{t('modelExplorer.noCompatible')}</div>}
        </div>
    );
};

interface OllamaTagItemProps {
    tag: string;
    model: OllamaLibraryModel;
    pullingOllama: string | null;
    handlePullOllama: (modelName: string, tag: string) => void | Promise<void>;
    t: (key: string) => string;
}

const OllamaTagItem: React.FC<OllamaTagItemProps> = ({ tag, model, pullingOllama, handlePullOllama, t }) => {
    const fullModelName = `${model.name}:${tag}`;
    const isPulling = pullingOllama === fullModelName;

    return (
        <div key={tag} className="p-5 rounded-2xl border border-border/50 bg-muted/20 hover:border-orange/40 hover:bg-warning/5 transition-all group">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-warning/20 text-orange rounded-lg text-xs font-black uppercase tracking-widest font-mono">{tag}</span>
                    <span className="text-xxs text-muted-foreground font-medium uppercase tracking-widest opacity-50">{t('modelExplorer.localPull')}</span>
                </div>
                <Database className="w-4 h-4 text-orange/50" />
            </div>
            <button
                onClick={() => void handlePullOllama(model.name, tag)}
                disabled={!!pullingOllama}
                className={cn(
                    "w-full py-3 text-xxs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg active:scale-95 disabled:opacity-50",
                    isPulling ? "bg-warning text-foreground animate-pulse" : "bg-foreground text-background hover:scale-[1.02] group-hover:bg-warning-600 group-hover:text-foreground"
                )}
            >
                {isPulling ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> {t('modelExplorer.pulling')}</>
                ) : (
                    <><Download className="w-4 h-4" /> {t('modelExplorer.pullVersion')}</>
                )}
            </button>
        </div>
    );
};

interface OllamaTagsListProps {
    model: OllamaLibraryModel;
    pullingOllama: string | null;
    handlePullOllama: (modelName: string, tag: string) => void | Promise<void>;
    t: (key: string) => string;
}

const OllamaTagsList: React.FC<OllamaTagsListProps> = ({ model, pullingOllama, handlePullOllama, t }) => (
    <div className="space-y-3">
        {model.tags.map(tag => (
            <OllamaTagItem key={tag} tag={tag} model={model} pullingOllama={pullingOllama} handlePullOllama={handlePullOllama} t={t} />
        ))}
    </div>
);

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
    t
}) => {
    const isHF = selectedModel.provider === 'huggingface';
    const isOllama = selectedModel.provider === 'ollama';

    return (
        <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 40 }}
            className="w-[450px] border-l border-border/50 bg-card/60 backdrop-blur-2xl flex flex-col shadow-[-20px_0_50px_rgba(0,0,0,0.2)] relative z-40"
        >
            <div className="p-6 border-b border-border/50 flex items-center justify-between bg-white/5">
                <h2 className="font-black truncate pr-4 text-lg">
                    {isOllama ? (selectedModel as OllamaLibraryModel).name : (selectedModel as HFModel).name}
                </h2>
                <button onClick={() => setSelectedModel(null)} className="p-2 hover:bg-white/10 rounded-xl transition-all active:scale-90 shadow-sm border border-transparent hover:border-white/10">
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="p-8 space-y-4 border-b border-border/50 bg-white/5">
                {isHF ? <HFMetadata model={selectedModel as HFModel} t={t} /> : <OllamaMetadata t={t} />}
                <p className="text-sm text-muted-foreground leading-relaxed max-h-[120px] overflow-y-auto pr-4 scrollbar-thin">
                    {selectedModel.description || t('modelExplorer.defaultDescription')}
                </p>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-thin">
                <MetadataGrid model={selectedModel} t={t} />
                <HardwareStats model={selectedModel} t={t} />

                <div className="space-y-6">
                    <h3 className="text-xxs font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-3">
                        <Server className="w-4 h-4 text-muted-foreground/50" /> {t('modelExplorer.availableVersions')}
                    </h3>

                    {isHF ? (
                        <HFFilesList files={files} model={selectedModel as HFModel} modelsDir={modelsDir} downloading={downloading} loadingFiles={loadingFiles} handleDownloadHF={handleDownloadHF} t={t} />
                    ) : (
                        <OllamaTagsList model={selectedModel as OllamaLibraryModel} pullingOllama={pullingOllama} handlePullOllama={handlePullOllama} t={t} />
                    )}
                </div>
            </div>
        </motion.div>
    );
};
