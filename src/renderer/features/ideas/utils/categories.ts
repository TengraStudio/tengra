/**
 * Category metadata for project ideas
 */
import { IdeaCategory } from '@shared/types/ideas'
import {
    Code,
    Gamepad2,
    Globe,
    LucideIcon,
    Monitor,
    Smartphone,
    Sparkles
} from 'lucide-react'

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
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/20'
    },
    'mobile-app': {
        id: 'mobile-app',
        label: 'Mobile App',
        icon: Smartphone,
        color: 'text-green-400',
        bgColor: 'bg-green-500/20'
    },
    'game': {
        id: 'game',
        label: 'Game',
        icon: Gamepad2,
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/20'
    },
    'cli-tool': {
        id: 'cli-tool',
        label: 'CLI Tool',
        icon: Code,
        color: 'text-orange-400',
        bgColor: 'bg-orange-500/20'
    },
    'desktop': {
        id: 'desktop',
        label: 'Desktop App',
        icon: Monitor,
        color: 'text-pink-400',
        bgColor: 'bg-pink-500/20'
    },
    'other': {
        id: 'other',
        label: 'Other',
        icon: Sparkles,
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500/20'
    }
}

/**
 * Compatibility matrix for categories.
 * Maps a category to an array of categories it is NOT compatible with.
 */
export const INCOMPATIBILITY_RULES: Partial<Record<IdeaCategory, IdeaCategory[]>> = {
    'game': ['cli-tool', 'website'],
    'cli-tool': ['game', 'mobile-app'],
    'website': ['game'],
    'mobile-app': ['cli-tool']
}

export const CATEGORIES: IdeaCategory[] = [
    'website',
    'mobile-app',
    'game',
    'cli-tool',
    'desktop',
    'other'
]

export function getCategoryMeta(category: IdeaCategory): CategoryMeta {
    return CATEGORY_METADATA[category]
}
