/**
 * Category metadata for workspace ideas
 */
import { IdeaCategory } from '@shared/types/ideas';
import {
    Code,
    Gamepad2,
    Globe,
    LucideIcon,
    Monitor,
    Smartphone,
    Sparkles
} from 'lucide-react';

export interface CategoryMeta {
    id: IdeaCategory
    label: string
    icon: LucideIcon
    color: string
    bgColor: string
}

export const CATEGORY_METADATA: Record<IdeaCategory, CategoryMeta> = {
    'website': {
        id: 'website',
        label: 'Website',
        icon: Globe,
        color: 'text-primary',
        bgColor: 'bg-primary/20'
    },
    'mobile-app': {
        id: 'mobile-app',
        label: 'Mobile App',
        icon: Smartphone,
        color: 'text-success',
        bgColor: 'bg-success/20'
    },
    'game': {
        id: 'game',
        label: 'Game',
        icon: Gamepad2,
        color: 'text-purple',
        bgColor: 'bg-purple/20'
    },
    'cli-tool': {
        id: 'cli-tool',
        label: 'CLI Tool',
        icon: Code,
        color: 'text-orange',
        bgColor: 'bg-warning/20'
    },
    'desktop': {
        id: 'desktop',
        label: 'Desktop App',
        icon: Monitor,
        color: 'text-pink',
        bgColor: 'bg-pink/20'
    },
    'other': {
        id: 'other',
        label: 'Other',
        icon: Sparkles,
        color: 'text-warning',
        bgColor: 'bg-yellow/20'
    }
};

/**
 * Compatibility matrix for categories.
 * Maps a category to an array of categories it is NOT compatible with.
 */
export const INCOMPATIBILITY_RULES: Partial<Record<IdeaCategory, IdeaCategory[]>> = {
    'game': ['cli-tool', 'website'],
    'cli-tool': ['game', 'mobile-app'],
    'website': ['game'],
    'mobile-app': ['cli-tool']
};

export const CATEGORIES: IdeaCategory[] = [
    'website',
    'mobile-app',
    'game',
    'cli-tool',
    'desktop',
    'other'
];

export function getCategoryMeta(category: IdeaCategory): CategoryMeta {
    return CATEGORY_METADATA[category];
}
