const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const SOURCE_FILE = path.join(ROOT_DIR, 'docs', 'changelog', 'data', 'changelog.entries.json');
const LOCALES_DIR = path.join(ROOT_DIR, 'docs', 'changelog', 'i18n');
const LOCALES_CONFIG_FILE = path.join(LOCALES_DIR, 'locales.json');

function readJson(filePath, fallback) {
    if (!fs.existsSync(filePath)) {
        return fallback;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalize(value) {
    return String(value ?? '').trim();
}

function sameText(a, b) {
    return normalize(a) === normalize(b);
}

function shouldIgnoreItemForTranslationCheck(item) {
    const text = normalize(item);
    if (text.length === 0) {
        return true;
    }

    // Markdown/code-structure lines do not carry natural-language translation value.
    if (text === '```' || text.startsWith('```')) {
        return true;
    }
    if (text === '}' || text === '{' || text === '});' || text === ');' || text === '},') {
        return true;
    }
    if (/^\|[-:\s|]+\|?$/.test(text)) {
        return true;
    }
    if (/^##\s*\[\d{4}-\d{2}-\d{2}\]/.test(text)) {
        return true;
    }
    if (/^###\s+/.test(text)) {
        return true;
    }
    if (/^\*\*[^*]+:\*\*$/.test(text) || /^\*\*[^*]+\*\*:$/.test(text)) {
        return true;
    }

    // Keep file paths, env vars and pure code tokens out of translation quality metrics.
    if (/^[-*]?\s*`[^`]+`(?:,\s*`[^`]+`)*$/.test(text)) {
        return true;
    }
    if (/^[-*]?\s*\[[^\]]+\]\(file:\/\/\/.+\)$/.test(text)) {
        return true;
    }
    if (/^[-*]?\s*[A-Z0-9_]{3,}$/.test(text)) {
        return true;
    }
    if (/^[-*]?\s*\d+\.\s*`[^`]+`/.test(text)) {
        return true;
    }
    if (/^[A-Za-z0-9_.]+\([^)]*\);?$/.test(text)) {
        return true;
    }
    if (/^[-*]?\s*\*\*[^*]+\*\*:\s*`[^`]+`(?:,\s*`[^`]+`)*$/.test(text)) {
        return true;
    }
    if (/^[-*]?\s*`[^`]+`:\s*\d+/.test(text)) {
        return true;
    }
    if (/^[-*]?\s*`[^`]+`\s*→\s*`[^`]+`$/.test(text)) {
        return true;
    }
    if (/^[-*]?\s*[A-Za-z0-9_.-]+(?:,\s*[A-Za-z0-9_.-]+){2,}$/.test(text)) {
        return true;
    }
    if (/^[-*]?\s*`[^`]+`:\s*[A-Za-z0-9_.-]+(?:,\s*[A-Za-z0-9_.-]+){1,}$/.test(text)) {
        return true;
    }
    if (/^[-*]?\s*\*\*[^*]+\*\*:\s*$/.test(text)) {
        return true;
    }
    if (/^\d+\.\s*\*\*[^*]+\*\*:\s*$/.test(text)) {
        return true;
    }
    if (/^[-*]?\s*[A-Za-z]+:\s*`[^`]+`(?:,\s*`[^`]+`)+\.?$/.test(text)) {
        return true;
    }
    if (/^[-*]?\s*`[a-z0-9_.-]+`\s*\(EN\/TR\)\s*$/i.test(text)) {
        return true;
    }
    if (/^(const|let|var)\s+[A-Za-z_$][\w$]*\s*=/.test(text)) {
        return true;
    }
    if (/^[-*]?\s*[^`]*\.(tsx|ts|js|md|css|json|ps1)\b/i.test(text)) {
        return true;
    }
    if (/^###\s+v\d+\.\d+\.\d+/.test(text)) {
        return true;
    }

    return false;
}

function parseArgs() {
    const args = process.argv.slice(2);
    const map = {};
    for (const arg of args) {
        if (!arg.startsWith('--')) {
            continue;
        }

        const body = arg.slice(2);
        if (!body.includes('=')) {
            map[body] = true;
            continue;
        }

        const [rawKey, ...rest] = body.split('=');
        map[rawKey] = rest.join('=');
    }
    return map;
}

function toInt(value, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) {
        return fallback;
    }
    return Math.floor(n);
}

