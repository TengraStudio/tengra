import { AlertCircle, ChevronDown, ChevronUp, Copy, RotateCcw } from 'lucide-react';
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
        <div className="flex items-center justify-center p-6 w-full h-full bg-background/50 backdrop-blur-sm animate-in fade-in duration-500">
            <div role="alert" className="max-w-2xl w-full p-8 bg-card border border-border shadow-premium rounded-2xl relative overflow-hidden group">
                {/* Decorative Background Accent */}
                <div className="absolute top-0 left-0 w-full h-1 bg-destructive/50" />

                <div className="flex items-start gap-4 mb-6">
                    <div className="p-3 rounded-xl bg-destructive/10 text-destructive">
                        <AlertCircle className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-foreground mb-1">
                            {t('errors.somethingWentWrong')}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            The application encountered an unexpected error.
                        </p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="relative group/code">
                        <div className="absolute -top-3 left-3 px-2 py-0.5 bg-card text-[10px] font-bold uppercase tracking-wider text-destructive/70 border border-border rounded">
                            Error Message
                        </div>
                        <pre className="text-sm bg-muted/30 p-5 rounded-xl overflow-auto whitespace-pre-wrap font-mono border border-border/50 text-foreground">
                            {error.message || 'Unknown error occurred'}
                        </pre>
                    </div>

                    {error.stack && (
                        <div className="bg-muted/20 rounded-xl border border-border/30 overflow-hidden">
                            <button
                                onClick={() => setShowStack(!showStack)}
                                className="w-full px-4 py-3 text-xs font-semibold flex items-center justify-between hover:bg-muted/30 transition-colors text-muted-foreground"
                            >
                                <span className="flex items-center gap-2">
                                    {showStack ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                    TECHNICAL DETAILS (STACK TRACE)
                                </span>
                            </button>
                            {showStack && (
                                <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-300">
                                    <pre className="text-[11px] bg-black/20 p-4 rounded-lg overflow-auto max-h-60 whitespace-pre font-mono text-muted-foreground leading-relaxed">
                                        {error.stack}
                                    </pre>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex gap-3 justify-end items-center mt-8">
                    <button
                        onClick={copyError}
                        className={cn(
                            "group flex items-center gap-2 px-5 py-2.5 text-sm font-medium border border-border rounded-xl transition-all",
                            copied
                                ? "bg-success/10 text-success border-success/30"
                                : "hover:bg-muted text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {copied ? <span className="animate-in zoom-in-50 duration-200">Copied!</span> : (
                            <>
                                <Copy className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" />
                                <span>Copy Details</span>
                            </>
                        )}
                    </button>
                    <button
                        onClick={resetErrorBoundary}
                        className="flex items-center gap-2 px-6 py-2.5 text-sm bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-all font-bold shadow-lg shadow-primary/20 active:scale-95"
                    >
                        <RotateCcw className="w-4 h-4" />
                        <span>{t('common.retry')}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

ErrorFallback.displayName = 'ErrorFallback';
