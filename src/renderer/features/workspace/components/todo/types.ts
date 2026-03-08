import type { TodoFile, TodoItem } from '@/types';

export type { TodoFile, TodoItem };

export interface TodoStats {
    total: number;
    completed: number;
    pending: number;
}
