/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconChevronLeft } from '@tabler/icons-react';
import React from 'react';

import { cn } from '@/lib/utils';

/* Batch-02: Extracted Long Classes */
const C_WIZARDSTEPCONTAINER_1 = "flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-all group px-4 py-2 rounded-xl hover:bg-muted/30 border border-transparent hover:border-border/40 disabled:opacity-40";


interface WizardNavigationButton {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    variant?: 'primary' | 'secondary';
    icon?: React.ReactNode;
}

interface WizardStepContainerProps {
    /** Step title displayed at the top. */
    title?: string;
    /** Step description displayed below the title. */
    description?: string;
    /** Icon rendered next to the title. */
    icon?: React.ReactNode;
    children: React.ReactNode;
    /** Back button configuration. Omit to hide. */
    backButton?: WizardNavigationButton;
    /** Next/Finish button configuration. Omit to hide. */
    nextButton?: WizardNavigationButton;
    /** Additional class for the outer wrapper. */
    className?: string;
    /** Whether to show the footer navigation bar. */
    showFooter?: boolean;
}

/**
 * Generic wizard step wrapper with consistent layout,
 * optional title/description/icon and navigation buttons.
 */
export const WizardStepContainer: React.FC<WizardStepContainerProps> = ({
    title,
    description,
    icon,
    children,
    backButton,
    nextButton,
    className,
    showFooter = true,
}) => {
    return (
        <div className={cn('flex flex-1 flex-col', className)}>
            {(title || description) && (
                <div className="mb-5 space-y-1.5">
                    <div className="flex items-center gap-3">
                        {icon && <div className="text-primary">{icon}</div>}
                        {title && (
                            <h3 className="text-lg font-bold text-foreground">
                                {title}
                            </h3>
                        )}
                    </div>
                    {description && (
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {description}
                        </p>
                    )}
                </div>
            )}

            <div className="flex-1 flex flex-col overflow-auto">{children}</div>

            {showFooter && (backButton || nextButton) && (
                <div className="flex justify-between items-center pt-5 mt-5 border-t border-border/30">
                    {backButton ? (
                        <button
                            type="button"
                            onClick={backButton.onClick}
                            disabled={backButton.disabled}
                            className={C_WIZARDSTEPCONTAINER_1}
                        >
                            <IconChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform duration-200" />
                            <span>{backButton.label}</span>
                        </button>
                    ) : (
                        <div />
                    )}
                    {nextButton && (
                        <button
                            type="button"
                            onClick={nextButton.onClick}
                            disabled={nextButton.disabled}
                            className={cn(
                                'px-8 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-40 disabled:grayscale flex items-center gap-3 shadow-lg relative overflow-hidden group/btn hover:brightness-105 active:scale-95',
                                nextButton.variant === 'secondary'
                                    ? 'bg-muted text-foreground'
                                    : 'bg-primary text-primary-foreground shadow-primary/30 hover:shadow-primary/50'
                            )}
                        >
                            <div className="absolute inset-0 bg-primary-foreground/10 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300" />
                            <span className="relative z-10">{nextButton.label}</span>
                            {nextButton.icon && (
                                <div className="relative z-10 p-1.5 bg-background/20 rounded-xl group-hover/btn:translate-x-1 transition-all duration-300">
                                    {nextButton.icon}
                                </div>
                            )}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};
