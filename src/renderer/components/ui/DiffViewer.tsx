/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { DiffEditor } from '@monaco-editor/react';
import { IconLoader2 } from '@tabler/icons-react';
import type { editor } from 'monaco-editor';
import React, { useEffect, useRef, useState } from 'react';

import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { ensureMonacoInitialized } from '@/utils/monaco-loader.util';
import { appLogger } from '@/utils/renderer-logger';


interface DiffViewerProps {
    original: string;
    modified: string;
    language?: string;
    className?: string;
    readOnly?: boolean;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
    original,
    modified,
    language = 'plaintext',
    className,
    readOnly = true,
}) => {
    const { isLight } = useTheme();
    const { t } = useTranslation();
    const [isMonacoReady, setIsMonacoReady] = useState(false);
    const editorRef = useRef<editor.IStandaloneDiffEditor | null>(null);

    useEffect(() => {
        let active = true;
        void ensureMonacoInitialized()
            .then(() => {
                if (active) {
                    setIsMonacoReady(true);
                }
            })
            .catch(error => {
                appLogger.error('DiffViewer', 'Failed to initialize Monaco for DiffEditor', error);
            });

        return () => {
            active = false;
        };
    }, []);

    const handleEditorDidMount = (editor: editor.IStandaloneDiffEditor) => {
        editorRef.current = editor;
    };

    return (
        <div className={cn('relative w-full h-full rounded-lg border border-border/50 overflow-hidden bg-background shadow-sm', className)}>
            {isMonacoReady ? (
                <DiffEditor
                    height="100%"
                    language={language}
                    original={original}
                    modified={modified}
                    theme={isLight ? 'light' : 'vs-dark'}
                    onMount={handleEditorDidMount}
                    loading={
                        <div className="flex items-center justify-center h-full w-full bg-background/50 text-muted-foreground gap-2">
                            <IconLoader2 className="w-5 h-5 animate-spin text-primary" />
                            {t('frontend.diffViewer.loading')}
                        </div>
                    }
                    options={{
                        readOnly: readOnly,
                        renderSideBySide: true,
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        fontFamily: "var(--font-sans)",
                        fontSize: 13,
                        originalEditable: false,
                        automaticLayout: true, // Help with resize issues
                    }}
                />
            ) : (
                <div className="flex items-center justify-center h-full w-full bg-background/50 text-muted-foreground gap-2">
                    <IconLoader2 className="w-5 h-5 animate-spin text-primary" />
                    {t('frontend.diffViewer.loading')}
                </div>
            )}
        </div>
    );
};

