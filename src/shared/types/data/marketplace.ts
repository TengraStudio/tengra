/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { McpPermission, McpPermissionProfile, MCPServerConfig } from '../system/settings';

export interface MarketplaceItem {
    id: string;
    name: string;
    description: string;
    author: string;
    version: string;
    downloadUrl: string;
    previewUrl?: string;
    itemType: 'theme' | 'mcp' | 'model' | 'prompt' | 'language' | 'code-language-pack' | 'skill' | 'extension' | 'icon-pack';
    installed?: boolean;
    installedVersion?: string;
    updateAvailable?: boolean;
    removable?: boolean;
    downloads?: number;
    pullCount?: number;
}

export interface MarketplaceTheme extends MarketplaceItem {
    appearance: 'dark' | 'light';
    previewColor?: string;
}

export interface MarketplaceMcp extends MarketplaceItem {
    category: string;
    command: string;
    args: string[];
    entrypointUrl?: string;
    entrypointFile?: string;
    env?: Record<string, string>;
    permissionProfile?: McpPermissionProfile;
    permissions?: McpPermission[];
    tools?: MCPServerConfig['tools'];
    storage?: MCPServerConfig['storage'];
    capabilities?: string[];
}

export interface MarketplaceExtension extends MarketplaceItem {
    category: string;
    publisher?: string;
    repository?: string;
}


export interface MarketplaceModelTag {
    id: string;
    name: string;
    size?: string;
    contextWindow?: string;
    inputType?: string;
    modelSize?: string;
    tensorType?: string;
    downloadUrl?: string;
    installed?: boolean;
}

export interface MarketplaceGpuDevice {
    index: number;
    name: string;
    vendorId?: number;
    deviceId?: number;
    vendorString?: string;
    deviceString?: string;
    driverVendor?: string;
    driverVersion?: string;
    active?: boolean;
    backend?: string;
    memoryBytes?: number;
    memoryUsedBytes?: number;
}

export type MarketplaceModelFit = 'recommended' | 'workable' | 'limited' | 'blocked';

export interface MarketplaceModelPerformanceEstimate {
    fit: MarketplaceModelFit;
    score: number;
    backend: 'cpu' | 'gpu';
    confidence: 'high' | 'medium' | 'low';
    selectedVariant?: {
        id: string;
        name: string;
        size?: string;
        contextWindow?: string;
    };
    estimatedTokensPerSecond: number;
    estimatedPromptTokensPerSecond: number;
    estimatedMemoryBytes: number;
    estimatedDiskBytes: number;
    estimatedVramBytes?: number;
    memoryFits: boolean;
    storageFits: boolean;
    vramFits?: boolean;
    cpuHeadroomPercent: number;
    reasons: string[];
}

export interface MarketplaceModel extends MarketplaceItem {
    parameters?: string;
    provider: 'ollama' | 'huggingface' | 'custom';
    source?: 'ollama' | 'huggingface' | 'custom';
    sourceUrl?: string;
    category?: string;
    pipelineTag?: string;
    downloads?: number;
    pullCount?: number;
    likes?: number;
    readme?: string;
    totalSize?: string;
    submodels?: MarketplaceModelTag[];
    performance?: MarketplaceModelPerformanceEstimate;
}

export interface MarketplaceRuntimeProfile {
    system: {
        platform: string;
        arch: string;
        cpuCores: number;
        cpuLoadPercent: number;
        totalMemoryBytes: number;
        freeMemoryBytes: number;
        storageTotalBytes: number;
        storageFreeBytes: number;
        storageUsedBytes: number;
        storageUsagePercent: number;
    };
    gpu: {
        available: boolean;
        source: 'electron' | 'llama' | 'ollama' | 'combined' | 'none';
        name?: string;
        backends: string[];
        devices: MarketplaceGpuDevice[];
        vramBytes?: number;
        vramUsedBytes?: number;
        totalVramBytes?: number;
        totalVramUsedBytes?: number;
    };
    performance: {
        rssBytes: number;
        heapUsedBytes: number;
        processCount: number;
        alertCount: number;
    };
}

export interface MarketplacePrompt extends MarketplaceItem {
    category: string;
}

export interface MarketplaceLanguage extends MarketplaceItem {
    locale: string;
    nativeName: string;
    rtl?: boolean;
    coverage?: number;
    schemaVersion?: string;
}

export interface MarketplaceCodeLanguageConfiguration {
    comments?: {
        lineComment?: string;
        blockComment?: [string, string];
    };
    brackets?: Array<[string, string]>;
    autoClosingPairs?: Array<{
        open: string;
        close: string;
        notIn?: string[];
    }>;
    surroundingPairs?: Array<{
        open: string;
        close: string;
    }>;
}

export interface MarketplaceCodeLanguageContribution {
    id: string;
    displayName: string;
    aliases?: string[];
    extensions?: string[];
    filenames?: string[];
    monacoLanguage?: string;
    textMateScope?: string;
    configuration?: MarketplaceCodeLanguageConfiguration;
    monarch?: Record<string, unknown>;
}

export interface MarketplaceCodeLanguagePack extends MarketplaceItem {
    category?: string;
    languages: MarketplaceCodeLanguageContribution[];
}

export interface MarketplaceSkill extends MarketplaceItem {
    provider?: string;
    content?: string;
    enabled_by_default?: boolean;
}

export interface MarketplaceIconPack extends MarketplaceItem {
    iconVariables?: Record<string, string>;
}

export interface MarketplaceRegistry {
    version: string;
    lastUpdated: string;
    themes: MarketplaceTheme[];
    mcp: MarketplaceMcp[];
    models?: MarketplaceModel[];
    prompts?: MarketplacePrompt[];
    languages?: MarketplaceLanguage[];
    codeLanguagePacks?: MarketplaceCodeLanguagePack[];
    skills?: MarketplaceSkill[];
    extensions?: MarketplaceExtension[];
    iconPacks?: MarketplaceIconPack[];
}

export interface InstallRequest {
    type: 'theme' | 'mcp' | 'model' | 'prompt' | 'language' | 'code-language-pack' | 'skill' | 'extension' | 'icon-pack';
    id: string;
    downloadUrl?: string;
    provider?: MarketplaceModel['provider'];
    sourceUrl?: string;
    category?: string;
    pipelineTag?: string;
    name?: string;
    description?: string;
    author?: string;
    version?: string;
}

export interface InstallResult {
    success: boolean;
    code?: string;
    message?: string;
    path?: string;
    mcpConfig?: MCPServerConfig;
    queuedDownloads?: number;
    downloadIds?: string[];
}

export interface RemoteModelSourceConfig {
    provider: MarketplaceModel['provider'];
    url: string;
}

export interface IndexedModel {
    item: MarketplaceModel;
    order: number;
}
