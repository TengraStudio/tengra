import { Loader2, Sparkles } from 'lucide-react';
import React from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

interface SubmitButtonProps {
	isValid: boolean
	isLoading: boolean
	onSubmit: () => void
}

export const SubmitButton: React.FC<SubmitButtonProps> = ({
	isValid,
	isLoading,
	onSubmit
}) => {
	const { t } = useTranslation();

	return (
		<button
			type="submit"
			disabled={!isValid || isLoading}
			onClick={e => {
				e.preventDefault();
				onSubmit();
			}}
			className={cn(
				'w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2',
				isValid && !isLoading
					? 'bg-primary text-primary-foreground hover:brightness-110 shadow-lg shadow-primary/20 scale-100 hover:scale-[1.01] active:scale-[0.99]'
					: 'bg-muted/50 text-muted-foreground/40 cursor-not-allowed'
			)}
		>
			{isLoading ? (
				<>
					<Loader2 className="w-5 h-5 animate-spin" />
					{t('common.loading')}
				</>
			) : (
				<>
					<Sparkles className="w-5 h-5" />
					{t('ideas.startResearch')}
				</>
			)}
		</button>
	);
};
