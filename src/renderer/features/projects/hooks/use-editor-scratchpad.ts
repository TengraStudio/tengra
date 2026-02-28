import React from 'react';

import { useTranslation } from '@/i18n';

interface UseEditorScratchpadParams {
    projectPath: string | undefined;
    activeTabName: string | undefined;
    setSnippetStatus: (status: string) => void;
}

/**
 * Manages scratchpad notes, test execution, and diagnostic output.
 */
export function useEditorScratchpad({ projectPath, activeTabName, setSnippetStatus }: UseEditorScratchpadParams) {
    const { t } = useTranslation();
    const [scratchNote, setScratchNote] = React.useState('');
    const [scratchName, setScratchName] = React.useState('scratch-note');
    const [testOutput, setTestOutput] = React.useState('');
    const [diagnosticLines, setDiagnosticLines] = React.useState<string[]>([]);

    const runTestCommand = React.useCallback(async (mode: 'nearest' | 'file' | 'suite') => {
        if (!projectPath) {
            return;
        }
        const fileArg = activeTabName ?? '';
        const commandByMode: Record<'nearest' | 'file' | 'suite', string[]> = {
            nearest: ['test', '--', fileArg],
            file: ['test', '--', fileArg],
            suite: ['test'],
        };
        const result = await window.electron.runCommand('npm', commandByMode[mode], projectPath);
        const output = `${result.stdout}\n${result.stderr}`.trim();
        setTestOutput(output);
        const lines = output
            .split('\n')
            .filter(line => /fail|pass|error/i.test(line))
            .slice(0, 20);
        setDiagnosticLines(lines);
    }, [activeTabName, projectPath]);

    const runScratchCommand = React.useCallback(async () => {
        if (!projectPath || !scratchNote.trim()) {
            return;
        }
        const parts = scratchNote.trim().split(/\s+/);
        const command = parts[0];
        const args = parts.slice(1);
        if (!command) {
            return;
        }
        const result = await window.electron.runCommand(command, args, projectPath);
        setTestOutput(`${result.stdout}\n${result.stderr}`.trim());
    }, [projectPath, scratchNote]);

    const saveScratchAsDoc = React.useCallback(async () => {
        if (!projectPath) {
            return;
        }
        const path = `${projectPath}\\docs\\${scratchName}.md`;
        await window.electron.files.writeFile(path, scratchNote);
        setSnippetStatus(t('projectDashboard.editor.scratchSavedDoc'));
    }, [projectPath, scratchName, scratchNote, t, setSnippetStatus]);

    const saveScratchAsTask = React.useCallback(async () => {
        if (!projectPath) {
            return;
        }
        const path = `${projectPath}\\tasks\\${scratchName}.txt`;
        await window.electron.files.writeFile(path, scratchNote);
        setSnippetStatus(t('projectDashboard.editor.scratchSavedTask'));
    }, [projectPath, scratchName, scratchNote, t, setSnippetStatus]);

    return {
        scratchNote,
        setScratchNote,
        scratchName,
        setScratchName,
        testOutput,
        diagnosticLines,
        runTestCommand,
        runScratchCommand,
        saveScratchAsDoc,
        saveScratchAsTask,
    };
}
