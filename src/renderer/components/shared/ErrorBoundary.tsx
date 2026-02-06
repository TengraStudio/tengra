import { Component, ErrorInfo, ReactNode } from 'react';

import { useTranslation } from '@/i18n';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
}

interface ErrorBoundaryBaseProps extends Props {
    defaultFallback: ReactNode;
}

class ErrorBoundaryBase extends Component<ErrorBoundaryBaseProps, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(_: Error): State {
        return { hasError: true };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        window.electron.log.error('Uncaught error', error);
        window.electron.log.error('React error info', { componentStack: errorInfo.componentStack });
    }

    public render() {
        if (this.state.hasError) {
            return this.props.fallback ?? this.props.defaultFallback;
        }

        return this.props.children;
    }
}

export const ErrorBoundary = ({ children, fallback }: Props) => {
    const { t } = useTranslation();
    return (
        <ErrorBoundaryBase
            fallback={fallback}
            defaultFallback={<h1>{t('errors.unexpected')}</h1>}
        >
            {children}
        </ErrorBoundaryBase>
    );
};
