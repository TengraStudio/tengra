import type {
    MarketplaceModel,
    MarketplaceModelFit,
    MarketplaceModelPerformanceEstimate,
    MarketplaceModelTag,
    MarketplaceRuntimeProfile,
} from '@shared/types/marketplace';

const BYTES_IN_KB = 1024;
const BYTES_IN_MB = BYTES_IN_KB * 1024;
const BYTES_IN_GB = BYTES_IN_MB * 1024;

const DEFAULT_CONTEXT_TOKENS = 4096;
const DEFAULT_RAM_OVERHEAD_BYTES = 512 * BYTES_IN_MB;

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function parseBytes(value?: string): number | undefined {
    if (!value) {
        return undefined;
    }
    const normalized = value.trim().toLowerCase().replace(/,/g, '');
    const match = normalized.match(/^(\d+(?:\.\d+)?)\s*(tb|gb|mb|kb)$/i);
    if (!match) {
        return undefined;
    }
    const amount = Number(match[1]);
    if (!Number.isFinite(amount) || amount <= 0) {
        return undefined;
    }
    const unit = match[2].toLowerCase();
    if (unit === 'tb') { return amount * BYTES_IN_GB * 1024; }
    if (unit === 'gb') { return amount * BYTES_IN_GB; }
    if (unit === 'mb') { return amount * BYTES_IN_MB; }
    return amount * BYTES_IN_KB;
}

function parseParameters(value?: string | number): number | undefined {
    if (value === undefined || value === null) {
        return undefined;
    }
    const valStr = String(value).trim().toLowerCase().replace(/,/g, '');
    
    // Exact match for things like "7b", "135m"
    const exactMatch = valStr.match(/^(\d+(?:\.\d+)?)\s*([bmk])$/i);
    if (exactMatch) {
        const amount = Number(exactMatch[1]);
        const unit = exactMatch[2];
        if (unit === 'b') { return amount * 1_000_000_000; }
        if (unit === 'm') { return amount * 1_000_000; }
        return amount * 1_000;
    }

    // Search for patterns like "7b", "13b" even if they're surrounded by other text like "shisa-7b-v1"
    const searchMatch = valStr.match(/(\d+(?:\.\d+)?)\s*(b|m|k)(?:\s|[^a-z0-9]|$)/i);
    if (searchMatch) {
        const amount = Number(searchMatch[1]);
        const unit = searchMatch[2];
        if (unit === 'b') { return amount * 1_000_000_000; }
        if (unit === 'm') { return amount * 1_000_000; }
        return amount * 1_000;
    }
    
    // Try raw number if it seems possible
    const rawNum = Number(valStr);
    if (!Number.isNaN(rawNum) && rawNum > 1000) {
        return rawNum;
    }

    return undefined;
}

export function extractParametersFromName(name: string): number | undefined {
    return parseParameters(name);
}

function parseContextWindow(value?: string): number | undefined {
    if (!value) {
        return undefined;
    }
    const match = value.trim().match(/(\d+(?:\.\d+)?)\s*(k|m)?/i);
    if (!match) {
        return undefined;
    }
    const amount = Number(match[1]);
    if (!Number.isFinite(amount) || amount <= 0) {
        return undefined;
    }
    const multiplier = match[2]?.toLowerCase() === 'm' ? 1_000_000 : match[2]?.toLowerCase() === 'k' ? 1_000 : 1;
    return Math.round(amount * multiplier);
}

interface MarketplaceModelVariantCandidate {
    id: string;
    name: string;
    size?: string;
    contextWindow?: string;
    parameterCount: number;
    memoryBytes: number;
    storageBytes: number;
    source: 'root' | 'submodel';
}

