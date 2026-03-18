import { useSettingsLogic } from '@renderer/features/settings/hooks/useSettingsLogic';
import { SettingsCategory } from '@renderer/features/settings/types';
import { useMemo, useState } from 'react';

export function useAuthManager() {
    const logic = useSettingsLogic();
    const [settingsCategory, setSettingsCategory] = useState<SettingsCategory>('general');
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

    return useMemo(() => ({
        ...logic,
        language: logic.settings?.general.language ?? 'en',
        settingsCategory,
        setSettingsCategory,
        isAuthModalOpen,
        setIsAuthModalOpen,
        handleAntigravityLogout: () => logic.disconnectProvider('antigravity'),
        appSettings: logic.settings,
        setAppSettings: logic.setSettings,
        quotas: logic.quotaData,
        copilotQuota: logic.copilotQuota,
        codexUsage: logic.codexUsage,
        claudeQuota: logic.claudeQuota,
        refresh: logic.refreshAuthStatus
    }), [
        logic, settingsCategory, isAuthModalOpen
    ]);
}
