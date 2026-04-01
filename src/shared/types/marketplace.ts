export interface MarketplaceItem {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  downloadUrl: string;
  previewUrl?: string;
  itemType: 'theme' | 'mcp' | 'persona' | 'model' | 'prompt';
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
  provider: 'ollama' | 'llama' | 'custom';
}

export interface MarketplacePrompt extends MarketplaceItem {
  category: string;
}

export interface MarketplaceRegistry {
  version: string;
  lastUpdated: string;
  themes: MarketplaceTheme[];
  mcp: MarketplaceMcp[];
  personas?: MarketplacePersona[];
  models?: MarketplaceModel[];
  prompts?: MarketplacePrompt[];
}

export interface InstallRequest {
  type: 'theme' | 'mcp' | 'persona' | 'model' | 'prompt';
  id: string;
  downloadUrl: string;
}

export interface InstallResult {
  success: boolean;
  message?: string;
  path?: string;
}
