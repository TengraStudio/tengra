import React from 'react';

import { useTranslation } from '@/i18n';

interface OutputDisplayProps {
    stdout: string;
    stderr: string;
    durationMs: number;
    success: boolean;
}

/** Displays code execution output with color-coded stdout/stderr */
export const OutputDisplay: React.FC<OutputDisplayProps> = ({
    stdout,
    stderr,
    durationMs,
    success,
}) => {
    const { t } = useTranslation();

    return (
        <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3">
            <div className="mb-2 flex items-center justify-between typo-caption text-muted-foreground">
                <span>{t('codeSandbox.output')}</span>
                <span>{t('codeSandbox.executionTime', { ms: durationMs })}</span>
            </div>

            {stdout && (
                <pre className="whitespace-pre-wrap break-words font-mono text-sm text-success">
                    {stdout}
                </pre>
            )}

            {stderr && (
                <div className="mt-2">
                    <span className="typo-caption font-semibold text-destructive">
                        {t('codeSandbox.stderr')}
                    </span>
                    <pre className="whitespace-pre-wrap break-words font-mono text-sm text-destructive">
                        {stderr}
                    </pre>
                </div>
            )}

            {!stdout && !stderr && (
                <p className="text-sm text-muted-foreground">
                    {success ? t('codeSandbox.noOutput') : t('codeSandbox.error')}
                </p>
            )}
        </div>
    );
};

OutputDisplay.displayName = 'OutputDisplay';
