import { JsonObject } from './common';

/**
 * File Diff Types - Shared between main and renderer processes
 */

export interface FileDiff {
    id: string
    chatSessionId?: string
    aiSystem: AISystemType
    filePath: string
    beforeContent: string
    afterContent: string
    diffContent: string
    timestamp: number
    changeReason?: string
    metadata?: JsonObject
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

export type AISystemType = 'chat' | 'workspace' | 'council'