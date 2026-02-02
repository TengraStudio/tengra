import { IdeaCategory, IdeaSessionConfig } from '@shared/types/ideas';
import React, { useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { useModel } from '@/context/ModelContext';

import { CategorySelectionSection } from './CategorySelectionSection';
import { CustomPromptSection } from './CustomPromptSection';
import { MarketPreviewModal } from './MarketPreviewModal';
import { MaxIdeasSliderSection } from './MaxIdeasSliderSection';
import { ModelSelectionSection } from './ModelSelectionSection';
import { PreviewMarketButton } from './PreviewMarketButton';
import { SubmitButton } from './SubmitButton';

interface SessionSetupProps {
    onCreateSession: (config: IdeaSessionConfig) => Promise<void>
    isLoading: boolean
}

export const SessionSetup: React.FC<SessionSetupProps> = ({
	onCreateSession,
	isLoading
}) => {
	const {
		selectedProvider,
		selectedModel,
		handleSelectModel,
		groupedModels,
		setIsModelMenuOpen,
		toggleFavorite,
		isFavorite
	} = useModel();

	const { appSettings, quotas, codexUsage } = useAuth();

	const [categories, setCategories] = useState<IdeaCategory[]>([]);
	const [maxIdeas, setMaxIdeas] = useState(5);
	const [customPrompt, setCustomPrompt] = useState('');
	const [showPreview, setShowPreview] = useState(false);
	const [isLoadingPreview, setIsLoadingPreview] = useState(false);
	const [marketPreview, setMarketPreview] = useState<Array<{
		category: IdeaCategory
		summary: string
		keyTrends: string[]
		marketSize: string
		competition: string
	}> | null>(null);

	const handlePreviewMarket = async (): Promise<void> => {
		if (categories.length === 0) {
			return;
		}

		setShowPreview(true);
		setIsLoadingPreview(true);
		setMarketPreview(null);

		try {
			const response = await window.electron.ideas.generateMarketPreview(categories);
			if (response.success && response.data) {
				setMarketPreview(response.data);
			}
		} catch {
			// Preview generation failed
		} finally {
			setIsLoadingPreview(false);
		}
	};

	const handleSubmit = async (e: React.FormEvent): Promise<void> => {
		e.preventDefault();
		if (!selectedModel || categories.length === 0) {
			return;
		}

		await onCreateSession({
			model: selectedModel,
			provider: selectedProvider,
			categories,
			maxIdeas,
			customPrompt: customPrompt.trim() || undefined
		});
	};

	const isValid = Boolean(selectedModel && categories.length > 0);

	return (
		<form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-6 text-left">
			<ModelSelectionSection
				selectedModel={selectedModel}
				selectedProvider={selectedProvider}
				onSelect={handleSelectModel}
				groupedModels={groupedModels}
				appSettings={appSettings}
				quotas={quotas}
				codexUsage={codexUsage}
				onOpenChange={setIsModelMenuOpen}
				toggleFavorite={toggleFavorite}
				isFavorite={isFavorite}
				isLoading={isLoading}
			/>

			<CategorySelectionSection
				selected={categories}
				onChange={setCategories}
				isLoading={isLoading}
			/>

			<MaxIdeasSliderSection
				value={maxIdeas}
				onChange={setMaxIdeas}
				isLoading={isLoading}
			/>

			<CustomPromptSection
				value={customPrompt}
				onChange={setCustomPrompt}
				isLoading={isLoading}
			/>

			<PreviewMarketButton
				categoriesCount={categories.length}
				isLoading={isLoading}
				onClick={() => void handlePreviewMarket()}
			/>

			<SubmitButton
				isValid={isValid}
				isLoading={isLoading}
				onSubmit={() => void handleSubmit(new Event('submit') as unknown as React.FormEvent)}
			/>

			{showPreview && (
				<MarketPreviewModal
					categories={categories}
					onClose={() => setShowPreview(false)}
					onContinue={() => {
						setShowPreview(false);
						// Submit the form to start research
						void handleSubmit(new Event('submit') as unknown as React.FormEvent);
					}}
					isLoading={isLoadingPreview}
					preview={marketPreview}
				/>
			)}
		</form>
	);
};
