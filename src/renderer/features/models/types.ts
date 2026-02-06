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
    thinkingLevels?: string[];
    description?: string;
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

export interface HFModel {
    id: string
    name: string
    author: string
    description: string
    downloads: number
    likes: number
    tags: string[]
    lastModified: string
    provider: 'huggingface'
}

export interface OllamaLibraryModel {
    name: string
    description: string
    tags: string[]
    provider: 'ollama'
    pulls?: string
}

export type UnifiedModel = HFModel | OllamaLibraryModel

export interface HFFile {
    path: string
    size: number
    oid: string
    quantization: string
}

