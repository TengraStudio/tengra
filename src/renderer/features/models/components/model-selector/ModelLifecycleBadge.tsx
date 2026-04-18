/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { ModelListItem } from '@renderer/features/models/types';
import React from 'react';

interface ModelLifecycleBadgeProps {
    model: Pick<ModelListItem, 'lifecycle' | 'replacementModelId' | 'sunsetDate' | 'description'>;
}

export const ModelLifecycleBadge: React.FC<ModelLifecycleBadgeProps> = ({ model }) => {
    if (!model.lifecycle || model.lifecycle === 'active') {
        return null;
    }

    const label = model.lifecycle === 'retired' ? 'Retired' : 'Deprecated';
    const title = [
        model.description ?? label,
        model.replacementModelId ? `Replacement: ${model.replacementModelId}` : '',
        model.sunsetDate ? `Sunset: ${model.sunsetDate}` : '',
    ].filter(Boolean).join(' | ');

    return (
        <span
            className="text-xxxs font-bold text-warning bg-warning/15 px-1.5 py-0.5 rounded leading-none mr-1 border border-warning/30"
            title={title}
        >
            {label}
        </span>
    );
};
