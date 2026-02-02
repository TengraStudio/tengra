import { TodoFile, TodoItem } from '../components/todo/types';

const IGNORED_FOLDERS = ['node_modules', '.git', 'dist', 'build', 'out', '.next', '.idea', '.vscode', 'coverage', '.Tandem', 'vendor'];
const TODO_FILENAMES = ['todo.md', 'todo.txt', 'todo', 'tasks.md', 'tasks.txt', 'roadmap.md'];

export async function scanDirectory(dirPath: string): Promise<string[]> {
    const foundFiles: string[] = [];
    try {
        const entries = await window.electron.files.listDirectory(dirPath);
        const entryList = Array.isArray(entries) ? entries : [];

        for (const entry of entryList) {
            if (IGNORED_FOLDERS.includes(entry.name)) { continue; }
            if (entry.name.startsWith('.')) { continue; }

            const fullPath = `${dirPath}/${entry.name}`;

            if (entry.isDirectory) {
                const subFiles = await scanDirectory(fullPath);
                foundFiles.push(...subFiles);
            } else if (TODO_FILENAMES.includes(entry.name.toLowerCase())) {
                foundFiles.push(fullPath);
            }
        }
    } catch (e) {
        console.warn(`Failed to scan ${dirPath}`, e);
    }
    return foundFiles;
}

export async function parseTodoFile(filePath: string, projectRoot: string): Promise<TodoFile | null> {
    try {
        const content = await window.electron.files.readFile(filePath);
        const lines = content.split('\n');
        const items: TodoItem[] = [];
        const relativePath = filePath.replace(projectRoot, '').replace(/^[\\/]/, '');

        lines.forEach((line, index) => {
            const trimmed = line.trim();
            const match = trimmed.match(/^[-*+]\s*\[([ xX-])\]\s*(.*)/);
            if (match) {
                const status = match[1].toLowerCase();
                items.push({
                    id: `${filePath}-${index}`,
                    text: match[2].trim() || '',
                    completed: status === 'x',
                    line: index + 1,
                    filePath,
                    relativePath
                });
            } else if (trimmed.startsWith('TODO:') || trimmed.startsWith('FIXME:')) {
                items.push({
                    id: `${filePath}-${index}`,
                    text: trimmed.replace(/^(TODO|FIXME):?\s*/, '').trim(),
                    completed: false,
                    line: index + 1,
                    filePath,
                    relativePath
                });
            }
        });

        return { path: filePath, relativePath, items };
    } catch (e) {
        console.error(`Failed to parse ${filePath}`, e);
        return null;
    }
}
