import type { IdeaCategory } from '@shared/types/ideas';
import React from 'react';

import { useTranslation } from '@/i18n';

import { CategorySelector } from './CategorySelector';

interface CategorySelectionSectionProps {
	selected: IdeaCategory[]
	onChange: (categories: IdeaCategory[]) => void
	isLoading: boolean
}

export const CategorySelectionSection: React.FC<CategorySelectionSectionProps> = ({
	selected,
	onChange,
	isLoading
}) => {
	const { t } = useTranslation();

	return (
		<div className="bg-muted/20 backdrop-blur-sm rounded-xl border border-border p-5">
			<h3 className="text-sm font-semibold text-foreground mb-3">
				{t('ideas.selectCategories')}
			</h3>
			<CategorySelector
				selected={selected}
				onChange={onChange}
				disabled={isLoading}
			/>
		</div>
	);
};
