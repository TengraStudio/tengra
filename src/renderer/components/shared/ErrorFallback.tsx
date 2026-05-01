/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconAlertCircle, IconChevronDown, IconChevronUp, IconCopy, IconRotate } from '@tabler/icons-react';
import { useState } from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';


export const ErrorFallback = ({
    error,
    resetErrorBoundary,
}: {
    error: Error;
    resetErrorBoundary: () => void;
}) => {
    const { t } = useTranslation();
    const [showStack, setShowStack] = useState(false);
    const [copied, setCopied] = useState(false);

    const copyError = () => {
        void window.electron.clipboard.writeText(`${error.message}\n\n${error.stack}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex items-center justify-center w-full h-full p-6 bg-background/50 backdrop-blur-sm animate-in fade-in duration-500">
            <div role="alert" className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-top-2 duration-500">
                {/* Decorative Background Accent */}
                <div className="absolute top-0 left-0 w-full h-1 bg-destructive/50" />

                <div className="flex items-start gap-4 p-6 pb-2">
                    <div className="p-3 rounded-xl bg-destructive/10 text-destructive shrink-0">
                        <IconAlertCircle className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-foreground mb-1">
                            {t('frontend.errors.somethingWentWrong')}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            {t('frontend.errors.unexpectedDescription')}
                        </p>
                    </div>
                </div>

                <div className="p-6 pt-2 space-y-4">
                    <div className="relative group">
                        <div className="absolute -top-2 left-3 px-2 py-0.5 typo-overline font-bold text-destructive/70 bg-card border border-border rounded pointer-events-none">
                            {t('frontend.errors.errorMessageLabel')}
                        </div>
                        <pre className="text-sm font-mono bg-muted/30 text-foreground p-5 border border-border/50 rounded-xl overflow-auto whitespace-pre-wrap max-h-200">
                            {error.message || t('common.unknownError')}
                        </pre>
                    </div>

                    {error.stack && (
                        <div className="space-y-2">
                            <button
                                onClick={() => setShowStack(!showStack)}
                                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-muted-foreground bg-muted/20 hover:bg-muted/30 border border-border/30 rounded-xl transition-colors w-full"
                            >
                                <span className="flex items-center gap-2">
                                    {showStack ? <IconChevronUp className="w-4 h-4" /> : <IconChevronDown className="w-4 h-4" />}
                                    {t('frontend.errors.technicalDetails')}
                                </span>
                            </button>
                            {showStack && (
                                <div className="animate-in slide-in-from-top-1 duration-200">
                                    <pre className="typo-overline font-mono bg-muted/50 text-muted-foreground p-4 rounded-lg max-h-300 overflow-auto whitespace-pre leading-relaxed border border-border/20">
                                        {error.stack}
                                    </pre>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-end gap-3 p-6 pt-2 bg-muted/5 mt-4">
                    <button
                        onClick={copyError}
                        className={cn(
                            "flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-muted-foreground border border-border rounded-xl hover:bg-muted hover:text-foreground transition-all",
                            copied && "bg-success/10 text-success border-success/30"
                        )}
                    >
                        {copied ? <span>{t('common.copied')}</span> : (
                            <>
                                <IconCopy className="w-4 h-4 opacity-70" />
                                <span>{t('frontend.errors.copyDetails')}</span>
                            </>
                        )}
                    </button>
                    <button
                        onClick={resetErrorBoundary}
                        className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold bg-primary text-primary-foreground rounded-xl shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all"
                    >
                        <IconRotate className="w-4 h-4" />
                        <span>{t('common.retry')}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

ErrorFallback.displayName = 'ErrorFallback';
