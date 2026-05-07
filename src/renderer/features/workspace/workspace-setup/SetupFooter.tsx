/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconArrowRight, IconCheck, IconChevronLeft, IconLoader2 } from '@tabler/icons-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/* Batch-02: Extracted Long Classes */
const C_WIZARDFOOTER_1 = "flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-all group px-4 py-2 rounded-xl hover:bg-muted/30 border border-transparent hover:border-border/40";


interface SetupFooterProps {
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

export const SetupFooter: React.FC<SetupFooterProps> = ({
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
            return <IconLoader2 className="w-4 h-4 animate-spin" />;
        }
        if (step === 'ssh-browser') {
            return <IconCheck className="w-5 h-5" />;
        }
        return <IconArrowRight className="w-5 h-5" />;
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

    return (
        <div className="flex justify-between items-center pt-6 border-t border-border/30 mt-6 bg-card/50 backdrop-blur-sm -mx-8 px-8 pb-2">
            <Button
                variant="ghost"
                onClick={onBack}
                className={C_WIZARDFOOTER_1}
            >
                <IconChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform duration-200" />
                <span>{backLabel}</span>
            </Button>

            <div className="flex gap-4">
                {step !== 'selection' && (
                    <Button
                        onClick={onNext}
                        disabled={isNextDisabled}
                        className={cn(
                            'h-auto py-3 px-8 rounded-xl font-bold text-sm transition-all flex items-center gap-3 shadow-lg relative overflow-hidden group/btn hover:brightness-105 active:scale-95',
                            step === 'ssh-connection' 
                                ? 'bg-primary text-primary-foreground shadow-primary/30' 
                                : 'bg-primary text-primary-foreground shadow-primary/30 hover:shadow-primary/50'
                        )}
                    >
                        <div className="absolute inset-0 bg-muted/20 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300 pointer-events-none" />
                        <span className="relative z-10">{getButtonLabel()}</span>
                        <div className="relative z-10 p-1.5 bg-background/40 rounded-xl group-hover/btn:translate-x-1 transition-all duration-300">
                            {getButtonContent()}
                        </div>
                    </Button>
                )}
            </div>
        </div>
    );
};

