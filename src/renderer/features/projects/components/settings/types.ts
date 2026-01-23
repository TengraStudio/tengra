import { Project } from '@/types/project'

export interface ProjectSettingsFormData {
    title: string
    description: string
    status: Project['status']
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

export type ProjectSettingsSection = 'general' | 'council' | 'workspace' | 'build' | 'dev' | 'advanced'

export interface SettingsSectionProps {
    formData: ProjectSettingsFormData
    setFormData: React.Dispatch<React.SetStateAction<ProjectSettingsFormData>>
    t: (key: string) => string
}
