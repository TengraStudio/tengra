import App from '@renderer/App';
import { AppProviders } from '@renderer/context/AppProviders';
import { installRendererLogger } from '@renderer/logging';
import { performanceMonitor } from '@renderer/utils/performance';
import React from 'react';
import ReactDOM from 'react-dom/client';

import '@renderer/index.css';

import '@renderer/web-bridge';

installRendererLogger();
performanceMonitor.mark('renderer:boot');

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
    throw new Error('Root element not found');
}
