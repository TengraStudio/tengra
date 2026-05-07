/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconArrowRight } from '@tabler/icons-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

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
    const { t } = useTranslation();

    return (
        <Button
            variant="ghost"
            onClick={onClick}
            className={cn(
                'relative h-80 bg-card border border-border/30 rounded-3xl p-7 flex flex-col items-start justify-between text-left shadow-sm overflow-hidden hover:bg-muted/10 hover:border-border/60 transition-all group',
                className
            )}
        >
            <div
                className={cn(
                    'w-14 h-14 rounded-2xl flex items-center justify-center ring-1 group-hover:scale-110 transition-transform duration-300',
                    option.accentBg,
                    option.accentColor,
                    option.accentRing
                )}
            >
                <Icon className="w-7 h-7" />
            </div>
            <div className="space-y-3">
                <h3 className="font-bold text-2xl text-foreground group-hover:text-primary transition-colors">
                    {option.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-64">
                    {option.description}
                </p>
            </div>
            <div className="opacity-80">
                <div className={cn('flex items-center gap-2 font-semibold text-sm group-hover:translate-x-1 transition-transform', option.accentColor)}>
                    <span>{t('common.next')}</span>
                    <IconArrowRight className="w-4 h-4" />
                </div>
            </div>
        </Button>
    );
};

WizardOptionCard.displayName = 'WizardOptionCard';

