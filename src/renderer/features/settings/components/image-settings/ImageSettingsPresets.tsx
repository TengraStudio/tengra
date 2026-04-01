import { XCircle } from 'lucide-react';
import React from 'react';

import { ImagePresetEntry } from '../../types';

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
        <div className="rounded-xl border border-border/40 bg-muted/30 p-4">
            <h5 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t('settings.images.presetsTitle')}
            </h5>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <input
                    value={presetName}
                    onChange={event => setPresetName(event.target.value)}
                    placeholder={t('settings.images.presetName')}
                    className="rounded-md border border-border/40 bg-background/40 px-2 py-1.5 text-xs"
                />
                <input
                    value={presetPromptPrefix}
                    onChange={event => setPresetPromptPrefix(event.target.value)}
                    placeholder={t('settings.images.promptPrefix')}
                    className="rounded-md border border-border/40 bg-background/40 px-2 py-1.5 text-xs"
                />
            </div>
            <button
                onClick={() => { void handleSavePreset(); }}
                className="mt-2 rounded-lg border border-primary/35 px-2.5 py-1 tw-text-10 font-bold uppercase tracking-wider text-primary"
            >
                {t('settings.images.savePreset')}
            </button>
            <div className="mt-3 space-y-1.5">
                {presetEntries.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t('settings.images.noPresets')}</p>
                ) : (
                    presetEntries.map(preset => (
                        <div key={preset.id} className="flex items-center justify-between rounded border border-border/40 bg-background/40 px-2 py-1 text-xs">
                            <span className="truncate">{preset.name}</span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => { void handleExportPresetShare(preset.id); }}
                                    className="rounded border border-border/50 px-1.5 py-0.5 tw-text-10 text-muted-foreground"
                                >
                                    {t('settings.images.exportPreset')}
                                </button>
                                <button onClick={() => { void handleDeletePreset(preset.id); }} className="text-destructive">
                                    <XCircle className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
            <div className="mt-3 rounded-lg border border-border/40 bg-background/40 p-2">
                <textarea
                    value={presetShareCode}
                    onChange={event => setPresetShareCode(event.target.value)}
                    placeholder={t('settings.images.presetShareCodePlaceholder')}
                    className="tw-min-h-58 w-full rounded-md border border-border/40 bg-background/40 px-2 py-1.5 font-mono tw-text-10"
                />
                <button
                    onClick={() => { void handleImportPresetShare(); }}
                    className="mt-2 rounded-lg border border-primary/35 px-2.5 py-1 tw-text-10 font-bold uppercase tracking-wider text-primary"
                >
                    {t('settings.images.importPresetShare')}
                </button>
            </div>
        </div>
    );
};
