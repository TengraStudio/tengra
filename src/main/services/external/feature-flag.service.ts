/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as fs from 'fs';
import * as path from 'path';

import { BaseService } from '@main/services/base.service';
import { DataService } from '@main/services/data/data.service';
import { t } from '@main/utils/i18n.util';
import { JsonObject } from '@shared/types/common';
import { TengraError } from '@shared/utils/error.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';


export interface FeatureFlag {
    id: string;
    enabled: boolean;
    description?: string;
    rolloutPercentage?: number; // Future use
}

export interface EvaluationContext {
    userId?: string;
    environment?: string;
    attributes?: JsonObject;
}

/**
 * Standardized error codes for FeatureFlagService
 */
export enum FeatureFlagErrorCode {
    INVALID_FEATURE_ID = 'FEATURE_FLAG_INVALID_ID',
    LOAD_FAILED = 'FEATURE_FLAG_LOAD_FAILED',
    SAVE_FAILED = 'FEATURE_FLAG_SAVE_FAILED',
    NOT_FOUND = 'FEATURE_FLAG_NOT_FOUND',
    INVALID_CONTEXT = 'FEATURE_FLAG_INVALID_CONTEXT',
    INVALID_OVERRIDE = 'FEATURE_FLAG_INVALID_OVERRIDE',
    EVALUATION_FAILED = 'FEATURE_FLAG_EVALUATION_FAILED'
}

/**
 * Typed error class for FeatureFlagService operations.
 * Carries a FeatureFlagErrorCode for programmatic error handling.
 */
export class FeatureFlagError extends TengraError {
    public readonly featureFlagCode: FeatureFlagErrorCode;

