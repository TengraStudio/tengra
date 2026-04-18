/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { MemoryVersion } from '@shared/types/advanced-memory';
import { History, RotateCcw } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';

interface MemoryHistoryPanelProps {
    history: MemoryVersion[];
    onRollback: (versionIndex: number) => void;
    onClose: () => void;
}

export const MemoryHistoryPanel: React.FC<MemoryHistoryPanelProps> = ({
    history,
    onRollback,
    onClose
}) => {
    const { t } = useTranslation();

    return (
        <div className="flex flex-col h-full bg-muted/10 border-l border-border/40 animate-in slide-in-from-right duration-300 w-80">
            <div className="p-4 border-b border-border/40 flex items-center justify-between bg-muted/20">
                <div className="flex items-center gap-2 font-bold">
                    <History className="w-4 h-4 text-primary" />
                    {t('memory.historyTitle')}
                </div>
                <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">×</Button>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-4">
                {history.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">{t('memory.noHistory')}</p>
                ) : (
                    history.map((version, index) => (
                        <div key={index} className="space-y-2 group">
                            <div className="flex items-center justify-between">
                                <span className="text-xxxs font-bold text-muted-foreground/60">
                                    {new Date(version.timestamp).toLocaleString()}
                                </span>
                                {index > 0 && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onRollback(index)}
                                        className="h-6 px-2 text-xxxs opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <RotateCcw className="w-3 h-3 mr-1" />
                                        {t('memory.rollback')}
                                    </Button>
                                )}
                            </div>
                            <div className="p-3 bg-muted/30 rounded-lg text-sm border border-transparent group-hover:border-primary/20 transition-colors">
                                <p className="leading-relaxed opacity-80">{version.content}</p>
                                <div className="mt-2 flex gap-1 items-center overflow-hidden">
                                    <span className="text-xxxs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">
                                        {version.category}
                                    </span>
                                    {version.tags.map((tag, i) => (
                                        <span key={i} className="text-xxxs bg-muted/30 text-muted-foreground px-1.5 py-0.5 rounded">
                                            #{tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
