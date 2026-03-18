import { Component, ErrorInfo, ReactNode } from 'react';

import { useTranslation } from '@/i18n';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    fallbackRender?: (props: { error: Error; resetErrorBoundary: () => void }) => ReactNode;
    resetKeys?: RendererDataValue[];
}

interface State {
    hasError: boolean;
    error: Error | null;
}

interface ErrorBoundaryBaseProps extends Props {
    defaultFallback: ReactNode;
}

class ErrorBoundaryBase extends Component<ErrorBoundaryBaseProps, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        window.electron.log.error('Uncaught error', error);
        window.electron.log.error('React error info', { componentStack: errorInfo.componentStack });
    }

    public componentDidUpdate(prevProps: ErrorBoundaryBaseProps) {
        if (this.state.hasError && this.props.resetKeys && prevProps.resetKeys) {
            const keysChanged = this.props.resetKeys.some((key, index) => {
                const prevKey = prevProps.resetKeys?.[index];
                return key !== prevKey;
            });

            if (keysChanged) {
                this.resetErrorBoundary();
            }
        }
    }

    public resetErrorBoundary = () => {
        this.setState({ hasError: false, error: null });
    };

    public render() {
        if (this.state.hasError) {
            const resolvedError = this.state.error ?? new Error('Unknown render error');
            if (this.props.fallbackRender) {
                try {
                    return this.props.fallbackRender({
                        error: resolvedError,
                        resetErrorBoundary: this.resetErrorBoundary
                    });
                } catch (fallbackError) {
                    window.electron.log.error(
                        'Error boundary fallback render failed',
                        fallbackError instanceof Error
                            ? fallbackError
                            : new Error('Unknown fallback render error')
                    );
                }
            }
            return this.props.fallback ?? this.props.defaultFallback;
        }

        return this.props.children;
    }
}

export const ErrorBoundary = (props: Props) => {
    const { t } = useTranslation();
    const defaultFallbackRender = ({ resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
        <div className="min-h-[220px] flex flex-col items-center justify-center gap-3 p-6 text-center">
            <h1 className="text-lg font-semibold">{t('errors.unexpected')}</h1>
            <p className="text-sm text-muted-foreground">{t('errors.tryAgain')}</p>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={resetErrorBoundary}
                    className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm"
                >
                    {t('common.retry')}
                </button>
                <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="px-3 py-1.5 rounded-md border border-border text-sm"
                >
                    {t('common.reload')}
                </button>
            </div>
        </div>
    );
    return (
        <ErrorBoundaryBase
            {...props}
            fallbackRender={props.fallbackRender ?? defaultFallbackRender}
            defaultFallback={<h1>{t('errors.unexpected')}</h1>}
        />
    );
};
