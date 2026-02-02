import { HFModel, OllamaLibraryModel, UnifiedModel } from '@renderer/features/models/types';
import { Download } from 'lucide-react';
import React, { memo } from 'react';

import { motion } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';

interface ModelCardProps {
    model: UnifiedModel
    isSelected: boolean
    isInstalled: boolean
    onSelect: (model: UnifiedModel) => void | Promise<void>
    t: (key: string) => string
}

const ARCHITECTURE_MAP: Record<string, string> = {
    llama: 'Llama',
    mistral: 'Mistral',
    phi: 'Phi',
    gemma: 'Gemma',
    qwen: 'Qwen'
};

function detectArchitecture(modelName: string): string {
    const nameLower = modelName.toLowerCase();
    for (const [key, arch] of Object.entries(ARCHITECTURE_MAP)) {
        if (nameLower.includes(key)) { return arch; }
    }
    return 'Transformer';
}

function formatDownloads(downloads: number): string {
    return downloads > 1000 ? `${(downloads / 1000).toFixed(1)}k` : String(downloads);
}

const DownloadBadge: React.FC<{ count: string | number }> = ({ count }) => (
    <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground/80 bg-muted/30 px-3 py-1.5 rounded-xl border border-border/30">
        <Download className="w-3.5 h-3.5" />
        {count}
    </div>
);

function getSecondaryBadgeContent(model: UnifiedModel): { count: string | number } | null {
    if (model.provider === 'huggingface') {
        const downloads = (model as HFModel).downloads;
        return { count: formatDownloads(downloads) };
    }
    // model.provider === 'ollama' - type narrowing guaranteed
    const ollamaModel = model as OllamaLibraryModel;
    if (ollamaModel.pulls) {
        return { count: ollamaModel.pulls };
    }
    return null;
}

interface ModelHeaderProps {
    isOllama: boolean;
    isInstalled: boolean;
    badgeContent: { count: string | number } | null;
    t: (key: string) => string;
}

const ModelHeader: React.FC<ModelHeaderProps> = ({ isOllama, isInstalled, badgeContent, t }) => (
    <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-2">
            <div className={cn("text-[9px] font-black px-3 py-1.5 rounded-xl uppercase tracking-[0.2em] shadow-sm", isOllama ? "bg-orange/20 text-orange border border-orange/20" : "bg-yellow/20 text-yellow border border-yellow/20")}>
                {isOllama ? 'OLLAMA' : 'HUGGINGFACE'}
            </div>
            {isInstalled && (
                <div className="text-[9px] font-black px-3 py-1.5 rounded-xl uppercase tracking-[0.2em] bg-success/20 text-success border border-success/20 shadow-sm">
                    {t('modelExplorer.pulled')}
                </div>
            )}
        </div>
        {badgeContent && <DownloadBadge count={badgeContent.count} />}
    </div>
);

interface ModelTagsProps {
    tags: string[];
}

const ModelTags: React.FC<ModelTagsProps> = ({ tags }) => (
    <div className="flex flex-wrap gap-2 mt-auto">
        {tags.slice(0, 4).map(tag => (
            <span key={tag} className="px-3 py-1.5 bg-muted/40 rounded-xl text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 border border-transparent group-hover:border-primary/20 group-hover:bg-primary/5 group-hover:text-primary transition-all">
                {tag}
            </span>
        ))}
        {tags.length > 4 && <span className="px-2 py-1 text-[10px] font-black text-muted-foreground/30">+{tags.length - 4}</span>}
    </div>
);

export const ModelCard = memo(({ model, isSelected, isInstalled, onSelect, t }: ModelCardProps) => {
    const isOllama = model.provider === 'ollama';
    const name = isOllama ? (model as OllamaLibraryModel).name : (model as HFModel).name;
    const params = isOllama ? (model as OllamaLibraryModel).tags.find(tag => tag.toLowerCase().includes('b') || tag.toLowerCase().includes('m')) : '';
    const architecture = detectArchitecture(name);
    const badgeContent = getSecondaryBadgeContent(model);

    return (
        <motion.div
            onClick={() => void onSelect(model)}
            className={cn(
                "group relative flex flex-col bg-card border rounded-3xl overflow-hidden transition-all duration-300 cursor-pointer",
                isSelected ? "border-primary ring-1 ring-primary/20 bg-primary/[0.02]" : "border-border/40 hover:border-primary/30 hover:bg-accent/5"
            )}
        >
            <div className="p-7 flex-1 flex flex-col">
                <ModelHeader isOllama={isOllama} isInstalled={isInstalled} badgeContent={badgeContent} t={t} />
                <div className="relative mb-2">
                    <h3 className="font-black text-2xl line-clamp-1 tracking-tighter" title={name}>{name}</h3>
                </div>
                <div className="flex items-center gap-3 mb-6">
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary/70">{architecture}</span>
                    {params && <span className="w-1 h-1 rounded-full bg-border" />}
                    {params && <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{params} Params</span>}
                </div>
                <p className="text-sm text-muted-foreground/70 line-clamp-3 mb-8 leading-relaxed font-medium">
                    {model.description || 'Access state-of-the-art intelligence with this advanced language model.'}
                </p>
                <ModelTags tags={model.tags} />
            </div>
            <div className="absolute inset-x-0 bottom-0 h-1.5 bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-full group-hover:translate-y-0" />
        </motion.div>
    );
});

ModelCard.displayName = 'ModelCard';
