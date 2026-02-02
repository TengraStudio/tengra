import { useCallback, useEffect, useMemo, useState } from 'react';

import { TodoFile, TodoItem } from '../components/todo/types';
import { parseTodoFile, scanDirectory } from '../utils/todo-utils';

export function useProjectTodoLogic(projectRoot: string) {
    const [todoFiles, setTodoFiles] = useState<TodoFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>({});

    const fetchTodos = useCallback(async () => {
        if (!projectRoot) { return; }
        setLoading(true);
        setError(null);
        try {
            const files = await scanDirectory(projectRoot);
            const results = await Promise.all(files.map(file => parseTodoFile(file, projectRoot)));
            const validFiles = results.filter((f): f is TodoFile => f !== null && f.items.length > 0);

            setTodoFiles(validFiles);

            // Auto expand all by default
            const expanded: Record<string, boolean> = {};
            validFiles.forEach(f => expanded[f.path] = true);
            setExpandedFiles(expanded);

        } catch (err) {
            console.error('Failed to fetch todos:', err);
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    }, [projectRoot]);

    useEffect(() => {
        void fetchTodos();
    }, [fetchTodos]);

    const handleToggle = useCallback(async (item: TodoItem) => {
        try {
            const content = await window.electron.files.readFile(item.filePath);
            const lines = content.split('\n');

            // Verify line content matches to avoid drift issues
            const targetLine = lines[item.line - 1];
            if (!targetLine || (!targetLine.includes('- [ ]') && !targetLine.includes('- [x]'))) {
                throw new Error('File content changed, please refresh');
            }

            const newLine = item.completed
                ? targetLine.replace('- [x]', '- [ ]')
                : targetLine.replace('- [ ]', '- [x]');

            lines[item.line - 1] = newLine;
            await window.electron.files.writeFile(item.filePath, lines.join('\n'));

            // Optimistic update
            setTodoFiles(prev => prev.map(f => {
                if (f.path !== item.filePath) { return f; }
                return {
                    ...f,
                    items: f.items.map(i => i.id === item.id ? { ...i, completed: !i.completed } : i)
                };
            }));
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
            void fetchTodos(); // Revert/Refresh on error
        }
    }, [fetchTodos]);

    const handleAddTask = useCallback(async (text: string) => {
        if (!text.trim()) { return; }

        try {
            // Default to root TODO.md
            const targetPath = `${projectRoot}/TODO.md`;
            let content = '';

            // Check if file exists
            if (await window.electron.files.exists(targetPath)) {
                content = await window.electron.files.readFile(targetPath);
                if (content && !content.endsWith('\n')) { content += '\n'; }
            } else {
                content = '# Project Tasks\n\n';
            }

            const newTaskLine = `- [ ] ${text}`;
            const newContent = content + newTaskLine + '\n';

            await window.electron.files.writeFile(targetPath, newContent);
            await fetchTodos();

        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    }, [projectRoot, fetchTodos]);

    const totalStats = useMemo(() => {
        let total = 0;
        let completed = 0;
        todoFiles.forEach(f => {
            total += f.items.length;
            f.items.forEach(i => { if (i.completed) { completed++; } });
        });
        return { total, completed, pending: total - completed };
    }, [todoFiles]);

    const toggleFileExpand = useCallback((path: string) => {
        setExpandedFiles(prev => ({ ...prev, [path]: !prev[path] }));
    }, []);

    return {
        todoFiles,
        loading,
        error,
        expandedFiles,
        totalStats,
        fetchTodos,
        handleToggle,
        handleAddTask,
        toggleFileExpand
    };
}
