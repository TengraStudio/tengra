#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const reportDir = path.join(rootDir, 'docs', 'audits');
const reportPath = path.join(reportDir, 'critical-priority-report.md');
const jsonReportPath = path.join(reportDir, 'critical-priority-report.json');

function getBinPath(name) {
    const ext = process.platform === 'win32' ? '.cmd' : '';
    return path.join(rootDir, 'node_modules', '.bin', `${name}${ext}`);
}

function runCommand(bin, args) {
    const result = spawnSync(bin, args, {
        cwd: rootDir,
        encoding: 'utf8',
        shell: process.platform === 'win32',
        maxBuffer: 1024 * 1024 * 50
    });

    return {
        code: result.status ?? 1,
        stdout: result.stdout ?? '',
        stderr: result.stderr ?? '',
        error: result.error ? String(result.error) : null
    };
}

function readJson(relativePath) {
    const fullPath = path.join(rootDir, relativePath);
    return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

function collectFiles(dir, matcher, results = []) {
    if (!fs.existsSync(dir)) {
        return results;
    }

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            collectFiles(fullPath, matcher, results);
        } else if (matcher(fullPath)) {
            results.push(fullPath);
        }
    }
    return results;
}

function countMatches(content, pattern) {
    const matches = content.match(pattern);
    return matches ? matches.length : 0;
}

function toWorkspacePath(fullPath) {
    return path.relative(rootDir, fullPath).replace(/\\/g, '/');
}

