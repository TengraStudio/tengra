 
const fs = require('fs');
const path = require('path');
const { z } = require('zod');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const SOURCE_FILE = path.join(ROOT_DIR, 'docs', 'changelog', 'data', 'changelog.entries.json');
const LOCALES_DIR = path.join(ROOT_DIR, 'docs', 'changelog', 'i18n');
const LOCALES_CONFIG_FILE = path.join(LOCALES_DIR, 'locales.json');
const GENERATED_DOCS_DIR = path.join(ROOT_DIR, 'docs', 'changelog', 'generated');
const RENDERER_INDEX_PATH = path.join(ROOT_DIR, 'src', 'renderer', 'data', 'changelog.index.json');

const EntryLocaleSchema = z.object({
    title: z.string().min(1),
    summary: z.string().optional().default(''),
    items: z.array(z.string()),
});

const EntrySchema = z.object({
    id: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    channel: z.enum(['stable', 'beta', 'nightly']).default('stable'),
    type: z.enum(['feature', 'fix', 'security', 'perf', 'refactor', 'docs']).default('feature'),
    status: z.enum(['completed', 'in_progress', 'planned', 'unknown']).default('unknown'),
    audience: z.array(z.enum(['end-user', 'developer', 'admin'])).default(['end-user']),
    components: z.array(z.string()).default([]),
    breaking: z.boolean().default(false),
    security: z.boolean().default(false),
    translations: z.object({
        en: EntryLocaleSchema,
        tr: EntryLocaleSchema.optional(),
    }),
});

const SourceSchema = z.object({
    version: z.number().default(1),
    generatedFrom: z.string().optional(),
    generatedAt: z.string().optional(),
    entries: z.array(EntrySchema),
});

const LocalesConfigSchema = z.object({
    defaultLocale: z.string().min(2).default('en'),
    locales: z.array(
        z.object({
            code: z.string().min(2),
            markdownTitle: z.string().min(1),
            validateOverrides: z.boolean().default(true),
        })
    ).min(1),
});

const OverrideLocaleSchema = z.record(
    z.string(),
    z.object({
        title: z.string().optional(),
        summary: z.string().optional(),
        items: z.array(z.string()).optional(),
    })
);

function readJson(filePath, fallback) {
    if (!fs.existsSync(filePath)) {
        return fallback;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadOverrides(locale) {
    if (locale === 'en') {
        return {};
    }
    const overridePath = path.join(LOCALES_DIR, `${locale}.overrides.json`);
    const raw = readJson(overridePath, {});
    return OverrideLocaleSchema.parse(raw);
}

function resolveLocaleContent(entry, locale, localeOverrides) {
    const baseEn = entry.translations.en;
    const baseLocale = entry.translations[locale] ?? baseEn;
    const override = localeOverrides[entry.id];

    if (!override) {
        return baseLocale;
    }

    return {
        title: override.title ?? baseLocale.title,
        summary: override.summary ?? baseLocale.summary,
        items: override.items ?? baseLocale.items,
    };
}

function normalizeLines(lines) {
    return lines
        .map((line) => line.trimEnd())
        .filter((line) => line.trim().length > 0 || line === '')
        .map((line) => line);
}

function renderMarkdownForLocale(index, locale, markdownTitle) {
    const title = markdownTitle;
    const grouped = new Map();

    for (const entry of index.entries) {
        const bucket = grouped.get(entry.date) ?? [];
        bucket.push(entry);
        grouped.set(entry.date, bucket);
    }

    const sections = [title, ''];
    const sortedDates = Array.from(grouped.keys()).sort((a, b) => b.localeCompare(a));

    for (const date of sortedDates) {
        sections.push(`## [${date}]`);
        sections.push('');

        const entries = grouped.get(date) ?? [];
        for (const entry of entries) {
            const content = entry.contentByLocale[locale] ?? entry.contentByLocale.en;
            sections.push(`### ${content.title}`);
            sections.push('');
            sections.push(`- **Type**: ${entry.type}`);
            sections.push(`- **Status**: ${entry.status}`);
            if (content.summary.length > 0) {
                sections.push(`- **Summary**: ${content.summary}`);
            }
            sections.push('');
            sections.push(...normalizeLines(content.items));
            sections.push('');
        }
    }

    return `${sections.join('\n').trimEnd()}\n`;
}

function build() {
    const source = SourceSchema.parse(readJson(SOURCE_FILE, null));
    const localeConfig = LocalesConfigSchema.parse(readJson(LOCALES_CONFIG_FILE, null));
    const localeCodes = localeConfig.locales.map((locale) => locale.code);
    const overridesByLocale = Object.fromEntries(
        localeCodes.map((locale) => [locale, loadOverrides(locale)])
    );

    const sortedEntries = [...source.entries].sort((a, b) => {
        if (a.date === b.date) {
            return a.id.localeCompare(b.id);
        }
        return b.date.localeCompare(a.date);
    });

    const index = {
        version: source.version,
        generatedAt: new Date().toISOString(),
        locales: localeCodes,
        entries: sortedEntries.map((entry) => {
            const contentByLocale = Object.fromEntries(
                localeCodes.map((locale) => [
                    locale,
                    resolveLocaleContent(entry, locale, overridesByLocale[locale]),
                ])
            );

            return {
                id: entry.id,
                date: entry.date,
                channel: entry.channel,
                type: entry.type,
                status: entry.status,
                audience: entry.audience,
                components: entry.components,
                breaking: entry.breaking,
                security: entry.security,
                contentByLocale,
            };
        }),
    };

    fs.mkdirSync(path.dirname(RENDERER_INDEX_PATH), { recursive: true });
    fs.writeFileSync(RENDERER_INDEX_PATH, `${JSON.stringify(index, null, 2)}\n`, 'utf8');

    fs.mkdirSync(GENERATED_DOCS_DIR, { recursive: true });
    for (const locale of localeConfig.locales) {
        const markdown = renderMarkdownForLocale(index, locale.code, locale.markdownTitle);
        const outputFile = path.join(GENERATED_DOCS_DIR, `CHANGELOG.${locale.code}.md`);
        fs.writeFileSync(outputFile, markdown, 'utf8');
    }

    console.log(`Built changelog index with ${index.entries.length} entries`);
}

build();