function buildModelVariants(model: MarketplaceModel): MarketplaceModelVariantCandidate[] {
    const variants: MarketplaceModelVariantCandidate[] = [];
    const rootStorageBytes = resolveVariantStorageBytes({
        size: model.totalSize,
        modelSize: model.parameters,
    }, model);
    const rootMemoryBytes = resolveVariantMemoryBytes({
        modelSize: model.parameters,
        tensorType: model.pipelineTag,
        contextWindow: undefined,
        size: model.totalSize,
    }, model, rootStorageBytes);

    const parameterCount = parseParameters(model.parameters) 
        ?? extractParametersFromName(model.name)
        ?? estimateParameterCountFromBytes(rootStorageBytes);

    variants.push({
        id: model.id,
        name: model.name,
        size: model.totalSize,
        contextWindow: undefined,
        parameterCount: parameterCount ?? 0,
        memoryBytes: rootMemoryBytes,
        storageBytes: rootStorageBytes,
        source: 'root',
    });

    for (const submodel of model.submodels ?? []) {
        const variantStorageBytes = resolveVariantStorageBytes(submodel, model);
        const variantMemoryBytes = resolveVariantMemoryBytes(submodel, model, variantStorageBytes);
        const variantParameterCount = resolveVariantParameters(submodel, variantStorageBytes, model);

        variants.push({
            id: submodel.id,
            name: submodel.name,
            size: submodel.size ?? submodel.modelSize,
            contextWindow: submodel.contextWindow,
            parameterCount: variantParameterCount ?? 0,
            memoryBytes: variantMemoryBytes,
            storageBytes: variantStorageBytes,
            source: 'submodel',
        });
    }
    return variants.filter(variant => variant.memoryBytes > 0 || variant.storageBytes > 0 || variant.parameterCount > 0);
}

function resolveVariantStorageBytes(
    variant: Pick<MarketplaceModelTag, 'size' | 'modelSize' | 'tensorType'>, 
    model: MarketplaceModel
): number {
    const fromBytes = parseBytes(variant.size)
        ?? parseBytes(variant.modelSize)
        ?? parseBytes(model.totalSize);
    
    if (fromBytes && fromBytes > 0) {
        return fromBytes;
    }

    // Estimate from parameters as a fallback if size is unknown or "0 KB"
    const parameterCount = parseParameters(variant.modelSize)
        ?? parseParameters(model.parameters)
        ?? extractParametersFromName(model.name);
    
    if (parameterCount && parameterCount > 0) {
        // Assume Q4 for storage estimation if unknown (approx 0.6 bytes per param for weights)
        return Math.max(100 * BYTES_IN_MB, estimateWeightsFromParameters(parameterCount, model, variant.tensorType ?? 'q4'));
    }

    return 0;
}

function resolveVariantParameters(variant: Pick<MarketplaceModelTag, 'size' | 'modelSize' | 'tensorType'>, bytes: number, model: MarketplaceModel): number {
    return parseParameters(variant.modelSize) 
        ?? parseParameters(model.parameters) 
        ?? extractParametersFromName(model.name)
        ?? estimateParameterCountFromBytes(bytes) 
        ?? 0;
}

function resolveVariantMemoryBytes(
    variant: Pick<MarketplaceModelTag, 'modelSize' | 'tensorType' | 'contextWindow' | 'size'>,
    model: MarketplaceModel,
    storageBytes: number
): number {
    const parameterCount = parseParameters(variant.modelSize) 
        ?? parseParameters(model.parameters)
        ?? extractParametersFromName(variant.modelSize ?? variant.size ?? '')
        ?? extractParametersFromName(model.name);

    if (parameterCount) {
        const quantizedBytes = estimateWeightsFromParameters(parameterCount, model, variant.tensorType ?? model.pipelineTag);
        const contextTokens = variant.contextWindow ? parseContextWindow(variant.contextWindow) ?? DEFAULT_CONTEXT_TOKENS : resolveContextTokens(model);
        return Math.round(quantizedBytes + estimateKvCacheBytes(parameterCount, contextTokens) + DEFAULT_RAM_OVERHEAD_BYTES);
    }
    if (storageBytes > 0) {
        const estimatedParams = estimateParameterCountFromBytes(storageBytes) ?? 0;
        const contextScale = resolveContextTokens(model) / DEFAULT_CONTEXT_TOKENS;
        // Estimate KV Cache for inferred parameter count
        const kvCacheEstimate = Math.round(BYTES_IN_MB * 128 * (estimatedParams / 1_000_000_000) * contextScale);
        return Math.round(storageBytes + kvCacheEstimate + DEFAULT_RAM_OVERHEAD_BYTES);
    }
    return 0;
}

function estimateParameterCountFromBytes(bytes: number): number | undefined {
    if (bytes <= 0) { return undefined; }
    return Math.max(1, Math.round(bytes / 0.82));
}

