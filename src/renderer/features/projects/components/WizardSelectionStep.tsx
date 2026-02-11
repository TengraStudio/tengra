import { ArrowRight, FolderOpen, Plus, Server } from 'lucide-react';
import React from 'react';

import { useTranslation } from '@/i18n';

interface WizardSelectionStepProps {
    onImportLocal: () => void;
    onSSHConnect: () => void;
    onCreateNew: () => void;
}

export const WizardSelectionStep: React.FC<WizardSelectionStepProps> = ({
    onImportLocal,
    onSSHConnect,
    onCreateNew,
}) => {
    const { t } = useTranslation();

    return (
        <div className="flex flex-col items-center justify-center flex-1 h-full py-12">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-5xl mx-auto px-2">
                <button
                    onClick={onImportLocal}
                    className="group relative h-72 bg-card hover:bg-accent/40 border border-border hover:border-primary/50 rounded-3xl p-8 flex flex-col items-center justify-center text-center transition-all duration-300 hover:-translate-y-1 shadow-sm hover:shadow-2xl hover:shadow-primary/10 overflow-hidden"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center text-primary mb-6 ring-1 ring-primary/20 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500">
                        <FolderOpen className="w-12 h-12" />
                    </div>
                    <h3 className="font-black text-2xl text-foreground tracking-tight leading-none">
                        {t('projectWizard.alreadyExists')}
                    </h3>
                    <p className="text-xxs text-muted-foreground mt-4 leading-relaxed font-medium uppercase tracking-wider opacity-70">
                        {t('projectWizard.alreadyExistsDesc')}
                    </p>
                    <div className="absolute bottom-6 opacity-0 group-hover:opacity-100 group-hover:translate-x-2 transition-all duration-300">
                        <ArrowRight className="w-5 h-5 text-primary" />
                    </div>
                </button>

                <button
                    onClick={onSSHConnect}
                    className="group relative h-72 bg-card hover:bg-accent/40 border border-border hover:border-purple/50 rounded-3xl p-8 flex flex-col items-center justify-center text-center transition-all duration-300 hover:-translate-y-1 shadow-sm hover:shadow-2xl hover:shadow-purple-500/10 overflow-hidden"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="w-24 h-24 rounded-3xl bg-accent/5 flex items-center justify-center text-accent mb-6 ring-1 ring-accent/10 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500">
                        <Server className="w-12 h-12" />
                    </div>
                    <h3 className="font-black text-2xl text-foreground tracking-tight leading-none">
                        {t('projectWizard.sshTodo')}
                    </h3>
                    <p className="text-xxs text-muted-foreground mt-4 leading-relaxed font-medium uppercase tracking-wider opacity-70">
                        {t('projectWizard.sshTodoDesc')}
                    </p>
                </button>

                <button
                    onClick={onCreateNew}
                    className="group relative h-72 bg-card hover:bg-accent/40 border border-border hover:border-primary/50 rounded-3xl p-8 flex flex-col items-center justify-center text-center transition-all duration-300 hover:-translate-y-1 shadow-sm hover:shadow-2xl hover:shadow-blue-500/10 overflow-hidden"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-info/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center text-primary mb-6 ring-1 ring-info/20 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500">
                        <Plus className="w-12 h-12" />
                    </div>
                    <h3 className="font-black text-2xl text-foreground tracking-tight leading-none">
                        {t('projectWizard.newCreateTodo')}
                    </h3>
                    <p className="text-xxs text-muted-foreground mt-4 leading-relaxed font-medium uppercase tracking-wider opacity-70">
                        {t('projectWizard.newCreateTodoDesc')}
                    </p>
                    <div className="absolute bottom-6 opacity-0 group-hover:opacity-100 group-hover:translate-x-2 transition-all duration-300">
                        <ArrowRight className="w-5 h-5 text-primary" />
                    </div>
                </button>
            </div>
        </div>
    );
};
