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
            return <Check className="w-5 h-5" />;
        }
        return <ArrowRight className="w-5 h-5" />;
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
            return "bg-purple text-foreground shadow-purple-500/30";
        }
        return "bg-primary text-primary-foreground shadow-primary/30 hover:shadow-primary/50";
    };

    return (
        <div className="flex justify-between items-center pt-6 border-t border-border/30 mt-6 bg-card/50 backdrop-blur-sm -mx-8 px-8 pb-2">
            <button
                onClick={onBack}
                className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-all group px-4 py-2 rounded-xl hover:bg-muted/30 border border-transparent hover:border-border/40"
            >
                <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform duration-200" />
                <span>{backLabel}</span>
            </button>

            <div className="flex gap-4">
                {step !== 'selection' && (
                    <button
                        onClick={onNext}
                        disabled={isNextDisabled}
                        className={cn(
                            'px-8 py-3 rounded-xl font-bold text-sm tracking-tight transition-all disabled:opacity-40 disabled:grayscale flex items-center gap-3 shadow-lg relative overflow-hidden group/btn hover:brightness-105 active:scale-[0.98]',
                            getButtonColor()
                        )}
                    >
                        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300" />
                        <span className="relative z-10">{getButtonLabel()}</span>
                        <div className="relative z-10 p-1.5 bg-black/10 rounded-xl group-hover/btn:translate-x-1 transition-all duration-300">
                            {getButtonContent()}
                        </div>
                    </button>
                )}
            </div>
        </div>
    );
};
