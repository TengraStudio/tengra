/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconCode, IconEye } from '@tabler/icons-react';
import { memo } from 'react';

import { cn } from '@/lib/utils';

type TranslationFn = (key: string, options?: Record<string, string | number>) => string;

export interface RawToggleProps {
    active: boolean;
    onClick: () => void;
    t: TranslationFn;
}

/**
 * RawToggle component
 * 
 * A toggle switch to switch between rendered markdown and raw markdown text.
 */
export const RawToggle = memo(({ active, onClick, t }: RawToggleProps) => (
    <div className="flex items-center gap-2 mb-1">
        <button
            onClick={onClick}
            className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded-lg typo-caption font-medium transition-colors',
                active
                    ? 'bg-primary/20 text-primary'
                    : 'bg-accent/30 text-muted-foreground hover:text-foreground hover:bg-accent/50'
            )}
        >
            {active ? <IconEye className="w-3 h-3" /> : <IconCode className="w-3 h-3" />}
            {active ? t('chat.render') : t('chat.raw')}
        </button>
    </div>
));

RawToggle.displayName = 'RawToggle';
