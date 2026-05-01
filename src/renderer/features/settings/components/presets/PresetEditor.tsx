/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React from 'react';

import { ParameterPreset } from '../ParameterPresets';

/* Batch-02: Extracted Long Classes */
const C_PRESETEDITOR_1 = "flex-1 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 typo-caption font-bold transition-colors";


interface PresetEditorProps {
    preset: ParameterPreset
    onUpdate: (preset: ParameterPreset) => void
    onCancel: () => void
    onSave: () => void
    t: (key: string) => string
}

export const PresetEditor: React.FC<PresetEditorProps> = ({
    preset, onUpdate, onCancel, onSave, t
}) => {
    return (
        <div className="p-4 rounded-xl bg-muted/20 border border-border/50 space-y-3">
            <input
                type="text"
                value={preset.name}
                onChange={(e) => onUpdate({ ...preset, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-background/50 border border-border/50 text-sm text-foreground"
                placeholder={t('frontend.ssh.presets.placeholders.name')}
            />
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="typo-caption text-muted-foreground mb-1 block">{t('frontend.ssh.presets.labels.temperature')}</label>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={preset.temperature}
                        onChange={(e) => onUpdate({ ...preset, temperature: parseFloat(e.target.value) })}
                        className="w-full"
                    />
                    <div className="typo-caption text-center">{preset.temperature}</div>
                </div>
                <div>
                    <label className="typo-caption text-muted-foreground mb-1 block">{t('frontend.ssh.presets.labels.topP')}</label>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={preset.topP}
                        onChange={(e) => onUpdate({ ...preset, topP: parseFloat(e.target.value) })}
                        className="w-full"
                    />
                    <div className="typo-caption text-center">{preset.topP}</div>
                </div>
            </div>
            <div className="flex gap-2">
                <button
                    onClick={onCancel}
                    className="flex-1 py-1.5 rounded-lg bg-muted/30 hover:bg-muted/50 text-muted-foreground typo-caption font-medium transition-colors"
                >
                    {t('common.cancel')}
                </button>
                <button
                    onClick={onSave}
                    className={C_PRESETEDITOR_1}
                >
                    {t('common.save')}
                </button>
            </div>
        </div>
    );
};
