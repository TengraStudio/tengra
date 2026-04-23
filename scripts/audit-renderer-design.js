const fs = require('node:fs');
const path = require('node:path');

const rootDir = process.cwd();
const rendererDir = path.join(rootDir, 'src', 'renderer');
const targetExtensions = new Set(['.ts', '.tsx']);
const violations = [];

const inlineStylePatterns = [
    {
        name: 'static z-index',
        regex: /\bzIndex\s*:\s*\d+/g,
    },
    {
        name: 'static spacing/radius/font-size',
        regex: /\b(?:fontSize|margin(?:Top|Bottom|Left|Right)?|padding(?:Top|Bottom|Left|Right)?|borderRadius)\s*:\s*(?:'[^']+'|"[^"]+"|\d+)/g,
    },
];

function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(fullPath);
            continue;
        }

        if (!targetExtensions.has(path.extname(entry.name))) {
            continue;
        }

        inspectFile(fullPath);
    }
}

function inspectFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const stylePropRegex = /style=\{\{([\s\S]*?)\}\}/g;

    let styleMatch;
    while ((styleMatch = stylePropRegex.exec(content)) !== null) {
        const styleBody = styleMatch[1];
        const baseLine = content.slice(0, styleMatch.index).split('\n').length - 1;

        for (const pattern of inlineStylePatterns) {
            let match;
            while ((match = pattern.regex.exec(styleBody)) !== null) {
                const rawMatch = match[0];
                if (rawMatch.includes('var(--')) {
                    continue;
                }

                const relativeLine = styleBody.slice(0, match.index).split('\n').length;
                violations.push({
                    filePath: path.relative(rootDir, filePath),
                    line: baseLine + relativeLine,
                    rule: pattern.name,
                    snippet: rawMatch,
                });
            }
        }
    }
}

walk(rendererDir);

if (violations.length > 0) {
    console.error('Renderer design audit failed. Replace static inline design literals with theme tokens or utility classes.\n');
    for (const violation of violations) {
        console.error(`- ${violation.filePath}:${violation.line} [${violation.rule}] ${violation.snippet}`);
    }
    process.exit(1);
}

console.log('Renderer design audit passed.');
