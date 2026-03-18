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
            title: t('workspaceWizard.alreadyExists'),
            description: t('workspaceWizard.alreadyExistsDesc'),
            icon: FolderOpen,
            accentColor: 'text-primary',
            accentBg: 'bg-primary/10',
            accentRing: 'ring-primary/30',
        },
        {
            id: 'ssh',
            title: t('workspaceWizard.remoteSSH'),
            description: t('workspaceWizard.remoteSSHDesc'),
            icon: Server,
            accentColor: 'text-purple-500',
            accentBg: 'bg-purple-500/10',
            accentRing: 'ring-purple-500/30',
        },
        {
            id: 'create',
            title: t('workspaceWizard.localWorkspace'),
            description: t('workspaceWizard.localWorkspaceDesc'),
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
            <div className="grid grid-cols-1 gap-5 w-full">
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
