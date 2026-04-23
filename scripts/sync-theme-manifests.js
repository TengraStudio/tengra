/**
 * Sync `src/renderer/themes/manifests/*` with CSS variables defined in
 * `src/renderer/styles/layers/theme-vars.css`.
 *
 * Source of truth: CSS. We extract all `--*` custom properties from:
 * - shared `:root { ... }`
 * - `:root, [data-theme='white'] { ... }`
 * - `[data-theme='black'] { ... }`
 *
 * Then we update `colors` in `white.theme.json` and `black.theme.json`:
 * - overwrite existing keys with CSS values
 * - add missing keys found in CSS
 * - keep metadata untouched
 */

const fs = require('fs');
const path = require('path');

const THEME_VARS_CSS = path.join(__dirname, '..', 'src', 'renderer', 'styles', 'layers', 'theme-vars.css');
const TAILWIND_TOKENS_CSS = path.join(__dirname, '..', 'src', 'renderer', 'styles', 'base', 'tailwind-theme-tokens.css');
const WHITE_MANIFEST = path.join(__dirname, '..', 'src', 'renderer', 'themes', 'manifests', 'white.theme.json');
const BLACK_MANIFEST = path.join(__dirname, '..', 'src', 'renderer', 'themes', 'manifests', 'black.theme.json');

const REQUIRED_COLOR_KEYS = [
    'background',
    'foreground',
    'primary',
    'secondary',
    'accent',
    'muted',
    'destructive',
    'border',
    'input',
    'ring',
    'card',
    'cardForeground',
    'popover',
    'popoverForeground',
    'primaryForeground',
    'secondaryForeground',
    'accentForeground',
    'destructiveForeground',
    'mutedForeground',
];

