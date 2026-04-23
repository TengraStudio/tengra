/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Button } from '@renderer/components/ui/button';
import { Textarea } from '@renderer/components/ui/textarea';
import { Tooltip } from '@renderer/components/ui/tooltip';
import { Loader2, Send, Sparkles } from 'lucide-react';
import React from 'react';

import { useAICommitGenerator } from '../../hooks/useAICommitGenerator';

interface CommitSectionProps {
    commitMessage: string;
    setCommitMessage: (msg: string) => void;
    isCommitting: boolean;
    handleCommit: () => Promise<void>;
    workspacePath?: string;
    t: (key: string) => string;
}

export const GitCommitSection: React.FC<CommitSectionProps> = ({
    commitMessage,
    setCommitMessage,
    isCommitting,
    handleCommit,
    workspacePath,
    t
}) => {
    const { generateCommitMessage, isGenerating } = useAICommitGenerator(workspacePath);

    const onAIButtonClick = async () => {
        const generated = await generateCommitMessage();
        if (generated) {
            setCommitMessage(generated);
        }
    };
    return (
        <div className="space-y-3 mb-8">
            <div className="flex items-center justify-between px-1">
                <span className="typo-overline font-bold text-muted-foreground/40 uppercase tracking-widest">{t('git.commitSection.sourceControl')}</span>
                <span className="typo-overline text-muted-foreground/20 font-bold uppercase tracking-tighter">{t('git.commitSection.readyToStage')}</span>
            </div>

            <div className="border border-border/40 rounded-xl overflow-hidden bg-muted/10 focus-within:border-primary/30 focus-within:ring-1 focus-within:ring-primary/20 transition-all shadow-sm">
                <Textarea
                    placeholder={t('git.commitSection.messagePlaceholder')}
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    className="min-h-100 border-none focus-visible:ring-0 text-sm shadow-none bg-transparent py-4 px-4 resize-none"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                            void handleCommit();
                        }
                    }}
                />

                <div className="p-2.5 bg-muted/20 flex justify-between items-center gap-2 border-t border-border/10">
                    <Tooltip content={t('git.commitSection.generateTooltip')}>
                        <Button
                            variant="ghost"
                            size="sm"
                            disabled={isGenerating || isCommitting}
                            className="h-8 px-3 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg group"
                            onClick={() => void onAIButtonClick()}
                        >
                            {isGenerating ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                            ) : (
                                <Sparkles className="w-3.5 h-3.5 mr-2 group-hover:animate-pulse" />
                            )}
                            <span className="typo-overline font-bold uppercase tracking-tight">
                                {isGenerating ? t('git.commitSection.thinking') : t('git.commitSection.aiGenerate')}
                            </span>
                        </Button>
                    </Tooltip>

                    <div className="flex items-center gap-2">
                        <span className="typo-overline text-muted-foreground/30 font-bold uppercase tracking-tight mr-2 hidden sm:inline">
                            Ctrl + Enter
                        </span>
                        <Button
                            onClick={() => void handleCommit()}
                            disabled={isCommitting || !commitMessage.trim()}
                            className="h-8 px-5 typo-overline font-black uppercase tracking-widest bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg shadow-lg shadow-primary/10 transition-all active:scale-95"
                        >
                            {isCommitting ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                            ) : (
                                <Send className="w-3 h-3 mr-2" />
                            )}
                            {t('git.commitSection.commitChanges')}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
