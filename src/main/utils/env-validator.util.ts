import fs from 'fs';
import path from 'path';

import { appLogger } from '../logging/logger';

/**
 * Environment variable configuration
 */
interface EnvVarConfig {
    name: string;
    required: boolean;
    description?: string;
}

/**
 * Validation result for environment variables
 */
interface ValidationResult {
    valid: boolean;
    missing: string[];
    warnings: string[];
}

/**
 * Parse .env.example file to extract variable names
 */
function parseEnvExample(filePath: string): EnvVarConfig[] {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        const vars: EnvVarConfig[] = [];

        for (const line of lines) {
            const trimmed = line.trim();
            // Skip empty lines and comments
            if (!trimmed || trimmed.startsWith('#')) {
                continue;
            }

            // Extract variable name (before =)
            const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)=/);
            if (match) {
                vars.push({
                    name: match[1],
                    required: false, // Most OAuth vars are optional
                });
            }
        }

        return vars;
    } catch (error) {
        appLogger.error('EnvValidator', 'Failed to parse .env.example', error as Error);
        return [];
    }
}

/**
 * Validate environment variables against .env.example
 * 
 * @param envExamplePath - Path to .env.example file
 * @returns Validation result with missing and warning variables
 */
export function validateEnvironmentVariables(envExamplePath?: string): ValidationResult {
    const result: ValidationResult = {
        valid: true,
        missing: [],
        warnings: [],
    };

    // Default to .env.example in the repository root
    const examplePath = envExamplePath ?? path.join(process.cwd(), '.env.example');

    // Check if .env.example exists
    if (!fs.existsSync(examplePath)) {
        appLogger.warn('EnvValidator', '.env.example file not found', { path: examplePath });
        return result;
    }

    // Parse .env.example
    const expectedVars = parseEnvExample(examplePath);

    if (expectedVars.length === 0) {
        appLogger.warn('EnvValidator', 'No environment variables found in .env.example');
        return result;
    }

    // Check each variable
    checkVariables(expectedVars, result);

    // Log results
    logValidationResults(result);

    return result;
}

function checkVariables(expectedVars: EnvVarConfig[], result: ValidationResult) {
    for (const varConfig of expectedVars) {
        const value = process.env[varConfig.name];

        if (!value || value.trim() === '') {
            if (varConfig.required) {
                result.missing.push(varConfig.name);
                result.valid = false;
            } else {
                result.warnings.push(varConfig.name);
            }
        }
    }
}

function logValidationResults(result: ValidationResult) {
    if (result.missing.length > 0) {
        appLogger.error(
            'EnvValidator',
            'Required environment variables are missing',
            new Error(`Missing: ${result.missing.join(', ')}`)
        );
    }

    if (result.warnings.length > 0) {
        appLogger.info(
            'EnvValidator',
            'Optional environment variables are not set',
            { warnings: result.warnings }
        );
    }

    if (result.valid && result.warnings.length === 0) {
        appLogger.info('EnvValidator', 'All environment variables are configured');
    }
}

/**
 * Validate environment variables and throw error if required ones are missing
 * 
 * @param envExamplePath - Path to .env.example file
 * @throws Error if required environment variables are missing
 */
export function validateEnvironmentOrThrow(envExamplePath?: string): void {
    const result = validateEnvironmentVariables(envExamplePath);

    if (!result.valid) {
        throw new Error(
            `Missing required environment variables: ${result.missing.join(', ')}\n` +
            'Please configure these variables in your .env file or environment.'
        );
    }
}

/**
 * Get a summary of environment variable status
 */
export function getEnvironmentSummary(envExamplePath?: string): {
    total: number;
    configured: number;
    missing: number;
    percentage: number;
} {
    const examplePath = envExamplePath ?? path.join(process.cwd(), '.env.example');

    if (!fs.existsSync(examplePath)) {
        return { total: 0, configured: 0, missing: 0, percentage: 0 };
    }

    const expectedVars = parseEnvExample(examplePath);
    const total = expectedVars.length;
    let configured = 0;

    for (const varConfig of expectedVars) {
        const value = process.env[varConfig.name];
        if (value && value.trim() !== '') {
            configured++;
        }
    }

    const missing = total - configured;
    const percentage = total > 0 ? Math.round((configured / total) * 100) : 0;

    return { total, configured, missing, percentage };
}
