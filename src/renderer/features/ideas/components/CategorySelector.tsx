import { IdeaCategory } from '@shared/types/ideas';
import { LucideIcon } from 'lucide-react';
import React, { useMemo } from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

import { CATEGORIES, getCategoryMeta, INCOMPATIBILITY_RULES } from '../utils/categories';

interface CategorySelectorProps {
    selected: IdeaCategory[]
    onChange: (categories: IdeaCategory[]) => void
    disabled?: boolean
}

interface CategoryButtonProps {
    category: IdeaCategory
    label: string
    icon: LucideIcon
    isSelected: boolean
    isDisabled: boolean
    bgColor: string
    color: string
    onClick: () => void
    incompatibleWithLabel: string | null
    isAtLimit: boolean
}

const CategoryButton: React.FC<CategoryButtonProps> = ({
    label,
    icon: Icon,
    isSelected,
    isDisabled,
    bgColor,
    color,
    onClick,
    incompatibleWithLabel,
    isAtLimit
}) => (
    <div className="group relative">
        <button
            type="button"
            onClick={onClick}
            disabled={isDisabled}
            title={incompatibleWithLabel ? `Incompatible with ${incompatibleWithLabel}` : undefined}
            className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg transition-all',
                'border text-sm font-medium',
                isSelected
                    ? `${bgColor} ${color} border-current`
                    : 'bg-muted/30 text-muted-foreground/60 border-border/50 hover:bg-muted/50 hover:text-muted-foreground',
                isDisabled && !isSelected && 'opacity-30 cursor-not-allowed grayscale'
            )}
        >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
        </button>

        {incompatibleWithLabel && !isSelected && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-background text-xxs text-foreground rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity z-10">
                Incompatible with {incompatibleWithLabel}
            </div>
        )}
        {isAtLimit && !incompatibleWithLabel && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-background text-xxs text-foreground rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity z-10">
                Max 3 categories
            </div>
        )}
    </div>
);

const CATEGORY_LABELS: Record<IdeaCategory, string> = {
    'website': 'ideas.categories.website',
    'mobile-app': 'ideas.categories.mobileApp',
    'game': 'ideas.categories.game',
    'cli-tool': 'ideas.categories.cliTool',
    'desktop': 'ideas.categories.desktop',
    'other': 'ideas.categories.other'
};

export const CategorySelector: React.FC<CategorySelectorProps> = ({
    selected,
    onChange,
    disabled = false
}) => {
    const { t } = useTranslation();

    const getIncompatibilityInfo = useMemo(() => {
        return (category: IdeaCategory) => {
            const rules = INCOMPATIBILITY_RULES[category];
            if (!rules) { return null; }

            const incompatibleWith = selected.find(s => rules.includes(s));
            if (incompatibleWith) {
                return getCategoryMeta(incompatibleWith).label;
            }
            return null;
        };
    }, [selected]);

    const toggleCategory = (category: IdeaCategory) => {
        if (disabled) { return; }

        if (selected.includes(category)) {
            onChange(selected.filter(c => c !== category));
        } else if (selected.length < 3 && !getIncompatibilityInfo(category)) {
            onChange([...selected, category]);
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(category => {
                    const meta = getCategoryMeta(category);
                    const isSelected = selected.includes(category);
                    const incompatibleWithLabel = getIncompatibilityInfo(category);
                    const isAtLimit = selected.length >= 3 && !isSelected;

                    return (
                        <CategoryButton
                            key={category}
                            category={category}
                            label={t(CATEGORY_LABELS[category]) || category}
                            icon={meta.icon}
                            isSelected={isSelected}
                            isDisabled={disabled || (!!incompatibleWithLabel && !isSelected) || isAtLimit}
                            bgColor={meta.bgColor}
                            color={meta.color}
                            onClick={() => toggleCategory(category)}
                            incompatibleWithLabel={incompatibleWithLabel}
                            isAtLimit={isAtLimit}
                        />
                    );
                })}
            </div>

            {selected.length > 0 && (
                <p className="text-xxs text-muted-foreground/40 italic">
                    {selected.length}/3 categories selected
                </p>
            )}
        </div>
    );
};
