import React from 'react';

export interface ModelListItem {
    id: string;
    label: string;
    disabled: boolean;
    disabledReason?: string;
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
    isLocal?: boolean;
    isFree?: boolean;
    supportsReasoning?: boolean;
    lifecycle?: 'active' | 'deprecated' | 'retired';
    replacementModelId?: string;
    sunsetDate?: string;
    score?: number;
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
    category?: 'coding' | 'chat' | 'multimodal' | 'embedding' | 'reasoning' | 'general'
    recommendationScore?: number
    longDescriptionMarkdown?: string
    provider: 'huggingface'
}

export interface OllamaLibraryModel {
    name: string
    description: string
    tags: string[]
    provider: 'ollama'
    pulls?: string
    lastUpdated?: string
    longDescriptionHtml?: string
    versions?: Array<{
        version: string
        size: string
        maxContext: string
        inputType: string
        digest: string
    }>
}

export type UnifiedModel = HFModel | OllamaLibraryModel

export interface HFFile {
    path: string
    size: number
    oid: string
    quantization: string
    compatibility?: {
        compatible: boolean
        reasons: string[]
        estimatedRamGB: number
        estimatedVramGB: number
    }
}

