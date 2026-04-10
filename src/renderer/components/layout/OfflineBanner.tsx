import { useTranslation } from '@renderer/i18n';
import { WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';


/**
 * Persistent banner displayed when the app loses network connectivity.
 * Listens to browser online/offline events and reflects current status.
 */
export function OfflineBanner(): JSX.Element | null {
    const { t } = useTranslation();
    const [isOffline, setIsOffline] = useState(!navigator.onLine);

    useEffect(() => {
        const handleOffline = (): void => setIsOffline(true);
        const handleOnline = (): void => setIsOffline(false);

        window.addEventListener('offline', handleOffline);
        window.addEventListener('online', handleOnline);

        return () => {
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('online', handleOnline);
        };
    }, []);

    if (!isOffline) {
        return null;
    }

    return (
        <div
            className="tengra-offline-banner"
            role="alert"
        >
            <WifiOff className="tengra-offline-banner__icon" />
            <span>{t('common.offlineBanner')}</span>
        </div>
    );
}
