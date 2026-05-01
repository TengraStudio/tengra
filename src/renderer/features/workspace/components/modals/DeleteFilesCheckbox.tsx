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

/* Batch-02: Extracted Long Classes */
const C_DELETEFILESCHECKBOX_1 = "flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50 cursor-pointer hover:bg-muted/50 transition-colors group";
const C_DELETEFILESCHECKBOX_2 = "peer appearance-none w-5 h-5 border border-border/50 rounded bg-muted/20 checked:bg-destructive checked:border-destructive transition-all cursor-pointer";


interface DeleteFilesCheckboxProps {
    checked: boolean;
    onChange: (b: boolean) => void;
    t: (key: string) => string;
}

export const DeleteFilesCheckbox: React.FC<DeleteFilesCheckboxProps> = ({ checked, onChange, t }) => (
    <label className={C_DELETEFILESCHECKBOX_1}>
        <div className="relative flex items-center justify-center w-5 h-5">
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className={C_DELETEFILESCHECKBOX_2}
            />
            <svg
                className="absolute w-3.5 h-3.5 text-foreground opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
        </div>
        <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground group-hover:text-destructive transition-colors">
                {t('frontend.workspaces.deleteWorkspaceFiles')}
            </span>
            {checked && (
                <span className="text-sm text-destructive font-bold animate-pulse">
                    {t('frontend.workspaceModals.permanentDeletionWarning')}
                </span>
            )}
        </div>
    </label>
);
