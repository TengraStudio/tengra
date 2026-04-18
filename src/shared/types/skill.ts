/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export interface ProxySkill {
    id: string;
    name: string;
    description: string;
    provider: string;
    content: string;
    enabled: boolean;
    source: string;
    created_at: number;
    updated_at: number;
}

export interface ProxySkillUpsertInput {
    id?: string;
    name: string;
    description?: string;
    provider?: string;
    content: string;
    enabled?: boolean;
}

export interface ProxySkillToggleInput {
    enabled: boolean;
}

export interface ProxyMarketplaceSkillInstallInput {
    id: string;
}

export interface ProxySkillListResponse {
    items: ProxySkill[];
}

export interface ProxySkillItemResponse {
    item: ProxySkill;
}
