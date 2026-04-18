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

interface ModelItemProps {
    model: { provider: string; model: string };
    onRemove: () => void;
    disabled: boolean;
    t: (key: string) => string;
}

export const ModelItem = memo(({ model, onRemove, disabled, t }: ModelItemProps) => (
    <div className="flex items-center gap-2 p-2 bg-muted rounded-md animate-in fade-in slide-in-from-left-1">
        <span className="flex-1 text-sm font-medium">{model.provider}/{model.model}</span>
        <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            disabled={disabled}
            className="hover:text-destructive transition-colors"
        >
            {t('chat.collaboration.remove')}
        </Button>
    </div>
));

ModelItem.displayName = 'ModelItem';
