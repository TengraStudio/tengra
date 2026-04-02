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
