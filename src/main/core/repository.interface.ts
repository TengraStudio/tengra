/**
 * Options for paginated queries.
 * @property page - The 1-based page number
 * @property pageSize - Number of items per page
 * @property sortBy - Optional field name to sort by
 * @property sortOrder - Sort direction (defaults to 'asc')
 */
export interface PaginationOptions {
    page: number;
    pageSize: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

/**
 * Result wrapper for paginated queries.
 * @template T The domain entity type
 * @property items - The items in the current page
 * @property total - Total number of items across all pages
 * @property page - The current page number
 * @property pageSize - Number of items per page
 */
export interface PaginatedResult<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
}

/**
 * Generic Interface for Repositories.
 * Represents a collection-like interface for accessing domain objects.
 * 
 * @template T The domain entity type
 */
export interface IRepository<T> {
    /**
     * Retrieve all items.
     * @returns Array of all items in the repository
     */
    findAll(): Promise<T[]>;

    /**
     * Retrieve a single item by ID.
     * @param id - Unique identifier of the item
     * @returns The item if found, null otherwise
     */
    findById(id: string): Promise<T | null>;

    /**
     * Create a new item.
     * @param item - The item to create
     * @returns The created item (may include generated fields like ID)
     */
    create(item: T): Promise<T>;

    /**
     * Update an existing item.
     * @param id - Unique identifier of the item to update
     * @param item - Partial fields to update
     * @returns The updated item
     */
    update(id: string, item: Partial<T>): Promise<T>;

    /**
     * Delete an item by ID.
     * @param id - Unique identifier of the item to delete
     * @returns True if the item was deleted, false if not found
     */
    delete(id: string): Promise<boolean>;
}
