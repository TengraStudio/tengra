# Tengra Theme System

VSCode-compatible theme system for marketplace extensibility.

## Architecture

### Theme Manifest (VSCode-style)

Each theme is defined by a JSON manifest declaring its type explicitly:

```json
{
  "id": "my-theme",
  "name": "my-cool-theme",
  "displayName": "My Cool Theme",
  "type": "dark",  // ← Explicit light/dark/highContrast
  "version": "1.0.0",
  "colors": {
    "background": "0 0% 0%",
    "foreground": "0 0% 100%",
    ...
  }
}
```

### Key Benefits

✅ **Marketplace Ready** - Users can create and share themes
✅ **No Hardcoded Lists** - Theme type declared in manifest
✅ **VSCode Compatible** - Industry-standard approach
✅ **Type Safe** - Full TypeScript support
✅ **Extensible** - Easy to add new themes

## How It Works

### 1. Theme Registry (`theme-registry.service.ts`)

Centralized theme management:

```typescript
import { themeRegistry } from '@/themes/theme-registry.service';

// Get theme type
const type = themeRegistry.getThemeType('black'); // 'dark'

// Check if light
const isLight = themeRegistry.isLightTheme('white'); // true

// Register custom theme
themeRegistry.registerTheme(myCustomTheme);
```

### 2. useTheme Hook

React hook using registry:

```typescript
const { theme, isLight, isDark, themeType, manifest } = useTheme();

// isLight determined by manifest.type, not color calculation
```

### 3. Logo Adaptation

Automatically uses correct logo based on theme type:

```typescript
const logo = useMemo(() => (isLight ? logoBlack : logoWhite), [isLight]);
```

## Creating a Custom Theme

### Step 1: Create Manifest

Create `my-theme.theme.json`:

```json
{
  "id": "my-theme",
  "name": "my-cool-theme",
  "displayName": "My Cool Theme",
  "description": "A beautiful custom theme",
  "author": "Your Name",
  "version": "1.0.0",
  "type": "dark",
  "colors": {
    "background": "222 47% 11%",
    "foreground": "210 40% 98%",
    "primary": "217 91% 60%",
    ...
  },
  "tags": ["dark", "blue", "modern"]
}
```

### Step 2: Register Theme

```typescript
import myTheme from './my-theme.theme.json';
import { themeRegistry } from '@/themes/theme-registry.service';

themeRegistry.registerTheme(myTheme as ThemeManifest);
```

### Step 3: Apply Theme

```typescript
document.documentElement.setAttribute('data-theme', 'my-theme');
```

## Theme Types

| Type | Description | Logo Color |
|------|-------------|------------|
| `light` | Light background (e.g., white) | Black |
| `dark` | Dark background (e.g., black) | White |
| `highContrast` | High contrast for accessibility | Auto |

## Built-in Themes

- **Tengra Black** (`black`) - Pure black with electric cyan
- **Tengra White** (`white`) - Clean white with vibrant purple

## Marketplace Integration (Future)

When marketplace is ready:

1. Theme creator uploads manifest JSON
2. Users install via marketplace
3. Theme auto-registers on install
4. Logo and UI adapt automatically

No code changes needed! 🎉

## API Reference

### ThemeManifest

```typescript
interface ThemeManifest {
  id: string;           // Unique identifier
  name: string;         // Package name
  displayName: string;  // UI display name
  type: ThemeType;      // 'light' | 'dark' | 'highContrast'
  version: string;      // Semver
  colors: ThemeColors;  // HSL color definitions
  author?: string;
  description?: string;
  tags?: string[];
}
```

### ThemeRegistryService

```typescript
class ThemeRegistryService {
  getTheme(id: string): ThemeManifest | undefined;
  getThemeType(id: string): ThemeType;
  isLightTheme(id: string): boolean;
  isDarkTheme(id: string): boolean;
  getAllThemes(): ThemeManifest[];
  registerTheme(manifest: ThemeManifest): void;
  unregisterTheme(id: string): boolean;
}
```

## Comparison: VSCode vs Dynamic Calculation

### ❌ Dynamic Calculation (Old)

```typescript
// Fragile - depends on color calculation
const bgColor = getComputedStyle(...)
const isLight = luminance > 0.5; // Can be wrong!
```

**Problems:**
- Edge cases (gradient backgrounds, images)
- No way to override for special themes
- Calculation overhead on every theme change

### ✅ Manifest Declaration (New)

```typescript
// Reliable - explicit declaration
const isLight = themeRegistry.isLightTheme('my-theme');
```

**Benefits:**
- Theme creator knows their intent
- Instant lookup, no calculation
- Works with any visual design
- Marketplace compatible

## Migration Guide

If you have old themes, convert to manifest:

**Before (ThemeDefinition):**
```typescript
{
  id: 'my-theme',
  isDark: true,  // ← Boolean
  colors: {...}
}
```

**After (ThemeManifest):**
```json
{
  "id": "my-theme",
  "type": "dark",  // ← Enum
  "version": "1.0.0",
  "colors": {...}
}
```

## Why VSCode's Approach?

1. **Industry Standard** - Proven by millions of themes
2. **Creator Intent** - Theme author knows if it's light/dark
3. **Marketplace Ready** - Works with extension system
4. **Future Proof** - Can add more types (e.g., `amoled`, `solarized`)
5. **Performance** - No runtime calculation needed

---

Made with 💜 by Tengra Team

