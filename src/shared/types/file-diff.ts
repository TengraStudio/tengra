/**
 * File Diff Types - Shared between main and renderer processes
 */

export interface FileDiff {
    id: string
    chatSessionId?: string
    aiSystem: 'chat' | 'project' | 'council'
    filePath: string
    beforeContent: string
    afterContent: string
    diffContent: string
    timestamp: number
    changeReason?: string
    metadata?: {
        userId?: string
        messageId?: string
        councilSessionId?: string
        toolName?: string
    }
}

export interface DiffHunk {
    oldStart: number
    oldLines: number
    newStart: number
    newLines: number
    lines: DiffLine[]
}

export interface DiffLine {
    type: 'context' | 'delete' | 'insert'
    content: string
    oldLineNumber?: number
    newLineNumber?: number
}

export interface FileChangeEvent {
    type: 'file-changed'
    data: FileDiff
}

export interface DiffStats {
    additions: number
    deletions: number
    changes: number
}

export type AISystemType = 'chat' | 'project' | 'council'