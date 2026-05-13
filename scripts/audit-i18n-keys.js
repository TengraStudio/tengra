const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const localesPath = path.join(projectRoot, 'src/renderer/i18n/locales/en.locale.json');
const srcPath = path.join(projectRoot, 'src');

const ALLOWED_PREFIXES_BY_DIR = {
    'renderer': ['frontend.', 'common.'],
    'main': ['backend.', 'common.'],
    'shared': ['frontend.', 'backend.', 'common.']
};

function loadTranslations(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const json = JSON.parse(content);
        return json.translations || {};
    } catch (error) {
        console.error('Failed to load translations:', error);
        return {};
    }
}

function hasKey(translations, key) {
    if (!key) return true;
    const parts = key.split('.');
    let current = translations;
    for (const part of parts) {
        if (current === null || typeof current !== 'object' || current[part] === undefined) {
            return false;
        }
        current = current[part];
    }
    return true;
}

function scanFiles(dir, files = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'dist' && entry.name !== '.gemini') {
                scanFiles(fullPath, files);
            }
        } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
            files.push(fullPath);
        }
    }
    return files;
}

function findKeysInFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const regex = /(?:^|[^a-zA-Z0-9])t\(\s*[`'"]([^`'"]+)[`'"]/g;
    const keys = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
        const key = match[1];
        if (key.includes('${')) continue;
        
        keys.push({
            key: key,
            line: content.substring(0, match.index).split('\n').length
        });
    }
    return keys;
}

const translations = loadTranslations(localesPath);
const files = scanFiles(srcPath);

console.log(`Scanning ${files.length} files in ${srcPath}...`);

let missingCount = 0;
let prefixErrorCount = 0;

files.forEach(file => {
    const relativePath = path.relative(projectRoot, file);
    const normalizedRelativePath = relativePath.replace(/\\/g, '/');
    
    let allowedPrefixes = [];
    if (normalizedRelativePath.startsWith('src/renderer/')) {
        allowedPrefixes = ALLOWED_PREFIXES_BY_DIR['renderer'];
    } else if (normalizedRelativePath.startsWith('src/main/')) {
        allowedPrefixes = ALLOWED_PREFIXES_BY_DIR['main'];
    } else if (normalizedRelativePath.startsWith('src/shared/')) {
        allowedPrefixes = ALLOWED_PREFIXES_BY_DIR['shared'];
    }

    const keys = findKeysInFile(file);

    keys.forEach(({ key, line }) => {
        let isMissing = !hasKey(translations, key);
        let hasPrefix = allowedPrefixes.length === 0 || allowedPrefixes.some(p => key.startsWith(p));

        if (!hasPrefix) {
            // Check if it exists with an allowed prefix
            const suggestedPrefix = allowedPrefixes.find(p => hasKey(translations, p + key));
            if (suggestedPrefix) {
                console.warn(`[Prefix Error] "${key}" in ${relativePath}:${line} - Should be "${suggestedPrefix}${key}"`);
            } else {
                console.warn(`[Prefix Error] "${key}" in ${relativePath}:${line} - Missing allowed prefix (${allowedPrefixes.join(', ')})`);
            }
            prefixErrorCount++;
        }

        if (isMissing) {
            // Don't double report if we already suggested a prefix and that prefixed key exists
            const fixedWithPrefix = allowedPrefixes.some(p => hasKey(translations, p + key));
            if (!fixedWithPrefix) {
                console.error(`[Missing Key] "${key}" in ${relativePath}:${line}`);
                missingCount++;
            }
        }
    });
});

console.log(`\nFinished scanning.`);
console.log(`- Missing keys: ${missingCount}`);
console.log(`- Prefix errors: ${prefixErrorCount}`);

if (missingCount > 0 || prefixErrorCount > 0) {
    process.exit(1);
}
