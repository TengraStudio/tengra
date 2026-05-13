const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const srcPath = path.join(projectRoot, 'src');

function scanFiles(dir, files = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        // Skip common non-source directories and test directories
        if (entry.isDirectory()) {
            const skipDirs = ['node_modules', '.git', 'dist', '.gemini', 'tests', '__tests__', 'test-results', 'playwright-report'];
            if (!skipDirs.includes(entry.name)) {
                scanFiles(fullPath, files);
            }
        } else if (entry.isFile()) {
            // Only process .tsx and .jsx files
            if (/\.(tsx|jsx)$/.test(entry.name)) {
                // Skip test files by extension
                if (!/\.(test|spec)\.(tsx|jsx)$/.test(entry.name)) {
                    files.push(fullPath);
                }
            }
        }
    }
    return files;
}

function isTechnicalAttribute(attr) {
    const technical = [
        'className', 'id', 'ref', 'key', 'type', 'mode', 'variant', 'size', 'color', 
        'style', 'name', 'value', 'defaultValue', 'htmlFor', 'src', 'href', 'target',
        'rel', 'width', 'height', 'tabIndex', 'role', 'lang', 'dir', 'nonce',
        'content', 'charset', 'action', 'method', 'enctype', 'sandbox', 'loading',
        'data-testid', 'data-id', 'data-state', 'data-orientation', 'data-disabled',
        'align', 'valign', 'border', 'cellpadding', 'cellspacing', 'span', 'colspan', 'rowspan'
    ];
    
    // Also skip all event handlers (onMouseOver, onClick, etc.)
    if (attr.startsWith('on') && attr.length > 2 && /[A-Z]/.test(attr[2])) return true;
    
    // Skip data-* and aria-* except for aria-label which is often user-facing
    if (attr.startsWith('data-')) return true;
    if (attr.startsWith('aria-') && attr !== 'aria-label') return true;

    return technical.includes(attr);
}

function isUserFacingText(text) {
    if (!text) return false;
    const trimmed = text.trim();
    if (trimmed.length < 2) return false;
    
    // Must contain at least one letter
    if (!/[a-zA-Z]/.test(trimmed)) return false;
    
    // Skip strings that look like CSS units or technical values
    const technicalValues = [
        'px', 'rem', 'em', 'vh', 'vw', 'true', 'false', 'none', 'auto', 
        'hidden', 'flex', 'block', 'relative', 'absolute', 'fixed',
        'grid', 'inline', 'static', 'sticky', 'inherit', 'initial', 'unset',
        'solid', 'dashed', 'dotted', 'transparent', 'currentColor', 'outline'
    ];
    if (technicalValues.includes(trimmed.toLowerCase())) return false;
    
    // Skip common tailwind-like or BEM-like strings (contains dashes/colons but no spaces)
    if ((trimmed.includes('-') || trimmed.includes(':')) && !trimmed.includes(' ')) {
        // Exception for things like "Sign-in" or "Side-bar" if they start with a capital
        if (!/^[A-Z]/.test(trimmed)) return false;
    }
    
    // Skip if it looks like a variable or camelCase property (starts lower, has upper later)
    if (/^[a-z]+[A-Z]/.test(trimmed)) return false;

    // Skip common technical IDs or codes
    if (/^(icon|btn|input|form|nav|id|tab)-/i.test(trimmed)) return false;
    
    // Skip strings that look like paths or URLs
    if (trimmed.includes('/') || trimmed.includes('\\') || trimmed.startsWith('http')) return false;

    return true;
}

function findHardcodedTextInFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const results = [];
    
    // 1. Match text between tags: >Text<
    // This is the most common place for hardcoded text.
    const tagTextRegex = />([^<{>]+)</g;
    let match;
    while ((match = tagTextRegex.exec(content)) !== null) {
        const text = match[1].trim();
        if (isUserFacingText(text)) {
            results.push({
                text,
                line: content.substring(0, match.index).split('\n').length,
                type: 'tag content'
            });
        }
    }

    // 2. Match attributes: attr="text"
    // We match any word-like attribute followed by a string.
    const attrRegex = /\s([a-zA-Z0-9-]+)=["']([^"']+)["']/g;
    while ((match = attrRegex.exec(content)) !== null) {
        const attr = match[1];
        const text = match[2].trim();
        
        // Skip if it's a technical attribute
        if (isTechnicalAttribute(attr)) continue;
        
        // Skip if it starts with { (not likely here since we matched quotes, 
        // but some people write attr="{...}")
        if (text.startsWith('{')) continue;
        
        if (isUserFacingText(text)) {
            results.push({
                text: `${attr}="${text}"`,
                line: content.substring(0, match.index).split('\n').length,
                type: 'attribute'
            });
        }
    }

    return results;
}

const files = scanFiles(srcPath);
console.log(`Scanning ${files.length} TSX/JSX files in ${srcPath} for hardcoded text (excluding tests)...`);

let foundCount = 0;
files.forEach(file => {
    const findings = findHardcodedTextInFile(file);
    if (findings.length > 0) {
        const relativePath = path.relative(projectRoot, file);
        console.log(`\n--- ${relativePath} ---`);
        findings.forEach(f => {
            console.log(`[${f.type}] line ${f.line}: "${f.text}"`);
            foundCount++;
        });
    }
});

console.log(`\nFinished scanning. Found ${foundCount} potential hardcoded strings.`);
