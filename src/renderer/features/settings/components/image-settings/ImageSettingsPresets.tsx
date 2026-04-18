/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
import { Bookmark, Download, Plus, Share2, Trash2, Zap } from 'lucide-react';
import React from 'react';

import { ImagePresetEntry } from '../../types';

/* Batch-02: Extracted Long Classes */
const C_IMAGESETTINGSPRESETS_1 = "bg-card rounded-3xl border border-border/40 p-8 space-y-8 shadow-sm group/presets hover:border-border/60 transition-all duration-500 overflow-hidden relative lg:p-10";
const C_IMAGESETTINGSPRESETS_2 = "p-3 rounded-2xl bg-primary/10 text-primary shadow-lg shadow-primary/5 group-hover/presets:scale-110 transition-transform duration-500";
const C_IMAGESETTINGSPRESETS_3 = "h-12 px-6 rounded-2xl bg-muted/20 border-border/40 focus-visible:ring-primary/20 typo-caption font-bold placeholder:text-muted-foreground/30 shadow-inner group-hover:bg-muted/30 transition-all";
const C_IMAGESETTINGSPRESETS_4 = "h-12 px-6 rounded-2xl bg-muted/20 border-border/40 focus-visible:ring-primary/20 typo-caption font-bold placeholder:text-muted-foreground/30 shadow-inner group-hover:bg-muted/30 transition-all";
const C_IMAGESETTINGSPRESETS_5 = "h-12 px-8 rounded-2xl bg-foreground text-background hover:bg-primary hover:text-primary-foreground typo-body font-bold transition-all active:scale-95 shadow-xl shadow-black/10 flex items-center gap-3 w-full sm:w-auto";
const C_IMAGESETTINGSPRESETS_6 = "flex flex-col items-center justify-center py-10 text-center bg-muted/5 border-2 border-dashed border-border/20 rounded-2xl opacity-40 sm:flex-row";
const C_IMAGESETTINGSPRESETS_7 = "group/item flex items-center justify-between gap-4 bg-background/50 border border-border/20 rounded-2xl px-5 py-4 transition-all hover:bg-muted/10 hover:border-border/40 shadow-sm sm:gap-5 lg:gap-6";
const C_IMAGESETTINGSPRESETS_8 = "h-8 w-8 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all hover:scale-110";
const C_IMAGESETTINGSPRESETS_9 = "min-h-32 w-full rounded-2xl border border-border/40 bg-background/40 p-6 font-mono typo-body text-muted-foreground leading-relaxed shadow-inner focus:ring-1 focus:ring-primary/20 outline-none transition-all custom-scrollbar lg:p-8";
const C_IMAGESETTINGSPRESETS_10 = "h-10 px-6 rounded-xl border-border/40 bg-muted/40 typo-body font-bold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all active:scale-95 shadow-sm flex items-center gap-2 w-full";


interface ImageSettingsPresetsProps {
    presetEntries: ImagePresetEntry[];
    presetName: string;
    setPresetName: (name: string) => void;
    presetPromptPrefix: string;
    setPresetPromptPrefix: (prefix: string) => void;
    presetShareCode: string;
    setPresetShareCode: (code: string) => void;
    handleSavePreset: () => Promise<void>;
    handleDeletePreset: (id: string) => Promise<void>;
    handleExportPresetShare: (id: string) => Promise<void>;
    handleImportPresetShare: () => Promise<void>;
    t: (key: string) => string | undefined;
}

export const ImageSettingsPresets: React.FC<ImageSettingsPresetsProps> = ({
    presetEntries,
    presetName,
    setPresetName,
    presetPromptPrefix,
    setPresetPromptPrefix,
    presetShareCode,
    setPresetShareCode,
    handleSavePreset,
    handleDeletePreset,
    handleExportPresetShare,
    handleImportPresetShare,
    t,
}) => {
    return (
        <div className={C_IMAGESETTINGSPRESETS_1}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1 relative z-10">
                <div className="flex items-center gap-4">
                    <div className={C_IMAGESETTINGSPRESETS_2}>
                        <Bookmark className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-foreground group-hover/presets:text-primary transition-colors">
                            {t('settings.images.presetsTitle')}
                        </h3>
                        <p className="typo-body text-muted-foreground mt-1 font-bold opacity-60">
                            {presetEntries.length} {t('settings.images.savedPresets')}
                        </p>
                    </div>
                </div>
            </div>

            <div className="space-y-6 relative z-10">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <div className="typo-body font-bold text-muted-foreground/40 px-1">Preset Name</div>
                        <Input
                            value={presetName}
                            onChange={event => setPresetName(event.target.value)}
                            placeholder={t('settings.images.presetName')}
                            className={C_IMAGESETTINGSPRESETS_3}
                        />
                    </div>
                    <div className="space-y-2">
                        <div className="typo-body font-bold text-muted-foreground/40 px-1">Prompt Prefix</div>
                        <Input
                            value={presetPromptPrefix}
                            onChange={event => setPresetPromptPrefix(event.target.value)}
                            placeholder={t('settings.images.promptPrefix')}
                            className={C_IMAGESETTINGSPRESETS_4}
                        />
                    </div>
                </div>
                <Button
                    onClick={() => { void handleSavePreset(); }}
                    className={C_IMAGESETTINGSPRESETS_5}
                >
                    <Plus className="w-4 h-4" />
                    {t('settings.images.savePreset')}
                </Button>
            </div>

            <div className="space-y-3 relative z-10">
                {presetEntries.length === 0 ? (
                    <div className={C_IMAGESETTINGSPRESETS_6}>
                        <p className="typo-body font-bold text-muted-foreground px-6">
                            {t('settings.images.noPresets')}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-300 overflow-y-auto pr-2 custom-scrollbar">
                        {presetEntries.map(preset => (
                            <div key={preset.id} className={C_IMAGESETTINGSPRESETS_7}>
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className="h-2 w-2 rounded-full bg-primary/40 group-hover/item:bg-primary group-hover/item:scale-125 transition-all" />
                                    <span className="typo-body font-bold text-foreground truncate">{preset.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => { void handleExportPresetShare(preset.id); }}
                                        className="h-8 w-8 text-muted-foreground/40 hover:text-primary hover:bg-primary/10 rounded-xl transition-all hover:scale-110"
                                    >
                                        <Share2 className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => { void handleDeletePreset(preset.id); }}
                                        className={C_IMAGESETTINGSPRESETS_8}
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="bg-muted/20 border border-border/20 rounded-3xl p-6 space-y-4 relative z-10 group/share">
                <div className="flex items-center gap-3 px-1">
                    <Zap className="w-3.5 h-3.5 text-primary" />
                    <div className="typo-body font-bold text-muted-foreground/40">Import / Export Code</div>
                </div>
                <textarea
                    value={presetShareCode}
                    onChange={event => setPresetShareCode(event.target.value)}
                    placeholder={t('settings.images.presetShareCodePlaceholder')}
                    className={C_IMAGESETTINGSPRESETS_9}
                />
                <Button
                    onClick={() => { void handleImportPresetShare(); }}
                    className={C_IMAGESETTINGSPRESETS_10}
                >
                    <Download className="w-3.5 h-3.5" />
                    {t('settings.images.importPresetShare')}
                </Button>
            </div>

            <div className="absolute -right-20 -top-20 w-80 h-80 bg-primary/5 rounded-full blur-3xl opacity-30 pointer-events-none" />
        </div>
    );
};
