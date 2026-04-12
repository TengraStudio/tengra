import App from '@renderer/App';
import { AppProviders } from '@renderer/context/AppProviders';
import { registerExtensionComponent } from '@renderer/features/extensions/components/ExtensionViewHost';
import { registerLocalExtensions } from '@renderer/features/extensions/extension-renderers';
import { installRendererLogger } from '@renderer/logging';
import { translateErrorMessage } from '@renderer/utils/error-handler.util';
import { performanceMonitor } from '@renderer/utils/performance';
import React from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';

import '@renderer/index.css';

// Expose extension SDK to the global window object
window.React = React;
window.ReactDOM = ReactDOM;
window.Tengra = {
    registerExtensionComponent,
};

installRendererLogger();
registerLocalExtensions();
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
    ReactDOMClient.createRoot(rootElement).render(
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
