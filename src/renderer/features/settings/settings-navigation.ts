/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
    BarChart,
    Bot,
    Database,
    Image,
    LayoutPanelLeft,
    LucideIcon,
    MonitorCog,
    Palette,
    Puzzle,
    Rocket,
    Settings,
    Share2,
    Sparkles,
    TrendingUp,
    User,
    Users,
} from 'lucide-react';

import type { SettingsCategory } from '@/features/settings/types';

type SettingsTranslationFn = (key: string, options?: Record<string, string | number>) => string;

export interface SettingsNavigationItem {
    id: SettingsCategory
    label: string
    sectionLabel: string
    icon: LucideIcon
}

export interface SettingsNavigationGroup {
    label: string
    items: SettingsNavigationItem[]
}

export function getSettingsNavigationItems(t: SettingsTranslationFn): SettingsNavigationItem[] {
    return [
        {
            id: 'general',
            label: t('settings.tabs.general'),
            sectionLabel: t('settings.categories.general'),
            icon: Settings,
        },

        {
            id: 'editor',
            label: t('settings.tabs.editor'),
            sectionLabel: t('settings.categories.general'),
            icon: LayoutPanelLeft,
        },
        {
            id: 'images',
            label: t('settings.tabs.images'),
            sectionLabel: t('settings.categories.visuals'),
            icon: Image,
        },
        {
            id: 'system',
            label: t('settings.tabs.system'),
            sectionLabel: t('settings.categories.app'),
            icon: MonitorCog,
        },
        {
            id: 'accounts',
            label: t('settings.tabs.accounts'),
            sectionLabel: t('settings.categories.security'),
            icon: User,
        },
        {
            id: 'appearance',
            label: t('settings.tabs.appearance'),
            sectionLabel: t('settings.categories.visuals'),
            icon: Palette,
        },
        {
            id: 'models',
            label: t('settings.tabs.models'),
            sectionLabel: t('settings.categories.ai'),
            icon: Sparkles,
        },
        {
            id: 'memory',
            label: t('settings.tabs.memory'),
            sectionLabel: t('settings.categories.ai'),
            icon: Database,
        },
        {
            id: 'quotas',
            label: t('statistics.connectedAppsUsage'),
            sectionLabel: t('settings.categories.ai'),
            icon: TrendingUp,
        },
        {
            id: 'usage-limits',
            label: t('settings.usage-limits'),
            sectionLabel: t('settings.categories.ai'),
            icon: TrendingUp,
        },
        {
            id: 'statistics',
            label: t('settings.tabs.statistics'),
            sectionLabel: t('settings.categories.insights'),
            icon: BarChart,
        },
        {
            id: 'personas',
            label: t('settings.tabs.personas'),
            sectionLabel: t('settings.categories.customization'),
            icon: Users,
        },
        {
            id: 'speech',
            label: t('settings.tabs.speech'),
            sectionLabel: t('settings.categories.interaction'),
            icon: Bot,
        },
        {
            id: 'social-media',
            label: t('settings.tabs.socialMedia'),
            sectionLabel: t('settings.categories.interaction'),
            icon: Share2,
        },


        {
            id: 'about',
            label: t('settings.tabs.about'),
            sectionLabel: t('settings.categories.app'),
            icon: Rocket,
        },
        {
            id: 'extensions-plugins',
            label: t('settings.tabs.plugins'),
            sectionLabel: t('settings.categories.extensions'),
            icon: Puzzle,
        },
        {
            id: 'extensions-mcp',
            label: t('settings.tabs.mcpServers'),
            sectionLabel: t('settings.categories.extensions'),
            icon: Rocket,
        },
        {
            id: 'extensions-skills',
            label: t('settings.tabs.skills'),
            sectionLabel: t('settings.categories.extensions'),
            icon: Sparkles,
        },
    ];
}

export function groupSettingsNavigationItems(
    items: SettingsNavigationItem[]
): SettingsNavigationGroup[] {
    const groups = new Map<string, SettingsNavigationItem[]>();

    for (const item of items) {
        const existing = groups.get(item.sectionLabel);
        if (existing) {
            existing.push(item);
            continue;
        }
        groups.set(item.sectionLabel, [item]);
    }

    return Array.from(groups.entries()).map(([label, groupItems]) => ({
        label,
        items: groupItems,
    }));
}

export function findSettingsNavigationItem(
    items: SettingsNavigationItem[],
    category: SettingsCategory
): SettingsNavigationItem | null {
    return items.find(item => item.id === category) ?? null;
}