function hyphenToCamel(name) {
    return name.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function cssVarToManifestKey(varName) {
    // RuntimeThemeManager converts camelCase -> kebab-case only by inserting '-' before capitals.
    // For vars that include numeric segments like `blur-1px` or `opacity-02`, camelCasing loses the hyphen
    // and cannot be reconstructed. For these, keep the kebab-case key as-is.
    if (/-\d/.test(varName)) {
        return varName;
    }
    return hyphenToCamel(varName);
}

function parseCssRules(cssText) {
    const rules = [];
    let i = 0;
    const len = cssText.length;

    const isWhitespace = ch => ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t' || ch === '\f';

    // Very small CSS rule parser (good enough for our simple `selector { decls }` blocks).
    while (i < len) {
        // Skip whitespace
        while (i < len && isWhitespace(cssText[i])) i++;

        // Skip comments
        if (cssText[i] === '/' && cssText[i + 1] === '*') {
            i += 2;
            while (i < len && !(cssText[i] === '*' && cssText[i + 1] === '/')) i++;
            i += 2;
            continue;
        }

        // Skip @-rules blocks we don't care about; we only care about nested selector rules inside @layer.
        if (cssText[i] === '@') {
            // Move to next '{' or ';'
            while (i < len && cssText[i] !== '{' && cssText[i] !== ';') i++;
            if (cssText[i] === ';') {
                i++;
                continue;
            }
            if (cssText[i] === '{') {
                // Enter at-rule block, but keep parsing inner rules (we do this by just consuming '{' and continuing)
                i++;
                continue;
            }
        }

        // Read selector until '{'
        const selectorStart = i;
        while (i < len && cssText[i] !== '{') i++;
        if (i >= len) break;
        const selector = cssText.slice(selectorStart, i).trim();
        i++; // skip '{'

        // Read block body with brace matching
        const bodyStart = i;
        let depth = 1;
        while (i < len && depth > 0) {
            // Skip comments inside blocks
            if (cssText[i] === '/' && cssText[i + 1] === '*') {
                i += 2;
                while (i < len && !(cssText[i] === '*' && cssText[i + 1] === '/')) i++;
                i += 2;
                continue;
            }
            if (cssText[i] === '{') depth++;
            else if (cssText[i] === '}') depth--;
            i++;
        }
        const body = cssText.slice(bodyStart, i - 1);

        // Record only normal selector rules (ignore empty selectors and `@layer` artifacts)
        if (selector && !selector.startsWith('@')) {
            rules.push({ selector, body });
        }
    }

    return rules;
}

function extractVarsFromBody(body) {
    const vars = new Map();
    const re = /--([a-z0-9-]+)\s*:\s*([^;]+);/gi;
    let match;
    while ((match = re.exec(body))) {
        const name = match[1].trim();
        const value = match[2].trim();
        vars.set(name, value);
    }
    return vars;
}

function mergeMaps(...maps) {
    const out = new Map();
    for (const map of maps) {
        for (const [k, v] of map.entries()) out.set(k, v);
    }
    return out;
}

function loadJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveJson(filePath, obj) {
    fs.writeFileSync(filePath, `${JSON.stringify(obj, null, 2)}\n`, 'utf8');
}

function syncManifest(manifestPath, cssVarMap) {
    const manifest = loadJson(manifestPath);
    const existingColors = (manifest.colors && typeof manifest.colors === 'object') ? manifest.colors : {};
    const existingVars = (manifest.vars && typeof manifest.vars === 'object') ? manifest.vars : {};

    // 1) Convert css vars to manifest keys
    const cssColors = {};
    const cssVars = {};
    const legacyNumericKeysToDrop = new Set();
    for (const [varName, value] of cssVarMap.entries()) {
        const key = cssVarToManifestKey(varName);
        cssColors[key] = value;
        cssVars[varName] = value;

        // If we kept kebab-case due to numeric segments, drop the old (incorrect) camelCase key if present.
        if (/-\d/.test(varName)) {
            const legacyKey = hyphenToCamel(varName);
            if (legacyKey !== key) {
                legacyNumericKeysToDrop.add(legacyKey);
            }
        }
    }

    // 2) Sync colors to the minimal required schema (ThemeService validation depends on them).
    // Everything else should live under `vars` to support full theming without bloating `colors`.
    const outColors = {};
    let addedRequired = 0;
    for (const key of REQUIRED_COLOR_KEYS) {
        const value = Object.prototype.hasOwnProperty.call(cssColors, key)
            ? cssColors[key]
            : existingColors[key];
        if (typeof value === 'string') {
            outColors[key] = value;
        } else if (Object.prototype.hasOwnProperty.call(cssColors, key)) {
            // should not happen, but keep counters accurate
            addedRequired += 1;
        }
    }

    // 4) Sync raw CSS vars (kebab-case) for full theming
    const outVars = {};
    const sortedVarKeys = Object.keys(cssVars).sort((a, b) => a.localeCompare(b));
    for (const key of sortedVarKeys) {
        outVars[key] = cssVars[key];
    }

    manifest.colors = outColors;
    manifest.vars = outVars;
    saveJson(manifestPath, manifest);

    return { addedColors: addedRequired, totalColors: Object.keys(outColors).length, totalVars: Object.keys(outVars).length, prevVars: Object.keys(existingVars).length };
}

function main() {
    const cssText = fs.readFileSync(THEME_VARS_CSS, 'utf8');
    const tailwindTokensText = fs.readFileSync(TAILWIND_TOKENS_CSS, 'utf8');
    const rules = parseCssRules(cssText);
    const tailwindRules = parseCssRules(tailwindTokensText);

    const rootRules = rules.filter(r => r.selector.replace(/\s+/g, ' ') === ':root');
    const whiteRules = rules.filter(r => r.selector.includes("[data-theme='white']") || r.selector.includes(':root,') || r.selector.includes(':root,'));
    const blackRules = rules.filter(r => r.selector.includes("[data-theme='black']") && !r.selector.includes('.theme-logo-invert'));

    const sharedRootVars = mergeMaps(...rootRules.map(r => extractVarsFromBody(r.body)));
    const sharedTailwindVars = mergeMaps(...tailwindRules.map(r => extractVarsFromBody(r.body)));
    const sharedVars = mergeMaps(sharedRootVars, sharedTailwindVars);
    const whiteVars = mergeMaps(sharedVars, ...whiteRules.map(r => extractVarsFromBody(r.body)));
    const blackVars = mergeMaps(sharedVars, ...blackRules.map(r => extractVarsFromBody(r.body)));

    const whiteResult = syncManifest(WHITE_MANIFEST, whiteVars);
    const blackResult = syncManifest(BLACK_MANIFEST, blackVars);

    console.log(`[sync-theme-manifests] Updated white colors: +${whiteResult.addedColors}, total=${whiteResult.totalColors}`);
    console.log(`[sync-theme-manifests] Updated white vars: total=${whiteResult.totalVars} (prev=${whiteResult.prevVars})`);
    console.log(`[sync-theme-manifests] Updated black colors: +${blackResult.addedColors}, total=${blackResult.totalColors}`);
    console.log(`[sync-theme-manifests] Updated black vars: total=${blackResult.totalVars} (prev=${blackResult.prevVars})`);
}

main();
