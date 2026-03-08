import type { Workspace } from '@/types';

export interface WorkspaceSettingsFormData {
    title: string
    description: string
    status: Workspace['status']
    councilEnabled: boolean
    councilMembers: string[]
    consensusThreshold: number
    // Build
    buildCommand: string
    testCommand: string
    lintCommand: string
    outputDir: string
    envFile: string
    // Dev
    devCommand: string
    devPort: number
    devAutoStart: boolean
    // Advanced
    fileWatchEnabled: boolean
    indexingEnabled: boolean
    autoSave: boolean
}

export type WorkspaceSettingsSection = 'general' | 'council' | 'workspace' | 'build' | 'dev' | 'advanced'

export interface SettingsSectionProps {
    formData: WorkspaceSettingsFormData
    setFormData: React.Dispatch<React.SetStateAction<WorkspaceSettingsFormData>>
    t: (key: string) => string
}
