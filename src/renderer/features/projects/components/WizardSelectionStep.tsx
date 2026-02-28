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
        <div className="flex flex-col justify-center flex-1 h-full">
            <div className="mb-6 px-2">
                <h3 className="text-lg font-bold text-foreground">{t('projectWizard.title')}</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full">
                <button
                    onClick={onImportLocal}
                    className="group relative h-[19rem] bg-card hover:bg-muted/10 border border-border/30 hover:border-primary/50 rounded-3xl p-7 flex flex-col items-start justify-between text-left transition-all duration-300 hover:-translate-y-1 shadow-sm hover:shadow-[0_14px_30px_rgba(var(--primary),0.12)] overflow-hidden"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary ring-1 ring-primary/30">
                        <FolderOpen className="w-7 h-7" />
                    </div>
                    <div className="space-y-3">
                        <h3 className="font-bold text-2xl text-foreground tracking-tight">
                            {t('projectWizard.alreadyExists')}
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed max-w-[260px]">
                            {t('projectWizard.alreadyExistsDesc')}
                        </p>
                    </div>
                    <div className="opacity-80 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300">
                        <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                            <span>{t('projectWizard.next')}</span>
                            <ArrowRight className="w-4 h-4" />
                        </div>
                    </div>
                </button>

                <button
                    onClick={onSSHConnect}
                    className="group relative h-[19rem] bg-card hover:bg-muted/10 border border-border/30 hover:border-purple/50 rounded-3xl p-7 flex flex-col items-start justify-between text-left transition-all duration-300 hover:-translate-y-1 shadow-sm hover:shadow-[0_14px_30px_rgba(var(--purple),0.12)] overflow-hidden"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-500 ring-1 ring-purple-500/30">
                        <Server className="w-7 h-7" />
                    </div>
                    <div className="space-y-3">
                        <h3 className="font-bold text-2xl text-foreground tracking-tight">
                            {t('projectWizard.remoteSSH')}
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed max-w-[260px]">
                            {t('projectWizard.remoteSSHDesc')}
                        </p>
                    </div>
                    <div className="opacity-80 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300">
                        <div className="flex items-center gap-2 text-purple-500 font-semibold text-sm">
                            <span>{t('projectWizard.next')}</span>
                            <ArrowRight className="w-4 h-4" />
                        </div>
                    </div>
                </button>

                <button
                    onClick={onCreateNew}
                    className="group relative h-[19rem] bg-card hover:bg-muted/10 border border-border/30 hover:border-info/50 rounded-3xl p-7 flex flex-col items-start justify-between text-left transition-all duration-300 hover:-translate-y-1 shadow-sm hover:shadow-[0_14px_30px_rgba(var(--info),0.12)] overflow-hidden"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-info/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="w-14 h-14 rounded-2xl bg-info/10 flex items-center justify-center text-info ring-1 ring-info/30">
                        <Plus className="w-7 h-7" />
                    </div>
                    <div className="space-y-3">
                        <h3 className="font-bold text-2xl text-foreground tracking-tight">
                            {t('projectWizard.localProject')}
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed max-w-[260px]">
                            {t('projectWizard.localProjectDesc')}
                        </p>
                    </div>
                    <div className="opacity-80 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300">
                        <div className="flex items-center gap-2 text-info font-semibold text-sm">
                            <span>{t('projectWizard.next')}</span>
                            <ArrowRight className="w-4 h-4" />
                        </div>
                    </div>
                </button>
            </div>
        </div>
    );
};