function resolveThresholds(args) {
    const defaults = {
        missing: Number.POSITIVE_INFINITY,
        sameTitle: Number.POSITIVE_INFINITY,
        sameSummary: Number.POSITIVE_INFINITY,
        sameItems: Number.POSITIVE_INFINITY,
    };

    const thresholdFileArg = args['threshold-file'];
    if (typeof thresholdFileArg === 'string' && thresholdFileArg.length > 0) {
        const thresholdPath = path.resolve(ROOT_DIR, thresholdFileArg);
        const fromFile = readJson(thresholdPath, null);
        if (!fromFile || typeof fromFile !== 'object') {
            throw new Error(`Invalid threshold file: ${thresholdPath}`);
        }
        return {
            mode: fromFile.mode === 'global' ? 'global' : 'perLocale',
            global: fromFile.global ?? defaults,
            perLocale: fromFile.perLocale ?? {},
            source: thresholdPath,
        };
    }

    return {
        mode: 'global',
        global: {
            missing: toInt(args['max-missing'], defaults.missing),
            sameTitle: toInt(args['max-same-title'], defaults.sameTitle),
            sameSummary: toInt(args['max-same-summary'], defaults.sameSummary),
            sameItems: toInt(args['max-same-items'], defaults.sameItems),
        },
        perLocale: {},
        source: null,
    };
}

function checkThresholds(results, thresholds) {
    const violations = [];

    for (const result of results) {
        const applicable =
            thresholds.mode === 'perLocale'
                ? thresholds.perLocale[result.locale] ?? null
                : thresholds.global;
        if (!applicable) {
            continue;
        }

        const checks = [
            ['missing', result.missing],
            ['sameTitle', result.sameTitle],
            ['sameSummary', result.sameSummary],
            ['sameItems', result.sameItems],
        ];

        for (const [key, value] of checks) {
            const maxAllowed = Number(applicable[key]);
            if (Number.isFinite(maxAllowed) && value > maxAllowed) {
                violations.push({
                    locale: result.locale,
                    metric: key,
                    actual: value,
                    allowed: maxAllowed,
                });
            }
        }
    }

    return violations;
}

function run() {
    const args = parseArgs();
    const shouldFailOnThreshold = args['fail-on-threshold'] === true;
    const jsonOutput = args.json === true;

    const source = readJson(SOURCE_FILE, null);
    const localeConfig = readJson(LOCALES_CONFIG_FILE, null);
    if (!source || !Array.isArray(source.entries)) {
        throw new Error('Invalid changelog source');
    }

    const locales = (localeConfig?.locales ?? [])
        .filter((locale) => locale.code !== 'en')
        .map((locale) => locale.code);

    const results = [];
    for (const locale of locales) {
        const overridePath = path.join(LOCALES_DIR, `${locale}.overrides.json`);
        const overrides = readJson(overridePath, {});

        let missing = 0;
        let sameTitle = 0;
        let sameSummary = 0;
        let sameItems = 0;

        for (const entry of source.entries) {
            const en = entry.translations?.en;
            const localized = overrides[entry.id];
            if (!en || !localized) {
                missing += 1;
                continue;
            }

            if (sameText(localized.title, en.title)) {
                sameTitle += 1;
            }
            if (sameText(localized.summary, en.summary)) {
                sameSummary += 1;
            }

            const localizedItems = Array.isArray(localized.items) ? localized.items : [];
            const enItems = Array.isArray(en.items) ? en.items : [];
            const sameItemCount = enItems.filter((item, i) => {
                // Ignore intentionally empty separators and technical/code-only lines.
                if (shouldIgnoreItemForTranslationCheck(item)) {
                    return false;
                }
                return sameText(localizedItems[i], item);
            }).length;
            sameItems += sameItemCount;
        }

        results.push({ locale, missing, sameTitle, sameSummary, sameItems });
    }

    const thresholds = resolveThresholds(args);
    const violations = checkThresholds(results, thresholds);

    if (jsonOutput) {
        console.log(
            JSON.stringify(
                {
                    generatedAt: new Date().toISOString(),
                    thresholds: {
                        mode: thresholds.mode,
                        source: thresholds.source,
                        global: thresholds.global,
                        perLocale: thresholds.perLocale,
                    },
                    results,
                    violations,
                },
                null,
                2
            )
        );
    } else {
        for (const result of results) {
            console.log(
                `${result.locale}: missing=${result.missing}, sameTitle=${result.sameTitle}, sameSummary=${result.sameSummary}, sameItems=${result.sameItems}`
            );
        }

        if (violations.length > 0) {
            console.log('\nThreshold violations:');
            for (const violation of violations) {
                console.log(
                    `- ${violation.locale}.${violation.metric}: actual=${violation.actual}, allowed=${violation.allowed}`
                );
            }
        }
    }

    if (shouldFailOnThreshold && violations.length > 0) {
        process.exit(1);
    }
}

run();
