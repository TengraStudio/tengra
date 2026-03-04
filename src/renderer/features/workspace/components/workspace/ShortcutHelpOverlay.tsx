import React from 'react';

interface ShortcutHelpOverlayProps {
    visible: boolean;
    t: (key: string) => string;
}

/** Full-screen overlay showing workspace keyboard shortcuts. */
export const ShortcutHelpOverlay: React.FC<ShortcutHelpOverlayProps> = ({ visible, t }) => {
    if (!visible) {
        return null;
    }

    return (
        <div className="absolute inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-xl border border-border/50 bg-background p-5 space-y-3">
                <h3 className="text-sm font-semibold">
                    {t('workspace.shortcuts') || 'Workspace Shortcuts'}
                </h3>
                <ul className="text-xs text-muted-foreground space-y-2">
                    <li>Ctrl/Cmd + K — {t('shortcuts.commandPalette') || 'Command palette'}</li>
                    <li>Ctrl/Cmd + P — {t('workspace.quickSwitch') || 'Quick switch tabs'}</li>
                    <li>Ctrl/Cmd + W — {t('workspace.closeTab') || 'Close current tab'}</li>
                    <li>Ctrl/Cmd + / — {t('workspace.shortcuts') || 'Toggle this help'}</li>
                    <li>` — {t('workspace.run') || 'Toggle terminal'}</li>
                </ul>
            </div>
        </div>
    );
};
