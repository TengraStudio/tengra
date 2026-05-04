/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { OllamaModel } from '@/types/ai';

export interface TokenTimelineItem {
    promptTokens: number;
    completionTokens: number;
    timestamp?: number;
    date?: string;
}

export interface StatisticsData {
    tokenTimeline: TokenTimelineItem[];
    chatCount: number;
    messageCount: number;
    totalTokens: number;
}

export interface ProxyModel {
    id: string;
    object: string;
    created: number;
    owned_by: string;
    name?: string; // Some providers might use name
}

export type InstalledModel = OllamaModel;

export interface CombinedModel {
    id: string;
    sources: string[];
    details?: InstalledModel | ProxyModel;
}

export interface BenchmarkResult {
    tokensPerSec: number;
    latency: number;
}




export interface GroupedModel {
    id: string;
    provider: string;
    models: InstalledModel[];
}
