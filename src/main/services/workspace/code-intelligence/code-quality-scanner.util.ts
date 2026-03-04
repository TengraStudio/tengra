/**
 * Code quality analysis utilities
 */

import { promises as fs } from 'fs';

import { scanDirRecursively } from './file-scanner.util';
import { parseFileSymbols } from './symbol-parser.util';
import { CodeQualityAnalysis, SecurityFinding } from './types';

const CODE_FILE_PATTERN = /\.(ts|tsx|js|jsx|py|go|rs|java|kt|kts|cpp|c|h|hpp|cs)$/i;

const SECURITY_RULES: Array<{ rule: string; pattern: RegExp }> = [
    { rule: 'unsafe-eval', pattern: /\beval\s*\(/ },
    { rule: 'unsafe-new-function', pattern: /\bnew\s+Function\s*\(/ },
    { rule: 'unsafe-inner-html', pattern: /\.innerHTML\s*=/ },
    { rule: 'unsafe-child-process-exec', pattern: /\bexec\s*\(/ },
    { rule: 'unsafe-shell-true', pattern: /shell\s*:\s*true/ },
];

/** Scan lines for security issues */
export function scanFileForSecurityIssues(
    filePath: string,
    lines: string[]
): { issueCount: number; findings: SecurityFinding[] } {
    let issueCount = 0;
    const findings: SecurityFinding[] = [];

    for (let index = 0; index < lines.length; index++) {
        const line = lines[index] ?? '';
        for (const rule of SECURITY_RULES) {
            if (rule.pattern.test(line)) {
                issueCount += 1;
                findings.push({
                    file: filePath,
                    line: index + 1,
                    rule: rule.rule,
                    snippet: line.trim().slice(0, 200),
                });
            }
        }
    }

    return { issueCount, findings };
}

/** Estimate cyclomatic complexity of file content */
export function estimateFileComplexity(content: string): number {
    const branchKeywords = content.match(/\b(if|else\s+if|for|while|case|catch)\b/g)?.length ?? 0;
    const logicalOperators = content.match(/&&|\|\|/g)?.length ?? 0;
    const ternaryOperators = content.match(/\?/g)?.length ?? 0;
    return 1 + branchKeywords + logicalOperators + Math.floor(ternaryOperators / 2);
}

/** Accumulate quality metrics from a single file */
function analyzeFileMetrics(
    filePath: string,
    content: string,
    lines: string[]
): {
    lineCount: number;
    functions: number;
    classes: number;
    longLines: number;
    todos: number;
    consoleUsage: number;
    securityIssues: number;
    securityFindings: SecurityFinding[];
    complexity: number;
} {
    const symbols = parseFileSymbols(filePath, content);
    const complexity = estimateFileComplexity(content);
    const secResult = scanFileForSecurityIssues(filePath, lines);

    return {
        lineCount: lines.length,
        functions: symbols.filter(s => s.kind === 'function').length,
        classes: symbols.filter(s => s.kind === 'class').length,
        longLines: lines.filter(l => l.length > 120).length,
        todos: lines.filter(l => /(TODO|FIXME|HACK|XXX)/i.test(l)).length,
        consoleUsage: lines.filter(l => /console\.(log|warn|error|debug)\s*\(/.test(l)).length,
        securityIssues: secResult.issueCount,
        securityFindings: secResult.findings,
        complexity,
    };
}

/** Calculate quality score from accumulated penalties */
function calculateQualityScore(
    longLineCount: number,
    todoLikeCount: number,
    consoleUsageCount: number,
    securityIssueCount: number,
    averageComplexity: number
): number {
    const penalties =
        Math.min(longLineCount * 0.15, 20) +
        Math.min(todoLikeCount * 0.5, 15) +
        Math.min(consoleUsageCount * 0.2, 10) +
        Math.min(securityIssueCount * 0.8, 25) +
        Math.min(averageComplexity * 2.5, 35);
    return Math.max(0, Math.round(100 - penalties));
}

/** Analyze code quality across a project */
export async function analyzeCodeQuality(
    rootPath: string,
    maxFiles: number = 300
): Promise<CodeQualityAnalysis> {
    const safeMaxFiles = Number.isFinite(maxFiles) && maxFiles > 0
        ? Math.min(Math.trunc(maxFiles), 3000)
        : 300;

    const files: string[] = [];
    await scanDirRecursively(rootPath, files);
    const candidateFiles = files.filter(f => CODE_FILE_PATTERN.test(f)).slice(0, safeMaxFiles);

    let totalLines = 0, functionSymbols = 0, classSymbols = 0;
    let longLineCount = 0, todoLikeCount = 0, consoleUsageCount = 0;
    let securityIssueCount = 0, complexityTotal = 0;
    const complexityByFile: Array<{ file: string; complexity: number }> = [];
    const securityFindings: SecurityFinding[] = [];

    for (const filePath of candidateFiles) {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const lines = content.split(/\r?\n/);
            const metrics = analyzeFileMetrics(filePath, content, lines);

            totalLines += metrics.lineCount;
            functionSymbols += metrics.functions;
            classSymbols += metrics.classes;
            longLineCount += metrics.longLines;
            todoLikeCount += metrics.todos;
            consoleUsageCount += metrics.consoleUsage;
            securityIssueCount += metrics.securityIssues;
            const remaining = 200 - securityFindings.length;
            securityFindings.push(...metrics.securityFindings.slice(0, remaining));
            complexityTotal += metrics.complexity;
            complexityByFile.push({ file: filePath, complexity: metrics.complexity });
        } catch {
            // Best-effort quality scan; skip unreadable files.
        }
    }

    const filesScanned = candidateFiles.length;
    const averageComplexity = filesScanned > 0 ? complexityTotal / filesScanned : 0;
    const qualityScore = calculateQualityScore(
        longLineCount, todoLikeCount, consoleUsageCount, securityIssueCount, averageComplexity
    );

    return {
        rootPath,
        filesScanned,
        totalLines,
        functionSymbols,
        classSymbols,
        longLineCount,
        todoLikeCount,
        consoleUsageCount,
        averageComplexity: Number(averageComplexity.toFixed(2)),
        securityIssueCount,
        topSecurityFindings: securityFindings.slice(0, 50),
        highestComplexityFiles: complexityByFile
            .sort((a, b) => b.complexity - a.complexity)
            .slice(0, 20),
        qualityScore,
        generatedAt: new Date().toISOString(),
    };
}
