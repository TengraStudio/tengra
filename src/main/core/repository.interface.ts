/**
 * Generic Interface for Repositories.
 * Represents a collection-like interface for accessing domain objects.
 * 
 * @template T The domain entity type
 */
export interface IRepository<T> {
    /**
     * Retrieve all items.
     */
    findAll(): Promise<T[]>;

    /**
     * Retrieve a single item by ID.
     */
    findById(id: string): Promise<T | null>;

    /**
     * Create a new item.
     */
    create(item: T): Promise<T>;

    /**
     * Update an existing item.
     */
    update(id: string, item: Partial<T>): Promise<T>;

    /**
     * Delete an item by ID.
     */
    delete(id: string): Promise<boolean>;
}
