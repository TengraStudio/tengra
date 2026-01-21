import { useCallback, useEffect, useState } from 'react';

import { EntityKnowledge, EpisodicMemory, SemanticFragment } from '@/types';

export function useMemory() {
    const [facts, setFacts] = useState<SemanticFragment[]>([]);
    const [episodes, setEpisodes] = useState<EpisodicMemory[]>([]);
    const [entities, setEntities] = useState<EntityKnowledge[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await window.electron.memory.getAll();
            setFacts(data.facts);
            setEpisodes(data.episodes);
            setEntities(data.entities);
            setError(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to fetch memories');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const deleteFact = async (id: string) => {
        const res = await window.electron.memory.deleteFact(id);
        if (res.success) {
            setFacts(prev => prev.filter(f => f.id !== id));
        }
        return res;
    };

    const deleteEntity = async (id: string) => {
        const res = await window.electron.memory.deleteEntity(id);
        if (res.success) {
            setEntities(prev => prev.filter(e => e.id !== id));
        }
        return res;
    };

    const addFact = async (content: string, tags: string[] = []) => {
        const res = await window.electron.memory.addFact(content, tags);
        if (res.success) {
            void refresh();
        }
        return res;
    };

    const search = async (query: string) => {
        if (!query.trim()) {
            return refresh();
        }
        try {
            const results = await window.electron.memory.search(query);
            setFacts(results.facts);
            setEpisodes(results.episodes);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Search failed');
        }
    };

    return {
        facts,
        episodes,
        entities,
        isLoading,
        error,
        refresh,
        deleteFact,
        deleteEntity,
        addFact,
        search
    };
}
