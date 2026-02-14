import { Component, ErrorInfo, ReactNode } from 'react';

import { useTranslation } from '@/i18n';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    fallbackRender?: (props: { error: Error; resetErrorBoundary: () => void }) => ReactNode;
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

    public resetErrorBoundary = () => {
        this.setState({ hasError: false, error: null });
    };

    public render() {
        if (this.state.hasError) {
            if (this.props.fallbackRender && this.state.error) {
                return this.props.fallbackRender({
                    error: this.state.error,
                    resetErrorBoundary: this.resetErrorBoundary
                });
            }
            return this.props.fallback ?? this.props.defaultFallback;
        }

        return this.props.children;
    }
}

export const ErrorBoundary = (props: Props) => {
    const { t } = useTranslation();
    return (
        <ErrorBoundaryBase
            {...props}
            defaultFallback={<h1>{t('errors.unexpected')}</h1>}
        />
    );
};
