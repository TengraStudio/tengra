import { ProviderConfig } from '@shared/types/agent-state';
import { AlertTriangle, Check, Loader2, Server } from 'lucide-react';
import React, { memo, useEffect, useState } from 'react';

import { Modal } from '@/components/ui/modal';
import { Language, useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

const getWorkspaceAgentBridge = () => window.electron.projectAgent;

interface ModelSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    reason: string;
    language: Language;
    onSelect: (provider: string, model: string) => void;
}

const ReasonSection = ({ reason, t }: { reason: string, t: (k: string) => string }) => (
    <div className="bg-warning/10 border border-warning/20 rounded-xl p-4 flex gap-4">
        <AlertTriangle className="w-6 h-6 text-warning shrink-0" />
        <div>
            <h4 className="text-sm font-bold text-warning uppercase tracking-wider mb-1">
                {t('agent.interruptionReason')}
            </h4>
            <p className="text-sm text-foreground/80 leading-relaxed">
                {reason}
            </p>
        </div>
    </div>
);

const ModelItem = memo(({ model: m, isSelected, onSelect }: {
    model: ProviderConfig,
    isSelected: boolean,
    onSelect: (m: ProviderConfig) => void
}) => (
    <button
        onClick={() => onSelect(m)}
        className={cn(
            "w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left group",
            isSelected
                ? "bg-primary/20 border-primary shadow-lg shadow-primary/5"
                : "bg-muted/30 border-border/40 hover:bg-muted/50 hover:border-border/60"
        )}
    >
        <div className="flex items-center gap-3">
            <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center",
                isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground group-hover:bg-muted-foreground group-hover:text-muted transition-colors"
            )}>
                <Server className="w-4 h-4" />
            </div>
            <div>
                <p className="text-xs font-bold text-foreground">
                    {m.model}
                </p>
                <p className="text-xxs text-muted-foreground uppercase font-medium">
                    {m.provider}
                </p>
            </div>
        </div>
        {isSelected && (
            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                <Check className="w-3 h-3 text-primary-foreground" />
            </div>
        )}
    </button>
));

ModelItem.displayName = 'ModelItem';

export const ModelSelectionModal: React.FC<ModelSelectionModalProps> = ({
    isOpen,
    onClose,
    reason,
    language,
    onSelect
}) => {
    const { t } = useTranslation(language);
    const [availableModels, setAvailableModels] = useState<ProviderConfig[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedModel, setSelectedModel] = useState<ProviderConfig | null>(null);

    useEffect(() => {
        if (isOpen) {
            void fetchModels();
        }
    }, [isOpen]);

    const fetchModels = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await getWorkspaceAgentBridge().getAvailableModels();
            if (data.success && data.models) {
                const mappedModels: ProviderConfig[] = data.models.map(model => ({
                    provider: model.provider,
                    model: model.name,
                    accountIndex: 0,
                    status: 'active'
                }));
                setAvailableModels(mappedModels);
                if (mappedModels.length > 0) {
                    setSelectedModel(mappedModels[0]);
                }
            } else {
                setError('Failed to load models');
            }
        } catch (err) {
            setError('Connection failed');
            window.electron.log.error('ModelSelectionModal: Connection failed', err as Error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirm = () => {
        if (selectedModel) {
            onSelect(selectedModel.provider, selectedModel.model);
            onClose();
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('agent.interruptionTitle')}>
            <div className="space-y-6 py-4">
                <ReasonSection reason={reason} t={t} />

                <div className="space-y-3">
                    <label className="text-xxs font-bold uppercase text-muted-foreground tracking-widest pl-1">
                        {t('agent.selectAlternativeModel')}
                    </label>

                    {isLoading ? (
                        <div className="h-[200px] flex items-center justify-center bg-muted/20 border border-border/50 rounded-xl">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : error ? (
                        <div className="h-[200px] flex flex-col items-center justify-center bg-destructive/5 border border-destructive/20 rounded-xl p-4 text-center">
                            <AlertTriangle className="w-8 h-8 text-destructive mb-2" />
                            <p className="text-sm text-destructive/80 mb-4">{t('agent.failedLoadModels')}</p>
                            <button
                                onClick={() => void fetchModels()}
                                className="px-4 py-2 bg-muted/30 hover:bg-muted/40 rounded-lg text-xs font-bold"
                            >
                                {t('common.retry')}
                            </button>
                        </div>
                    ) : (
                        <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
                            {availableModels.map((m, idx) => (
                                <ModelItem
                                    key={`${m.provider}-${m.model}-${idx}`}
                                    model={m}
                                    isSelected={selectedModel?.provider === m.provider && selectedModel.model === m.model}
                                    onSelect={setSelectedModel}
                                />
                            ))}
                        </div>
                    )}
                </div>

                <p className="text-xxs text-muted-foreground italic leading-relaxed px-1">
                    {t('agent.interruptionHelp')}
                </p>

                <div className="flex gap-3 pt-2">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded-xl transition-all border border-border/50"
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!selectedModel || isLoading}
                        className="flex-[2] py-3 bg-primary text-primary-foreground rounded-xl font-black text-xs uppercase tracking-widest hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 disabled:opacity-50 active:scale-[0.98]"
                    >
                        {t('agent.continueWithModel')}
                    </button>
                </div>
            </div>
        </Modal>
    );
};
