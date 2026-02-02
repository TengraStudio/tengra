import { Eye } from 'lucide-react';
import React from 'react';

import { useTranslation } from '@/i18n';

interface PreviewMarketButtonProps {
	categoriesCount: number
	isLoading: boolean
	onClick: () => void
}

export const PreviewMarketButton: React.FC<PreviewMarketButtonProps> = ({
	categoriesCount,
	isLoading,
	onClick
}) => {
	const { t } = useTranslation();

	if (categoriesCount === 0) {
		return null;
	}

	return (
		<button
			type="button"
			onClick={onClick}
			disabled={isLoading}
			className="w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 bg-muted/30 hover:bg-muted/50 text-foreground border border-border/50"
		>
			<Eye className="w-4 h-4" />
			{t('ideas.previewMarket') || 'Preview Market Research'}
		</button>
	);
};