function estimateWeightsFromParameters(parameterCount: number, model: MarketplaceModel, quantHint?: string): number {
    const quants = [quantHint, model.pipelineTag, model.name]
        .filter((value): value is string => Boolean(value))
        .join(' ')
        .toLowerCase();
    
    // Improved heuristics for quantization bit-width
    let bitsPerParam = 5.5; // Default (around Q5_K_M)
    if (quants.includes('q8')) { bitsPerParam = 8.5; }
    else if (quants.includes('q6')) { bitsPerParam = 6.6; }
    else if (quants.includes('q5')) { bitsPerParam = 5.5; }
    else if (quants.includes('q4')) { bitsPerParam = 4.8; }
    else if (quants.includes('q3')) { bitsPerParam = 3.7; }
    else if (quants.includes('q2')) { bitsPerParam = 2.8; }
    else if (quants.includes('fp16') || quants.includes('bf16')) { bitsPerParam = 16; }
    else if (quants.includes('fp8')) { bitsPerParam = 8; }

    const bytesPerParam = bitsPerParam / 8;
    return Math.max(256 * BYTES_IN_MB, parameterCount * bytesPerParam);
}

function resolveContextTokens(model: MarketplaceModel): number {
    const windowFromSubmodels = model.submodels
        ?.map(submodel => parseContextWindow(submodel.contextWindow))
        .filter((value): value is number => typeof value === 'number' && value > 0)
        .sort((a, b) => b - a)[0];
    return windowFromSubmodels ?? DEFAULT_CONTEXT_TOKENS;
}

function estimateKvCacheBytes(parameterCount: number, contextTokens: number): number {
    const parameterBillions = Math.max(parameterCount / 1_000_000_000, 1);
    const contextScale = Math.max(contextTokens / DEFAULT_CONTEXT_TOKENS, 1);
    return Math.round(BYTES_IN_MB * 192 * parameterBillions * contextScale);
}

function getAvailableCapacity(profile: MarketplaceRuntimeProfile): number {
    if (profile.gpu.available) {
        const gpuCapacity = profile.gpu.totalVramBytes
            ?? profile.gpu.vramBytes
            ?? profile.gpu.devices.reduce((sum, device) => sum + (device.memoryBytes ?? 0), 0);
        return gpuCapacity > 0 ? gpuCapacity : profile.system.freeMemoryBytes;
    }
    return profile.system.freeMemoryBytes;
}

function chooseBestVariant(
    model: MarketplaceModel,
    profile: MarketplaceRuntimeProfile
): MarketplaceModelVariantCandidate {
    const variants = buildModelVariants(model);
    const vramCapacity = profile.gpu.available ? (profile.gpu.totalVramBytes ?? profile.gpu.vramBytes ?? 0) : 0;
    const ramCapacity = profile.system.freeMemoryBytes;
    const totalCapacity = vramCapacity + ramCapacity;

    if (variants.length === 0) {
        return {
            id: model.id,
            name: model.name,
            source: 'root',
            parameterCount: 0,
            memoryBytes: 0,
            storageBytes: 0,
        };
    }
    
    let bestVariant = variants[0];
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const variant of variants) {
        // Memory fit factors
        const fitsInVram = vramCapacity > 0 && variant.memoryBytes <= vramCapacity * 0.95;
        const fitsInHybrid = variant.memoryBytes <= totalCapacity * 0.9;
        
        const parameterScore = clamp(Math.log10(Math.max(variant.parameterCount, 1)) * 20, 0, 60);
        const contextBonus = variant.contextWindow ? clamp((parseContextWindow(variant.contextWindow) ?? DEFAULT_CONTEXT_TOKENS) / 8192, 0, 8) : 0;
        const quantBonus = variant.size?.match(/q[0-9]/i) ? 4 : 0;
        
        // Scoring based on fit
        let fitScore = 0;
        if (fitsInVram) {
            fitScore = 1200 + (variant.memoryBytes / (vramCapacity || 1)) * 100;
        } else if (fitsInHybrid) {
            // Spilled to RAM - significant penalty because it will be slow
            const spillRatio = (variant.memoryBytes - vramCapacity) / variant.memoryBytes;
            fitScore = 800 - (spillRatio * 500); 
        } else {
            // Doesn't fit at all
            fitScore = -1000;
        }

        const rootBias = variant.source === 'root' ? 6 : 0;
        const score = fitScore + parameterScore + contextBonus + quantBonus + rootBias;
        
        if (score > bestScore) {
            bestScore = score;
            bestVariant = variant;
        }
    }

    return bestVariant;
}

