import { useTranslation } from '@renderer/i18n';
import React from 'react';

import { motion } from '@/lib/framer-motion-compat';

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
            className="absolute bottom-full left-0 mb-2 py-1 bg-popover border border-border rounded-lg shadow-xl z-9999 min-w-[140px] overflow-hidden"
        >
            {availableShells.length > 0 ? (
                availableShells.map(shell => (
                    <button
                        key={shell.id}
                        onClick={() => onCreateTerminal(shell.id)}
                        className="w-full px-3 py-2 text-left text-xs font-medium hover:bg-accent/50 transition-colors flex items-center gap-2 text-foreground"
                    >
                        <span className="opacity-50">&gt;_</span>
                        {shell.name}
                    </button>
                ))
            ) : (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                    {t('terminal.noShellsFound')}
                </div>
            )}
        </motion.div>
    );
};
