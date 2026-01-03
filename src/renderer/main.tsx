import './web-bridge'
import { installRendererLogger } from './logging'
import React from 'react'
import ReactDOM from 'react-dom/client'
import './components/ToolDisplay.css'
import App from './App'
import './index.css'

installRendererLogger()

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
)
