import type { ChangeEventHandler, Ref } from 'react';

import { cn } from '@/lib/utils';

import type { TerminalShortcutPresetId } from '../utils/shortcut-config';

interface TerminalShortcutModalsProps {
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
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Shortcut Preset
                </div>
                <div className="grid grid-cols-3 gap-1">
                    {(['default', 'vim', 'emacs'] as TerminalShortcutPresetId[]).map(presetId => (
                        <button
                            key={presetId}
                            onClick={() => {
                                applyShortcutPreset(presetId);
                            }}
                            className={cn(
                                'px-2 py-1 rounded-sm text-[11px] border transition-colors capitalize',
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
                        className="px-2 py-1 rounded border border-border text-[11px] hover:bg-accent/50 transition-colors"
                    >
                        Export
                    </button>
                    <button
                        onClick={openImportDialog}
                        className="px-2 py-1 rounded border border-border text-[11px] hover:bg-accent/50 transition-colors"
                    >
                        Import
                    </button>
                    <button
                        onClick={() => {
                            void shareShortcutPreferences();
                        }}
                        className="px-2 py-1 rounded border border-border text-[11px] hover:bg-accent/50 transition-colors"
                    >
                        Share
                    </button>
                    <button
                        onClick={importShortcutShareCode}
                        className="px-2 py-1 rounded border border-border text-[11px] hover:bg-accent/50 transition-colors"
                    >
                        Apply Code
                    </button>
                </div>
            </div>
        </>
    );
}
