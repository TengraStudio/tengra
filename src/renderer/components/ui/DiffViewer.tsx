import React from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { useTheme } from '@/hooks/useTheme';
import { Loader2 } from 'lucide-react';

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
    readOnly = true
}) => {
    const { isLight } = useTheme();

    return (
        <div className={`relative w-full h-full overflow-hidden ${className}`}>
            <DiffEditor
                height="100%"
                language={language}
                original={original}
                modified={modified}
                theme={isLight ? 'light' : 'vs-dark'}
                loading={
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        Loading Diff...
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
        </div>
    );
};
