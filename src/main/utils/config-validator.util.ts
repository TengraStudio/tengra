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
 * Configuration Validator
 * Validates application settings with type safety
 */

import { t } from '@main/utils/i18n.util';
import { JsonObject, JsonValue } from '@shared/types/common';

export type ValidationResult = {
    valid: boolean
    errors: ValidationError[]
    warnings: ValidationWarning[]
}

export interface ValidationError {
    path: string
    message: string
    value?: JsonValue
}

export interface ValidationWarning {
    path: string
    message: string
    suggestion?: string
}

type Validator<T = JsonValue | undefined> = (value: T, path: string) => ValidationError[]

// Built-in validators
export const validators = {
    required: <T extends JsonValue | undefined>(value: T, path: string): ValidationError[] => {
        if (value === undefined) {
            return [{ path, message: t('auto.valueIsRequired') }];
        }
        return [];
    },

    string: (value: JsonValue | undefined, path: string): ValidationError[] => {
        if (value !== undefined && typeof value !== 'string') {
            return [{ path, message: t('auto.mustBeAString'), value }];
        }
        return [];
    },

    number: (value: JsonValue | undefined, path: string): ValidationError[] => {
        if (value !== undefined && typeof value !== 'number') {
            return [{ path, message: t('auto.mustBeANumber'), value }];
        }
        return [];
    },

    boolean: (value: JsonValue | undefined, path: string): ValidationError[] => {
        if (value !== undefined && typeof value !== 'boolean') {
            return [{ path, message: t('auto.mustBeABoolean'), value }];
        }
        return [];
    },

    url: (value: JsonValue | undefined, path: string): ValidationError[] => {
        if (value === undefined || value === '') { return []; }
        if (typeof value !== 'string') { return [{ path, message: t('auto.mustBeAString'), value }]; }
        try {
            new URL(value);
            return [];
        } catch {
            return [{ path, message: t('auto.mustBeAValidUrl'), value }];
        }
    },

    port: (value: JsonValue | undefined, path: string): ValidationError[] => {
        if (value === undefined) { return []; }
        if (typeof value !== 'number' || value < 1 || value > 65535) {
            return [{ path, message: t('auto.mustBeAValidPort165535'), value }];
        }
        return [];
    },

    email: (value: JsonValue | undefined, path: string): ValidationError[] => {
        if (value === undefined || value === '') { return []; }
        if (typeof value !== 'string') { return [{ path, message: t('auto.mustBeAString'), value }]; }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value as string)) {
            return [{ path, message: 'Must be a valid email address', value }];
        }
        return [];
    },

    min: (minValue: number) => (value: JsonValue | undefined, path: string): ValidationError[] => {
        if (value !== undefined && typeof value === 'number' && value < minValue) {
            return [{ path, message: `Must be at least ${minValue}`, value }];
        }
        return [];
    },

    max: (maxValue: number) => (value: JsonValue | undefined, path: string): ValidationError[] => {
        if (value !== undefined && typeof value === 'number' && value > maxValue) {
            return [{ path, message: `Must be at most ${maxValue}`, value }];
        }
        return [];
    },

    oneOf: <T extends JsonValue>(allowedValues: T[]) => (value: JsonValue | undefined, path: string): ValidationError[] => {
        if (value !== undefined && !allowedValues.includes(value as T)) {
            return [{ path, message: `Must be one of: ${allowedValues.join(', ')}`, value }];
        }
        return [];
    },

    pattern: (regex: RegExp, message: string) => (value: JsonValue | undefined, path: string): ValidationError[] => {
        if (value !== undefined && typeof value === 'string' && !regex.test(value)) {
            return [{ path, message, value }];
        }
        return [];
    }
};

// Schema definition
export interface SchemaField {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array'
    required?: boolean
    validators?: Validator[]
    default?: JsonValue
    children?: Record<string, SchemaField>
}

export type Schema = Record<string, SchemaField>

/**
 * Validates a configuration object against a provided schema.
 * 
 * @param config - The configuration object to validate
 * @param schema - The schema to validate against
 * @param basePath - Optional base path for error reporting (nested objects)
 * @returns A ValidationResult indicating success/failure and any errors/warnings
 */
export function validateConfig(config: JsonObject, schema: Schema, basePath = ''): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    const fieldValidation = validateSchemaFields(config, schema, basePath);
    errors.push(...fieldValidation.errors);
    warnings.push(...fieldValidation.warnings);

    const unknownKeysWarnings = validateUnknownKeys(config, schema, basePath);
    warnings.push(...unknownKeysWarnings);

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * Validates all fields defined in the schema.
 * @internal
 */
