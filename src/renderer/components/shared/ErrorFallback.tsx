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
        <div className="tengra-error-fallback">
            <div role="alert" className="tengra-error-fallback__card">
                {/* Decorative Background Accent */}
                <div className="tengra-error-fallback__accent" />

                <div className="tengra-error-fallback__header">
                    <div className="tengra-error-fallback__icon-wrap">
                        <AlertCircle className="tengra-error-fallback__icon" />
                    </div>
                    <div>
                        <h2 className="tengra-error-fallback__title">
                            {t('errors.somethingWentWrong')}
                        </h2>
                        <p className="tengra-error-fallback__subtitle">
                            {t('errors.unexpectedDescription')}
                        </p>
                    </div>
                </div>

                <div className="tengra-error-fallback__body">
                    <div className="tengra-error-fallback__message-wrap">
                        <div className="tengra-error-fallback__message-label">
                            {t('errors.errorMessageLabel')}
                        </div>
                        <pre className="tengra-error-fallback__message">
                            {error.message || t('common.unknownError')}
                        </pre>
                    </div>

                    {error.stack && (
                        <div className="tengra-error-fallback__stack-wrap">
                            <button
                                onClick={() => setShowStack(!showStack)}
                                className="tengra-error-fallback__stack-toggle"
                            >
                                <span className="tengra-error-fallback__stack-toggle-inner">
                                    {showStack ? <ChevronUp className="tengra-error-fallback__chevron" /> : <ChevronDown className="tengra-error-fallback__chevron" />}
                                    {t('errors.technicalDetails')}
                                </span>
                            </button>
                            {showStack && (
                                <div className="tengra-error-fallback__stack-content">
                                    <pre className="tengra-error-fallback__stack">
                                        {error.stack}
                                    </pre>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="tengra-error-fallback__actions">
                    <button
                        onClick={copyError}
                        className={cn(
                            "tengra-error-fallback__copy-btn",
                            copied && "tengra-error-fallback__copy-btn--copied"
                        )}
                    >
                        {copied ? <span className="tengra-error-fallback__copied-text">{t('common.copied')}</span> : (
                            <>
                                <Copy className="tengra-error-fallback__copy-icon" />
                                <span>{t('errors.copyDetails')}</span>
                            </>
                        )}
                    </button>
                    <button
                        onClick={resetErrorBoundary}
                        className="tengra-error-fallback__retry-btn"
                    >
                        <RotateCcw className="tengra-error-fallback__retry-icon" />
                        <span>{t('common.retry')}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

ErrorFallback.displayName = 'ErrorFallback';
