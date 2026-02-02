export interface TodoItem {
    id: string;
    text: string;
    completed: boolean;
    line: number;
    filePath: string;
    relativePath: string;
}

export interface TodoFile {
    path: string;
    relativePath: string;
    items: TodoItem[];
}

export interface TodoStats {
    total: number;
    completed: number;
    pending: number;
}