    constructor(message: string, code: FeatureFlagErrorCode, context?: JsonObject) {
        super(message, code, context);
        this.featureFlagCode = code;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

export enum FeatureFlagTelemetryEvent {
    FLAG_CHECKED = 'feature_flag_checked',
    FLAG_ENABLED = 'feature_flag_enabled',
    FLAG_DISABLED = 'feature_flag_disabled',
    FLAGS_LOADED = 'feature_flag_loaded',
    FLAGS_SAVED = 'feature_flag_saved',
    FLAGS_LOAD_FAILED = 'feature_flag_load_failed'
}

export const FEATURE_FLAG_PERFORMANCE_BUDGETS = {
    IS_ENABLED_MS: 1,
    ENABLE_MS: 100,
    DISABLE_MS: 100,
    LOAD_FLAGS_MS: 500,
    SAVE_FLAGS_MS: 500,
    GET_ALL_FLAGS_MS: 10
} as const;

/** Maximum allowed length for feature flag identifiers */
const MAX_FLAG_ID_LENGTH = 256;

/** Pattern for valid feature flag IDs: alphanumeric, dots, hyphens, underscores */
const FLAG_ID_PATTERN = /^[a-zA-Z0-9._-]+$/;

/** Maximum number of attributes in an evaluation context */
const MAX_CONTEXT_ATTRIBUTES = 50;

/** Maximum length for context attribute string values */
const MAX_CONTEXT_VALUE_LENGTH = 512;

export class FeatureFlagService extends BaseService {
    private flags: Map<string, FeatureFlag> = new Map();
    private overrides: Map<string, boolean> = new Map();
    private configPath: string;

    /** Default feature flags for council modules */
    private defaults: FeatureFlag[] = [
        { id: 'council.planning', enabled: true, description: t('auto.enableCouncilPlanGeneration') },
        { id: 'council.routing', enabled: true, description: t('auto.enableQuotaawareRouting') },
        { id: 'council.teamwork', enabled: true, description: t('auto.enableMultiagentTeamworkreassignment') },
        { id: 'council.recovery', enabled: true, description: t('auto.enableCrashsafeRecovery') },
        { id: 'council.governance', enabled: true, description: 'Enable model governance enforcement' }
    ];


    constructor(private dataService: DataService) {
        super('FeatureFlagService');
        this.configPath = path.join(this.dataService.getPath('config'), 'features.json');
    }

    override async initialize(): Promise<void> {
        await this.loadFlags();
        void super.initialize();
    }

    /** Clears in-memory flags and overrides. */
    override async cleanup(): Promise<void> {
        this.flags.clear();
        this.overrides.clear();
        this.logInfo('Feature flag service cleaned up');
    }

    private async loadFlags() {
        try {
            // Ensure Config Dir exists
            const configDir = path.dirname(this.configPath);
            try {
                await fs.promises.access(configDir);
            } catch {
                await fs.promises.mkdir(configDir, { recursive: true, mode: 0o700 });
            }

            // Load from disk
            try {
                const content = await fs.promises.readFile(this.configPath, 'utf-8');
                const loaded = safeJsonParse<FeatureFlag[]>(content, []);
                loaded.forEach(f => this.flags.set(f.id, f));
            } catch {
                // Ignore if file doesn't exist
            }

            // Merge defaults if not present
            this.defaults.forEach(def => {
                if (!this.flags.has(def.id)) {
                    this.flags.set(def.id, def);
                }
            });

            this.logInfo('Feature flags loaded');
        } catch (error) {
            this.logError('Failed to load feature flags', error);
            // Fallback to defaults in memory
            this.defaults.forEach(def => this.flags.set(def.id, def));
        }
    }

    private async saveFlags() {
        try {
            const data = Array.from(this.flags.values());
            await fs.promises.writeFile(this.configPath, JSON.stringify(data, null, 2));
        } catch (error) {
            this.logError('Failed to save feature flags', error);
        }
    }

    isEnabled(featureId: string): boolean {
        if (!featureId || typeof featureId !== 'string' || featureId.trim().length === 0) {
            return false;
        }
        if (featureId.length > MAX_FLAG_ID_LENGTH || !FLAG_ID_PATTERN.test(featureId)) {
            return false;
        }
        const override = this.overrides.get(featureId);
        if (override !== undefined) {
            return override;
        }
        const flag = this.flags.get(featureId);
        return flag ? flag.enabled : false;
    }

    /** Enables a feature flag by its identifier and persists the change. */
    enable(featureId: string): void {
        this.validateFeatureId(featureId);
        const flag = this.flags.get(featureId);
        if (flag) {
            flag.enabled = true;
            this.flags.set(featureId, flag);
            void this.saveFlags();
            this.logInfo(`Feature enabled: ${featureId}`);
        }
    }

    /** Disables a feature flag by its identifier and persists the change. */
    disable(featureId: string): void {
        this.validateFeatureId(featureId);
        const flag = this.flags.get(featureId);
        if (flag) {
            flag.enabled = false;
            this.flags.set(featureId, flag);
            void this.saveFlags();
            this.logInfo(`Feature disabled: ${featureId}`);
        }
    }

    /**
     * Evaluates a feature flag with an optional context.
     * Always returns a safe default (false) on error — never throws.
     * Context is validated for future targeting and rollout use.
     */
    evaluate(featureId: string, context?: EvaluationContext): boolean {
        try {
            this.validateFeatureId(featureId);
            if (context !== undefined) {
                this.validateEvaluationContext(context);
            }
            const override = this.overrides.get(featureId);
            if (override !== undefined) {
                return override;
            }
            const flag = this.flags.get(featureId);
            return flag ? flag.enabled : false;
        } catch (error) {
            this.logWarn('evaluate fallback to false', error as Error);
            return false;
        }
    }

    /**
     * Sets a local override for a feature flag evaluation.
     * @throws FeatureFlagError with INVALID_OVERRIDE code if value is not a boolean
     */
    setOverride(featureId: string, enabled: boolean): void {
        this.validateFeatureId(featureId);
        if (typeof enabled !== 'boolean') {
            throw new FeatureFlagError(
                'Override value must be a boolean',
                FeatureFlagErrorCode.INVALID_OVERRIDE,
                { featureId }
            );
        }
        this.overrides.set(featureId, enabled);
        this.logInfo(`Override set for ${featureId}: ${String(enabled)}`);
    }

    /** Clears a local override for a feature flag. */
    clearOverride(featureId: string): void {
        this.validateFeatureId(featureId);
        this.overrides.delete(featureId);
        this.logInfo(`Override cleared for ${featureId}`);
    }

    getAllFlags(): FeatureFlag[] {
        return Array.from(this.flags.values());
    }

    /**
     * Validates a feature flag identifier for mutation operations.
     * @throws FeatureFlagError with INVALID_FEATURE_ID code for invalid identifiers
     */
    private validateFeatureId(featureId: string): void {
        if (!featureId || typeof featureId !== 'string') {
            throw new FeatureFlagError(
                'Feature flag ID must be a non-empty string',
                FeatureFlagErrorCode.INVALID_FEATURE_ID,
                { featureId: String(featureId) }
            );
        }
        if (featureId.trim().length === 0) {
            throw new FeatureFlagError(
                'Feature flag ID must not be blank',
                FeatureFlagErrorCode.INVALID_FEATURE_ID,
                { featureId }
            );
        }
        if (featureId.length > MAX_FLAG_ID_LENGTH) {
            throw new FeatureFlagError(
                `Feature flag ID exceeds maximum length of ${MAX_FLAG_ID_LENGTH}`,
                FeatureFlagErrorCode.INVALID_FEATURE_ID,
                { featureId: featureId.slice(0, 50), length: featureId.length }
            );
        }
        if (!FLAG_ID_PATTERN.test(featureId)) {
            throw new FeatureFlagError(
                'Feature flag ID contains invalid characters',
                FeatureFlagErrorCode.INVALID_FEATURE_ID,
                { featureId }
            );
        }
    }

    /**
     * Validates an evaluation context object.
     * @throws FeatureFlagError with INVALID_CONTEXT code for invalid contexts
     */
    private validateEvaluationContext(context: EvaluationContext): void {
        if (context === null || typeof context !== 'object' || Array.isArray(context)) {
            throw new FeatureFlagError(
                'Evaluation context must be a plain object',
                FeatureFlagErrorCode.INVALID_CONTEXT
            );
        }
        this.validateContextField(context.userId, 'userId');
        this.validateContextField(context.environment, 'environment');
        if (context.attributes !== undefined) {
            this.validateContextAttributes(context.attributes);
        }
    }

    /** Validates a single string field on an evaluation context. */
    private validateContextField(value: string | undefined, name: string): void {
        if (value === undefined) {
            return;
        }
        if (typeof value !== 'string' || value.trim().length === 0) {
            throw new FeatureFlagError(
                `${name} must be a non-empty string`,
                FeatureFlagErrorCode.INVALID_CONTEXT,
                { field: name }
            );
        }
        if (value.length > MAX_CONTEXT_VALUE_LENGTH) {
            throw new FeatureFlagError(
                `${name} exceeds maximum length of ${MAX_CONTEXT_VALUE_LENGTH}`,
                FeatureFlagErrorCode.INVALID_CONTEXT,
                { field: name, length: value.length }
            );
        }
    }

    /** Validates the attributes map on an evaluation context. */
    private validateContextAttributes(
        attributes: JsonObject
    ): void {
        if (attributes === null || typeof attributes !== 'object' || Array.isArray(attributes)) {
            throw new FeatureFlagError(
                'attributes must be a plain object',
                FeatureFlagErrorCode.INVALID_CONTEXT
            );
        }
        const keys = Object.keys(attributes);
        if (keys.length > MAX_CONTEXT_ATTRIBUTES) {
            throw new FeatureFlagError(
                `attributes exceeds maximum of ${MAX_CONTEXT_ATTRIBUTES} entries`,
                FeatureFlagErrorCode.INVALID_CONTEXT,
                { count: keys.length }
            );
        }
        for (const key of keys) {
            const value = attributes[key];
            const valueType = typeof value;
            if (valueType !== 'string' && valueType !== 'number' && valueType !== 'boolean') {
                throw new FeatureFlagError(
                    `attribute "${key}" must be string, number, or boolean`,
                    FeatureFlagErrorCode.INVALID_CONTEXT,
                    { attribute: key }
                );
            }
            if (valueType === 'string' && (value as string).length > MAX_CONTEXT_VALUE_LENGTH) {
                throw new FeatureFlagError(
                    `attribute "${key}" exceeds maximum length of ${MAX_CONTEXT_VALUE_LENGTH}`,
                    FeatureFlagErrorCode.INVALID_CONTEXT,
                    { attribute: key, length: (value as string).length }
                );
            }
        }
    }

    /**
     * Get health status for feature flag monitoring dashboards
     */
    getHealth(): { totalFlags: number; enabledFlags: number; flagIds: string[] } {
        const flags = Array.from(this.flags.values());
        return {
            totalFlags: flags.length,
            enabledFlags: flags.filter(f => f.enabled).length,
            flagIds: flags.map(f => f.id)
        };
    }
}
