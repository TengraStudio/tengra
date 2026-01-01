import './web-bridge'
import React from 'react'
import ReactDOM from 'react-dom/client'
import './components/ToolDisplay.css'
import AppRoot from './AppRoot'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <AppRoot />
    </React.StrictMode>
)