function validateSchemaFields(config: JsonObject, schema: Schema, basePath: string): { errors: ValidationError[], warnings: ValidationWarning[] } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    for (const [key, field] of Object.entries(schema)) {
        const path = basePath ? `${basePath}.${key}` : key;
        const value = config[key];

        const fieldResult = validateField(value, field, path);
        errors.push(...fieldResult.errors);
        warnings.push(...fieldResult.warnings);
    }

    return { errors, warnings };
}

/**
 * Validates a single field against its schema definition.
 * @internal
 */
function validateField(value: JsonValue | undefined, field: SchemaField, path: string): { errors: ValidationError[], warnings: ValidationWarning[] } {
    if (field.required && (value === undefined || value === null)) {
        return { errors: [{ path, message: t('auto.thisFieldIsRequired') }], warnings: [] };
    }

    if (value === undefined) {
        return { errors: [], warnings: [] };
    }

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Type validation
    errors.push(...validateType(value, field.type, path));

    // Custom validators
    if (field.validators) {
        for (const validator of field.validators) {
            errors.push(...validator(value, path));
        }
    }

    // Nested object validation
    if (field.type === 'object' && field.children !== undefined) {
        const nested = validateNestedConfig(value, field.children, path);
        errors.push(...nested.errors);
        warnings.push(...nested.warnings);
    }

    return { errors, warnings };
}

/**
 * Validates nested configuration objects.
 * @internal
 */
function validateNestedConfig(value: JsonValue, children: Record<string, SchemaField>, path: string): { errors: ValidationError[], warnings: ValidationWarning[] } {
    if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
        const nestedResult = validateConfig(value as JsonObject, children, path);
        return { errors: nestedResult.errors, warnings: nestedResult.warnings };
    }
    return { errors: [], warnings: [] };
}

/**
 * Checks for keys in the config that are not defined in the schema.
 * @internal
 */
function validateUnknownKeys(config: JsonObject, schema: Schema, basePath: string): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];
    for (const key of Object.keys(config)) {
        const path = basePath ? `${basePath}.${key}` : key;
        if (!(key in schema)) {
            warnings.push({
                path,
                message: t('auto.unknownConfigurationKey'),
                suggestion: 'This key may be deprecated or misspelled'
            });
        }
    }
    return warnings;
}

/**
 * Validates the type of a value against a schema type string.
 * @internal
 */
function validateType(value: JsonValue, type: SchemaField['type'], path: string): ValidationError[] {
    switch (type) {
        case 'string':
            return validators.string(value, path);
        case 'number':
            return validators.number(value, path);
        case 'boolean':
            return validators.boolean(value, path);
        case 'object':
            if (typeof value !== 'object' || Array.isArray(value) || value === null) {
                return [{ path, message: t('auto.mustBeAnObject'), value }];
            }
            return [];
        case 'array':
            if (!Array.isArray(value)) {
                return [{ path, message: t('auto.mustBeAnArray'), value }];
            }
            return [];
        default:
            return [];
    }
}

/**
 * Apply defaults from schema to config
 */
export function applyDefaults(config: JsonObject, schema: Schema): JsonObject {
    const result: JsonObject = { ...config };

    for (const [key, field] of Object.entries(schema)) {
        if (result[key] === undefined && field.default !== undefined) {
            result[key] = field.default;
        }

        if (field.type === 'object' && field.children) {
            result[key] = applyDefaults((result[key] ?? {}) as JsonObject, field.children);
        }
    }

    return result;
}

// Pre-defined settings schema
export const settingsSchema: Schema = {
    proxy: {
        type: 'object',
        children: {
            enabled: { type: 'boolean', default: true },
            port: { type: 'number', validators: [validators.port], default: 8317 },
            key: { type: 'string' }
        }
    },
    ollama: {
        type: 'object',
        children: {
            url: { type: 'string', validators: [validators.url], default: 'http://127.0.0.1:11434' }
        }
    },
    gemini: {
        type: 'object',
        children: {
            apiKey: { type: 'string' }
        }
    },
    openai: {
        type: 'object',
        children: {
            apiKey: { type: 'string' },
            baseUrl: { type: 'string', validators: [validators.url] }
        }
    },
    anthropic: {
        type: 'object',
        children: {
            apiKey: { type: 'string' }
        }
    },
    antigravity: {
        type: 'object',
        children: {
            connected: { type: 'boolean' },
            creditUsageModeByAccount: { type: 'object' }
        }
    },
    theme: {
        type: 'string',
        validators: [validators.oneOf(['dark', 'light', 'system'])],
        default: 'dark'
    },
    autoUpdate: {
        type: 'boolean',
        default: true
    }
};

