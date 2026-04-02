import App from '@renderer/App';
import { AppProviders } from '@renderer/context/AppProviders';
import { installRendererLogger } from '@renderer/logging';
import { translateErrorMessage } from '@renderer/utils/error-handler.util';
import { performanceMonitor } from '@renderer/utils/performance';
import React from 'react';
import ReactDOM from 'react-dom/client';

import '@renderer/index.css';

installRendererLogger();
performanceMonitor.mark('renderer:boot');

const bootstrapWindow = window as Window & {
    requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number
};

const loadWebBridge = () => {
    void import('@renderer/web-bridge');
};

if (!window.electron) {
    loadWebBridge();
} else if (bootstrapWindow.requestIdleCallback) {
    bootstrapWindow.requestIdleCallback(() => {
        loadWebBridge();
    }, { timeout: 300 });
} else {
    window.setTimeout(() => {
        loadWebBridge();
    }, 150);
}

const rootElement = document.getElementById('root');
if (rootElement) {
    ReactDOM.createRoot(rootElement).render(
        <React.StrictMode>
            <AppProviders>
                <App />
            </AppProviders>
        </React.StrictMode>
    );
    window.requestAnimationFrame(() => {
        document.documentElement.classList.add('app-ready');
    });
} else {
    throw new Error(translateErrorMessage('Root element not found'));
}
