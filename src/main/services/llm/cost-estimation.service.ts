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
 * Cost Estimation Service
 * Calculates estimated and actual costs for LLM API usage (AGT-TOK-02)
 */

import { BaseService } from '@main/services/base.service';
import { Message } from '@shared/types/chat';
import { CostEstimate, PlanCostBreakdown, WorkspaceStep } from '@shared/types/council';

import { getTokenEstimationService, TokenEstimationService } from './token-estimation.service';

/**
 * Model pricing information (prices per million tokens in USD)
 */
export interface ModelPricingInfo {
    provider: string;
    model: string;
    inputPricePerMillionTokens: number;
    outputPricePerMillionTokens: number;
    /** Optional cached input price (e.g., for Anthropic prompt caching) */
    cachedInputPricePerMillionTokens?: number;
}

/**
 * Model pricing database
 * Prices as of January 2025 - should be updated periodically
 */
const MODEL_PRICING: Record<string, ModelPricingInfo> = {
    // Anthropic Claude Models
    'claude-3-5-sonnet-20241022': {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        inputPricePerMillionTokens: 3.0,
        outputPricePerMillionTokens: 15.0,
        cachedInputPricePerMillionTokens: 0.3,
    },
    'claude-3-5-sonnet': {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet',
        inputPricePerMillionTokens: 3.0,
        outputPricePerMillionTokens: 15.0,
    },
    'claude-3-5-haiku': {
        provider: 'anthropic',
        model: 'claude-3-5-haiku',
        inputPricePerMillionTokens: 0.8,
        outputPricePerMillionTokens: 4.0,
    },
    'claude-3-opus': {
        provider: 'anthropic',
        model: 'claude-3-opus',
        inputPricePerMillionTokens: 15.0,
        outputPricePerMillionTokens: 75.0,
    },
    'claude-3-sonnet': {
        provider: 'anthropic',
        model: 'claude-3-sonnet',
        inputPricePerMillionTokens: 3.0,
        outputPricePerMillionTokens: 15.0,
    },
    'claude-3-haiku': {
        provider: 'anthropic',
        model: 'claude-3-haiku',
        inputPricePerMillionTokens: 0.25,
        outputPricePerMillionTokens: 1.25,
    },
    'claude-opus-4.6': {
        provider: 'anthropic',
        model: 'claude-opus-4.6',
        inputPricePerMillionTokens: 5.0,
        outputPricePerMillionTokens: 25.0,
    },
    'claude-sonnet-4-6': {
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        inputPricePerMillionTokens: 3.0,
        outputPricePerMillionTokens: 15.0,
    },
    'claude-haiku-4-5': {
        provider: 'anthropic',
        model: 'claude-haiku-4-5',
        inputPricePerMillionTokens: 1.0,
        outputPricePerMillionTokens: 5.0,
    },

    // OpenAI Models
    'gpt-4o': {
        provider: 'openai',
        model: 'gpt-4o',
        inputPricePerMillionTokens: 2.5,
        outputPricePerMillionTokens: 10.0,
    },
    'gpt-4o-mini': {
        provider: 'openai',
        model: 'gpt-4o-mini',
        inputPricePerMillionTokens: 0.15,
        outputPricePerMillionTokens: 0.6,
    },
    'gpt-4-turbo': {
        provider: 'openai',
        model: 'gpt-4-turbo',
        inputPricePerMillionTokens: 10.0,
        outputPricePerMillionTokens: 30.0,
    },
    'gpt-4': {
        provider: 'openai',
        model: 'gpt-4',
        inputPricePerMillionTokens: 30.0,
        outputPricePerMillionTokens: 60.0,
    },
    'gpt-3.5-turbo': {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        inputPricePerMillionTokens: 0.5,
        outputPricePerMillionTokens: 1.5,
    },
    'o1': {
        provider: 'openai',
        model: 'o1',
        inputPricePerMillionTokens: 15.0,
        outputPricePerMillionTokens: 60.0,
    },
    'o1-mini': {
        provider: 'openai',
        model: 'o1-mini',
        inputPricePerMillionTokens: 3.0,
        outputPricePerMillionTokens: 12.0,
    },
    'o1-preview': {
        provider: 'openai',
        model: 'o1-preview',
        inputPricePerMillionTokens: 15.0,
        outputPricePerMillionTokens: 60.0,
    },
    'o3-mini': {
        provider: 'openai',
        model: 'o3-mini',
        inputPricePerMillionTokens: 1.1,
        outputPricePerMillionTokens: 4.4,
    },
    'o3': {
        provider: 'openai',
        model: 'o3',
        inputPricePerMillionTokens: 1.0,
        outputPricePerMillionTokens: 5.0,
    },
    'o4-mini': {
        provider: 'openai',
        model: 'o4-mini',
        inputPricePerMillionTokens: 0.15,
        outputPricePerMillionTokens: 0.6,
    },
    'gpt-5.4': {
        provider: 'openai',
        model: 'gpt-5.4',
        inputPricePerMillionTokens: 2.50,
        outputPricePerMillionTokens: 10.0,
    },
    'gpt-5.4-mini': {
        provider: 'openai',
        model: 'gpt-5.4-mini',
        inputPricePerMillionTokens: 0.15,
        outputPricePerMillionTokens: 0.6,
    },
    'gpt-5.4-nano': {
        provider: 'openai',
        model: 'gpt-5.4-nano',
        inputPricePerMillionTokens: 0.10,
        outputPricePerMillionTokens: 0.4,
    },
    'gpt-5.2-pro': {
        provider: 'openai',
        model: 'gpt-5.2-pro',
        inputPricePerMillionTokens: 1.50,
        outputPricePerMillionTokens: 7.50,
    },
    'gpt-5.2': {
        provider: 'openai',
        model: 'gpt-5.2',
        inputPricePerMillionTokens: 0.50,
        outputPricePerMillionTokens: 2.50,
    },
    'gpt-5-pro': {
        provider: 'openai',
        model: 'gpt-5-pro',
        inputPricePerMillionTokens: 1.0,
        outputPricePerMillionTokens: 5.0,
    },
    'gpt-5': {
        provider: 'openai',
        model: 'gpt-5',
        inputPricePerMillionTokens: 0.25,
        outputPricePerMillionTokens: 1.25,
    },
    'gpt-5-mini': {
        provider: 'openai',
        model: 'gpt-5-mini',
        inputPricePerMillionTokens: 0.10,
        outputPricePerMillionTokens: 0.50,
    },
    'gpt-5-nano': {
        provider: 'openai',
        model: 'gpt-5-nano',
        inputPricePerMillionTokens: 0.05,
        outputPricePerMillionTokens: 0.25,
    },
    'gpt-4.1': {
        provider: 'openai',
        model: 'gpt-4.1',
        inputPricePerMillionTokens: 1.0,
        outputPricePerMillionTokens: 5.0,
    },
    'gpt-4.1-mini': {
        provider: 'openai',
        model: 'gpt-4.1-mini',
        inputPricePerMillionTokens: 0.15,
        outputPricePerMillionTokens: 0.6,
    },
    'gpt-4.1-nano': {
        provider: 'openai',
        model: 'gpt-4.1-nano',
        inputPricePerMillionTokens: 0.10,
        outputPricePerMillionTokens: 0.4,
    },

    // Google Gemini Models
    'gemini-2.0-flash': {
        provider: 'google',
        model: 'gemini-2.0-flash',
        inputPricePerMillionTokens: 0.1,
        outputPricePerMillionTokens: 0.4,
    },
    'gemini-1.5-pro': {
        provider: 'google',
        model: 'gemini-1.5-pro',
        inputPricePerMillionTokens: 1.25,
        outputPricePerMillionTokens: 5.0,
    },
    'gemini-1.5-flash': {
        provider: 'google',
        model: 'gemini-1.5-flash',
        inputPricePerMillionTokens: 0.075,
        outputPricePerMillionTokens: 0.3,
    },
    'gemini-pro': {
        provider: 'google',
        model: 'gemini-pro',
        inputPricePerMillionTokens: 0.5,
        outputPricePerMillionTokens: 1.5,
    },
    'gemini-3.1-pro-preview': {
        provider: 'google',
        model: 'gemini-3.1-pro-preview',
        inputPricePerMillionTokens: 2.0,
        outputPricePerMillionTokens: 12.0,
    },
    'gemini-3.1-flash-preview': {
        provider: 'google',
        model: 'gemini-3.1-flash-preview',
        inputPricePerMillionTokens: 0.50,
        outputPricePerMillionTokens: 3.0,
    },
    'gemini-3.1-flash-lite': {
        provider: 'google',
        model: 'gemini-3.1-flash-lite',
        inputPricePerMillionTokens: 0.25,
        outputPricePerMillionTokens: 1.50,
    },
    'gemini-3.1-flash-image': {
        provider: 'google',
        model: 'gemini-3.1-flash-image',
        inputPricePerMillionTokens: 0.25,
        outputPricePerMillionTokens: 30.0,
    },
    'gemini-3-pro-image': {
        provider: 'google',
        model: 'gemini-3-pro-image',
        inputPricePerMillionTokens: 2.0,
        outputPricePerMillionTokens: 30.0,
    },

    // Meta Llama Models (via various providers)
    'llama-3.1-405b': {
        provider: 'meta',
        model: 'llama-3.1-405b',
        inputPricePerMillionTokens: 3.0,
        outputPricePerMillionTokens: 3.0,
    },
    'llama-3.1-70b': {
        provider: 'meta',
        model: 'llama-3.1-70b',
        inputPricePerMillionTokens: 0.88,
        outputPricePerMillionTokens: 0.88,
    },
    'llama-3.1-8b': {
        provider: 'meta',
        model: 'llama-3.1-8b',
        inputPricePerMillionTokens: 0.05,
        outputPricePerMillionTokens: 0.08,
    },

    // Mistral Models
    'mistral-large': {
        provider: 'mistral',
        model: 'mistral-large',
        inputPricePerMillionTokens: 2.0,
        outputPricePerMillionTokens: 6.0,
    },
    'mixtral-8x22b': {
        provider: 'mistral',
        model: 'mixtral-8x22b',
        inputPricePerMillionTokens: 0.9,
        outputPricePerMillionTokens: 0.9,
    },
    'mistral-small': {
        provider: 'mistral',
        model: 'mistral-small',
        inputPricePerMillionTokens: 0.2,
        outputPricePerMillionTokens: 0.6,
    },

    // DeepSeek Models
    'deepseek-chat': {
        provider: 'deepseek',
        model: 'deepseek-chat',
        inputPricePerMillionTokens: 0.14,
        outputPricePerMillionTokens: 0.28,
    },
    'deepseek-reasoner': {
        provider: 'deepseek',
        model: 'deepseek-reasoner',
        inputPricePerMillionTokens: 0.55,
        outputPricePerMillionTokens: 2.19,
    },
};

