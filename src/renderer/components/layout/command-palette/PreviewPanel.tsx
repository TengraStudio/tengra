import { CommandItem } from '@renderer/components/layout/CommandPalette';
import { Command } from 'lucide-react';
import React from 'react';

import { useTranslation } from '@/i18n';


interface PreviewPanelProps {
    selectedItem?: CommandItem | undefined;
}

export const PreviewPanel: React.FC<PreviewPanelProps> = ({ selectedItem }) => {
    const { t } = useTranslation();

    return (
        <div className="tengra-preview-panel">
            {selectedItem?.preview ? (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="tengra-preview-panel__icon-wrap shadow-inner">
                        {selectedItem.icon}
                    </div>
                    <h3 className="tengra-preview-panel__title line-clamp-2">
                        {selectedItem.preview.title}
                    </h3>
                    <p className="tengra-preview-panel__content">
                        {selectedItem.preview.content}
                    </p>

                    {selectedItem.preview.metadata && (
                        <div className="tengra-preview-panel__meta">
                            {Object.entries(selectedItem.preview.metadata).map(([key, value]) => (
                                <div key={key} className="tengra-preview-panel__meta-item">
                                    <span className="tengra-preview-panel__meta-key">
                                        {key}
                                    </span>
                                    <span className="tengra-preview-panel__meta-value">
                                        {value}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div className="tengra-preview-panel__empty">
                    <Command className="w-12 h-12 mb-4" />
                    <p className="typo-caption font-medium">
                        {t('commandPalette.previewEmpty')}
                    </p>
                </div>
            )}
        </div>
    );
};

PreviewPanel.displayName = 'PreviewPanel';
