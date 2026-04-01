# Tengra Marketplace Repository Structure Guide

This guide outlines the expected structure for the `TengraStudio/tengra-market` repository. The application fetches `registry.json` from this repository to display available items.

## 📁 Repository Structure

```
tengra-market/
├── registry.json           # Central index of all marketplace items
├── themes/                 # Theme JSON files
│   ├── dracula.json
│   ├── catppuccin.json
│   └── ...
├── personas/               # Persona JSON files
│   ├── developer.json
│   ├── creative-writer.json
│   └── ...
├── mcp/                    # MCP Configuration templates
│   ├── sqlite.json
│   ├── git.json
│   └── ...
├── models/                 # Model metadata files
├── prompts/                # Shared prompt templates (JSON)
└── assets/                 # Icons and preview images
    ├── previews/
    └── icons/
```

## 📄 registry.json Schema

The `registry.json` file must follow this structure:

```json
{
  "version": "1.0.0",
  "lastUpdated": "2026-03-31T22:00:00Z",
  "themes": [
    {
      "id": "dracula",
      "name": "Dracula",
      "description": "A dark theme for vampires.",
      "author": "Zeno Rocha",
      "version": "1.0.0",
      "itemType": "theme",
      "appearance": "dark",
      "previewColor": "#282a36",
      "downloadUrl": "https://raw.githubusercontent.com/TengraStudio/tengra-market/main/themes/dracula.json"
    }
  ],
  "mcp": [
    {
      "id": "github-mcp",
      "name": "GitHub MCP",
      "description": "Interact with GitHub repositories.",
      "author": "Model Context Protocol",
      "version": "1.0.0",
      "itemType": "mcp",
      "category": "Development",
      "downloadUrl": "https://raw.githubusercontent.com/TengraStudio/tengra-market/main/mcp/github.json"
    }
  ],
  "personas": [],
  "models": [],
  "prompts": []
}
```

## 🎨 Theme File Format

Themes installed via the marketplace reside in `userData/runtime/themes` and are injected into the DOM at runtime.

```json
{
  "id": "theme-id",
  "displayName": "Theme Name",
  "author": "Author Name",
  "appearance": "dark",
  "colors": {
    "background": "222 47% 11%",
    "foreground": "210 40% 98%",
    "primary": "217.2 91.2% 59.8%",
    "border": "217.2 32.6% 17.5%",
    "muted": "217.2 32.6% 17.5%"
  }
}
```

## 🛠 Deployment

1. Updates to `registry.json` are immediately reflected in the app (via the Marketplace "Sync" button or on load).
2. Ensure all `downloadUrl` links point to the **raw** versions of the files in the GitHub repository.
