/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React, { useCallback,useState } from 'react';

import { useTranslation } from '@/i18n';

import { LanguageSelector } from './LanguageSelector';
import { OutputDisplay } from './OutputDisplay';

/* Batch-02: Extracted Long Classes */
const C_CODESANDBOXPANEL_1 = "w-full resize-y rounded-lg border border-border/50 bg-muted/30 p-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-primary/40";
const C_CODESANDBOXPANEL_2 = "rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";


type SandboxLanguage = 'javascript' | 'typescript' | 'python' | 'shell';

interface ExecutionResult {
    success: boolean;
    stdout: string;
    stderr: string;
    durationMs: number;
}

/**
 * Inline code execution panel for running snippets in a sandboxed environment.
 * Supports JavaScript, TypeScript, Python, and Shell.
 */
export const CodeSandboxPanel: React.FC = () => {
    const { t } = useTranslation();
    const [language, setLanguage] = useState<SandboxLanguage>('javascript');
    const [code, setCode] = useState('');
    const [isRunning, setIsRunning] = useState(false);
    const [result, setResult] = useState<ExecutionResult | null>(null);

    const handleCodeChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setCode(e.target.value);
    }, []);

    const handleRun = useCallback(async () => {
        if (!code.trim() || isRunning) {return;}

        setIsRunning(true);
        setResult(null);

        try {
            const response = await window.electron.codeSandbox.execute({
                language,
                code,
            });

            setResult({
                success: response.success,
                stdout: response.stdout,
                stderr: response.stderr,
                durationMs: response.durationMs,
            });
        } catch {
            setResult({
                success: false,
                stdout: '',
                stderr: t('codeSandbox.error'),
                durationMs: 0,
            });
        } finally {
            setIsRunning(false);
        }
    }, [code, language, isRunning, t]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                void handleRun();
            }
        },
        [handleRun]
    );

    return (
        <div className="rounded-xl border border-border/50 bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                    {t('codeSandbox.title')}
                </h3>
                <LanguageSelector
                    value={language}
                    onChange={setLanguage}
                    disabled={isRunning}
                />
            </div>

            <textarea
                value={code}
                onChange={handleCodeChange}
                onKeyDown={handleKeyDown}
                placeholder={t('codeSandbox.codePlaceholder')}
                disabled={isRunning}
                rows={8}
                className={C_CODESANDBOXPANEL_1}
                spellCheck={false}
            />

            <div className="mt-3 flex justify-end">
                <button
                    onClick={() => void handleRun()}
                    disabled={isRunning || !code.trim()}
                    className={C_CODESANDBOXPANEL_2}
                >
                    {isRunning ? t('codeSandbox.running') : t('codeSandbox.run')}
                </button>
            </div>

            {result && (
                <OutputDisplay
                    stdout={result.stdout}
                    stderr={result.stderr}
                    durationMs={result.durationMs}
                    success={result.success}
                />
            )}
        </div>
    );
};

CodeSandboxPanel.displayName = 'CodeSandboxPanel';
