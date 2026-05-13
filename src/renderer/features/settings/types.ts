/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export type SettingsCategory =
    | 'accounts'
    | 'general'
    | 'editor'
    | 'appearance'
    | 'system'
    | 'models'
    | 'memory'
    | 'skills'
    | 'quotas'
    | 'statistics'
    | 'speech'
    | 'about'
    | 'images'
    | 'extensions'
    | 'extensions-plugins'
    | 'extensions-mcp'
    | 'extensions-skills'
    | 'usage-limits'
    | 'social-media'
    | 'ai-instructions';

export type DetailedStats = Awaited<ReturnType<Window['electron']['db']['getDetailedStats']>>
export type AuthStatusState = { codex: boolean; claude: boolean; antigravity: boolean; ollama: boolean; cursor: boolean; copilot?: boolean }
export type BrowserOAuthProvider = 'codex' | 'claude' | 'antigravity' | 'ollama' | 'cursor'
export type DeviceAuthProvider = 'copilot'
export type SettingsAuthProvider = BrowserOAuthProvider | DeviceAuthProvider
export interface AuthBusyState {
    provider: SettingsAuthProvider
    state?: string
    accountId?: string
    initialAccountIds?: string[]
    startedAt: number
}
export type AuthFile = { provider?: string; type?: string; name?: string }
export interface AccountWrapper<T> {
    accounts: (T & { accountId?: string; email?: string; error?: string; isActive?: boolean })[]
}

export type ImageProvider = 'antigravity' | 'ollama' | 'sd-webui' | 'comfyui' | 'sd-cpp';

export interface ImageHistoryEntry {
    id: string;
    provider: string;
    prompt: string;
    width: number;
    height: number;
    steps: number;
    cfgScale: number;
    imagePath: string;
    createdAt: number;
}

export interface ImagePresetEntry {
    id: string;
    name: string;
    promptPrefix?: string;
    width: number;
    height: number;
    steps: number;
    cfgScale: number;
}

export interface ImageScheduleEntry {
    id: string;
    runAt: number;
    priority: 'low' | 'normal' | 'high';
    resourceProfile: 'balanced' | 'quality' | 'speed';
    status: string;
    options: {
        prompt: string;
    };
}

export interface ImageComparisonResult {
    ids: string[];
    comparedAt?: number;
    entries?: Array<{
        id: string;
        path: string;
        width: number;
        height: number;
        steps: number;
        cfgScale: number;
        seed: number;
        prompt: string;
        fileSizeBytes: number;
        bytesPerPixel: number;
    }>;
    summary: {
        averageFileSizeBytes: number;
        averageBytesPerPixel?: number;
        smallestFileId?: string;
        largestFileId?: string;
    };
}

export interface ImageWorkflowTemplateEntry {
    id: string;
    name: string;
    description?: string;
    workflow: Record<string, RendererDataValue>;
    createdAt: number;
    updatedAt: number;
}

export * from './types/props';

