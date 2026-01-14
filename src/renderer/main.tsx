import '@renderer/web-bridge'
import { installRendererLogger } from '@renderer/logging'

import React from 'react'
import ReactDOM from 'react-dom/client'


import App from '@renderer/App'
import { AppProviders } from '@renderer/context/AppProviders'
import '@renderer/index.css'

installRendererLogger()

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <AppProviders>
            <App />
        </AppProviders>
    </React.StrictMode>
)
