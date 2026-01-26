import App from '@renderer/App';
import { AppProviders } from '@renderer/context/AppProviders';
import { installRendererLogger } from '@renderer/logging';
import React from 'react';
import ReactDOM from 'react-dom/client';

import '@renderer/index.css';

import '@renderer/web-bridge';

installRendererLogger();

const rootElement = document.getElementById('root');
if (rootElement) {
    ReactDOM.createRoot(rootElement).render(
        <React.StrictMode>
            <AppProviders>
                <App />
            </AppProviders>
        </React.StrictMode>
    );
} else {
    throw new Error('Root element not found');
}
