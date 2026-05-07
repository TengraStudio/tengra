/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconTerminal } from '@tabler/icons-react';

/* Batch-02: Extracted Long Classes */
const C_TERMINALEMPTYSTATE_1 = "mt-4 px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-lg typo-caption font-bold transition-all border border-primary/30";


type TerminalEmptyStateProps = {
    title: string;
    actionLabel: string;
    onCreate: () => void;
};

export function TerminalEmptyState({ title, actionLabel, onCreate }: TerminalEmptyStateProps) {
    return (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground opacity-50">
            <IconTerminal className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-sm">{title}</p>
            <button
                onClick={onCreate}
                className={C_TERMINALEMPTYSTATE_1}
            >
                {actionLabel}
            </button>
        </div>
    );
}

