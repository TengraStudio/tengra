/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconBolt, IconPlus, IconRefresh } from '@tabler/icons-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface AIAssistantBarProps {
    aiPrompt: string;
    setAiPrompt: (val: string) => void;
    isAnalyzing: boolean;
    handleAIAnalyze: () => void;
}

export const AIAssistantBar: React.FC<AIAssistantBarProps> = ({
    aiPrompt,
    setAiPrompt,
    isAnalyzing,
    handleAIAnalyze
}) => {
    return (
        <div className="px-8 py-3 bg-muted/10 border-b border-border/10 flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary typo-overline font-bold whitespace-nowrap">
                <IconBolt className="w-3.5 h-3.5" />
                AI Assistant
            </div>
            <div className="flex-1 relative">
                <Input
                    placeholder="Suggest tasks based on my workspace goals..."
                    className="h-9 bg-transparent border-none focus-visible:ring-0 text-sm italic pr-12"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAIAnalyze()}
                />
                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-9 w-9 text-primary/60 hover:text-primary hover:bg-transparent"
                    onClick={handleAIAnalyze}
                    disabled={isAnalyzing || !aiPrompt.trim()}
                >
                    {isAnalyzing ? <IconRefresh className="w-4 h-4 animate-spin" /> : <IconPlus className="w-4 h-4" />}
                </Button>
            </div>
        </div>
    );
};
