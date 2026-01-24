import { IdeaCategory } from '@shared/types/ideas'
import React, { useMemo } from 'react'

import { useTranslation } from '@/i18n'
import { cn } from '@/lib/utils'

import { CATEGORIES, getCategoryMeta, INCOMPATIBILITY_RULES } from '../utils/categories'

interface CategorySelectorProps {
    selected: IdeaCategory[]
    onChange: (categories: IdeaCategory[]) => void
    disabled?: boolean
}

export const CategorySelector: React.FC<CategorySelectorProps> = ({
    selected,
    onChange,
    disabled = false
}) => {
    const { t } = useTranslation()

    // Helper to check if a category is incompatible with current selection
    const getIncompatibilityInfo = useMemo(() => {
        return (category: IdeaCategory) => {
            const rules = INCOMPATIBILITY_RULES[category]
            if (!rules) { return null }

            const incompatibleWith = selected.find(s => rules.includes(s))
            if (incompatibleWith) {
                const meta = getCategoryMeta(incompatibleWith)
                return meta.label
            }
            return null
        }
    }, [selected])

    const toggleCategory = (category: IdeaCategory) => {
        if (disabled) { return }

        if (selected.includes(category)) {
            onChange(selected.filter(c => c !== category))
        } else {
            // Check limits
            if (selected.length >= 3) {
                return
            }
            // Check incompatibility
            if (getIncompatibilityInfo(category)) {
                return
            }
            onChange([...selected, category])
        }
    }

    const getCategoryLabel = (category: IdeaCategory): string => {
        const labelMap: Record<string, string> = {
            'website': t('ideas.categories.website'),
            'mobile-app': t('ideas.categories.mobileApp'),
            'game': t('ideas.categories.game'),
            'cli-tool': t('ideas.categories.cliTool'),
            'desktop': t('ideas.categories.desktop'),
            'other': t('ideas.categories.other')
        }
        return labelMap[category] || category
    }

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(category => {
                    const meta = getCategoryMeta(category)
                    const isSelected = selected.includes(category)
                    const incompatibleWithLabel = getIncompatibilityInfo(category)
                    const isAtLimit = selected.length >= 3 && !isSelected
                    const isDisabled = disabled || (!!incompatibleWithLabel && !isSelected) || isAtLimit

                    const Icon = meta.icon

                    return (
                        <div key={category} className="group relative">
                            <button
                                type="button"
                                onClick={() => toggleCategory(category)}
                                disabled={isDisabled}
                                title={incompatibleWithLabel ? `Incompatible with ${incompatibleWithLabel}` : undefined}
                                className={cn(
                                    'flex items-center gap-2 px-3 py-2 rounded-lg transition-all',
                                    'border text-sm font-medium',
                                    isSelected
                                        ? `${meta.bgColor} ${meta.color} border-current`
                                        : 'bg-muted/30 text-muted-foreground/60 border-border/50 hover:bg-muted/50 hover:text-muted-foreground',
                                    isDisabled && !isSelected && 'opacity-30 cursor-not-allowed grayscale'
                                )}
                            >
                                <Icon className="w-4 h-4" />
                                <span>{getCategoryLabel(category)}</span>
                            </button>

                            {incompatibleWithLabel && !isSelected && (
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black text-[10px] text-white rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity z-10">
                                    Incompatible with {incompatibleWithLabel}
                                </div>
                            )}
                            {isAtLimit && !isSelected && !incompatibleWithLabel && (
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black text-[10px] text-white rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity z-10">
                                    Max 3 categories
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {selected.length > 0 && (
                <p className="text-[10px] text-muted-foreground/40 italic">
                    {selected.length}/3 categories selected
                </p>
            )}
        </div>
    )
}