function getFitLabel(
    context: {
        memoryFits: boolean;
        storageFits: boolean;
        hasMemoryEstimate: boolean;
        hasStorageEstimate: boolean;
        vramFits: boolean | undefined;
        score: number;
        estimatedTokensPerSecond: number;
        confidence: MarketplaceModelPerformanceEstimate['confidence'];
        hasKnownModelData: boolean;
        selectedVariant: MarketplaceModelVariantCandidate;
    }
): MarketplaceModelFit {
    if ((context.hasStorageEstimate && !context.storageFits) || (context.hasMemoryEstimate && !context.memoryFits)) {
        return 'blocked';
    }

    if (!context.hasKnownModelData) {
        return context.estimatedTokensPerSecond >= 14 && context.score >= 28 ? 'workable' : 'limited';
    }

    const modelBillions = context.selectedVariant.parameterCount / 1_000_000_000;

    if (context.vramFits === false) {
        if (modelBillions >= 20 && context.estimatedTokensPerSecond < 6) {
            return 'limited';
        }
        return context.score >= 46 && context.estimatedTokensPerSecond >= 4 ? 'workable' : 'limited';
    }

    if (context.vramFits === true) {
        if (context.confidence === 'high' && context.score >= 78 && context.estimatedTokensPerSecond >= 14) {
            return 'recommended';
        }
        return context.score >= 58 && context.estimatedTokensPerSecond >= 6 ? 'workable' : 'limited';
    }

    if (context.confidence === 'high' && context.score >= 74 && context.estimatedTokensPerSecond >= 10) {
        return 'recommended';
    }
    return context.score >= 52 && context.estimatedTokensPerSecond >= 4 ? 'workable' : 'limited';
}

interface MarketplaceReasonContext {
    model: MarketplaceModel;
    selectedVariant: MarketplaceModelVariantCandidate;
    memoryBytes: number;
    storageBytes: number;
    hasMemoryEstimate: boolean;
    hasStorageEstimate: boolean;
    memoryFits: boolean;
    storageFits: boolean;
    vramFits: boolean | undefined;
    profile: MarketplaceRuntimeProfile;
    backendCapacityBytes: number;
}

function buildReasons(context: MarketplaceReasonContext): string[] {
    const {
        model,
        selectedVariant,
        memoryBytes,
        storageBytes,
        hasMemoryEstimate,
        hasStorageEstimate,
        memoryFits,
        storageFits,
        vramFits,
        profile,
        backendCapacityBytes,
    } = context;
    const reasons: string[] = [];
    reasons.push(`${model.provider?.toUpperCase() ?? 'MODEL'} model`);
    if (selectedVariant.source === 'submodel') {
        reasons.push(`Selected submodel: ${selectedVariant.name}`);
    } else {
        reasons.push(`Selected base model: ${selectedVariant.name}`);
    }
    reasons.push(hasMemoryEstimate
        ? (profile.gpu.available
            ? `VRAM need ${formatGigabytes(memoryBytes)} / available ${formatGigabytes(backendCapacityBytes)}`
            : `RAM need ${formatGigabytes(memoryBytes)} / free ${formatGigabytes(profile.system.freeMemoryBytes)}`)
        : 'Memory metadata is incomplete; using conservative fit estimate');
    reasons.push(hasStorageEstimate
        ? `Storage need ${formatGigabytes(storageBytes)} / free ${formatGigabytes(profile.system.storageFreeBytes)}`
        : 'Storage metadata is incomplete; installation size is approximate');
    if (profile.gpu.available) {
        reasons.push(vramFits === false
            ? `GPU memory looks tight on ${profile.gpu.name ?? 'current GPU'}`
            : `GPU ready: ${profile.gpu.name ?? 'detected GPU'}`);
    }
    if (hasMemoryEstimate && !memoryFits) {
        reasons.push('Likely RAM constrained');
    }
    if (hasStorageEstimate && !storageFits) {
        reasons.push('Likely storage constrained');
    }
    return reasons.slice(0, 4);
}

function formatGigabytes(bytes: number): string {
    return `${(bytes / BYTES_IN_GB).toFixed(1)} GB`;
}

