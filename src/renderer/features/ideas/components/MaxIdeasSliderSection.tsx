import React from 'react';

import { useTranslation } from '@/i18n';

interface MaxIdeasSliderSectionProps {
	value: number
	onChange: (value: number) => void
	isLoading: boolean
}

export const MaxIdeasSliderSection: React.FC<MaxIdeasSliderSectionProps> = ({
	value,
	onChange,
	isLoading
}) => {
	const { t } = useTranslation();

	return (
		<div className="bg-muted/20 backdrop-blur-sm rounded-xl border border-border p-5">
			<div className="flex justify-between items-center mb-3">
				<h3 className="text-sm font-semibold text-foreground">
					{t('ideas.maxIdeas')}
				</h3>
				<span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
					{value}
				</span>
			</div>
			<input
				type="range"
				min={1}
				max={100}
				value={value}
				onChange={e => onChange(Number(e.target.value))}
				disabled={isLoading}
				className="w-full accent-primary"
			/>
			<div className="flex justify-between text-xxs text-muted-foreground/60 mt-1 font-medium">
				<span>1</span>
				<span>25</span>
				<span>50</span>
				<span>75</span>
				<span>100</span>
			</div>
		</div>
	);
};
