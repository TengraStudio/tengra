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
            className={`group relative h-[19rem] bg-card hover:bg-muted/10 border border-border/30 hover:border-[var(--border-primary)]/50 rounded-3xl p-7 flex flex-col items-start justify-between text-left transition-all duration-300 hover:-translate-y-1 shadow-sm hover:shadow-[0_14px_30px_rgba(var(--primary),0.12)] overflow-hidden ${className}`}
            style={{
                ['--tw-border-opacity' as string]: undefined,
            }}
        >
            <div
                className={`absolute inset-0 bg-gradient-to-br from-${option.accentColor}/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
            />
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
            <div className="opacity-80 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300">
                <div className={`flex items-center gap-2 ${option.accentColor} font-semibold text-sm`}>
                    <span>Next</span>
                    <ArrowRight className="w-4 h-4" />
                </div>
            </div>
        </button>
    );
};

WizardOptionCard.displayName = 'WizardOptionCard';
