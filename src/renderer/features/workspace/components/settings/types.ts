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
    // Editor
    editorFontSize: number
    editorLineHeight: number
    editorMinimap: boolean
    editorWordWrap: NonNullable<Workspace['editor']>['wordWrap']
    editorLineNumbers: NonNullable<Workspace['editor']>['lineNumbers']
    editorTabSize: number
    editorCursorBlinking: NonNullable<Workspace['editor']>['cursorBlinking']
    editorFontLigatures: boolean
    editorFormatOnPaste: boolean
    editorSmoothScrolling: boolean
    editorFolding: boolean
    editorCodeLens: boolean
    editorInlayHints: boolean
    editorAdditionalOptions: string
}

export type WorkspaceSettingsSection =
    | 'general'
    | 'council'
    | 'workspace'
    | 'build'
    | 'dev'
    | 'editor'
    | 'advanced'

export interface SettingsSectionProps {
    formData: WorkspaceSettingsFormData
    setFormData: React.Dispatch<React.SetStateAction<WorkspaceSettingsFormData>>
    t: (key: string) => string
}
