import { useTranslation } from '@renderer/i18n'
import { WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'

/**
 * Persistent banner displayed when the app loses network connectivity.
 * Listens to browser online/offline events and reflects current status.
 */
export function OfflineBanner(): JSX.Element | null {
    const { t } = useTranslation()
    const [isOffline, setIsOffline] = useState(!navigator.onLine)

    useEffect(() => {
        const handleOffline = (): void => setIsOffline(true)
        const handleOnline = (): void => setIsOffline(false)

        window.addEventListener('offline', handleOffline)
        window.addEventListener('online', handleOnline)

        return () => {
            window.removeEventListener('offline', handleOffline)
            window.removeEventListener('online', handleOnline)
        }
    }, [])

    if (!isOffline) {
        return null
    }

    return (
        <div
            className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-warning/90 px-3 py-1.5 text-xs font-semibold text-warning-foreground"
            role="alert"
        >
            <WifiOff className="h-3.5 w-3.5" />
            <span>{t('common.offlineBanner')}</span>
        </div>
    )
}