/**
 * Default pricing for unknown models (conservative estimate)
 */
const DEFAULT_PRICING: ModelPricingInfo = {
    provider: 'unknown',
    model: 'unknown',
    inputPricePerMillionTokens: 5.0,
    outputPricePerMillionTokens: 15.0,
};

/**
 * Cost Estimation Service
 * Provides cost estimation for LLM API calls before and after execution
 */
export class CostEstimationService extends BaseService {
    private tokenEstimator: TokenEstimationService;

    constructor() {
        super('CostEstimationService');
        this.tokenEstimator = getTokenEstimationService();
    }

    /**
     * Get pricing info for a model
     * Matches by exact ID, then by partial match
     */
    getPricing(modelId: string): ModelPricingInfo {
        const normalized = modelId.toLowerCase();

        // Exact match
        if (MODEL_PRICING[normalized]) {
            return MODEL_PRICING[normalized];
        }

        // Partial match (e.g., "claude-3-5-sonnet-20241022" matches "claude-3-5-sonnet")
        for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
            if (normalized.includes(key) || key.includes(normalized)) {
                return pricing;
            }
        }

        // Provider-specific partial matches
        const providerMatches: Array<{ patterns: string[]; pricing: ModelPricingInfo }> = [
            { patterns: ['claude', 'anthropic'], pricing: MODEL_PRICING['claude-3-5-sonnet'] },
            { patterns: ['gpt-4o'], pricing: MODEL_PRICING['gpt-4o'] },
            { patterns: ['gpt-4'], pricing: MODEL_PRICING['gpt-4-turbo'] },
            { patterns: ['gpt-3.5', 'gpt-35'], pricing: MODEL_PRICING['gpt-3.5-turbo'] },
            { patterns: ['gemini'], pricing: MODEL_PRICING['gemini-1.5-flash'] },
            { patterns: ['llama'], pricing: MODEL_PRICING['llama-3.1-70b'] },
            { patterns: ['mistral', 'mixtral'], pricing: MODEL_PRICING['mistral-small'] },
            { patterns: ['deepseek'], pricing: MODEL_PRICING['deepseek-chat'] },
        ];

