/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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
                <span>{t('frontend.codeSandbox.output')}</span>
                <span>{t('frontend.codeSandbox.executionTime', { ms: durationMs })}</span>
            </div>

            {stdout && (
                <pre className="whitespace-pre-wrap break-words font-mono text-sm text-success">
                    {stdout}
                </pre>
            )}

            {stderr && (
                <div className="mt-2">
                    <span className="typo-caption font-semibold text-destructive">
                        {t('frontend.codeSandbox.stderr')}
                    </span>
                    <pre className="whitespace-pre-wrap break-words font-mono text-sm text-destructive">
                        {stderr}
                    </pre>
                </div>
            )}

            {!stdout && !stderr && (
                <p className="text-sm text-muted-foreground">
                    {success ? t('frontend.codeSandbox.noOutput') : t('frontend.codeSandbox.error')}
                </p>
            )}
        </div>
    );
};

OutputDisplay.displayName = 'OutputDisplay';

