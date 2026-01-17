import { GroupedModels, ModelInfo } from '@renderer/features/models/utils/model-fetcher'
import React, { lazy,Suspense } from 'react'

import { LoadingState } from '@/components/ui/LoadingState'
import { SettingsCategory } from '@/features/settings/types'

const SettingsPage = lazy(() => import('@/features/settings/SettingsPage').then(m => ({ default: m.SettingsPage })))

interface SettingsViewProps {
    installedModels: ModelInfo[]
    proxyModels: ModelInfo[]
    loadModels: () => void
    settingsCategory: SettingsCategory
    groupedModels: GroupedModels | null
}

export const SettingsView: React.FC<SettingsViewProps> = ({
    installedModels,
    proxyModels,
    loadModels,
    settingsCategory,
    groupedModels
}) => {
    return (
        <Suspense fallback={<LoadingState size="md" />}>
            <SettingsPage
                installedModels={installedModels}
                proxyModels={proxyModels}
                onRefreshModels={() => { void loadModels() }}
                activeTab={settingsCategory}
                groupedModels={groupedModels}
            />
        </Suspense>
    )
}

SettingsView.displayName = 'SettingsView'
