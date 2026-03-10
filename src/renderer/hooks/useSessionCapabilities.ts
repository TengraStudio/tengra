import { SessionCapabilityDescriptor } from '@shared/types/session-engine';
import { useEffect, useSyncExternalStore } from 'react';

import {
    ensureSessionCapabilityCatalog,
    getSessionCapabilityCatalogSnapshot,
    subscribeSessionRuntime,
} from '@/store/session-runtime.store';

export function useSessionCapabilities(): SessionCapabilityDescriptor[] {
    const capabilities = useSyncExternalStore(
        subscribeSessionRuntime,
        getSessionCapabilityCatalogSnapshot,
        () => []
    );

    useEffect(() => {
        void ensureSessionCapabilityCatalog();
    }, []);

    return capabilities;
}
