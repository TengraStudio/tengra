/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import DOMPurify from 'dompurify';
import { memo, useEffect, useId, useState } from 'react';

type TranslationFn = (key: string, options?: Record<string, string | number>) => string;

export interface MermaidDiagramProps {
    code: string;
    t: TranslationFn;
}

/**
 * MermaidDiagram component
 * 
 * Renders Mermaid.js diagrams from code strings.
 * Uses lazy loading for the mermaid library and sanitizes the output.
 */
export const MermaidDiagram = memo(({ code, t }: MermaidDiagramProps) => {
    const [svg, setSvg] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const id = useId();

    useEffect(() => {
        let mounted = true;
        const render = async () => {
            try {
                const m = await import('mermaid');
                const mermaid = m.default;
                mermaid.initialize({
                    startOnLoad: false,
                    theme: 'dark',
                    securityLevel: 'loose',
                    fontFamily: 'inherit',
                });
                const renderResult = (await mermaid.render(id.replace(/:/g, ''), code)) as { svg: string } | string;
                const renderedSvg = typeof renderResult === 'string' ? renderResult : renderResult.svg;
                if (mounted) {
                    setSvg(DOMPurify.sanitize(renderedSvg));
                    setError(null);
                }
            } catch (err) {
                if (mounted) {
                    setError(err instanceof Error ? err.message : String(err));
                }
            }
        };
        void render();
        return () => {
            mounted = false;
        };
    }, [code, id]);

    if (error) {
        return (
            <pre className="typo-caption text-destructive bg-destructive/10 p-2 rounded">{error}</pre>
        );
    }

    if (!svg) {
        return (
            <div className="my-4 h-32 flex items-center justify-center bg-accent/10 rounded-xl border border-border/40 animate-pulse">
                <div className="typo-caption text-muted-foreground">
                    {t('frontend.messageBubble.renderingDiagram')}
                </div>
            </div>
        );
    }

    return (
        <div
            dangerouslySetInnerHTML={{ __html: svg }}
            className="my-4 flex justify-center bg-accent/30 p-4 rounded-xl border border-border/50"
        />
    );
});

MermaidDiagram.displayName = 'MermaidDiagram';

