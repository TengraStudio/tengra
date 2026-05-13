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

import {
    SettingsPanel,
    SettingsTabLayout,
} from './SettingsPrimitives';


/**
 * ImageSettingsTab component for managing image generation settings.
 * Allows selecting providers and managing local runtime (SD-CPP).
 */
export const ImageSettingsTab: React.FC<SettingsSharedProps> = ({ settings, t }) => {
    const language = settings?.general.language ?? 'en';

    return (
        <SettingsTabLayout className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <SettingsPanel className="px-0 py-0 bg-transparent w-full">
                <div className="h-60vh min-h-500">
                    <GalleryView language={language} />
                </div>
            </SettingsPanel>
        </SettingsTabLayout>
    );
};

