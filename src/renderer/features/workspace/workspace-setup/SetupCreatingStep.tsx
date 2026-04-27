/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconCheck, IconLoader2 } from '@tabler/icons-react';
import React from 'react';

import { useTranslation } from '@/i18n';

export const SetupCreatingStep: React.FC = () => {
    const { t } = useTranslation();

    return (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
            <div className="relative">
                <IconLoader2 className="w-16 h-16 animate-spin text-primary" />
                <IconCheck className="w-6 h-6 text-primary absolute inset-0 m-auto opacity-0 animate-pulse" />
            </div>
            <div>
                <h3 className="text-2xl font-light text-foreground">{t('workspaceWizard.creating')}</h3>
                <p className="text-muted-foreground mt-2 max-w-280 mx-auto text-sm">
                    {t('workspaceWizard.configuring')}
                </p>
            </div>
        </div>
    );
};
