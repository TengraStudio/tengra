import { Check, Image as ImageIcon, Loader2, Sparkles, Upload, Wand2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import {
    Button,
    Card,
    Label,
    Modal,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Textarea,
} from '@/components/ui';
import { ModelDefinition } from '@/electron';
import { useLogoGenerator } from '@/features/workspace/hooks/useLogoGenerator';
import { Language, useTranslation } from '@/i18n';
import { Project } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

interface LogoGeneratorModalProps {
    isOpen: boolean;
    onClose: () => void;
    project: Project;
    onApply: (logoPath: string) => void;
    language: Language;
}

export const LogoGeneratorModal: React.FC<LogoGeneratorModalProps> = ({
    isOpen,
    onClose,
    project,
    onApply,
    language,
}) => {
    const { t } = useTranslation(language);
    const {
        prompt,
        setPrompt,
        model,
        setModel,
        count,
        setCount,
        isGenerating,
        isAnalyzing,
        generatedLogos,
        suggestions,
        handleAnalyze,
        handleGenerate,
        handleApply,
        handleManualUpload,
    } = useLogoGenerator(project, onApply, onClose);

    const [activeTab, setActiveTab] = useState('generate');
    const [mode, setMode] = useState<'auto' | 'manual'>('auto');
    const [models, setModels] = useState<ModelDefinition[]>([]);
    const [loadingModels, setLoadingModels] = useState(false);

    const [dragActive, setDragActive] = useState(false);

    useEffect(() => {
        let mounted = true;
        const loadModels = async (): Promise<void> => {
            if (!mounted) {
                return;
            }
            setLoadingModels(true);
            try {
                const allModels = await window.electron.modelRegistry.getAllModels();
                if (!mounted) {
                    return;
                }
                const hasAntigravity = await window.electron.hasLinkedAccount('antigravity');
                const hasOpenAI =
                    (await window.electron.hasLinkedAccount('openai')) ||
                    (await window.electron.hasLinkedAccount('codex'));
                const hasNvidia = await window.electron.hasLinkedAccount('nvidia');

                const providerAllowed = (providerRaw: string) => {
                    const provider = providerRaw.toLowerCase();
                    if (provider === 'ollama') {
                        return true;
                    }
                    if (provider === 'antigravity' || provider === 'google') {
                        return hasAntigravity;
                    }
                    if (provider === 'openai' || provider === 'codex') {
                        return hasOpenAI;
                    }
                    if (provider === 'nvidia') {
                        return hasNvidia;
                    }
                    return false;
                };

                const imageModels = allModels.filter(
                    m =>
                        m.capabilities?.image_generation &&
                        providerAllowed(m.provider ?? '')
                );
                setModels(imageModels);
                if (imageModels.length > 0 && !model) {
                    setModel(imageModels[0].id);
                }
            } catch (err) {
                appLogger.error('LogoGeneratorModal', 'Failed to load models', err as Error);
            } finally {
                if (mounted) {
                    setLoadingModels(false);
                }
            }
        };

        if (isOpen) {
            void loadModels();
        }
        return () => {
            mounted = false;
        };
    }, [isOpen, model, setModel]);

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        const file = e.dataTransfer.files?.[0];
        if (file) {
            // Electron exposes the full path on the File object
            const fileWithPath = file as File & { path: string };
            const filePath = fileWithPath.path;
            if (filePath) {
                await handleApply(filePath);
            }
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={t('projects.logoUpload')}
            width="auto"
            height="auto"
            className="flex flex-col"
        >
            <div className="h-full grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-6 overflow-hidden">
                {/* Left Panel: Controls */}
                <div className="min-h-0 rounded-2xl border border-border/60 bg-muted/20 p-4 overflow-y-auto">
                    <div className="w-full space-y-5">
                        <div className="flex items-center p-1 bg-background/80 border border-border/60 rounded-xl">
                            <button
                                className={`flex-1 px-3 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'generate' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                onClick={() => setActiveTab('generate')}
                            >
                                {t('common.generate') || 'Generate'}
                            </button>
                            <button
                                className={`flex-1 px-3 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'upload' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                onClick={() => setActiveTab('upload')}
                            >
                                {t('common.upload') || 'Upload'}
                            </button>
                        </div>

                        {activeTab === 'generate' && (
                            <div className="space-y-6 mt-4">
                                {/* Mode Selection */}
                                <div className="space-y-3">
                                    <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                                        {t('projects.generationMode')}
                                    </Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Button
                                            variant={mode === 'auto' ? 'default' : 'outline'}
                                            onClick={() => setMode('auto')}
                                            className="justify-start h-10"
                                        >
                                            <Sparkles className="w-4 h-4 mr-2" />
                                            {t('common.auto')}
                                        </Button>
                                        <Button
                                            variant={mode === 'manual' ? 'default' : 'outline'}
                                            onClick={() => setMode('manual')}
                                            className="justify-start h-10"
                                        >
                                            <Wand2 className="w-4 h-4 mr-2" />
                                            {t('common.manual')}
                                        </Button>
                                    </div>
                                </div>

                                {/* Model Selection */}
                                <div className="space-y-2.5">
                                    <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                                        {t('projects.aiModel')}
                                    </Label>
                                    <Select
                                        value={model}
                                        onValueChange={setModel}
                                        disabled={loadingModels}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder={t('projects.selectModel')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {models.map(m => (
                                                <SelectItem key={m.id} value={m.id}>
                                                    {m.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {!loadingModels && models.length === 0 && (
                                        <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-3">
                                            <p className="text-xs text-muted-foreground">
                                                {t('projects.noImageModelsFound')}
                                            </p>
                                            <div className="space-y-1">
                                                <p className="text-xs font-semibold text-foreground">
                                                    {t('projects.recommendedImageModels')}
                                                </p>
                                                <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                                                    <li>FLUX.1-dev</li>
                                                    <li>Stable Diffusion XL</li>
                                                    <li>Stable Diffusion 3.5</li>
                                                </ul>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                        window.electron.openExternal(
                                                            'https://huggingface.co/models?pipeline_tag=text-to-image'
                                                        )
                                                    }
                                                >
                                                    {t('projects.openImageMarketplace')}
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                        window.electron.openExternal(
                                                            'https://civitai.com/models'
                                                        )
                                                    }
                                                >
                                                    {t('projects.openCivitai')}
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                        window.electron.openExternal(
                                                            'https://github.com/leejet/stable-diffusion.cpp'
                                                        )
                                                    }
                                                >
                                                    {t('projects.openStableDiffusionCpp')}
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                        window.electron.openExternal(
                                                            'https://ollama.com/search?c=vision'
                                                        )
                                                    }
                                                >
                                                    {t('projects.openOllamaLibrary')}
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Count Selection */}
                                <div className="space-y-2.5">
                                    <div className="flex justify-between">
                                        <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                                            {t('projects.numberOfLogos')}
                                        </Label>
                                        <span className="text-sm text-muted-foreground">
                                            {count}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-4 gap-2">
                                        {[1, 2, 3, 4].map(num => (
                                            <Button
                                                key={num}
                                                variant={count === num ? 'default' : 'outline'}
                                                size="default"
                                                onClick={() => setCount(num)}
                                                className="h-10"
                                            >
                                                {num}
                                            </Button>
                                        ))}
                                    </div>
                                </div>

                                {/* Prompt Input */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                                        {t('projects.prompt')}
                                    </Label>
                                    {mode === 'auto' ? (
                                        <div className="space-y-2">
                                            <Button
                                                variant="secondary"
                                                className="w-full h-10"
                                                onClick={() => void handleAnalyze()}
                                                disabled={isAnalyzing}
                                            >
                                                {isAnalyzing ? (
                                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                                ) : (
                                                    <Sparkles className="w-4 h-4 mr-2" />
                                                )}
                                                {suggestions.length > 0
                                                    ? t('projects.reAnalyzeProject')
                                                    : t('projects.analyzeProjectIdentity')}
                                            </Button>
                                            {suggestions.length > 0 && (
                                                <div className="space-y-2 mt-2">
                                                    <Label className="text-xs text-muted-foreground">
                                                        {t('projects.suggestedPrompts')}
                                                    </Label>
                                                    <div className="max-h-36 overflow-y-auto space-y-2 pr-1">
                                                        {suggestions.map((s, i) => (
                                                            <div
                                                                key={i}
                                                                className={`p-2 rounded-md border text-sm cursor-pointer hover:bg-muted ${prompt === s ? 'border-primary bg-primary/5' : 'border-border'}`}
                                                                onClick={() => setPrompt(s)}
                                                            >
                                                                {s}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : null}
                                    <Textarea
                                        value={prompt}
                                        onChange={e => setPrompt(e.target.value)}
                                        placeholder={t('projects.logoPromptPlaceholder')}
                                        className="h-32 resize-none bg-background/80"
                                    />
                                </div>

                                {/* Generate Button */}
                                <Button
                                    className="w-full h-11"
                                    size="lg"
                                    onClick={() => void handleGenerate()}
                                    disabled={isGenerating || !prompt || !model}
                                >
                                    {isGenerating ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                            {t('common.generating')}
                                        </>
                                    ) : (
                                        <>
                                            <Wand2 className="w-4 h-4 mr-2" />
                                            {t('common.generateLogos')}
                                        </>
                                    )}
                                </Button>
                            </div>
                        )}

                        {activeTab === 'upload' && (
                            <div className="mt-4">
                                <div
                                    className={`
                                        relative flex flex-col items-center justify-center w-full h-64 
                                        border-2 border-dashed rounded-xl transition-colors cursor-pointer
                                        ${dragActive ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}
                                    `}
                                    onDragEnter={handleDrag}
                                    onDragLeave={handleDrag}
                                    onDragOver={handleDrag}
                                    onDrop={e => void handleDrop(e)}
                                    onClick={() => void handleManualUpload()}
                                >
                                    <div className="flex flex-col items-center gap-4 text-center">
                                        <div className="p-4 rounded-full bg-muted">
                                            <Upload className="w-8 h-8 text-muted-foreground" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium">
                                                {t('projects.clickToUpload')}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {t('projects.currentImplementationOpensFileDialog')}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel: Gallery */}
                <div className="min-h-0 rounded-2xl border border-border/60 bg-background/80 p-4 flex flex-col gap-4 overflow-hidden">
                    <div className="flex items-end justify-between border-b border-border/50 pb-3">
                        <div>
                            <Label className="text-xl font-bold text-foreground">Generated Results</Label>
                            <p className="text-xs text-muted-foreground mt-1">
                                Pick a logo to apply it instantly.
                            </p>
                        </div>
                        <span className="text-sm text-muted-foreground font-medium">
                            {generatedLogos.length} result{generatedLogos.length !== 1 ? 's' : ''}
                        </span>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {generatedLogos.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-xl border-muted/70 bg-muted/10">
                                <ImageIcon className="w-12 h-12 mb-4 opacity-25" />
                                <p className="font-medium">No logos generated yet</p>
                                <p className="text-sm opacity-70">
                                    Configure settings and click Generate
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {generatedLogos.map((logoPath, index) => (
                                    <Card
                                        key={index}
                                        className="group relative aspect-square overflow-hidden border-2 border-border/60 hover:border-primary transition-all"
                                    >
                                        <img
                                            src={
                                                logoPath.startsWith('http') ||
                                                logoPath.startsWith('safe-file')
                                                    ? logoPath
                                                    : `safe-file://${logoPath}`
                                            }
                                            alt={`Generated Logo ${index + 1}`}
                                            className="w-full h-full object-contain p-4 bg-checkered"
                                        />
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                                            <Button
                                                size="sm"
                                                onClick={() => void handleApply(logoPath)}
                                            >
                                                <Check className="w-4 h-4 mr-2" />
                                                Apply
                                            </Button>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
};
