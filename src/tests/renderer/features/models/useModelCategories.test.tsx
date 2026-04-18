/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useModelCategories } from '@renderer/features/models/hooks/useModelCategories';
import type { GroupedModels } from '@shared/types/model.types';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('useModelCategories', () => {
    it('places huggingface models under dedicated category and keeps provider selectable', () => {
        const groupedModels: GroupedModels = {
            huggingface: {
                label: 'Hugging Face',
                models: [
                    {
                        id: 'lmstudio-community/gemma-4-E4B-it-GGUF',
                        name: 'gemma-4-E4B-it-GGUF',
                        provider: 'huggingface',
                        providerCategory: 'huggingface',
                    }
                ],
            },
        };

        const { result } = renderHook(() =>
            useModelCategories({
                groupedModels,
                debouncedSearchQuery: '',
                settings: undefined,
                selectedModel: '',
                isModelDisabled: () => false,
                t: key => key,
            })
        );

        const huggingFaceCategory = result.current.find(category => category.id === 'huggingface');
        expect(huggingFaceCategory).toBeDefined();
        expect(huggingFaceCategory?.models).toHaveLength(1);
        expect(huggingFaceCategory?.models[0]?.provider).toBe('huggingface');
        expect(huggingFaceCategory?.models[0]?.isLocal).toBe(true);
    });
});