function createFallbackProfile(): MarketplaceRuntimeProfile {
    return {
        system: {
            platform: 'unknown',
            arch: 'unknown',
            cpuCores: 4,
            cpuLoadPercent: 0,
            totalMemoryBytes: 8 * BYTES_IN_GB,
            freeMemoryBytes: 4 * BYTES_IN_GB,
            storageTotalBytes: 100 * BYTES_IN_GB,
            storageFreeBytes: 50 * BYTES_IN_GB,
            storageUsedBytes: 50 * BYTES_IN_GB,
            storageUsagePercent: 50,
        },
        gpu: {
            available: false,
            source: 'none',
            backends: [],
            devices: [],
        },
        performance: {
            rssBytes: 0,
            heapUsedBytes: 0,
            processCount: 0,
            alertCount: 0,
        },
    };
}

function calculatePerformanceMetrics(
    model: MarketplaceModel,
    profile: MarketplaceRuntimeProfile,
    selectedVariant?: MarketplaceModelVariantCandidate
): {
    estimatedMemoryBytes: number;
    estimatedDiskBytes: number;
    estimatedVramBytes?: number;
    memoryFits: boolean;
    storageFits: boolean;
    vramFits?: boolean;
    cpuHeadroomPercent: number;
    estimatedTokensPerSecond: number;
    estimatedPromptTokensPerSecond: number;
    score: number;
    backend: 'cpu' | 'gpu';
    hasKnownModelData: boolean;
    hasMemoryEstimate: boolean;
    hasStorageEstimate: boolean;
} {
    const modelBytes = selectedVariant?.memoryBytes ?? 0;
    const storageBytes = selectedVariant?.storageBytes ?? modelBytes;
    const contextTokens = selectedVariant?.contextWindow
        ? parseContextWindow(selectedVariant.contextWindow) ?? resolveContextTokens(model)
        : resolveContextTokens(model);
    
    const parameterCount = selectedVariant?.parameterCount 
        ?? parseParameters(model.parameters) 
        ?? extractParametersFromName(model.name)
        ?? estimateParameterCountFromBytes(storageBytes)
        ?? 0;
    const parameterBasedWeightsBytes = parameterCount > 0
        ? estimateWeightsFromParameters(parameterCount, model, selectedVariant?.name ?? model.pipelineTag)
        : 0;
    
    const kvCacheBytes = estimateKvCacheBytes(parameterCount, contextTokens);
    const estimatedMemoryBytes = Math.round(modelBytes > 0
        ? modelBytes
        : (storageBytes > 0
            ? storageBytes + kvCacheBytes + DEFAULT_RAM_OVERHEAD_BYTES
            : (parameterBasedWeightsBytes > 0 ? parameterBasedWeightsBytes + kvCacheBytes + DEFAULT_RAM_OVERHEAD_BYTES : 0)));
        
    const estimatedDiskBytes = Math.round(storageBytes > 0
        ? storageBytes * 1.05
        : (parameterBasedWeightsBytes > 0
            ? parameterBasedWeightsBytes * 1.1
            : (estimatedMemoryBytes > 0 ? estimatedMemoryBytes * 1.05 : 0)));
    
    const vramCapacity = profile.gpu.available ? (profile.gpu.totalVramBytes ?? profile.gpu.vramBytes ?? 0) : 0;
    const ramCapacity = profile.system.freeMemoryBytes;
    const totalCapacity = vramCapacity + ramCapacity;
    const hasMemoryEstimate = estimatedMemoryBytes > 0;
    const hasStorageEstimate = estimatedDiskBytes > 0;
    const hasKnownModelData = parameterCount > 0 || modelBytes > 0 || storageBytes > 0 || parameterBasedWeightsBytes > 0;

    const memoryFits = hasMemoryEstimate ? estimatedMemoryBytes <= totalCapacity * 0.95 : false;
    const storageFits = hasStorageEstimate ? estimatedDiskBytes <= profile.system.storageFreeBytes * 0.9 : false;
    const vramFits = profile.gpu.available && hasMemoryEstimate ? estimatedMemoryBytes <= vramCapacity * 0.95 : undefined;
    
    const cpuHeadroomPercent = clamp(100 - profile.system.cpuLoadPercent, 0, 100);
    
    // Parameter normalization: ensure we are dealing with actual counts
    // Some models might report "1" meaning 1B or 1,000,000,000 raw.
    let normalizedParamCount = parameterCount ?? 0;
    if (normalizedParamCount > 0 && normalizedParamCount < 1000) {
        normalizedParamCount *= 1_000_000_000; // Assume Billions if very small
    }

    const inferredParamCount = normalizedParamCount > 0
        ? normalizedParamCount
        : (estimateParameterCountFromBytes(storageBytes || parameterBasedWeightsBytes || estimatedMemoryBytes) ?? 0);
    const parameterBillions = inferredParamCount > 0
        ? Math.max(inferredParamCount / 1_000_000_000, 0.2)
        : undefined;
    const cpuBoost = clamp((profile.system.cpuCores / 8) * (cpuHeadroomPercent / 100), 0.3, 3.0);

    let gpuBoost = 1.0;
    if (profile.gpu.available) {
        if (vramFits) {
            const fitRatio = vramCapacity / Math.max(estimatedMemoryBytes, BYTES_IN_GB);
            gpuBoost = clamp(1.6 + Math.log2(1 + fitRatio), 1.4, 4.5);
        } else if (memoryFits && hasMemoryEstimate && estimatedMemoryBytes > 0) {
            const spillRatio = clamp(vramCapacity / estimatedMemoryBytes, 0.1, 1.0);
            gpuBoost = clamp(0.35 + spillRatio, 0.2, 1.2);
        } else {
            gpuBoost = 0.2;
        }
    }

    const memoryPenalty = memoryFits ? 1.0 : (hasMemoryEstimate ? 0.25 : 0.45);
    const storagePenalty = storageFits ? 1.0 : (hasStorageEstimate ? 0.35 : 0.6);

    const unknownModelBase = (profile.gpu.available ? 12 : 4) * clamp(cpuHeadroomPercent / 100, 0.2, 1.0);
    const baseTps = parameterBillions ? (34 / Math.pow(parameterBillions, 0.78)) : unknownModelBase;
    const rawTps = baseTps * cpuBoost * gpuBoost * memoryPenalty * storagePenalty;
    const estimatedTokensPerSecond = clamp(rawTps, 0.1, parameterBillions ? 180 : 45);
    const estimatedPromptTokensPerSecond = clamp(estimatedTokensPerSecond * 3.2, 0.1, parameterBillions ? 720 : 180);

    const score = clamp(
        (hasKnownModelData ? 20 : 5)
            + (memoryFits ? 24 : (hasMemoryEstimate ? -25 : -6))
            + (storageFits ? 16 : (hasStorageEstimate ? -18 : -4))
            + (vramFits ? 14 : (profile.gpu.available && hasMemoryEstimate ? -12 : 0))
            + clamp(estimatedTokensPerSecond * (hasKnownModelData ? 0.5 : 0.2), 0, hasKnownModelData ? 32 : 10)
            - (hasKnownModelData ? 0 : 18)
            - (profile.system.cpuLoadPercent * 0.2),
        0,
        100
    );

    return {
        estimatedMemoryBytes,
        estimatedDiskBytes,
        estimatedVramBytes: profile.gpu.available && hasMemoryEstimate ? estimatedMemoryBytes : undefined,
        memoryFits,
        storageFits,
        vramFits,
        cpuHeadroomPercent,
        estimatedTokensPerSecond,
        estimatedPromptTokensPerSecond,
        score,
        backend: (profile.gpu.available && (hasKnownModelData ? Boolean(vramFits || memoryFits) : true)) ? 'gpu' : 'cpu',
        hasKnownModelData,
        hasMemoryEstimate,
        hasStorageEstimate,
    };
}

