import { ArrowRight } from 'lucide-react';
import React from 'react';

export interface WizardOption {
    id: string;
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
    accentBg: string;
    accentRing: string;
}

export interface WizardOptionCardProps {
    option: WizardOption;
    onClick: () => void;
    className?: string;
}

/**
 * Reusable wizard option card component for selection steps.
 * Provides a consistent UI pattern for presenting multiple choices in a wizard flow.
 */
export const WizardOptionCard: React.FC<WizardOptionCardProps> = ({
    option,
    onClick,
    className = '',
}) => {
    const Icon = option.icon;

    return (
        <button
            onClick={onClick}
            className={`relative h-[19rem] bg-card border border-border/30 rounded-3xl p-7 flex flex-col items-start justify-between text-left shadow-sm overflow-hidden ${className}`}
        >
            <div
                className={`w-14 h-14 rounded-2xl ${option.accentBg} flex items-center justify-center ${option.accentColor} ring-1 ${option.accentRing}`}
            >
                <Icon className="w-7 h-7" />
            </div>
            <div className="space-y-3">
                <h3 className="font-bold text-2xl text-foreground tracking-tight">
                    {option.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-[260px]">
                    {option.description}
                </p>
            </div>
            <div className="opacity-80">
                <div className={`flex items-center gap-2 ${option.accentColor} font-semibold text-sm`}>
                    <span>Next</span>
                    <ArrowRight className="w-4 h-4" />
                </div>
            </div>
        </button>
    );
};

WizardOptionCard.displayName = 'WizardOptionCard';
