import { RotateCcw, Save, Settings } from 'lucide-react';
import React from 'react';

interface SettingsHeaderProps {
    t: (key: string) => string;
    projectTitle: string;
    isDirty: boolean;
    onReset: () => void;
    onSave: () => void;
}

export const SettingsHeader: React.FC<SettingsHeaderProps> = ({
    t,
    projectTitle,
    isDirty,
    onReset,
    onSave,
}) => (
    <div className="px-6 py-4 border-b border-border/40 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Settings className="w-5 h-5" />
            </div>
            <div>
                <h2 className="text-lg font-semibold text-foreground">
                    {t('projects.projectSettings')}
                </h2>
                <p className="text-xs text-muted-foreground">{projectTitle}</p>
            </div>
        </div>

        <div className="flex items-center gap-3">
            <button
                onClick={onReset}
                disabled={!isDirty}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-white/5 transition-colors disabled:opacity-30"
            >
                <RotateCcw className="w-4 h-4" />
                {t('common.reset') || 'Reset'}
            </button>
            <button
                onClick={onSave}
                disabled={!isDirty}
                className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50 shadow-lg shadow-primary/20"
            >
                <Save className="w-4 h-4" />
                {t('common.save') || 'Save Changes'}
            </button>
        </div>
    </div>
);
