
import React, { useEffect, useState } from 'react'
import type { IpcRendererEvent } from 'electron'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Download, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react'

interface UpdateStatus {
    state: 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error' | 'idle'
    version?: string
    progress?: number
    bytesPerSecond?: number
    total?: number
    transferred?: number
    error?: string
}

export const UpdateNotification: React.FC = () => {
    const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' })
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        const handleUpdateStatus = (_event: IpcRendererEvent, newStatus: UpdateStatus) => {
            console.log('Update status received:', newStatus)
            setStatus(newStatus)

            // Auto-show logic
            if (newStatus.state === 'available' ||
                newStatus.state === 'downloading' ||
                newStatus.state === 'downloaded' ||
                newStatus.state === 'error') {
                setIsVisible(true)
            }

            // Auto-hide for "not-available" after delay
            if (newStatus.state === 'not-available') {
                setIsVisible(true)
                setTimeout(() => setIsVisible(false), 3000)
            }
        }

        window.electron?.ipcRenderer.on('update:status', handleUpdateStatus)

        return () => {
            window.electron?.ipcRenderer.removeAllListeners('update:status')
        }
    }, [])

    const handleDownload = () => {
        window.electron?.ipcRenderer.invoke('update:download')
    }

    const handleInstall = () => {
        window.electron?.ipcRenderer.invoke('update:install')
    }

    const handleDismiss = () => {
        setIsVisible(false)
    }

    if (!isVisible || status.state === 'idle') return null

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: -50, x: 50 }}
                    animate={{ opacity: 1, y: 0, x: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="fixed top-20 right-4 z-50 w-80 bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-4 overflow-hidden"
                >
                    {/* Header */}
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                            {status.state === 'checking' && <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />}
                            {status.state === 'available' && <Download className="w-4 h-4 text-blue-400" />}
                            {status.state === 'downloading' && <Download className="w-4 h-4 text-blue-400 animate-pulse" />}
                            {status.state === 'downloaded' && <CheckCircle className="w-4 h-4 text-green-400" />}
                            {status.state === 'error' && <AlertCircle className="w-4 h-4 text-red-400" />}
                            {status.state === 'not-available' && <CheckCircle className="w-4 h-4 text-gray-400" />}

                            <h3 className="font-medium text-white text-sm">
                                {status.state === 'checking' && 'Checking for updates...'}
                                {status.state === 'available' && `Update Available: v${status.version}`}
                                {status.state === 'downloading' && 'Downloading update...'}
                                {status.state === 'downloaded' && 'Update Ready'}
                                {status.state === 'not-available' && 'You are up to date'}
                                {status.state === 'error' && 'Update Failed'}
                            </h3>
                        </div>
                        <button onClick={handleDismiss} className="text-gray-500 hover:text-white">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="text-xs text-gray-400 mb-3">
                        {status.state === 'available' && 'A new version of Orbit is available.'}
                        {status.state === 'downloading' && (
                            <div className="space-y-1">
                                <div className="flex justify-between">
                                    <span>{formatBytes(status.bytesPerSecond || 0)}/s</span>
                                    <span>{Math.round(status.progress || 0)}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500 transition-all duration-300"
                                        style={{ width: `${status.progress}%` }}
                                    />
                                </div>
                            </div>
                        )}
                        {status.state === 'downloaded' && 'Restart Orbit to apply the latest update.'}
                        {status.state === 'error' && status.error}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                        {status.state === 'available' && (
                            <button
                                onClick={handleDownload}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs py-1.5 px-3 rounded transition-colors"
                            >
                                Download
                            </button>
                        )}
                        {status.state === 'downloaded' && (
                            <button
                                onClick={handleInstall}
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs py-1.5 px-3 rounded transition-colors"
                            >
                                Restart Now
                            </button>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

function formatBytes(bytes: number, decimals = 2) {
    if (!+bytes) return '0 B'
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}
