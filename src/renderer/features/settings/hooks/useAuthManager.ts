/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useMemo, useState } from 'react';

import { useSettingsLogic } from '@/features/settings/hooks/useSettingsLogic';
import { SettingsCategory } from '@/features/settings/types';

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
