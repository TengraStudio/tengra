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

import { Card } from '@/components/ui/card';

interface ModelResponse {
    provider: string;
    model: string;
    content: string;
    latency: number;
}

interface ResponseCardProps {
    response: ModelResponse;
}

export const ResponseCard = memo(({ response }: ResponseCardProps) => (
    <Card className="p-3 hover:shadow-md transition-shadow animate-in fade-in">
        <div className="flex items-start justify-between mb-2">
            <span className="text-sm font-semibold">{response.provider}/{response.model}</span>
            <span className="typo-caption text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{response.latency}ms</span>
        </div>
        <p className="text-sm text-foreground/80 line-clamp-3 leading-relaxed">{response.content}</p>
    </Card>
));

ResponseCard.displayName = 'ResponseCard';
