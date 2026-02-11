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
import { useLogoGenerator } from '@/features/projects/hooks/useLogoGenerator';
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
        if (isOpen) {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            (async () => {
                if (!mounted) {
                    return;
                }
                setLoadingModels(true);
                try {
                    const allModels = await window.electron.modelRegistry.getAllModels();
                    if (!mounted) {
                        return;
                    }
                    const imageModels = allModels.filter(m => m.capabilities?.image_generation);
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
            })();
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
            title={t('projects.aiLogoGenerator') || 'Logo Generator'}
            className="max-w-4xl h-[80vh] flex flex-col"
        >
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row gap-6 p-6">
                {/* Left Panel: Controls */}
                <div className="w-full md:w-1/3 flex flex-col gap-6 overflow-y-auto pr-2">
                    <div className="w-full">
                        <div className="flex items-center p-1 bg-muted rounded-lg mb-4">
                            <button
                                className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'generate' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                onClick={() => setActiveTab('generate')}
                            >
                                {t('common.generate') || 'Generate'}
                            </button>
                            <button
                                className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'upload' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                onClick={() => setActiveTab('upload')}
                            >
                                {t('common.upload') || 'Upload'}
                            </button>
                        </div>

                        {activeTab === 'generate' && (
                            <div className="space-y-6 mt-4">
                                {/* Mode Selection */}
                                <div className="space-y-4">
                                    <Label>Generation Mode</Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Button
                                            variant={mode === 'auto' ? 'default' : 'outline'}
                                            onClick={() => setMode('auto')}
                                            className="justify-start"
                                        >
                                            <Sparkles className="w-4 h-4 mr-2" />
                                            Auto
                                        </Button>
                                        <Button
                                            variant={mode === 'manual' ? 'default' : 'outline'}
                                            onClick={() => setMode('manual')}
                                            className="justify-start"
                                        >
                                            <Wand2 className="w-4 h-4 mr-2" />
                                            Manual
                                        </Button>
                                    </div>
                                </div>

                                {/* Model Selection */}
                                <div className="space-y-2">
                                    <Label>AI Model</Label>
                                    <Select
                                        value={model}
                                        onValueChange={setModel}
                                        disabled={loadingModels}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a model" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {models.map(m => (
                                                <SelectItem key={m.id} value={m.id}>
                                                    {m.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Count Selection */}
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <Label>Number of Logos</Label>
                                        <span className="text-sm text-muted-foreground">
                                            {count}
                                        </span>
                                    </div>
                                    <div className="flex gap-2">
                                        {[1, 2, 3, 4].map(num => (
                                            <Button
                                                key={num}
                                                variant={count === num ? 'default' : 'outline'}
                                                size="sm"
                                                onClick={() => setCount(num)}
                                                className="flex-1"
                                            >
                                                {num}
                                            </Button>
                                        ))}
                                    </div>
                                </div>

                                {/* Prompt Input */}
                                <div className="space-y-2">
                                    <Label>Prompt</Label>
                                    {mode === 'auto' ? (
                                        <div className="space-y-2">
                                            <Button
                                                variant="secondary"
                                                className="w-full"
                                                onClick={() => void handleAnalyze()}
                                                disabled={isAnalyzing}
                                            >
                                                {isAnalyzing ? (
                                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                                ) : (
                                                    <Sparkles className="w-4 h-4 mr-2" />
                                                )}
                                                {suggestions.length > 0
                                                    ? 'Re-analyze Project'
                                                    : 'Analyze Project Identity'}
                                            </Button>
                                            {suggestions.length > 0 && (
                                                <div className="space-y-2 mt-2">
                                                    <Label className="text-xs text-muted-foreground">
                                                        Suggested Prompts
                                                    </Label>
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
                                            )}
                                        </div>
                                    ) : null}
                                    <Textarea
                                        value={prompt}
                                        onChange={e => setPrompt(e.target.value)}
                                        placeholder="Describe your logo..."
                                        className="h-32 resize-none"
                                    />
                                </div>

                                {/* Generate Button */}
                                <Button
                                    className="w-full"
                                    size="lg"
                                    onClick={() => void handleGenerate()}
                                    disabled={isGenerating || !prompt || !model}
                                >
                                    {isGenerating ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                            Generating...
                                        </>
                                    ) : (
                                        <>
                                            <Wand2 className="w-4 h-4 mr-2" />
                                            Generate Logos
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
                                            <p className="text-sm font-medium">Click to Upload</p>
                                            <p className="text-xs text-muted-foreground">
                                                Current implementation opens a file dialog
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel: Gallery */}
                <div className="w-full md:w-2/3 flex flex-col gap-4 border-l pl-6 overflow-hidden">
                    <div className="flex items-center justify-between">
                        <Label className="text-lg font-semibold">Generated Results</Label>
                        <span className="text-sm text-muted-foreground">
                            {generatedLogos.length} result{generatedLogos.length !== 1 ? 's' : ''}
                        </span>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {generatedLogos.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-xl border-muted">
                                <ImageIcon className="w-12 h-12 mb-4 opacity-20" />
                                <p>No logos generated yet</p>
                                <p className="text-sm opacity-60">
                                    Configure settings and click Generate
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                {generatedLogos.map((logoPath, index) => (
                                    <Card
                                        key={index}
                                        className="group relative aspect-square overflow-hidden border-2 hover:border-primary transition-all"
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
