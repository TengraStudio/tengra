import { TodoFile, TodoItem } from '@/types/project';

export type { TodoFile, TodoItem };

export interface TodoStats {
    total: number;
    completed: number;
    pending: number;
}
