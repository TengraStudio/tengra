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
}

export interface MarketplacePersona extends MarketplaceItem {
  context: string;
}

export interface MarketplaceModel extends MarketplaceItem {
  parameters?: string;
  provider: 'ollama' | 'huggingface' | 'custom';
  source?: 'ollama' | 'huggingface' | 'custom';
  sourceUrl?: string;
  category?: string;
  pipelineTag?: string;
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
  message?: string;
  path?: string;
}
