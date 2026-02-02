import React from 'react';

import { useTranslation } from '@/i18n';

interface CustomPromptSectionProps {
	value: string
	onChange: (value: string) => void
	isLoading: boolean
}

export const CustomPromptSection: React.FC<CustomPromptSectionProps> = ({
	value,
	onChange,
	isLoading
}) => {
	const { t } = useTranslation();

	return (
		<div className="space-y-2">
			<label className="text-sm font-medium text-foreground/90 flex items-center justify-between">
				<span>{t('ideas.customPrompt.label')}</span>
				<span className="text-xs text-muted-foreground font-normal">{t('ideas.customPrompt.optional')}</span>
			</label>
			<textarea
				value={value}
				onChange={e => onChange(e.target.value)}
				disabled={isLoading}
				placeholder={t('ideas.customPrompt.placeholder')}
				rows={3}
				className="w-full px-4 py-3 rounded-xl bg-background/50 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none transition-all"
			/>
			<p className="text-xs text-muted-foreground/60">
				{t('ideas.customPrompt.hint')}
			</p>
		</div>
	);
};
