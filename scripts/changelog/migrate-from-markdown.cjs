 
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const LEGACY_CHANGELOG_PATH = path.join(ROOT_DIR, 'docs', 'CHANGELOG.md');
const OUTPUT_DIR = path.join(ROOT_DIR, 'docs', 'changelog', 'data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'changelog.entries.json');
const DEFAULT_TR_OVERRIDES = path.join(
    ROOT_DIR,
    'docs',
    'changelog',
    'i18n',
    'tr.overrides.json'
);
const DEFAULT_DE_OVERRIDES = path.join(
    ROOT_DIR,
    'docs',
    'changelog',
    'i18n',
    'de.overrides.json'
);

const BRACKET_HEADING = /^##\s+\[(\d{4}-\d{2}-\d{2})\]\s*-\s*(.+)$/;
const COLON_HEADING = /^###\s+(\d{4}-\d{2}-\d{2})\s*:\s*(.+)$/;

function slugify(value) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
}

function normalizeStatus(raw) {
    const value = raw.toLowerCase();
    if (value.includes('completed')) {
        return 'completed';
    }
    if (value.includes('in progress')) {
        return 'in_progress';
    }
    if (value.includes('planned')) {
        return 'planned';
    }
    return 'unknown';
}

function inferType(lines, title) {
    const text = `${title}\n${lines.join('\n')}`.toLowerCase();
    if (text.includes('security')) {
        return 'security';
    }
    if (text.includes('fix') || text.includes('bug')) {
        return 'fix';
    }
    if (text.includes('performance') || text.includes('optimiz')) {
        return 'perf';
    }
    if (text.includes('refactor') || text.includes('cleanup')) {
        return 'refactor';
    }
    if (text.includes('docs') || text.includes('documentation')) {
        return 'docs';
    }
    return 'feature';
}

function extractSummary(lines) {
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.toLowerCase().startsWith('- **summary**:')) {
            return trimmed.replace(/^- \*\*Summary\*\*:\s*/i, '').trim();
        }
    }
    return '';
}

function collectItems(lines) {
    const items = [];
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length === 0 || trimmed === '---') {
            continue;
        }
        if (trimmed.toLowerCase().startsWith('- **status**:')) {
            continue;
        }
        if (trimmed.toLowerCase().startsWith('- **summary**:')) {
            continue;
        }
        items.push(line);
    }
    return items;
}

function parseLegacyMarkdown(content) {
    const lines = content.split(/\r?\n/);
    const entries = [];

    let currentDate = '';
    let currentTitle = '';
    let currentLines = [];

    const flush = () => {
        if (currentDate.length === 0 || currentTitle.length === 0) {
            return;
        }

        const summary = extractSummary(currentLines);
        const statusLine = currentLines.find((line) => line.trim().toLowerCase().startsWith('- **status**:'));
        const status = statusLine ? normalizeStatus(statusLine.replace(/^- \*\*Status\*\*:\s*/i, '').trim()) : 'unknown';
        const titleSlug = slugify(currentTitle);
        const id = `${currentDate}-${titleSlug}`;
        const items = collectItems(currentLines);
        const type = inferType(currentLines, currentTitle);

        entries.push({
            id,
            date: currentDate,
            channel: 'stable',
            type,
            status,
            audience: ['end-user', 'developer'],
            components: [],
            breaking: false,
            security: type === 'security',
            translations: {
                en: {
                    title: currentTitle,
                    summary,
                    items,
                },
            },
        });
    };

    for (const rawLine of lines) {
        const line = rawLine.trim();
        const bracketMatch = line.match(BRACKET_HEADING);
        const colonMatch = line.match(COLON_HEADING);

        if (bracketMatch ?? colonMatch) {
            flush();
            const match = bracketMatch ?? colonMatch;
            currentDate = match[1];
            currentTitle = match[2];
            currentLines = [];
            continue;
        }

        if (currentDate.length > 0) {
            currentLines.push(rawLine);
        }
    }

    flush();

    return entries;
}

function ensureFile(filePath, defaultValue) {
    if (fs.existsSync(filePath)) {
        return;
    }
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, defaultValue, 'utf8');
}

function seedMissingOverrides(filePath, entries) {
    const overrides = fs.existsSync(filePath)
        ? JSON.parse(fs.readFileSync(filePath, 'utf8'))
        : {};

    for (const entry of entries) {
        if (overrides[entry.id]) {
            continue;
        }
        overrides[entry.id] = {
            title: entry.translations.en.title,
            summary: entry.translations.en.summary,
            items: entry.translations.en.items,
        };
    }

    fs.writeFileSync(filePath, `${JSON.stringify(overrides, null, 2)}\n`, 'utf8');
}

function run() {
    const legacyContent = fs.readFileSync(LEGACY_CHANGELOG_PATH, 'utf8');
    const entries = parseLegacyMarkdown(legacyContent);

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(
        OUTPUT_FILE,
        `${JSON.stringify(
            {
                version: 1,
                generatedFrom: 'docs/CHANGELOG.md',
                generatedAt: new Date().toISOString(),
                entries,
            },
            null,
            2
        )}\n`,
        'utf8'
    );

    ensureFile(DEFAULT_TR_OVERRIDES, '{}\n');
    ensureFile(DEFAULT_DE_OVERRIDES, '{}\n');
    seedMissingOverrides(DEFAULT_DE_OVERRIDES, entries);

    console.log(`Migrated ${entries.length} entries to ${OUTPUT_FILE}`);
}

run();