export function estimateMarketplaceModelPerformance(
    model: MarketplaceModel,
    profile: MarketplaceRuntimeProfile | null
): MarketplaceModelPerformanceEstimate | undefined {
    const nameLower = model.name.toLowerCase();
    const isCloud = nameLower.includes('cloud') || 
                  (model.provider as string) === 'openai' || 
                  (model.provider as string) === 'anthropic' || 
                  (model.provider as string) === 'google' ||
                  ((model.provider as string) === 'mistral' && !model.pipelineTag?.includes('gguf'));

    if (isCloud) {
        return undefined;
    }

    const safeProfile = profile ?? createFallbackProfile();
    const selectedVariant = chooseBestVariant(model, safeProfile);
    const metrics = calculatePerformanceMetrics(model, safeProfile, selectedVariant);
    const {
        estimatedMemoryBytes,
        estimatedDiskBytes,
        estimatedVramBytes,
        memoryFits,
        storageFits,
        vramFits,
        cpuHeadroomPercent,
        estimatedTokensPerSecond,
        estimatedPromptTokensPerSecond,
        score,
        backend,
        hasKnownModelData,
        hasMemoryEstimate,
        hasStorageEstimate,
    } = metrics;
    const backendCapacityBytes = getAvailableCapacity(safeProfile);
    const confidence = hasKnownModelData ? (profile ? 'high' : 'medium') : 'low';
    
    return {
        fit: getFitLabel({
            memoryFits,
            storageFits,
            hasMemoryEstimate,
            hasStorageEstimate,
            vramFits,
            score,
            estimatedTokensPerSecond,
            confidence,
            hasKnownModelData,
            selectedVariant,
        }),
        score,
        backend,
        confidence,
        selectedVariant: {
            id: selectedVariant.id,
            name: selectedVariant.name,
            size: selectedVariant.size,
            contextWindow: selectedVariant.contextWindow,
        },
        estimatedTokensPerSecond,
        estimatedPromptTokensPerSecond,
        estimatedMemoryBytes,
        estimatedDiskBytes,
        estimatedVramBytes,
        memoryFits,
        storageFits,
        vramFits,
        cpuHeadroomPercent,
        reasons: buildReasons({
            model,
            selectedVariant,
            memoryBytes: estimatedMemoryBytes,
            storageBytes: estimatedDiskBytes,
            hasMemoryEstimate,
            hasStorageEstimate,
            memoryFits,
            storageFits,
            vramFits,
            profile: safeProfile,
            backendCapacityBytes,
        }),
    };
}

