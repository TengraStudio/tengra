/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconLoader2 } from '@tabler/icons-react';
import React from 'react';

interface SetupLoadingOverlayProps {
    isLoading: boolean;
    step: 'selection' | 'details' | 'ssh-connection' | 'ssh-browser' | 'creating';
    creatingLabel: string;
    loadingLabel: string;
}

export const SetupLoadingOverlay: React.FC<SetupLoadingOverlayProps> = ({
    isLoading,
    step,
    creatingLabel,
    loadingLabel
}) => {
    if (!isLoading) {
        return null;
    }

    return (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-2 z-50 flex items-center justify-center rounded-2xl">
            <div className="flex flex-col items-center gap-4">
                <IconLoader2 className="w-10 h-10 animate-spin text-primary" />
                <span className="text-sm font-medium text-foreground animate-pulse">
                    {step === 'creating' ? creatingLabel : loadingLabel}
                </span>
            </div>
        </div>
    );
};

