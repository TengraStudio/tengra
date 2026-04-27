/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconAlertCircle, IconRotate } from '@tabler/icons-react';
import { memo } from 'react';

/* Batch-02: Extracted Long Classes */
const C_TOOLRECOVERYNOTICE_1 = "flex items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 typo-caption text-warning sm:gap-4";
const C_TOOLRECOVERYNOTICE_2 = "inline-flex shrink-0 items-center gap-1 rounded-md border border-warning/30 px-2 py-1 font-semibold transition-colors hover:bg-warning/10";


type TranslationFn = (key: string, options?: Record<string, string | number>) => string;

export interface ToolRecoveryNoticeProps {
    interruptedToolNames: string[];
    onRegenerate?: () => void;
    t: TranslationFn;
}

export const ToolRecoveryNotice = memo(
    ({ interruptedToolNames, onRegenerate, t }: ToolRecoveryNoticeProps) => {
        if (interruptedToolNames.length === 0) {
            return null;
        }

        return (
            <div className={C_TOOLRECOVERYNOTICE_1}>
                <div className="flex min-w-0 items-center gap-2">
                    <IconAlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                        {t('tools.failed')}: {interruptedToolNames.join(', ')}
                    </span>
                </div>
                {onRegenerate && (
                    <button
                        type="button"
                        onClick={onRegenerate}
                        className={C_TOOLRECOVERYNOTICE_2}
                        aria-label={t('messageBubble.regenerate')}
                        title={t('messageBubble.regenerate')}
                    >
                        <IconRotate className="h-3 w-3" />
                        <span>{t('messageBubble.regenerate')}</span>
                    </button>
                )}
            </div>
        );
    }
);

ToolRecoveryNotice.displayName = 'ToolRecoveryNotice';
