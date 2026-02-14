import { useState } from 'react';

import { useTranslation } from '@/i18n';

export const ErrorFallback = ({
    error,
    resetErrorBoundary,
}: {
    error: Error;
    resetErrorBoundary: () => void;
}) => {
    const { t } = useTranslation();
    const [showStack, setShowStack] = useState(false);

    const copyError = () => {
        void navigator.clipboard.writeText(`${error.message}\n\n${error.stack}`);
    };

    return (
        <div className="flex items-center justify-center p-8 w-full h-full">
            <div role="alert" className="max-w-2xl w-full p-6 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                    <h2 className="text-lg font-semibold">{t('errors.somethingWentWrong')}</h2>
                </div>

                <div className="mb-4">
                    <pre className="text-sm bg-background/80 dark:bg-black/20 p-4 rounded-md overflow-auto whitespace-pre-wrap font-mono border border-destructive/10">
                        {error.message || 'Unknown error occurred'}
                    </pre>
                </div>

                {error.stack && (
                    <div className="mb-6">
                        <button
                            onClick={() => setShowStack(!showStack)}
                            className="text-xs font-medium flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity mb-2"
                        >
                            {showStack ? 'Hide Stack Trace' : 'Show Stack Trace'}
                        </button>
                        {showStack && (
                            <pre className="text-xs bg-background/50 dark:bg-black/20 p-3 rounded-md overflow-auto max-h-60 whitespace-pre font-mono border border-destructive/10">
                                {error.stack}
                            </pre>
                        )}
                    </div>
                )}

                <div className="flex gap-3 justify-end items-center">
                    <button
                        onClick={copyError}
                        className="px-4 py-2 text-sm border border-destructive/30 hover:bg-destructive/10 rounded transition-colors"
                    >
                        Copy Details
                    </button>
                    <button
                        onClick={resetErrorBoundary}
                        className="px-4 py-2 text-sm bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 transition-colors font-medium shadow-sm"
                    >
                        {t('common.retry')}
                    </button>
                </div>
            </div>
        </div>
    );
};

ErrorFallback.displayName = 'ErrorFallback';
