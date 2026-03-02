import { Check } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';

interface WizardProgressStep {
    id: string;
    label: string;
}

interface WizardProgressProps {
    steps: WizardProgressStep[];
    currentStepIndex: number;
    /** If provided, steps become clickable. */
    onStepClick?: (index: number) => void;
    className?: string;
}

/**
 * Numbered step progress indicator with labels.
 * Shows completed steps with checkmarks, highlights current step.
 */
export const WizardProgress: React.FC<WizardProgressProps> = ({
    steps,
    currentStepIndex,
    onStepClick,
    className,
}) => {
    return (
        <div className={cn('flex items-center gap-1', className)}>
            {steps.map((step, index) => {
                const isCompleted = index < currentStepIndex;
                const isCurrent = index === currentStepIndex;
                const isClickable = !!onStepClick;

                return (
                    <React.Fragment key={step.id}>
                        <button
                            type="button"
                            disabled={!isClickable}
                            onClick={() => onStepClick?.(index)}
                            className={cn(
                                'flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-300',
                                isClickable && 'cursor-pointer hover:bg-muted/30',
                                !isClickable && 'cursor-default',
                                isCurrent && 'bg-primary/10 text-primary',
                                isCompleted && 'text-success',
                                !isCurrent && !isCompleted && 'text-muted-foreground'
                            )}
                        >
                            <span
                                className={cn(
                                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-all duration-300',
                                    isCurrent && 'bg-primary text-primary-foreground shadow-[0_0_10px_rgba(var(--primary),0.35)]',
                                    isCompleted && 'bg-success/20 text-success',
                                    !isCurrent && !isCompleted && 'bg-muted/30 text-muted-foreground'
                                )}
                            >
                                {isCompleted ? <Check className="h-3.5 w-3.5" /> : index + 1}
                            </span>
                            <span className="hidden sm:inline truncate">{step.label}</span>
                        </button>
                        {index < steps.length - 1 && (
                            <div
                                className={cn(
                                    'h-px flex-1 min-w-[12px] transition-all duration-500',
                                    index < currentStepIndex ? 'bg-success/50' : 'bg-border/40'
                                )}
                            />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
};
