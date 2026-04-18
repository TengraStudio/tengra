/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { memo } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

/* Batch-02: Extracted Long Classes */
const C_COLLABORATIONMEMORY_1 = "h-8 typo-caption font-medium placeholder:text-muted-foreground/50 border-muted-foreground/10 focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-all";


interface CollaborationMemoryProps {
    sharedMemoryNote: string;
    setSharedMemoryNote: (value: string) => void;
    sharedMemory: string[];
    handleAddMemory: () => void;
    t: (key: string) => string;
}

export const CollaborationMemory = memo(({
    sharedMemoryNote,
    setSharedMemoryNote,
    sharedMemory,
    handleAddMemory,
    t
}: CollaborationMemoryProps) => {
    return (
        <Card className="p-4 space-y-3 bg-muted/20 border-muted-foreground/10 hover:bg-muted/40 transition-colors">
            <label className="text-sm font-bold text-muted-foreground/80 mb-2 block">
                {t('chat.collaboration.sharedMemory')}
            </label>
            <div className="flex gap-2">
                <Input
                    value={sharedMemoryNote}
                    onChange={(event) => { setSharedMemoryNote(event.target.value); }}
                    placeholder={t('chat.collaboration.memoryPlaceholder')}
                    className={C_COLLABORATIONMEMORY_1}
                />
                <Button
                    size="sm"
                    onClick={handleAddMemory}
                    disabled={!sharedMemoryNote.trim()}
                    className="h-8 px-4 typo-caption font-bold transition-transform hover:scale-105"
                >
                    {t('common.add')}
                </Button>
            </div>
            <div className="max-h-24 overflow-y-auto space-y-1.5 scrollbar-thin pr-1 transition-all">
                {sharedMemory.length === 0 ? (
                    <div className="p-2 border border-dashed border-muted-foreground/10 rounded-md text-center">
                        <span className="text-xxxs text-muted-foreground font-medium opacity-50">
                            {t('chat.collaboration.noSharedContextEntries')}
                        </span>
                    </div>
                ) : (
                    sharedMemory.map((entry, index) => (
                        <div key={index} className="flex items-start gap-2 group animate-in slide-in-from-left-2 fade-in duration-300">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary/40 mt-1.5 shrink-0 group-hover:bg-primary transition-colors" />
                            <p className="typo-caption font-normal text-foreground/80 leading-relaxed font-sans">{entry}</p>
                        </div>
                    ))
                )}
            </div>
        </Card>
    );
});

CollaborationMemory.displayName = 'CollaborationMemory';
