/**
 * Shared types for code intelligence modules
 */

export interface CodeSymbol {
    file: string;
    line: number;
    name: string;
    kind: string;
    signature: string;
    docstring: string;
}

export interface IndexingProgress {
    workspaceId?: string;
    current: number;
    total: number;
    status: string;
}

export interface SymbolAnalytics {
    totalSymbols: number;
    uniqueFiles: number;
    uniqueKinds: number;
    byKind: Record<string, number>;
    byExtension: Record<string, number>;
    topFiles: Array<{ path: string; count: number }>;
    topSymbols: Array<{ name: string; count: number }>;
    generatedAt: string;
}

export interface RenameLineChange {
    line: number;
    occurrences: number;
    before: string;
    after: string;
}

export interface RenameFileChange {
    file: string;
    replacements: RenameLineChange[];
}

export interface RenameSymbolResult {
    success: boolean;
    applied: boolean;
    symbol: string;
    newSymbol: string;
    totalFiles: number;
    totalOccurrences: number;
    changes: RenameFileChange[];
    updatedFiles: string[];
    errors: Array<{ file: string; error: string }>;
}

export interface DocumentationPreviewResult {
    success: boolean;
    filePath: string;
    format: 'markdown' | 'jsdoc-comments';
    content: string;
    symbolCount: number;
    generatedAt: string;
    error?: string;
}

export interface CodeQualityAnalysis {
    rootPath: string;
    filesScanned: number;
    totalLines: number;
    functionSymbols: number;
    classSymbols: number;
    longLineCount: number;
    todoLikeCount: number;
    consoleUsageCount: number;
    averageComplexity: number;
    securityIssueCount: number;
    topSecurityFindings: Array<{ file: string; line: number; rule: string; snippet: string }>;
    highestComplexityFiles: Array<{ file: string; complexity: number }>;
    qualityScore: number;
    generatedAt: string;
}

export interface SecurityFinding {
    file: string;
    line: number;
    rule: string;
    snippet: string;
}
