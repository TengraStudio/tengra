import { useState, useMemo } from 'react'
import { useDebounce } from './useDebounce'

/**
 * Custom hook for debounced search with filtering
 * 
 * @param items - Array of items to search through
 * @param searchFn - Function to extract searchable text from each item
 * @param delay - Debounce delay in milliseconds (default: 300ms)
 * @returns Object with search term, setter, debounced term, and filtered results
 * 
 * @example
 * ```tsx
 * const { searchTerm, setSearchTerm, filteredItems } = useDebouncedSearch(
 *   users,
 *   (user) => `${user.name} ${user.email}`,
 *   500
 * )
 * ```
 */
export function useDebouncedSearch<T>(
    items: T[],
    searchFn: (item: T) => string,
    delay: number = 300
) {
    const [searchTerm, setSearchTerm] = useState('')
    const debouncedSearchTerm = useDebounce(searchTerm, delay)

    const filteredItems = useMemo(() => {
        if (!debouncedSearchTerm.trim()) {
            return items
        }

        const query = debouncedSearchTerm.toLowerCase().trim()
        return items.filter(item => {
            const searchableText = searchFn(item).toLowerCase()
            return searchableText.includes(query)
        })
    }, [items, debouncedSearchTerm, searchFn])

    return {
        searchTerm,
        setSearchTerm,
        debouncedSearchTerm,
        filteredItems
    }
}
