import {
    BarChart,
    Code,
    Image,
    LucideIcon,
    Mic,
    Palette,
    Rocket,
    Server,
    Settings,
    Shield,
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
            id: 'images',
            label: t('settings.tabs.images'),
            sectionLabel: t('settings.categories.visuals'),
            icon: Image,
        },
        {
            id: 'models',
            label: t('settings.tabs.models'),
            sectionLabel: t('settings.categories.ai'),
            icon: Sparkles,
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
            icon: Mic,
        },
        {
            id: 'voice',
            label: t('voice.interfaceTitle'),
            sectionLabel: t('settings.categories.interaction'),
            icon: Mic,
        },
        {
            id: 'developer',
            label: t('settings.tabs.developer'),
            sectionLabel: t('settings.categories.tools'),
            icon: Code,
        },
        {
            id: 'mcp-servers',
            label: t('settings.tabs.mcpServers'),
            sectionLabel: t('settings.categories.tools'),
            icon: Server,
        },
        {
            id: 'advanced',
            label: t('settings.tabs.advanced'),
            sectionLabel: t('settings.categories.security'),
            icon: Shield,
        },
        {
            id: 'gallery',
            label: t('settings.gallery'),
            sectionLabel: t('settings.categories.app'),
            icon: Image,
        },
        {
            id: 'about',
            label: t('settings.tabs.about'),
            sectionLabel: t('settings.categories.app'),
            icon: Rocket,
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
