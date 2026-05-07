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

import { useTranslation } from '@/i18n';
import { motion } from '@/lib/framer-motion-compat';

/* Batch-02: Extracted Long Classes */
const C_NEWTERMINALMENU_1 = "absolute bottom-full left-0 mb-2 py-1 bg-popover border border-border rounded-lg shadow-xl z-9999 min-w-140 overflow-hidden";
const C_NEWTERMINALMENU_2 = "w-full px-3 py-2 text-left typo-caption font-medium hover:bg-accent/50 transition-colors flex items-center gap-2 text-foreground";


interface ShellInfo {
    id: string;
    name: string;
    path: string;
}

interface NewTerminalMenuProps {
    availableShells: ShellInfo[];
    onCreateTerminal: (id: string) => void;
}

export const NewTerminalMenu: React.FC<NewTerminalMenuProps> = ({
    availableShells,
    onCreateTerminal,
}) => {
    const { t } = useTranslation();

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={C_NEWTERMINALMENU_1}
        >
            {availableShells.length > 0 ? (
                availableShells.map(shell => (
                    <button
                        key={shell.id}
                        onClick={() => onCreateTerminal(shell.id)}
                        className={C_NEWTERMINALMENU_2}
                    >
                        <span className="opacity-50">&gt;_</span>
                        {shell.name}
                    </button>
                ))
            ) : (
                <div className="px-3 py-2 typo-caption text-muted-foreground">
                    {t('frontend.terminal.noShellsFound')}
                </div>
            )}
        </motion.div>
    );
};

