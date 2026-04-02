import { Loader2 } from 'lucide-react';
import React from 'react';

interface WizardLoadingOverlayProps {
    isLoading: boolean;
    step: 'selection' | 'details' | 'ssh-connection' | 'ssh-browser' | 'creating';
    creatingLabel: string;
    loadingLabel: string;
}

export const WizardLoadingOverlay: React.FC<WizardLoadingOverlayProps> = ({
    isLoading,
    step,
    creatingLabel,
    loadingLabel
}) => {
    if (!isLoading) {
        return null;
    }

    return (
        <div className="absolute inset-0 bg-background/80 tw-backdrop-blur-2 z-50 flex items-center justify-center rounded-2xl">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <span className="text-sm font-medium text-foreground animate-pulse">
                    {step === 'creating' ? creatingLabel : loadingLabel}
                </span>
            </div>
        </div>
    );
};
