/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconEye, IconFileCode, IconPencil, IconSparkles } from '@tabler/icons-react';
import { memo } from 'react';

/* Batch-02: Extracted Long Classes */
const C_MESSAGESOURCES_1 = "flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-accent/30 border border-border/30 hover:border-primary/50 hover:bg-primary/5 transition-all typo-caption text-muted-foreground hover:text-foreground group/chip";

type TranslationFn = (key: string, options?: Record<string, string | number>) => string;

export interface MessageSourceItem {
    path: string;
    label?: string;
    action?: 'read' | 'write' | 'delete' | 'patch';
}

export interface MessageSourcesProps {
    sources: (string | MessageSourceItem)[];
    onSourceClick?: (p: string) => void;
    t: TranslationFn;
}

/**
 * MessageSources component
 * 
 * Renders a list of chips representing source files used for generating the message.
 * Each chip can have a label (e.g. "Analyzed") and an action icon.
 */
export const MessageSources = memo(
    ({
        sources,
        onSourceClick,
        t,
    }: MessageSourcesProps) => {
        if (sources.length === 0) {
            return null;
        }
        return (
            <div className="flex flex-wrap gap-2 mt-3 animate-fade-in">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-primary/5 border border-primary/10 text-sm text-primary font-bold mb-1">
                    <IconSparkles className="w-3 h-3" />
                    {t('frontend.chat.sources')}
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {sources
                        .filter(item => {
                            const path = typeof item === 'string' ? item : item.path;
                            const filename = (path.split(/[\\/]/).pop() ?? '').toLowerCase();
                            const noiseFiles = [
                                'security.md',
                                'readme.md',
                                'contributing.md',
                                'code_of_conduct.md',
                                'license',
                                'license.md',
                                'license.txt',
                                '.gitignore',
                                '.editorconfig',
                                'package-lock.json',
                                'yarn.lock',
                                'pnpm-lock.yaml',
                                '.npmignore',
                                '.env.example',
                                'changelog.md'
                            ];
                            return !noiseFiles.includes(filename);
                        })
                        .map((item, idx) => {
                            const path = typeof item === 'string' ? item : item.path;
                            const label = typeof item === 'string' ? undefined : item.label;
                            const action = typeof item === 'string' ? undefined : item.action;
                            const filename = path.split(/[\\/]/).pop() ?? path;

                            const Icon = action === 'read' ? IconEye : 
                                         (action === 'write' || action === 'patch' ? IconPencil : IconFileCode);

                            return (
                                <button
                                    key={idx}
                                    onClick={() => onSourceClick?.(path)}
                                    className={C_MESSAGESOURCES_1}
                                    title={path}
                                >
                                    <Icon className="w-3.5 h-3.5 text-primary/60 group-hover/chip:text-primary" />
                                    <span>
                                        {label && <span className="opacity-60 mr-1">{label}:</span>}
                                        {filename}
                                    </span>
                                </button>
                            );
                        })}
                </div>
            </div>
        );
    }
);

MessageSources.displayName = 'MessageSources';
