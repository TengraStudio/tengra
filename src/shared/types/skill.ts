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
