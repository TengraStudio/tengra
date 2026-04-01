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
        <div className="w-72 bg-muted/5 p-6 flex flex-col gap-4 overflow-y-auto hidden md:flex">
            {selectedItem?.preview ? (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4 shadow-inner">
                        {selectedItem.icon}
                    </div>
                    <h3 className="text-lg font-bold text-foreground mb-2 line-clamp-2">
                        {selectedItem.preview.title}
                    </h3>
                    <p className="text-xs text-muted-foreground/70 leading-relaxed mb-6">
                        {selectedItem.preview.content}
                    </p>

                    {selectedItem.preview.metadata && (
                        <div className="space-y-3">
                            {Object.entries(selectedItem.preview.metadata).map(([key, value]) => (
                                <div key={key} className="flex flex-col gap-1">
                                    <span className="text-xxs font-bold text-muted-foreground/30 uppercase tracking-widest">
                                        {key}
                                    </span>
                                    <span className="text-xs text-foreground font-medium">
                                        {value}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-20">
                    <Command className="w-12 h-12 mb-4" />
                    <p className="text-xs font-medium uppercase tracking-widest">
                        {t('commandPalette.previewEmpty')}
                    </p>
                </div>
            )}
        </div>
    );
};

PreviewPanel.displayName = 'PreviewPanel';
