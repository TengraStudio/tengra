import { XCircle } from 'lucide-react';
import React from 'react';

import { ImagePresetEntry } from '../../types';

interface ImageSettingsPresetsProps {
    presetEntries: ImagePresetEntry[];
    presetName: string;
    setPresetName: (name: string) => void;
    presetPromptPrefix: string;
    setPresetPromptPrefix: (prefix: string) => void;
    handleSavePreset: () => Promise<void>;
    handleDeletePreset: (id: string) => Promise<void>;
    t: (key: string) => string | undefined;
}

export const ImageSettingsPresets: React.FC<ImageSettingsPresetsProps> = ({
    presetEntries,
    presetName,
    setPresetName,
    presetPromptPrefix,
    setPresetPromptPrefix,
    handleSavePreset,
    handleDeletePreset,
    t,
}) => {
    return (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <h5 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t('settings.images.presetsTitle')}
            </h5>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <input
                    value={presetName}
                    onChange={event => setPresetName(event.target.value)}
                    placeholder={t('settings.images.presetName') || 'Preset Name'}
                    className="rounded-md border border-white/10 bg-black/10 px-2 py-1.5 text-xs"
                />
                <input
                    value={presetPromptPrefix}
                    onChange={event => setPresetPromptPrefix(event.target.value)}
                    placeholder={t('settings.images.promptPrefix') || 'Prompt Prefix'}
                    className="rounded-md border border-white/10 bg-black/10 px-2 py-1.5 text-xs"
                />
            </div>
            <button
                onClick={() => { void handleSavePreset(); }}
                className="mt-2 rounded-lg border border-primary/35 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary"
            >
                {t('settings.images.savePreset')}
            </button>
            <div className="mt-3 space-y-1.5">
                {presetEntries.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t('settings.images.noPresets')}</p>
                ) : (
                    presetEntries.map(preset => (
                        <div key={preset.id} className="flex items-center justify-between rounded border border-white/10 bg-black/10 px-2 py-1 text-xs">
                            <span className="truncate">{preset.name}</span>
                            <button onClick={() => { void handleDeletePreset(preset.id); }} className="text-destructive">
                                <XCircle className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
