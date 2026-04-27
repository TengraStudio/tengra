/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * @fileoverview Input validation and schema guards for Model Selector Popover
 * @description Provides Zod schemas and validation utilities for type-safe model selection
 */

import { z } from 'zod';

/**
 * Schema for validating thinking levels
 */
export const ThinkingLevelSchema = z.enum([
    'none',
    'minimal',
    'low',
    'medium',
    'high',
    'xhigh',
    'max',
]);

/**
 * Schema for validating chat modes
 */
export const ChatModeSchema = z.enum(['instant', 'thinking', 'agent']);

/**
 * Schema for validating model pricing
 */
export const ModelPricingSchema = z
    .object({
        input: z.number().min(0).optional(),
        output: z.number().min(0).optional(),
    })
    .optional();

/**
 * Schema for validating a single model list item
 */
export const ModelListItemSchema = z.object({
    id: z.string().min(1, 'Model ID is required'),
    label: z.string().min(1, 'Model label is required'),
    disabled: z.boolean(),
    provider: z.string().min(1, 'Provider is required'),
    type: z.string().min(1, 'Model type is required'),
    contextWindow: z.number().int().positive().optional(),
    pricing: ModelPricingSchema,
    pinned: z.boolean().optional(),
    thinkingLevels: z.array(z.string()).optional(),
    description: z.string().optional(),
});

/**
 * Schema for validating a model category
 */
export const ModelCategorySchema = z.object({
    id: z.string().min(1, 'Category ID is required'),
    name: z.string().min(1, 'Category name is required'),
    icon: z.custom<React.ElementType>(
        val => val !== undefined && val !== null,
        'Icon component is required'
    ),
    color: z.string().min(1, 'Color class is required'),
    bg: z.string().min(1, 'Background class is required'),
    providerId: z.string().min(1, 'Provider ID is required'),
    models: z.array(ModelListItemSchema),
});

/**
 * Schema for validating selected model
 */
export const SelectedModelSchema = z.object({
    provider: z.string().min(1, 'Provider is required'),
    model: z.string().min(1, 'Model ID is required'),
});

/**
 * Schema for validating the popover props
 * Note: Function types are simplified for runtime validation
 */
export const ModelSelectorPopoverPropsSchema = z.object({
    isOpen: z.boolean(),
    onClose: z.function(),
    categories: z.array(ModelCategorySchema),
    selectedModels: z.array(SelectedModelSchema),
    selectedModel: z.string(),
    selectedProvider: z.string(),
    onSelect: z.function(),
    onRemoveModel: z.function().optional(),
    isFavorite: z.function().optional(),
    toggleFavorite: z.function().optional(),
    recentModels: z.array(z.string()).optional(),
    t: z.function(),
    chatMode: ChatModeSchema.optional(),
    onChatModeChange: z.function().optional(),
    thinkingLevel: z.string().optional(),
    onThinkingLevelChange: z.function().optional(),
    onConfirmSelection: z.function().optional(),
});

/**
 * Schema for validating search query
 */
export const SearchQuerySchema = z.string().max(200, 'Search query too long');

/**
 * Schema for validating pending model state
 */
export const PendingModelSchema = z
    .object({
        provider: z.string().min(1),
        id: z.string().min(1),
    })
    .nullable();

/**
 * Type guard to check if a value is a valid ModelListItem
 */
export function isValidModelListItem(value: RendererDataValue): value is z.infer<typeof ModelListItemSchema> {
    const result = ModelListItemSchema.safeParse(value);
    return result.success;
}

/**
 * Type guard to check if a value is a valid ModelCategory
 */
export function isValidModelCategory(value: RendererDataValue): value is z.infer<typeof ModelCategorySchema> {
    const result = ModelCategorySchema.safeParse(value);
    return result.success;
}

/**
 * Type guard to check if a value is a valid ChatMode
 */
export function isValidChatMode(value: RendererDataValue): value is z.infer<typeof ChatModeSchema> {
    const result = ChatModeSchema.safeParse(value);
    return result.success;
}

/**
 * Type guard to check if a value is a valid ThinkingLevel
 */
export function isValidThinkingLevel(value: RendererDataValue): value is z.infer<typeof ThinkingLevelSchema> {
    const result = ThinkingLevelSchema.safeParse(value);
    return result.success;
}

/**
 * Validates and sanitizes search query
 * @param query - The search query to validate
 * @returns Sanitized query or empty string if invalid
 */
export function sanitizeSearchQuery(query: string): string {
    const trimmed = query.trim();
    const result = SearchQuerySchema.safeParse(trimmed);
    return result.success ? result.data : '';
}

/**
 * Validates model selection parameters
 * @param provider - The provider ID
 * @param modelId - The model ID
 * @returns True if valid, false otherwise
 */
export function isValidModelSelection(provider: string, modelId: string): boolean {
    return (
        typeof provider === 'string' &&
        provider.length > 0 &&
        typeof modelId === 'string' &&
        modelId.length > 0
    );
}

/**
 * Validates categories array
 * @param categories - Array of categories to validate
 * @returns Validated categories or empty array
 */
export function validateCategories(
    categories: RendererDataValue
): z.infer<typeof ModelCategorySchema>[] {
    if (!Array.isArray(categories)) {
        return [];
    }

    const validCategories: z.infer<typeof ModelCategorySchema>[] = [];

    for (const category of categories) {
        if (isValidModelCategory(category)) {
            validCategories.push(category);
        }
    }

    return validCategories;
}

