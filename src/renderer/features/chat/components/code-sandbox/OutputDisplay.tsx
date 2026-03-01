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
        <div className="mt-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-3">
            <div className="mb-2 flex items-center justify-between text-xs text-[var(--text-tertiary)]">
                <span>{t('codeSandbox.output')}</span>
                <span>{t('codeSandbox.executionTime', { ms: durationMs })}</span>
            </div>

            {stdout && (
                <pre className="whitespace-pre-wrap break-words font-mono text-sm text-emerald-400">
                    {stdout}
                </pre>
            )}

            {stderr && (
                <div className="mt-2">
                    <span className="text-xs font-semibold text-red-400">
                        {t('codeSandbox.stderr')}
                    </span>
                    <pre className="whitespace-pre-wrap break-words font-mono text-sm text-red-400">
                        {stderr}
                    </pre>
                </div>
            )}

            {!stdout && !stderr && (
                <p className="text-sm italic text-[var(--text-tertiary)]">
                    {success ? t('codeSandbox.noOutput') : t('codeSandbox.error')}
                </p>
            )}
        </div>
    );
};

OutputDisplay.displayName = 'OutputDisplay';
