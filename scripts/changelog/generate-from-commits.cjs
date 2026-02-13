const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const SOURCE_FILE = path.join(ROOT_DIR, 'docs', 'changelog', 'data', 'changelog.entries.json');
const OUTPUT_FILE = path.join(ROOT_DIR, 'docs', 'changelog', 'data', 'changelog.commit-draft.json');

const TYPE_MAP = {
    feat: 'feature',
    fix: 'fix',
    refactor: 'refactor',
    perf: 'performance',
    docs: 'documentation',
    test: 'testing',
    chore: 'maintenance',
    ci: 'maintenance',
    build: 'maintenance',
    sec: 'security',
    security: 'security'
};

function readJson(filePath, fallback) {
    if (!fs.existsSync(filePath)) {
        return fallback;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const payload = `${JSON.stringify(value, null, 2)}\n`;
    let lastError = null;
    for (let attempt = 1; attempt <= 5; attempt += 1) {
        try {
            fs.writeFileSync(filePath, payload, 'utf8');
            return;
        } catch (error) {
            lastError = error;
            const code = String(error?.code ?? '');
            if (code !== 'UNKNOWN' && code !== 'EBUSY' && code !== 'EPERM') {
                throw error;
            }
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, attempt * 80);
        }
    }
    throw lastError;
}

function buildEntryId(date, title) {
    return `${date}-${title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')}`;
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

function normalizeWhitespace(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function titleCase(input) {
    return normalizeWhitespace(input)
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function inferType(subject) {
    const conventional = subject.match(/^([a-zA-Z]+)(\([^)]+\))?(!)?:\s+(.+)$/);
    if (!conventional) {
        return 'maintenance';
    }
    const rawType = conventional[1].toLowerCase();
    return TYPE_MAP[rawType] ?? 'maintenance';
}

function inferScope(subject) {
    const conventional = subject.match(/^([a-zA-Z]+)\(([^)]+)\)(!)?:\s+(.+)$/);
    if (!conventional) {
        return null;
    }
    return conventional[2];
}

function inferTitle(commitsForDate) {
    const first = commitsForDate[0];
    const conventional = first.subject.match(/^([a-zA-Z]+)(\([^)]+\))?(!)?:\s+(.+)$/);
    if (conventional) {
        return titleCase(conventional[4]);
    }
    return titleCase(first.subject);
}

function inferSummary(commitsForDate) {
    if (commitsForDate.length === 1) {
        return normalizeWhitespace(commitsForDate[0].subject);
    }
    const typeCounts = commitsForDate.reduce((acc, commit) => {
        acc[commit.type] = (acc[commit.type] ?? 0) + 1;
        return acc;
    }, {});
    const dominantType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'maintenance';
    return `${commitsForDate.length} commits grouped from git history (${dominantType}).`;
}

function inferComponents(commitsForDate) {
    const components = new Set();
    for (const commit of commitsForDate) {
        if (commit.scope) {
            components.add(titleCase(commit.scope.replace(/[/-]/g, ' ')));
        }
        const subject = commit.subject.toLowerCase();
        if (subject.includes('ipc')) {
            components.add('IPC');
        }
        if (subject.includes('changelog')) {
            components.add('Changelog');
        }
        if (subject.includes('test')) {
            components.add('Tests');
        }
        if (subject.includes('ui') || subject.includes('renderer')) {
            components.add('Renderer');
        }
    }
    return Array.from(components).slice(0, 6);
}

function isBreakingCommit(commit) {
    return /!:\s/.test(commit.subject) || /BREAKING CHANGE/i.test(commit.body);
}

function buildItems(commitsForDate) {
    return commitsForDate.slice(0, 12).map((commit) => {
        const safeSubject = normalizeWhitespace(commit.subject);
        return `- ${safeSubject} (\`${commit.hash.slice(0, 7)}\`)`;
    });
}

