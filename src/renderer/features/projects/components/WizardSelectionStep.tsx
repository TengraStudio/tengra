import { FolderOpen, Plus, Server } from 'lucide-react';
import React from 'react';

import { WizardOption,WizardOptionCard } from '@/components/shared/wizard/WizardOptionCard';
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

    const options: WizardOption[] = [
        {
            id: 'import',
            title: t('projectWizard.alreadyExists'),
            description: t('projectWizard.alreadyExistsDesc'),
            icon: FolderOpen,
            accentColor: 'text-primary',
            accentBg: 'bg-primary/10',
            accentRing: 'ring-primary/30',
        },
        {
            id: 'ssh',
            title: t('projectWizard.remoteSSH'),
            description: t('projectWizard.remoteSSHDesc'),
            icon: Server,
            accentColor: 'text-purple-500',
            accentBg: 'bg-purple-500/10',
            accentRing: 'ring-purple-500/30',
        },
        {
            id: 'create',
            title: t('projectWizard.localProject'),
            description: t('projectWizard.localProjectDesc'),
            icon: Plus,
            accentColor: 'text-info',
            accentBg: 'bg-info/10',
            accentRing: 'ring-info/30',
        },
    ];

    const handleOptionClick = (optionId: string) => {
        switch (optionId) {
            case 'import':
                onImportLocal();
                break;
            case 'ssh':
                onSSHConnect();
                break;
            case 'create':
                onCreateNew();
                break;
        }
    };

    return (
        <div className="flex flex-col justify-center flex-1 h-full">
            <div className="mb-6 px-2">
                <h3 className="text-lg font-bold text-foreground">{t('projectWizard.title')}</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full">
                {options.map((option) => (
                    <WizardOptionCard
                        key={option.id}
                        option={option}
                        onClick={() => handleOptionClick(option.id)}
                    />
                ))}
            </div>
        </div>
    );
};
