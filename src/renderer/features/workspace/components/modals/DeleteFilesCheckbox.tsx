import React from 'react';

interface DeleteFilesCheckboxProps {
    checked: boolean;
    onChange: (b: boolean) => void;
    t: (key: string) => string;
}

export const DeleteFilesCheckbox: React.FC<DeleteFilesCheckboxProps> = ({ checked, onChange, t }) => (
    <label className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50 cursor-pointer hover:bg-muted/50 transition-colors group">
        <div className="relative flex items-center justify-center w-5 h-5">
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="peer appearance-none w-5 h-5 border border-border/50 rounded bg-muted/20 checked:bg-destructive checked:border-destructive transition-all cursor-pointer"
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
                {t('workspaces.deleteWorkspaceFiles')}
            </span>
            {checked && (
                <span className="text-xxs text-destructive font-bold uppercase animate-pulse">
                    {t('workspaceModals.permanentDeletionWarning')}
                </span>
            )}
        </div>
    </label>
);