function loadGitCommits(fromDate, toDate, limit) {
    const format = '%H%x1f%ad%x1f%s%x1f%b%x1e';
    const sinceArg = fromDate ? `--since="${fromDate} 00:00:00"` : '';
    const untilArg = toDate ? `--until="${toDate} 23:59:59"` : '';
    const maxArg = Number.isFinite(limit) && limit > 0 ? `-n ${limit}` : '';
    const cmd = `git log --date=short --pretty=format:${format} ${sinceArg} ${untilArg} ${maxArg}`;
    const raw = execSync(cmd, { cwd: ROOT_DIR, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const records = raw.split('\x1e').map((r) => r.trim()).filter(Boolean);

    return records.map((record) => {
        const [hash, date, subject, body] = record.split('\x1f');
        const normalizedSubject = normalizeWhitespace(subject);
        return {
            hash,
            date,
            subject: normalizedSubject,
            body: String(body ?? ''),
            type: inferType(normalizedSubject),
            scope: inferScope(normalizedSubject)
        };
    });
}

function groupByDate(commits) {
    const grouped = new Map();
    for (const commit of commits) {
        if (!grouped.has(commit.date)) {
            grouped.set(commit.date, []);
        }
        grouped.get(commit.date).push(commit);
    }
    return grouped;
}

function run() {
    const args = parseArgs();
    const applyMode = args.apply === true;
    const dryRun = args['dry-run'] === true || !applyMode;
    const source = readJson(SOURCE_FILE, null);
    if (!source || !Array.isArray(source.entries)) {
        throw new Error('Invalid changelog source');
    }

    const latestDateInSource = source.entries.reduce((latest, entry) => {
        if (!entry.date) {
            return latest;
        }
        return entry.date > latest ? entry.date : latest;
    }, '1970-01-01');

    const fromDate = typeof args.from === 'string' ? args.from : latestDateInSource;
    const toDate = typeof args.to === 'string' ? args.to : null;
    const limit = args.limit ? Number(args.limit) : 300;

    const commits = loadGitCommits(fromDate, toDate, limit)
        .filter((commit) => !commit.subject.startsWith('Merge '))
        .filter((commit) => commit.subject.length > 0);
    const grouped = groupByDate(commits);

    const draftEntries = Array.from(grouped.entries())
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([date, commitsForDate]) => {
            const typeCounts = commitsForDate.reduce((acc, commit) => {
                acc[commit.type] = (acc[commit.type] ?? 0) + 1;
                return acc;
            }, {});
            const type = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'maintenance';
            const breaking = commitsForDate.some(isBreakingCommit);
            const security = commitsForDate.some((commit) => commit.type === 'security');
            const title = inferTitle(commitsForDate);

            return {
                date,
                suggestedId: buildEntryId(date, title),
                type,
                breaking,
                security,
                components: inferComponents(commitsForDate),
                title,
                summary: inferSummary(commitsForDate),
                items: buildItems(commitsForDate),
                commitCount: commitsForDate.length
            };
        });

    const output = {
        generatedAt: new Date().toISOString(),
        source: {
            fromDate,
            toDate,
            limit
        },
        totals: {
            commitCount: commits.length,
            suggestedEntryCount: draftEntries.length
        },
        entries: draftEntries
    };

    writeJson(OUTPUT_FILE, output);
    console.log(`Draft generated: ${path.relative(ROOT_DIR, OUTPUT_FILE)} (${draftEntries.length} entries from ${commits.length} commits)`);

    if (dryRun) {
        console.log('Dry-run mode: no changes applied to changelog.entries.json');
        return;
    }

    const existingById = new Set(source.entries.map((entry) => entry.id));
    let appliedCount = 0;
    const skipped = [];

    for (const draft of draftEntries) {
        if (existingById.has(draft.suggestedId)) {
            skipped.push({ id: draft.suggestedId, reason: 'id-exists' });
            continue;
        }

        const entry = {
            id: draft.suggestedId,
            date: draft.date,
            channel: 'stable',
            type: draft.type,
            status: 'planned',
            audience: ['developer'],
            components: draft.components,
            breaking: draft.breaking,
            security: draft.security,
            translations: {
                en: {
                    title: draft.title,
                    summary: draft.summary,
                    items: draft.items
                }
            }
        };

        source.entries.unshift(entry);
        existingById.add(entry.id);
        appliedCount += 1;
    }

    writeJson(SOURCE_FILE, source);
    console.log(`Applied ${appliedCount} draft entries to ${path.relative(ROOT_DIR, SOURCE_FILE)}`);
    if (skipped.length > 0) {
        console.log(`Skipped ${skipped.length} entries (existing IDs).`);
    }
}

run();