        for (const { patterns, pricing } of providerMatches) {
            if (patterns.some(p => normalized.includes(p))) {
                return pricing;
            }
        }

        return DEFAULT_PRICING;
    }

    /**
     * Calculate cost from token counts
     */
    calculateCost(
        inputTokens: number,
        outputTokens: number,
        modelId: string
    ): CostEstimate {
        const pricing = this.getPricing(modelId);

        const inputCost = (inputTokens / 1_000_000) * pricing.inputPricePerMillionTokens;
        const outputCost = (outputTokens / 1_000_000) * pricing.outputPricePerMillionTokens;

        return {
            inputTokens,
            outputTokens,
            totalTokens: inputTokens + outputTokens,
            costUsd: inputCost + outputCost,
        };
    }

    /**
     * Estimate cost for executing a plan
     * @param plan The plan steps to estimate
     * @param contextMessages Current conversation context
     * @param modelId The model being used
     * @param provider The provider being used
     */
    estimatePlanCost(
        plan: WorkspaceStep[],
        contextMessages: Message[],
        modelId: string,
        provider: string
    ): PlanCostBreakdown {
        const pricing = this.getPricing(modelId);

        // Estimate context tokens (input that will be sent with each step)
        const contextEstimate = this.tokenEstimator.estimateMessagesTokens(contextMessages);
        const baseInputTokens = contextEstimate.estimatedInputTokens;

        // Estimate tokens per step
        // Conservative: each step adds ~500 tokens of input + ~1000 tokens of output
        const ESTIMATED_STEP_INPUT = 500;
        const ESTIMATED_STEP_OUTPUT = 1000;

        let totalInputTokens = 0;
        let totalOutputTokens = 0;
        const stepBreakdown: PlanCostBreakdown['stepBreakdown'] = [];

        for (let i = 0; i < plan.length; i++) {
            const step = plan[i];

            // Each step gets context + accumulated history + step-specific input
            // Context grows linearly as we execute more steps
            const stepInputTokens = baseInputTokens + (i * ESTIMATED_STEP_OUTPUT) + ESTIMATED_STEP_INPUT;
            const stepOutputTokens = ESTIMATED_STEP_OUTPUT;

            const stepCost = this.calculateCost(stepInputTokens, stepOutputTokens, modelId);

            stepBreakdown.push({
                stepId: step.id,
                stepText: step.text,
                estimatedTokens: stepCost.totalTokens,
                estimatedCostUsd: stepCost.costUsd,
            });

            totalInputTokens += stepInputTokens;
            totalOutputTokens += stepOutputTokens;
        }

        const inputCost = (totalInputTokens / 1_000_000) * pricing.inputPricePerMillionTokens;
        const outputCost = (totalOutputTokens / 1_000_000) * pricing.outputPricePerMillionTokens;

        return {
            totalEstimatedCost: inputCost + outputCost,
            inputCost,
            outputCost,
            stepBreakdown,
            modelId,
            provider,
        };
    }

    /**
     * Calculate actual cost from completed plan execution
     */
    calculateActualPlanCost(
        plan: WorkspaceStep[],
        modelId: string,
        provider: string
    ): PlanCostBreakdown {
        const pricing = this.getPricing(modelId);

        let totalInputTokens = 0;
        let totalOutputTokens = 0;
        const stepBreakdown: PlanCostBreakdown['stepBreakdown'] = [];

        for (const step of plan) {
            const inputTokens = step.tokens?.prompt ?? 0;
            const outputTokens = step.tokens?.completion ?? 0;

            const stepCost = this.calculateCost(inputTokens, outputTokens, modelId);

            stepBreakdown.push({
                stepId: step.id,
                stepText: step.text,
                estimatedTokens: stepCost.totalTokens,
                estimatedCostUsd: stepCost.costUsd,
            });

            totalInputTokens += inputTokens;
            totalOutputTokens += outputTokens;
        }

        const inputCost = (totalInputTokens / 1_000_000) * pricing.inputPricePerMillionTokens;
        const outputCost = (totalOutputTokens / 1_000_000) * pricing.outputPricePerMillionTokens;

        return {
            totalEstimatedCost: inputCost + outputCost,
            inputCost,
            outputCost,
            stepBreakdown,
            modelId,
            provider,
        };
    }

    /**
     * Format cost for display (e.g., "$0.0123")
     */
    formatCost(costUsd: number): string {
        if (costUsd < 0.0001) {
            return '<$0.0001';
        }
        if (costUsd < 0.01) {
            return `$${costUsd.toFixed(4)}`;
        }
        if (costUsd < 1) {
            return `$${costUsd.toFixed(3)}`;
        }
        return `$${costUsd.toFixed(2)}`;
    }

    /**
     * Get all available model pricing info
     */
    getAllPricing(): Record<string, ModelPricingInfo> {
        return { ...MODEL_PRICING };
    }
}

// Singleton instance
let instance: CostEstimationService | null = null;

export function getCostEstimationService(): CostEstimationService {
    instance ??= new CostEstimationService();
    return instance;
}


