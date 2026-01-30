import React from 'react';

export interface ModelListItem {
    id: string;
    label: string;
    disabled: boolean;
    provider: string;
    type: string;
    contextWindow?: number;
    pricing?: {
        input?: number;
        output?: number;
    };
    pinned?: boolean;
}

export interface ModelCategory {
    id: string;
    name: string;
    icon: React.ElementType;
    color: string;
    bg: string;
    providerId: string;
    models: ModelListItem[];
}
