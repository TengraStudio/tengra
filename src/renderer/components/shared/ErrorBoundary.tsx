import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
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
            return this.props.fallback ?? <h1>Sorry.. there was an error</h1>;
        }

        return this.props.children;
    }
}