/**
 * Finds a model by ID across all categories
 * @param categories - Array of categories to search
 * @param modelId - The model ID to find
 * @returns The model or undefined if not found
 */
export function findModelById(
    categories: z.infer<typeof ModelCategorySchema>[],
    modelId: string
): z.infer<typeof ModelListItemSchema> | undefined {
    for (const category of categories) {
        const model = category.models.find(m => m.id === modelId);
        if (model) {
            return model;
        }
    }
    return undefined;
}

/**
 * Finds a model by provider and ID
 * @param categories - Array of categories to search
 * @param provider - The provider ID
 * @param modelId - The model ID
 * @returns The model or undefined if not found
 */
export function findModelByProviderAndId(
    categories: z.infer<typeof ModelCategorySchema>[],
    provider: string,
    modelId: string
): z.infer<typeof ModelListItemSchema> | undefined {
    for (const category of categories) {
        const model = category.models.find(m => m.id === modelId && m.provider === provider);
        if (model) {
            return model;
        }
    }
    return undefined;
}

/**
 * Checks if a model supports reasoning (has thinking levels)
 * @param model - The model to check
 * @returns True if the model supports reasoning
 */
export function modelSupportsReasoning(
    model: z.infer<typeof ModelListItemSchema> | undefined
): boolean {
    if (!model) {
        return false;
    }
    return Array.isArray(model.thinkingLevels) && model.thinkingLevels.length > 0;
}

/**
 * Gets valid thinking levels for a model
 * @param model - The model to get thinking levels for
 * @returns Array of valid thinking levels or empty array
 */
export function getValidThinkingLevels(
    model: z.infer<typeof ModelListItemSchema> | undefined
): string[] {
    if (!model || !modelSupportsReasoning(model)) {
        return [];
    }
    return model.thinkingLevels ?? [];
}

/**
 * Validates thinking level selection
 * @param model - The model to validate against
 * @param level - The thinking level to validate
 * @returns True if the level is valid for the model
 */
export function isValidThinkingLevelForModel(
    model: z.infer<typeof ModelListItemSchema> | undefined,
    level: string
): boolean {
    const validLevels = getValidThinkingLevels(model);
    return validLevels.includes(level);
}

/**
 * Error codes for model selector operations
 */
export const ModelSelectorErrorCodes = {
    INVALID_MODEL_ID: 'INVALID_MODEL_ID',
    INVALID_PROVIDER: 'INVALID_PROVIDER',
    MODEL_NOT_FOUND: 'MODEL_NOT_FOUND',
    INVALID_THINKING_LEVEL: 'INVALID_THINKING_LEVEL',
    MODEL_DISABLED: 'MODEL_DISABLED',
    CATEGORY_NOT_FOUND: 'CATEGORY_NOT_FOUND',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
} as const;

export type ModelSelectorErrorCode =
    (typeof ModelSelectorErrorCodes)[keyof typeof ModelSelectorErrorCodes];

/**
 * Custom error class for model selector errors
 */
export class ModelSelectorError extends Error {
    constructor(
        message: string,
        public readonly code: ModelSelectorErrorCode,
        public readonly details?: Record<string, RendererDataValue>
    ) {
        super(message);
        this.name = 'ModelSelectorError';
    }
}

/**
 * Creates a validation result object
 */
export interface ValidationResult {
    success: boolean;
    error?: ModelSelectorError;
}

/**
 * Validates a complete model selection operation
 * @param categories - Available categories
 * @param provider - Selected provider
 * @param modelId - Selected model ID
 * @param thinkingLevel - Optional thinking level
 * @returns Validation result
 */
export function validateModelSelection(
    categories: z.infer<typeof ModelCategorySchema>[],
    provider: string,
    modelId: string,
    thinkingLevel?: string
): ValidationResult {
    // Validate provider and model ID
    if (!isValidModelSelection(provider, modelId)) {
        return {
            success: false,
            error: new ModelSelectorError(
                'Invalid provider or model ID',
                ModelSelectorErrorCodes.VALIDATION_ERROR,
                { provider, modelId }
            ),
        };
    }

    // Find the model
    const model = findModelByProviderAndId(categories, provider, modelId);

    if (!model) {
        return {
            success: false,
            error: new ModelSelectorError(
                `Model not found: ${modelId}`,
                ModelSelectorErrorCodes.MODEL_NOT_FOUND,
                { provider, modelId }
            ),
        };
    }

    // Check if model is disabled
    if (model.disabled) {
        return {
            success: false,
            error: new ModelSelectorError(
                `Model is disabled: ${modelId}`,
                ModelSelectorErrorCodes.MODEL_DISABLED,
                { provider, modelId }
            ),
        };
    }

    // Validate thinking level if model supports reasoning
    if (modelSupportsReasoning(model)) {
        if (!thinkingLevel) {
            return {
                success: false,
                error: new ModelSelectorError(
                    'Thinking level required for reasoning model',
                    ModelSelectorErrorCodes.INVALID_THINKING_LEVEL,
                    { modelId, validLevels: model.thinkingLevels }
                ),
            };
        }

        if (!isValidThinkingLevelForModel(model, thinkingLevel)) {
            return {
                success: false,
                error: new ModelSelectorError(
                    `Invalid thinking level: ${thinkingLevel}`,
                    ModelSelectorErrorCodes.INVALID_THINKING_LEVEL,
                    { modelId, thinkingLevel, validLevels: model.thinkingLevels }
                ),
            };
        }
    }

    return { success: true };
}
