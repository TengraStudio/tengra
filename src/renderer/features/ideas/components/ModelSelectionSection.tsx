import type { GroupedModels } from '@/types';
import React from 'react';

import { useTranslation } from '@/i18n';
import type { AppSettings, CodexUsage, QuotaResponse } from '@/types';

import { ModelSelector } from '@/components/shared/ModelSelector';

interface ModelSelectionSectionProps {
	selectedModel: string
	selectedProvider: string
	onSelect: (provider: string, model: string, isMultiSelect?: boolean) => void
	groupedModels: GroupedModels | null
	appSettings: AppSettings | null
	quotas: { accounts: QuotaResponse[] } | null
	codexUsage: { accounts: { usage: CodexUsage }[] } | null
	onOpenChange: (open: boolean) => void
	toggleFavorite: (modelId: string) => void
	isFavorite: (modelId: string) => boolean
	isLoading?: boolean
}

export const ModelSelectionSection: React.FC<ModelSelectionSectionProps> = ({
	selectedModel,
	selectedProvider,
	onSelect,
	groupedModels,
	appSettings,
	quotas,
	codexUsage,
	onOpenChange,
	toggleFavorite,
	isFavorite,
	isLoading: _isLoading
}) => {
	const { t } = useTranslation();

	return (
		<div className="bg-muted/20 backdrop-blur-sm rounded-xl border border-border p-5">
			<h3 className="text-sm font-semibold text-foreground mb-3">
				{t('ideas.selectModel')}
			</h3>
			<ModelSelector
				selectedModel={selectedModel}
				selectedProvider={selectedProvider}
				onSelect={onSelect}
				groupedModels={groupedModels ?? undefined}
				settings={appSettings ?? undefined}
				quotas={quotas}
				codexUsage={codexUsage}
				onOpenChange={onOpenChange}
				toggleFavorite={toggleFavorite}
				isFavorite={isFavorite}
			/>
			<p className="text-xs text-muted-foreground/60 mt-3">
				{t('ideas.modelSelectorHint')}
			</p>
		</div>
	);
};
