/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { ChangeEventHandler, Ref } from 'react';

import { cn } from '@/lib/utils';

import type { TerminalShortcutPresetId } from '../utils/shortcut-config';

interface TerminalShortcutModalsProps {
    t: (key: string, options?: Record<string, string | number>) => string;
    inputRef: Ref<HTMLInputElement>;
    onImport: ChangeEventHandler<HTMLInputElement>;
    shortcutPreset: TerminalShortcutPresetId;
    applyShortcutPreset: (presetId: TerminalShortcutPresetId) => void;
    exportShortcutPreferences: () => void;
    openImportDialog: () => void;
    shareShortcutPreferences: () => Promise<void>;
    importShortcutShareCode: () => void;
}

export function TerminalShortcutModals({
    t,
    inputRef,
    onImport,
    shortcutPreset,
    applyShortcutPreset,
    exportShortcutPreferences,
    openImportDialog,
    shareShortcutPreferences,
    importShortcutShareCode,
}: TerminalShortcutModalsProps) {
    return (
        <>
            <input
                ref={inputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={onImport}
            />
            <div className="pt-1 border-t border-border/50 space-y-1">
                <div className="typo-overline text-muted-foreground">
                    {t('frontend.terminal.shortcutPresetLabel')}
                </div>
                <div className="grid grid-cols-3 gap-1">
                    {(['default', 'vim', 'emacs'] as TerminalShortcutPresetId[]).map(presetId => (
                        <button
                            key={presetId}
                            onClick={() => {
                                applyShortcutPreset(presetId);
                            }}
                            className={cn(
                                'px-2 py-1 rounded-sm typo-overline border transition-colors capitalize',
                                shortcutPreset === presetId
                                    ? 'bg-accent border-border text-foreground'
                                    : 'bg-transparent border-border/50 text-muted-foreground hover:text-foreground hover:bg-accent/30'
                            )}
                        >
                            {presetId}
                        </button>
                    ))}
                </div>
                <div className="grid grid-cols-2 gap-1">
                    <button
                        onClick={exportShortcutPreferences}
                        className="px-2 py-1 rounded border border-border typo-overline hover:bg-accent/50 transition-colors"
                    >
                        {t('frontend.terminal.exportShortcut')}
                    </button>
                    <button
                        onClick={openImportDialog}
                        className="px-2 py-1 rounded border border-border typo-overline hover:bg-accent/50 transition-colors"
                    >
                        {t('frontend.terminal.importShortcut')}
                    </button>
                    <button
                        onClick={() => {
                            void shareShortcutPreferences();
                        }}
                        className="px-2 py-1 rounded border border-border typo-overline hover:bg-accent/50 transition-colors"
                    >
                        {t('frontend.terminal.shareShortcut')}
                    </button>
                    <button
                        onClick={importShortcutShareCode}
                        className="px-2 py-1 rounded border border-border typo-overline hover:bg-accent/50 transition-colors"
                    >
                        {t('frontend.terminal.applyShortcutCode')}
                    </button>
                </div>
            </div>
        </>
    );
}
