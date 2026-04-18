/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * @fileoverview Shared action controls for form/editor footers
 * @description Provides a standardized Save/Cancel action bar used across feature editors,
 *   modals, and form footers. Supports loading states, disabled conditions, and variant styling.
 */

import { Loader2, Save } from 'lucide-react';
import React from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

import { Button } from '../ui/button';


export interface ActionControlsProps {
    /** Callback fired when the primary action is triggered */
    onSave: () => void;
    /** Callback fired when the cancel action is triggered */
    onCancel: () => void;
    /** Whether the primary action is currently processing */
    isLoading?: boolean;
    /** Whether the primary button should be disabled */
    disabled?: boolean;
    /** Visual variant for the primary button */
    variant?: 'default' | 'destructive';
    /** Override label for the primary button (defaults to common.save) */
    saveLabel?: string;
    /** Override label for the cancel button (defaults to common.cancel) */
    cancelLabel?: string;
    /** Whether to show a save icon on the primary button */
    showIcon?: boolean;
    /** Additional CSS classes for the container */
    className?: string;
}

/**
 * Standardized action controls for editor/form footers.
 * Provides Save and Cancel buttons with loading and disabled states.
 */
export const ActionControls: React.FC<ActionControlsProps> = ({
    onSave,
    onCancel,
    isLoading = false,
    disabled = false,
    variant = 'default',
    saveLabel,
    cancelLabel,
    showIcon = true,
    className,
}) => {
    const { t } = useTranslation();

    const resolvedSaveLabel = saveLabel ?? (isLoading ? t('common.saving') : t('common.save'));
    const resolvedCancelLabel = cancelLabel ?? t('common.cancel');

    return (
        <div className={cn('flex items-center justify-end gap-3', className)}>
            <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
                disabled={isLoading}
            >
                {resolvedCancelLabel}
            </Button>
            <Button
                variant={variant}
                size="sm"
                onClick={onSave}
                disabled={disabled || isLoading}
            >
                {isLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : showIcon ? (
                    <Save className="w-4 h-4 mr-2" />
                ) : null}
                {resolvedSaveLabel}
            </Button>
        </div>
    );
};
