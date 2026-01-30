import { Check, Loader2 } from 'lucide-react';
import React from 'react';

import { useTranslation } from '@/i18n';

export const WizardCreatingStep: React.FC = () => {
    const { t } = useTranslation();

    return (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
            <div className="relative">
                <Loader2 className="w-16 h-16 animate-spin text-primary" />
                <Check className="w-6 h-6 text-primary absolute inset-0 m-auto opacity-0 animate-pulse" />
            </div>
            <div>
                <h3 className="text-2xl font-light text-foreground">{t('projectWizard.creating')}</h3>
                <p className="text-muted-foreground mt-2 max-w-[280px] mx-auto text-sm">
                    {t('projectWizard.configuring')}
                </p>
            </div>
        </div>
    );
};
