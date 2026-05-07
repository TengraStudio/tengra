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
 * Model Fallback Chain Service
 * Provides automatic failover between LLM providers for improved reliability
 */

import { appLogger } from '@main/logging/logger';
import { ToolDefinition } from '@shared/types';
import { Message } from '@shared/types/chat';
import { getErrorMessage } from '@shared/utils/error.util';

export interface FallbackModelConfig {
    provider: string;
    model: string;
    priority: number;
    enabled: boolean;
    maxRetries?: number;
    retryDelayMs?: number;
    timeout?: number;
}

export interface FallbackChainConfig {
    models: FallbackModelConfig[];
    globalMaxRetries: number;
    globalRetryDelayMs: number;
    circuitBreaker: {
        enabled: boolean;
        failureThreshold: number;
        resetTimeoutMs: number;
    };
}

export interface FallbackAttempt {
    provider: string;
    model: string;
    success: boolean;
    error?: string;
    latencyMs: number;
    timestamp: Date;
}

export interface FallbackResult<T> {
    success: boolean;
    data?: T;
    error?: string;
    attempts: FallbackAttempt[];
    finalProvider?: string;
    finalModel?: string;
}

interface CircuitState {
    failures: number;
    lastFailure: Date | null;
    isOpen: boolean;
}

const DEFAULT_CONFIG: FallbackChainConfig = {
    models: [],
    globalMaxRetries: 3,
    globalRetryDelayMs: 1000,
    circuitBreaker: {
        enabled: true,
        failureThreshold: 3,
        resetTimeoutMs: 60000 // 1 minute
    }
};

export type ChatHandler = (
    provider: string,
    model: string,
    messages: Message[],
    tools?: ToolDefinition[],
    options?: Record<string, RuntimeValue>
) => Promise<Message | null>;

export class ModelFallbackService {
    private config: FallbackChainConfig = { ...DEFAULT_CONFIG };
    private circuitStates = new Map<string, CircuitState>();
    private attemptHistory: FallbackAttempt[] = [];
    private maxHistorySize = 1000;

    constructor(config?: Partial<FallbackChainConfig>) {
        if (config) {
            this.configure(config);
        }
    }

    /**
     * Configure the fallback chain
     */
    configure(config: Partial<FallbackChainConfig>): void {
        this.config = { ...this.config, ...config };

        // Sort models by priority
        this.config.models.sort((a, b) => a.priority - b.priority);

        appLogger.info('ModelFallbackService', `Configured with ${this.config.models.length} fallback models`);
    }

    /**
     * Add a model to the fallback chain
     */
    addModel(model: FallbackModelConfig): void {
        const existing = this.config.models.findIndex(
            m => m.provider === model.provider && m.model === model.model
        );

        if (existing >= 0) {
            this.config.models[existing] = model;
        } else {
            this.config.models.push(model);
        }

        // Re-sort by priority
        this.config.models.sort((a, b) => a.priority - b.priority);
    }

    /**
     * Remove a model from the fallback chain
     */
    removeModel(provider: string, model: string): boolean {
        const index = this.config.models.findIndex(
            m => m.provider === provider && m.model === model
        );

        if (index >= 0) {
            this.config.models.splice(index, 1);
            return true;
        }

        return false;
    }

    /**
     * Get the current fallback chain
     */
    getChain(): FallbackModelConfig[] {
        return [...this.config.models];
    }

    /**
     * Execute a chat request with automatic fallback
     */
    async executeWithFallback(
        messages: Message[],
        chatHandler: ChatHandler,
        tools?: ToolDefinition[],
        options?: Record<string, RuntimeValue>
    ): Promise<FallbackResult<Message>> {
        const attempts: FallbackAttempt[] = [];
        const enabledModels = this.config.models.filter(m => m.enabled);

        if (enabledModels.length === 0) {
            return {
                success: false,
                error: 'No models configured in fallback chain',
                attempts
            };
        }

        for (const modelConfig of enabledModels) {
            const modelKey = this.getModelKey(modelConfig.provider, modelConfig.model);

            // Check circuit breaker
            if (this.isCircuitOpen(modelKey)) {
                appLogger.debug('ModelFallbackService', `Skipping ${modelKey} - circuit breaker open`);
                continue;
            }

            const maxRetries = modelConfig.maxRetries ?? this.config.globalMaxRetries;
            const retryDelay = modelConfig.retryDelayMs ?? this.config.globalRetryDelayMs;

            for (let retry = 0; retry < maxRetries; retry++) {
                const startTime = Date.now();

                try {
                    appLogger.debug('ModelFallbackService',
                        `Attempting ${modelConfig.provider}/${modelConfig.model} (attempt ${retry + 1}/${maxRetries})`);

                    const result = await chatHandler(
                        modelConfig.provider,
                        modelConfig.model,
                        messages,
                        tools,
                        options
                    );

                    const latencyMs = Date.now() - startTime;

                    if (result) {
                        const attempt: FallbackAttempt = {
                            provider: modelConfig.provider,
                            model: modelConfig.model,
                            success: true,
                            latencyMs,
                            timestamp: new Date()
                        };

                        attempts.push(attempt);
                        this.recordAttempt(attempt);
                        this.resetCircuitBreaker(modelKey);

                        return {
                            success: true,
                            data: result,
                            attempts,
                            finalProvider: modelConfig.provider,
                            finalModel: modelConfig.model
                        };
                    }

                    // Null result is treated as a soft failure
                    throw new Error('Null response from model');

                } catch (error) {
                    const latencyMs = Date.now() - startTime;
                    const errorMsg = getErrorMessage(error as Error);

                    const attempt: FallbackAttempt = {
                        provider: modelConfig.provider,
                        model: modelConfig.model,
                        success: false,
                        error: errorMsg,
                        latencyMs,
                        timestamp: new Date()
                    };

                    attempts.push(attempt);
                    this.recordAttempt(attempt);
                    this.recordFailure(modelKey);

                    appLogger.warn('ModelFallbackService',
                        `${modelConfig.provider}/${modelConfig.model} failed: ${errorMsg}`);

                    // Check if this was the last retry for this model
                    if (retry < maxRetries - 1) {
                        await this.delay(retryDelay * (retry + 1)); // Exponential backoff
                    }
                }
            }
        }

        return {
            success: false,
            error: 'All models in fallback chain failed',
            attempts
        };
    }

