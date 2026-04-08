import { McpPermissionProfile,MCPServerConfig } from './settings';

export interface MarketplaceItem {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  downloadUrl: string;
  previewUrl?: string;
  itemType: 'theme' | 'mcp' | 'persona' | 'model' | 'prompt' | 'language' | 'skill';
  installed?: boolean;
  installedVersion?: string;
}

export interface MarketplaceTheme extends MarketplaceItem {
  appearance: 'dark' | 'light';
  previewColor?: string;
}

export interface MarketplaceMcp extends MarketplaceItem {
  category: string;
  command: string;
  args: string[];
  entrypointUrl?: string;
  entrypointFile?: string;
  env?: Record<string, string>;
  permissionProfile?: McpPermissionProfile;
  tools?: MCPServerConfig['tools'];
  storage?: MCPServerConfig['storage'];
  capabilities?: string[];
}

export interface MarketplacePersona extends MarketplaceItem {
  context: string;
}

export interface MarketplaceModelTag {
  id: string;
  name: string;
  size?: string;
  contextWindow?: string;
  inputType?: string;
  modelSize?: string;
  tensorType?: string;
  downloadUrl?: string;
  installed?: boolean;
}

export interface MarketplaceGpuDevice {
  index: number;
  name: string;
  vendorId?: number;
  deviceId?: number;
  vendorString?: string;
  deviceString?: string;
  driverVendor?: string;
  driverVersion?: string;
  active?: boolean;
  backend?: string;
  memoryBytes?: number;
  memoryUsedBytes?: number;
}

export type MarketplaceModelFit = 'recommended' | 'workable' | 'limited' | 'blocked';

export interface MarketplaceModelPerformanceEstimate {
  fit: MarketplaceModelFit;
  score: number;
  backend: 'cpu' | 'gpu';
  confidence: 'high' | 'medium' | 'low';
  selectedVariant?: {
    id: string;
    name: string;
    size?: string;
    contextWindow?: string;
  };
  estimatedTokensPerSecond: number;
  estimatedPromptTokensPerSecond: number;
  estimatedMemoryBytes: number;
  estimatedDiskBytes: number;
  estimatedVramBytes?: number;
  memoryFits: boolean;
  storageFits: boolean;
  vramFits?: boolean;
  cpuHeadroomPercent: number;
  reasons: string[];
}

export interface MarketplaceModel extends MarketplaceItem {
  parameters?: string;
  provider: 'ollama' | 'huggingface' | 'custom';
  source?: 'ollama' | 'huggingface' | 'custom';
  sourceUrl?: string;
  category?: string;
  pipelineTag?: string;
  downloads?: number;
  pullCount?: number;
  likes?: number;
  readme?: string;
  totalSize?: string;
  submodels?: MarketplaceModelTag[];
  performance?: MarketplaceModelPerformanceEstimate;
}

export interface MarketplaceRuntimeProfile {
  system: {
    platform: string;
    arch: string;
    cpuCores: number;
    cpuLoadPercent: number;
    totalMemoryBytes: number;
    freeMemoryBytes: number;
    storageTotalBytes: number;
    storageFreeBytes: number;
    storageUsedBytes: number;
    storageUsagePercent: number;
  };
  gpu: {
    available: boolean;
    source: 'electron' | 'llama' | 'ollama' | 'combined' | 'none';
    name?: string;
    backends: string[];
    devices: MarketplaceGpuDevice[];
    vramBytes?: number;
    vramUsedBytes?: number;
    totalVramBytes?: number;
    totalVramUsedBytes?: number;
  };
  performance: {
    rssBytes: number;
    heapUsedBytes: number;
    processCount: number;
    alertCount: number;
  };
}


export interface MarketplacePrompt extends MarketplaceItem {
  category: string;
}

export interface MarketplaceLanguage extends MarketplaceItem {
  locale: string;
  nativeName: string;
  rtl?: boolean;
  coverage?: number;
  schemaVersion?: string;
}

export interface MarketplaceSkill extends MarketplaceItem {
  provider?: string;
  content?: string;
  enabled_by_default?: boolean;
}

export interface MarketplaceRegistry {
  version: string;
  lastUpdated: string;
  themes: MarketplaceTheme[];
  mcp: MarketplaceMcp[];
  personas?: MarketplacePersona[];
  models?: MarketplaceModel[];
  prompts?: MarketplacePrompt[];
  languages?: MarketplaceLanguage[];
  skills?: MarketplaceSkill[];
}

export interface InstallRequest {
  type: 'theme' | 'mcp' | 'persona' | 'model' | 'prompt' | 'language' | 'skill';
  id: string;
  downloadUrl: string;
  provider?: MarketplaceModel['provider'];
  sourceUrl?: string;
  category?: string;
  pipelineTag?: string;
  name?: string;
  description?: string;
  author?: string;
  version?: string;
}

export interface InstallResult {
  success: boolean;
  code?: string;
  message?: string;
  path?: string;
  mcpConfig?: MCPServerConfig;
  queuedDownloads?: number;
  downloadIds?: string[];
}