function buildAudits() {
    const tsConfig = readJson('tsconfig.json');
    const tsConfigNode = readJson('tsconfig.node.json');

    const tscResult = runCommand(getBinPath('tsc'), ['-p', 'tsconfig.json', '--noEmit', '--pretty', 'false']);
    const tscOutput = `${tscResult.stdout}\n${tscResult.stderr}`;
    const implicitAnyMatches = tscOutput.match(/TS7006|TS7031|TS7034|TS2683/g) ?? [];

    const eslintResult = runCommand(getBinPath('eslint'), ['src/main', 'src/renderer', '--ext', '.ts,.tsx', '-f', 'json']);
    let eslintFiles = [];
    try {
        eslintFiles = JSON.parse(eslintResult.stdout || '[]');
    } catch {
        eslintFiles = [];
    }

    const ruleCounts = {
        complexity: 0,
        maxLinesPerFunction: 0,
        floatingPromises: 0,
        noConsole: 0
    };

    for (const file of eslintFiles) {
        for (const message of file.messages ?? []) {
            if (message.ruleId === 'complexity') { ruleCounts.complexity++; }
            if (message.ruleId === 'max-lines-per-function') { ruleCounts.maxLinesPerFunction++; }
            if (message.ruleId === '@typescript-eslint/no-floating-promises') { ruleCounts.floatingPromises++; }
            if (message.ruleId === 'no-console') { ruleCounts.noConsole++; }
        }
    }

    const tsFiles = collectFiles(
        path.join(rootDir, 'src'),
        (fullPath) => fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')
    );

    const consoleLogFindings = [];
    for (const file of tsFiles) {
        if (file.includes('project-scaffold.service.ts')) {
            continue;
        }
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
            if (/\bconsole\.log\s*\(/.test(lines[i])) {
                consoleLogFindings.push(`${toWorkspacePath(file)}:${i + 1}`);
            }
        }
    }

    const ipcFiles = collectFiles(
        path.join(rootDir, 'src', 'main', 'ipc'),
        (fullPath) => fullPath.endsWith('.ts')
    );

    let totalIpcHandles = 0;
    let wrappedIpcHandles = 0;
    let pathSanitizedIpcFiles = 0;

    for (const file of ipcFiles) {
        const content = fs.readFileSync(file, 'utf8');
        totalIpcHandles += countMatches(content, /ipcMain\.handle\s*\(/g);
        wrappedIpcHandles += countMatches(content, /ipcMain\.handle\s*\([^,]+,\s*create(?:Safe)?IpcHandler/gs);

        const handlesPathInputs =
            /ipcMain\.handle\([^)]*(filePath|dirPath|rootPath|oldPath|newPath|zipPath|destPath)/s.test(content);
        const hasPathProtection =
            /assertPathWithinRoot|fileSystemService\./.test(content);
        if (handlesPathInputs && hasPathProtection) {
            pathSanitizedIpcFiles++;
        }
    }

    const serviceFiles = collectFiles(
        path.join(rootDir, 'src', 'main', 'services'),
        (fullPath) => fullPath.endsWith('.service.ts')
    );

    const memoryLeakRiskFiles = [];
    for (const file of serviceFiles) {
        const content = fs.readFileSync(file, 'utf8');
        if (!content.includes('extends BaseService')) {
            continue;
        }

        const hasTimerOrWatcher = /(setInterval|setTimeout|watch\(|\.on\()/g.test(content);
        const hasCleanup = /override\s+async\s+cleanup\s*\(\s*\)\s*:\s*Promise<void>|async\s+cleanup\s*\(\s*\)\s*:\s*Promise<void>/.test(content);

        if (hasTimerOrWatcher && !hasCleanup) {
            memoryLeakRiskFiles.push(toWorkspacePath(file));
        }
    }

    const indexSources = collectFiles(
        path.join(rootDir, 'src', 'main'),
        (fullPath) => fullPath.endsWith('.ts') || fullPath.endsWith('.sql')
    );
    let indexStatementCount = 0;
    for (const file of indexSources) {
        const content = fs.readFileSync(file, 'utf8');
        indexStatementCount += countMatches(content, /CREATE INDEX IF NOT EXISTS/gi);
    }

    const strictEnabled =
        tsConfig.compilerOptions?.strict === true &&
        tsConfigNode.compilerOptions?.strict === true;

    const ipcCoverage = totalIpcHandles > 0
        ? Math.round((wrappedIpcHandles / totalIpcHandles) * 100)
        : 0;

    const eslintHasErrors = eslintFiles.some((file) => (file.errorCount ?? 0) > 0 || (file.fatalErrorCount ?? 0) > 0);

    return {
        generatedAt: new Date().toISOString(),
        globalTs: {
            strictEnabled,
            typeCheckExitCode: tscResult.code,
            implicitAnyDiagnostics: implicitAnyMatches.length
        },
        nasa: {
            maxFunctionLengthViolations: ruleCounts.maxLinesPerFunction,
            complexityViolations: ruleCounts.complexity,
            fsIpcReturnCheckViolations: ruleCounts.floatingPromises
        },
        logging: {
            consoleLogFindings,
            noConsoleRuleFindings: ruleCounts.noConsole
        },
        memory: {
            potentialLeakRiskFiles: memoryLeakRiskFiles
        },
        security: {
            pathSanitizedIpcFiles,
            totalIpcFiles: ipcFiles.length
        },
        ipc: {
            totalIpcHandles,
            wrappedIpcHandles,
            wrapperCoveragePercent: ipcCoverage
        },
        db: {
            indexStatementCount
        },
        tooling: {
            eslintExitCode: eslintHasErrors ? 1 : 0,
            eslintParseableFiles: eslintFiles.length
        }
    };
}

function writeReports(result) {
    if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
    }

    fs.writeFileSync(jsonReportPath, JSON.stringify(result, null, 2), 'utf8');

    const markdownLines = [
        '# Critical Priority Audit Report',
        '',
        `Generated: ${result.generatedAt}`,
        '',
        '## GLOBAL-TS',
        `- Strict mode enabled (\`tsconfig.json\` + \`tsconfig.node.json\`): **${result.globalTs.strictEnabled ? 'YES' : 'NO'}**`,
        `- Type check exit code: **${result.globalTs.typeCheckExitCode}**`,
        `- Implicit any diagnostics: **${result.globalTs.implicitAnyDiagnostics}**`,
        '',
        '## GLOBAL-NASA',
        `- Function length violations (\`max-lines-per-function\`): **${result.nasa.maxFunctionLengthViolations}**`,
        `- Cyclomatic complexity violations (\`complexity\`): **${result.nasa.complexityViolations}**`,
        `- Return-value / floating promise findings (\`@typescript-eslint/no-floating-promises\`): **${result.nasa.fsIpcReturnCheckViolations}**`,
        '',
        '## GLOBAL-LOG',
        `- \`console.log\` findings (excluding scaffold templates): **${result.logging.consoleLogFindings.length}**`,
        `- ESLint \`no-console\` findings: **${result.logging.noConsoleRuleFindings}**`,
        '',
        '## GLOBAL-MEM',
        `- Potential service leak-risk files (event/timer usage without cleanup): **${result.memory.potentialLeakRiskFiles.length}**`,
        '',
        '## GLOBAL-SEC',
        `- IPC files with path args and explicit sanitization patterns: **${result.security.pathSanitizedIpcFiles}/${result.security.totalIpcFiles}**`,
        '',
        '## GLOBAL-IPC',
        `- Total \`ipcMain.handle\`: **${result.ipc.totalIpcHandles}**`,
        `- Wrapped with central IPC wrappers: **${result.ipc.wrappedIpcHandles}**`,
        `- Wrapper coverage: **${result.ipc.wrapperCoveragePercent}%**`,
        '',
        '## GLOBAL-DB',
        `- \`CREATE INDEX IF NOT EXISTS\` statements found: **${result.db.indexStatementCount}**`,
        '',
        '## Notes',
        '- JSON raw report: `docs/audits/critical-priority-report.json`',
        ''
    ];

    const markdown = markdownLines.join('\n');

    fs.writeFileSync(reportPath, markdown, 'utf8');
}

function main() {
    const result = buildAudits();
    writeReports(result);

    console.log('Critical priority audit completed.');
    console.log(`Report: ${toWorkspacePath(reportPath)}`);
    console.log(`JSON: ${toWorkspacePath(jsonReportPath)}`);
}

main();