    /**
     * Get the model key for circuit breaker tracking
     */
    private getModelKey(provider: string, model: string): string {
        return `${provider}:${model}`;
    }

    /**
     * Check if the circuit breaker is open for a model
     */
    private isCircuitOpen(modelKey: string): boolean {
        if (!this.config.circuitBreaker.enabled) {
            return false;
        }

        const state = this.circuitStates.get(modelKey);
        if (!state?.isOpen) {
            return false;
        }

        // Check if reset timeout has passed
        if (state.lastFailure) {
            const elapsed = Date.now() - state.lastFailure.getTime();
            if (elapsed >= this.config.circuitBreaker.resetTimeoutMs) {
                // Half-open state - allow one attempt
                state.isOpen = false;
                return false;
            }
        }

        return true;
    }

    /**
     * Record a failure for circuit breaker
     */
    private recordFailure(modelKey: string): void {
        if (!this.config.circuitBreaker.enabled) {
            return;
        }

        let state = this.circuitStates.get(modelKey);
        if (!state) {
            state = { failures: 0, lastFailure: null, isOpen: false };
            this.circuitStates.set(modelKey, state);
        }

        state.failures++;
        state.lastFailure = new Date();

        if (state.failures >= this.config.circuitBreaker.failureThreshold) {
            state.isOpen = true;
            appLogger.warn('ModelFallbackService', `Circuit breaker opened for ${modelKey}`);
        }
    }

    /**
     * Reset the circuit breaker for a model
     */
    private resetCircuitBreaker(modelKey: string): void {
        const state = this.circuitStates.get(modelKey);
        if (state) {
            state.failures = 0;
            state.isOpen = false;
            state.lastFailure = null;
        }
    }

    /**
     * Record an attempt in history
     */
    private recordAttempt(attempt: FallbackAttempt): void {
        this.attemptHistory.push(attempt);

        // Trim history if needed
        if (this.attemptHistory.length > this.maxHistorySize) {
            this.attemptHistory = this.attemptHistory.slice(-this.maxHistorySize / 2);
        }
    }

    /**
     * Get attempt history
     */
    getAttemptHistory(limit?: number): FallbackAttempt[] {
        if (limit) {
            return this.attemptHistory.slice(-limit);
        }
        return [...this.attemptHistory];
    }

    /**
     * Get statistics about fallback usage
     */
    getStatistics(): {
        totalAttempts: number;
        successRate: number;
        byModel: Record<string, { attempts: number; successes: number; avgLatencyMs: number }>;
        circuitBreakerStatus: Record<string, { isOpen: boolean; failures: number }>;
    } {
        const byModel: Record<string, { attempts: number; successes: number; totalLatency: number }> = {};

        for (const attempt of this.attemptHistory) {
            const key = this.getModelKey(attempt.provider, attempt.model);
            if (!(key in byModel)) {
                byModel[key] = { attempts: 0, successes: 0, totalLatency: 0 };
            }
            byModel[key].attempts++;
            if (attempt.success) {
                byModel[key].successes++;
            }
            byModel[key].totalLatency += attempt.latencyMs;
        }

        const totalAttempts = this.attemptHistory.length;
        const totalSuccesses = this.attemptHistory.filter(a => a.success).length;

        const modelStats: Record<string, { attempts: number; successes: number; avgLatencyMs: number }> = {};
        for (const [key, stats] of Object.entries(byModel)) {
            modelStats[key] = {
                attempts: stats.attempts,
                successes: stats.successes,
                avgLatencyMs: stats.attempts > 0 ? Math.round(stats.totalLatency / stats.attempts) : 0
            };
        }

        const circuitBreakerStatus: Record<string, { isOpen: boolean; failures: number }> = {};
        for (const [key, state] of this.circuitStates.entries()) {
            circuitBreakerStatus[key] = {
                isOpen: state.isOpen,
                failures: state.failures
            };
        }

        return {
            totalAttempts,
            successRate: totalAttempts > 0 ? totalSuccesses / totalAttempts : 0,
            byModel: modelStats,
            circuitBreakerStatus
        };
    }

    /**
     * Clear attempt history
     */
    clearHistory(): void {
        this.attemptHistory = [];
    }

    /**
     * Reset all circuit breakers
     */
    resetAllCircuitBreakers(): void {
        this.circuitStates.clear();
        appLogger.info('ModelFallbackService', 'All circuit breakers reset');
    }

    /**
     * Delay helper
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Export singleton instance
export const modelFallbackService = new ModelFallbackService();

