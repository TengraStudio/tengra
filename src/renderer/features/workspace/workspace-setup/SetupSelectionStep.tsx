/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconFolderOpen, IconPlus, IconServer } from '@tabler/icons-react';
import React from 'react';

import { WizardOption,WizardOptionCard } from '@/components/shared/wizard/WizardOptionCard';
import { useTranslation } from '@/i18n';

interface SetupSelectionStepProps {
    onImportLocal: () => void;
    onSSHConnect: () => void;
    onCreateNew: () => void;
}

export const SetupSelectionStep: React.FC<SetupSelectionStepProps> = ({
    onImportLocal,
    onSSHConnect,
    onCreateNew,
}) => {
    const { t } = useTranslation();

    const options: WizardOption[] = [
        {
            id: 'import',
            title: t('frontend.workspaceWizard.alreadyExists'),
            description: t('frontend.workspaceWizard.alreadyExistsDesc'),
            icon: IconFolderOpen,
            accentColor: 'text-primary',
            accentBg: 'bg-primary/10',
            accentRing: 'ring-primary/30',
        },
        {
            id: 'ssh',
            title: t('frontend.workspaceWizard.remoteSSH'),
            description: t('frontend.workspaceWizard.remoteSSHDesc'),
            icon: IconServer,
            accentColor: 'text-accent-foreground',
            accentBg: 'bg-accent/40',
            accentRing: 'ring-accent/40',
        },
        {
            id: 'create',
            title: t('frontend.workspaceWizard.localWorkspace'),
            description: t('frontend.workspaceWizard.localWorkspaceDesc'),
            icon: IconPlus,
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

