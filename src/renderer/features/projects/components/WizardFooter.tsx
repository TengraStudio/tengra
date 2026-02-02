import { ArrowRight, Check, ChevronLeft, Loader2 } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';

interface WizardFooterProps {
    step: 'selection' | 'details' | 'ssh-connection' | 'ssh-browser' | 'creating';
    isLoading: boolean;
    formName: string;
    sshHost: string;
    sshUsername: string;
    onBack: () => void;
    onNext: () => void;
    backLabel: string;
    nextLabel: string;
    selectFolderLabel: string;
    connectLabel: string;
}

export const WizardFooter: React.FC<WizardFooterProps> = ({
    step,
    isLoading,
    formName,
    sshHost,
    sshUsername,
    onBack,
    onNext,
    backLabel,
    nextLabel,
    selectFolderLabel,
    connectLabel
}) => {
    if (step === 'creating') {
        return null;
    }

    const isNextDisabled = isLoading ||
        (step === 'details' && !formName) ||
        (step === 'ssh-connection' && (!sshHost || !sshUsername));

    const getButtonContent = () => {
        if (isLoading) {
            return <Loader2 className="w-4 h-4 animate-spin" />;
        }
        if (step === 'ssh-browser') {
            return <Check className="w-4 h-4" />;
        }
        return <ArrowRight className="w-4 h-4" />;
    };

    const getButtonLabel = () => {
        if (step === 'ssh-connection') {
            return connectLabel;
        }
        if (step === 'ssh-browser') {
            return selectFolderLabel;
        }
        return nextLabel;
    };

    const getButtonColor = () => {
        if (step === 'ssh-connection') {
            return "bg-purple text-foreground shadow-purple-500/20";
        }
        return "bg-primary text-primary-foreground shadow-primary/20";
    };

    return (
        <div className="flex justify-between items-center pt-6 border-t border-border/20 mt-auto">
            <button
                onClick={onBack}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
            >
                <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                {backLabel}
            </button>

            <div className="flex gap-3">
                {step !== 'selection' && (
                    <button
                        onClick={onNext}
                        disabled={isNextDisabled}
                        className={cn(
                            "px-6 py-2.5 rounded-xl font-bold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2 shadow-lg",
                            getButtonColor()
                        )}
                    >
                        {getButtonContent()}
                        {getButtonLabel()}
                    </button>
                )}
            </div>
        </div>
    );
};
