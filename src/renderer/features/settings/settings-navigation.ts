import {
    BarChart,
    Bot,
    Code,
    FolderKanban,
    Image,
    LayoutPanelLeft,
    LucideIcon,
    MonitorCog,
    Palette,
    Puzzle,
    Rocket,
    Settings,
    Share2,
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
            id: 'workspace',
            label: t('settings.tabs.workspace'),
            sectionLabel: t('settings.categories.general'),
            icon: FolderKanban,
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
            id: 'developer',
            label: t('settings.tabs.developer'),
            sectionLabel: t('settings.categories.tools'),
            icon: Code,
        },
        {
            id: 'advanced',
            label: t('settings.tabs.advanced'),
            sectionLabel: t('settings.categories.security'),
            icon: Shield,
        },
        {
            id: 'about',
            label: t('settings.tabs.about'),
            sectionLabel: t('settings.categories.app'),
            icon: Rocket,
        },
        {
            id: 'extensions',
            label: t('settings.tabs.extensions'),
            sectionLabel: t('settings.categories.tools'),
            icon: Puzzle,
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
