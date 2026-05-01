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
            label: t('frontend.settings.tabs.general'),
            sectionLabel: t('frontend.settings.categories.general'),
            icon: IconSettings,
        },

        {
            id: 'editor',
            label: t('frontend.settings.tabs.editor'),
            sectionLabel: t('frontend.settings.categories.general'),
            icon: IconColumns,
        },
        {
            id: 'images',
            label: t('frontend.settings.tabs.images'),
            sectionLabel: t('frontend.settings.categories.visuals'),
            icon: IconPhoto,
        },
        {
            id: 'system',
            label: t('frontend.settings.tabs.system'),
            sectionLabel: t('frontend.settings.categories.app'),
            icon: IconDeviceDesktopCog,
        },
        {
            id: 'accounts',
            label: t('frontend.settings.tabs.accounts'),
            sectionLabel: t('frontend.settings.categories.ai'),
            icon: IconUser,
        },
        {
            id: 'appearance',
            label: t('frontend.settings.tabs.appearance'),
            sectionLabel: t('frontend.settings.categories.visuals'),
            icon: IconPalette,
        },
        {
            id: 'models',
            label: t('frontend.settings.tabs.models'),
            sectionLabel: t('frontend.settings.categories.ai'),
            icon: IconSparkles,
        },
        {
            id: 'memory',
            label: t('frontend.settings.tabs.memory'),
            sectionLabel: t('frontend.settings.categories.ai'),
            icon: IconDatabase,
        },
        {
            id: 'quotas',
            label: t('frontend.statistics.connectedAppsUsage'),
            sectionLabel: t('frontend.settings.categories.ai'),
            icon: IconTrendingUp,
        },
        {
            id: 'usage-limits',
            label: t('frontend.settings.usage-limits'),
            sectionLabel: t('frontend.settings.categories.ai'),
            icon: IconTrendingUp,
        },
        {
            id: 'statistics',
            label: t('frontend.settings.tabs.statistics'),
            sectionLabel: t('frontend.settings.categories.insights'),
            icon: IconChartBar,
        },
        {
            id: 'speech',
            label: t('frontend.settings.tabs.speech'),
            sectionLabel: t('frontend.settings.categories.interaction'),
            icon: IconRobot,
        },
        {
            id: 'social-media',
            label: t('frontend.settings.tabs.socialMedia'),
            sectionLabel: t('frontend.settings.categories.interaction'),
            icon: IconShare2,
        },


        {
            id: 'about',
            label: t('frontend.settings.tabs.about'),
            sectionLabel: t('frontend.settings.categories.app'),
            icon: IconRocket,
        },
        {
            id: 'extensions-plugins',
            label: t('frontend.settings.tabs.plugins'),
            sectionLabel: t('frontend.settings.categories.extensions'),
            icon: IconPuzzle,
        },
        {
            id: 'extensions-mcp',
            label: t('frontend.settings.tabs.mcpServers'),
            sectionLabel: t('frontend.settings.categories.extensions'),
            icon: IconRocket,
        },
        {
            id: 'extensions-skills',
            label: t('frontend.settings.tabs.skills'),
            sectionLabel: t('frontend.settings.categories.extensions'),
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
