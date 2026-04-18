/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React from 'react';

import { GalleryView } from '@/components/shared/GalleryView';

import type { SettingsSharedProps } from '../types';


/**
 * ImageSettingsTab component for managing image generation settings.
 * Allows selecting providers and managing local runtime (SD-CPP).
 */
export const ImageSettingsTab: React.FC<SettingsSharedProps> = ({ settings, }) => {
    const language = settings?.general.language ?? 'en';

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000 ease-out pb-20">
            <div className="space-y-6 pt-12 border-t border-border/20 group/gallery">
                <div className={"rounded-3xl border border-border/20 bg-muted/20 overflow-hidden shadow-sm group-hover/gallery:border-border/40 transition-all duration-500"}>
                    <div className="h-60vh min-h-500">
                        <GalleryView language={language} />
                    </div>
                </div>
            </div>
        </div>
    );
};