export function enrichMarketplaceModel(
    model: MarketplaceModel,
    profile: MarketplaceRuntimeProfile | null
): MarketplaceModel {
    const performance = estimateMarketplaceModelPerformance(model, profile);
    const res = { ...model, performance };

    // If original model has no size info, or it is "0 KB", use our estimate to avoids broken UI.
    const normalizedSize = res.totalSize?.replace(/\s+/g, '').toLowerCase();
    const isMissingSize = !normalizedSize || normalizedSize === '0kb' || normalizedSize === '0b' || normalizedSize === '0gb' || normalizedSize === '0.0gb';
    if (performance && isMissingSize && performance.estimatedDiskBytes > 0) {
        res.totalSize = formatGigabytes(performance.estimatedDiskBytes);
    }

    return res;
}

export function sortMarketplaceModels<T extends MarketplaceModel>(items: T[], sort: string): T[] {
    const sorted = [...items];
    sorted.sort((left, right) => {
        if (sort === 'name_asc') { return left.name.localeCompare(right.name); }
        if (sort === 'name_desc') { return right.name.localeCompare(left.name); }
        if (sort === 'version_desc') { return right.version.localeCompare(left.version); }
        if (sort === 'downloads_desc') { return getPopularity(right) - getPopularity(left); }
        if (sort === 'likes_desc') { return (right.likes ?? 0) - (left.likes ?? 0); }
        if (sort === 'performance_desc') { return getPerformanceScore(right) - getPerformanceScore(left); }
        if (sort === 'tokens_desc') { return getTokensPerSecond(right) - getTokensPerSecond(left); }
        if (sort === 'memory_asc') { return getMemoryBytes(left) - getMemoryBytes(right); }
        if (sort === 'storage_asc') { return getStorageBytes(left) - getStorageBytes(right); }
        return 0;
    });
    return sorted;
}

function getPopularity(model: MarketplaceModel): number {
    return (model.downloads ?? 0) + (model.pullCount ?? 0);
}

function getPerformanceScore(model: MarketplaceModel): number {
    return model.performance?.score ?? 0;
}

function getTokensPerSecond(model: MarketplaceModel): number {
    return model.performance?.estimatedTokensPerSecond ?? 0;
}

function getMemoryBytes(model: MarketplaceModel): number {
    return model.performance?.estimatedMemoryBytes ?? 0;
}

function getStorageBytes(model: MarketplaceModel): number {
    return model.performance?.estimatedDiskBytes ?? 0;
}
