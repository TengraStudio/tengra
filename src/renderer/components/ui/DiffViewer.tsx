import { DiffEditor } from '@monaco-editor/react';
import { Loader2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n';
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

    return (
        <div className={`relative w-full h-full overflow-hidden ${className}`}>
            {isMonacoReady ? (
                <DiffEditor
                    height="100%"
                    language={language}
                    original={original}
                    modified={modified}
                    theme={isLight ? 'light' : 'vs-dark'}
                    loading={
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                            <Loader2 className="w-5 h-5 animate-spin mr-2" />
                            {t('diffViewer.loading')}
                        </div>
                    }
                    options={{
                        readOnly: readOnly,
                        renderSideBySide: true,
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                        fontSize: 13,
                        originalEditable: false, // Specifically make original read-only
                    }}
                />
            ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    {t('diffViewer.loading')}
                </div>
            )}
        </div>
    );
};
