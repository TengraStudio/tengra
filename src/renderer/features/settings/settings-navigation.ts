/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { type Icon,IconChartBar, IconColumns, IconDatabase, IconDeviceDesktopCog, IconPalette, IconPhoto, IconPuzzle, IconRobot, IconRocket, IconSettings, IconShare2, IconSparkles, IconTrendingUp, IconUser, IconUsers } from '@tabler/icons-react';

import type { SettingsCategory } from '@/features/settings/types';

type SettingsTranslationFn = (key: string, options?: Record<string, string | number>) => string;

export interface SettingsNavigationItem {
    id: SettingsCategory
    label: string
    sectionLabel: string
    icon: Icon
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
            icon: IconSettings,
        },

        {
            id: 'editor',
            label: t('settings.tabs.editor'),
            sectionLabel: t('settings.categories.general'),
            icon: IconColumns,
        },
        {
            id: 'images',
            label: t('settings.tabs.images'),
            sectionLabel: t('settings.categories.visuals'),
            icon: IconPhoto,
        },
        {
            id: 'system',
            label: t('settings.tabs.system'),
            sectionLabel: t('settings.categories.app'),
            icon: IconDeviceDesktopCog,
        },
        {
            id: 'accounts',
            label: t('settings.tabs.accounts'),
            sectionLabel: t('settings.categories.ai'),
            icon: IconUser,
        },
        {
            id: 'appearance',
            label: t('settings.tabs.appearance'),
            sectionLabel: t('settings.categories.visuals'),
            icon: IconPalette,
        },
        {
            id: 'models',
            label: t('settings.tabs.models'),
            sectionLabel: t('settings.categories.ai'),
            icon: IconSparkles,
        },
        {
            id: 'memory',
            label: t('settings.tabs.memory'),
            sectionLabel: t('settings.categories.ai'),
            icon: IconDatabase,
        },
        {
            id: 'quotas',
            label: t('statistics.connectedAppsUsage'),
            sectionLabel: t('settings.categories.ai'),
            icon: IconTrendingUp,
        },
        {
            id: 'usage-limits',
            label: t('settings.usage-limits'),
            sectionLabel: t('settings.categories.ai'),
            icon: IconTrendingUp,
        },
        {
            id: 'statistics',
            label: t('settings.tabs.statistics'),
            sectionLabel: t('settings.categories.insights'),
            icon: IconChartBar,
        },
        {
            id: 'speech',
            label: t('settings.tabs.speech'),
            sectionLabel: t('settings.categories.interaction'),
            icon: IconRobot,
        },
        {
            id: 'social-media',
            label: t('settings.tabs.socialMedia'),
            sectionLabel: t('settings.categories.interaction'),
            icon: IconShare2,
        },


        {
            id: 'about',
            label: t('settings.tabs.about'),
            sectionLabel: t('settings.categories.app'),
            icon: IconRocket,
        },
        {
            id: 'extensions-plugins',
            label: t('settings.tabs.plugins'),
            sectionLabel: t('settings.categories.extensions'),
            icon: IconPuzzle,
        },
        {
            id: 'extensions-mcp',
            label: t('settings.tabs.mcpServers'),
            sectionLabel: t('settings.categories.extensions'),
            icon: IconRocket,
        },
        {
            id: 'extensions-skills',
            label: t('settings.tabs.skills'),
            sectionLabel: t('settings.categories.extensions'),
            icon: IconSparkles,
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
