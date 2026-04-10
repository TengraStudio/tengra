import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@renderer/components/ui/select';
import { Play, Sparkles, Wand2, Zap } from 'lucide-react';
import React from 'react';

interface ImageSettingsEditProps {
    batchPrompts: string;
    setBatchPrompts: (prompts: string) => void;
    handleRunBatch: () => Promise<void>;
    editSource: string;
    setEditSource: (source: string) => void;
    editPrompt: string;
    setEditPrompt: (prompt: string) => void;
    editMode: 'img2img' | 'inpaint' | 'outpaint' | 'style-transfer';
    setEditMode: (mode: 'img2img' | 'inpaint' | 'outpaint' | 'style-transfer') => void;
    editStrength: number;
    setEditStrength: (strength: number) => void;
    editPresetId: 'balanced' | 'detail' | 'stylize';
    handleApplyEditPreset: (presetId: 'balanced' | 'detail' | 'stylize') => void;
    handleRunEdit: () => Promise<void>;
    t: (key: string) => string | undefined;
}

export const ImageSettingsEdit: React.FC<ImageSettingsEditProps> = ({
    batchPrompts,
    setBatchPrompts,
    handleRunBatch,
    editSource,
    setEditSource,
    editPrompt,
    setEditPrompt,
    editMode,
    setEditMode,
    editStrength,
    setEditStrength,
    editPresetId,
    handleApplyEditPreset,
    handleRunEdit,
    t,
}) => {
    return (
        <div className="bg-card rounded-3xl border border-border/40 p-8 space-y-8 shadow-sm group/edit hover:border-border/60 transition-all duration-500 overflow-hidden relative">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1 relative z-10">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-primary/10 text-primary shadow-lg shadow-primary/5 group-hover/edit:scale-110 transition-transform duration-500">
                        <Wand2 className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-foreground group-hover/edit:text-primary transition-colors">
                            {t('settings.images.editTitle')}
                        </h3>
                        <p className="typo-body text-muted-foreground mt-1 font-bold opacity-60">
                            {t('settings.images.batchProcessing')}
                        </p>
                    </div>
                </div>
            </div>

            <div className="space-y-6 relative z-10">
                <div className="space-y-3">
                    <div className="typo-body font-bold text-muted-foreground/40 px-1">Batch Prompts (Line per prompt)</div>
                    <textarea
                        value={batchPrompts}
                        onChange={event => setBatchPrompts(event.target.value)}
                        placeholder={t('settings.images.batchPrompts')}
                        className="tw-min-h-32 w-full rounded-2xl border border-border/40 bg-muted/20 p-6 font-mono typo-body text-muted-foreground leading-relaxed shadow-inner focus:ring-1 focus:ring-primary/20 outline-none transition-all custom-scrollbar"
                    />
                    <Button
                        onClick={() => { void handleRunBatch(); }}
                        className="h-12 px-8 rounded-2xl bg-foreground text-background hover:bg-primary hover:text-primary-foreground typo-body font-bold transition-all active:scale-95 shadow-xl shadow-black/10 flex items-center gap-3 w-full sm:w-auto"
                    >
                        <Play className="w-4 h-4" />
                        {t('settings.images.batchRun')}
                    </Button>
                </div>

                <div className="pt-8 border-t border-border/10 space-y-8">
                    <div className="flex items-center gap-3 px-1">
                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                        <div className="typo-body font-bold text-muted-foreground/40">Transformation Settings</div>
                    </div>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <div className="space-y-2">
                            <div className="typo-body font-bold text-muted-foreground/40 px-1">Source Image ID</div>
                            <Input
                                value={editSource}
                                onChange={event => setEditSource(event.target.value)}
                                placeholder={t('settings.images.editSource')}
                                className="h-12 px-6 rounded-2xl bg-muted/20 border-border/40 focus-visible:ring-primary/20 typo-caption font-bold placeholder:text-muted-foreground/30 shadow-inner group-hover:bg-muted/30 transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="typo-body font-bold text-muted-foreground/40 px-1">Refinement Prompt</div>
                            <Input
                                value={editPrompt}
                                onChange={event => setEditPrompt(event.target.value)}
                                placeholder={t('settings.images.editPrompt')}
                                className="h-12 px-6 rounded-2xl bg-muted/20 border-border/40 focus-visible:ring-primary/20 typo-caption font-bold placeholder:text-muted-foreground/30 shadow-inner group-hover:bg-muted/30 transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="typo-body font-bold text-muted-foreground/40 px-1">Preset Efficiency</div>
                            <Select
                                value={editPresetId}
                                onValueChange={(value: 'balanced' | 'detail' | 'stylize') => handleApplyEditPreset(value)}
                            >
                                <SelectTrigger className="h-12 px-6 rounded-2xl bg-muted/20 border-border/40 typo-caption font-bold focus:ring-primary/20">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-background/95 backdrop-blur-xl border-border/40 rounded-2xl shadow-2xl">
                                    <SelectItem value="balanced" className="typo-body font-bold">{t('settings.images.editPresetBalanced')}</SelectItem>
                                    <SelectItem value="detail" className="typo-body font-bold text-primary">{t('settings.images.editPresetDetail')}</SelectItem>
                                    <SelectItem value="stylize" className="typo-body font-bold text-success">{t('settings.images.editPresetStylize')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <div className="typo-body font-bold text-muted-foreground/40 px-1">Edit Mode</div>
                            <Select
                                value={editMode}
                                onValueChange={(value: 'img2img' | 'inpaint' | 'outpaint' | 'style-transfer') => setEditMode(value)}
                            >
                                <SelectTrigger className="h-12 px-6 rounded-2xl bg-muted/20 border-border/40 typo-caption font-bold focus:ring-primary/20">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-background/95 backdrop-blur-xl border-border/40 rounded-2xl shadow-2xl">
                                    <SelectItem value="img2img" className="typo-body font-bold text-primary">{t('settings.images.editModeImg2Img')}</SelectItem>
                                    <SelectItem value="inpaint" className="typo-body font-bold">{t('settings.images.editModeInpaint')}</SelectItem>
                                    <SelectItem value="outpaint" className="typo-body font-bold">{t('settings.images.editModeOutpaint')}</SelectItem>
                                    <SelectItem value="style-transfer" className="typo-body font-bold text-success">{t('settings.images.editModeStyleTransfer')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                            <div className="typo-body font-bold text-muted-foreground/40">Strength Correlation</div>
                            <div className="text-sm font-bold text-primary tabular-nums">{Math.round(editStrength * 100)}%</div>
                        </div>
                        <div className="h-3 w-full bg-muted/20 rounded-full border border-border/10 p-0.5 relative group/slider">
                            <input
                                type="range"
                                min={0}
                                max={1}
                                step={0.01}
                                value={editStrength}
                                onChange={event => setEditStrength(Number(event.target.value))}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                            />
                            <div
                                className="h-full bg-primary rounded-full transition-all duration-300 relative shadow-lg shadow-primary/20"
                                style={{ width: `${editStrength * 100}%` }}
                            >
                                <div className="absolute top-1/2 right-0 -translate-y-1/2 w-4 h-4 bg-background border-2 border-primary rounded-full shadow-lg group-hover/slider:scale-125 transition-transform" />
                            </div>
                        </div>
                    </div>

                    <Button
                        onClick={() => { void handleRunEdit(); }}
                        className="h-14 px-10 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 typo-caption font-bold transition-all active:scale-95 shadow-2xl shadow-primary/20 flex items-center gap-4 w-full"
                    >
                        <Zap className="w-5 h-5" />
                        {t('settings.images.editRun')}
                    </Button>
                </div>
            </div>

            <div className="absolute -right-24 -bottom-24 w-96 h-96 bg-primary/5 rounded-full blur-[100px] opacity-30 pointer-events-none" />
        </div>
    );
};
