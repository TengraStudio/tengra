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
        <div className="absolute inset-0 z-40 bg-background/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-xl border border-border/50 bg-background p-5 space-y-3">
                <h3 className="text-sm font-semibold">
                    {t('workspace.shortcutHelpTitle')}
                </h3>
                <ul className="typo-caption text-muted-foreground space-y-2">
                    <li>{t('workspace.shortcutCombos.quickSwitch')} — {t('workspace.quickSwitch')}</li>
                    <li>{t('workspace.shortcutCombos.closeTab')} — {t('workspace.closeTab')}</li>
                    <li>{t('workspace.shortcutCombos.toggleHelp')} — {t('workspace.shortcuts')}</li>
                    <li>{t('workspace.shortcutCombos.toggleTerminal')} — {t('workspace.toggleTerminal')}</li>
                </ul>
            </div>
        </div>
    );
};
