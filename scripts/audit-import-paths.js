const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SOURCE_ROOTS = ['src/main', 'src/renderer', 'src/shared', 'src/tests'];
const EXTENSIONS = new Set(['.ts', '.tsx']);
const IMPORT_RE = /from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/g;

const buckets = {
    parentRelativeInMain: [],
    parentRelativeInRenderer: [],
    localRelativeInRenderer: [],
    crossBoundaryRelativeInRenderer: [],
    legacyRendererNamespaces: [],
    duplicateSystemPaths: [],
    duplicateUiPaths: [],
    duplicateCommonPaths: [],
    rootRelativeWithoutAlias: [],
};

function walk(dir, output) {
    if (!fs.existsSync(dir)) {
        return;
    }

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const entryPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(entryPath, output);
            continue;
        }
        if (EXTENSIONS.has(path.extname(entry.name))) {
            output.push(entryPath);
        }
    }
}

function toPosix(value) {
    return value.split(path.sep).join('/');
}

function record(bucketName, filePath, specifier) {
    buckets[bucketName].push({
        file: toPosix(path.relative(ROOT, filePath)),
        specifier,
    });
}

function getRendererBoundary(relativeFile) {
    const parts = relativeFile.split('/');
    if (parts[0] !== 'src' || parts[1] !== 'renderer') {
        return null;
    }

    if (parts[2] === 'features' && parts[3]) {
        return `src/renderer/features/${parts[3]}`;
    }

    if (parts[2]) {
        return `src/renderer/${parts[2]}`;
    }

    return 'src/renderer';
}

function classifyRendererRelativeImport(filePath, specifier) {
    const relativeFile = toPosix(path.relative(ROOT, filePath));
    const importerBoundary = getRendererBoundary(relativeFile);
    if (!importerBoundary) {
        return;
    }

    const resolvedImportPath = toPosix(
        path.relative(
            ROOT,
            path.resolve(path.dirname(filePath), specifier)
        )
    );
    const targetBoundary = getRendererBoundary(resolvedImportPath);

    if (targetBoundary && importerBoundary === targetBoundary) {
        record('localRelativeInRenderer', filePath, specifier);
        return;
    }

    record('crossBoundaryRelativeInRenderer', filePath, specifier);
}

function classifyImport(filePath, specifier) {
    const relativeFile = toPosix(path.relative(ROOT, filePath));
    const inMain = relativeFile.startsWith('src/main/');
    const inRenderer = relativeFile.startsWith('src/renderer/');

    if (specifier.startsWith('../')) {
        if (inMain) {
            record('parentRelativeInMain', filePath, specifier);
        }
        if (inRenderer) {
            record('parentRelativeInRenderer', filePath, specifier);
            classifyRendererRelativeImport(filePath, specifier);
        }
    }

    if (specifier.startsWith('@/system/')) {
        record('legacyRendererNamespaces', filePath, specifier);
        record('duplicateSystemPaths', filePath, specifier);
    } else if (specifier.startsWith('@/ui/')) {
        record('legacyRendererNamespaces', filePath, specifier);
        record('duplicateUiPaths', filePath, specifier);
    } else if (specifier.startsWith('@/common/')) {
        record('legacyRendererNamespaces', filePath, specifier);
        record('duplicateCommonPaths', filePath, specifier);
    }

    if (specifier.startsWith('src/')) {
        record('rootRelativeWithoutAlias', filePath, specifier);
    }
}

function parseImports(filePath) {
    const source = fs.readFileSync(filePath, 'utf8');
    for (const match of source.matchAll(IMPORT_RE)) {
        const specifier = match[1] || match[2];
        if (!specifier) {
            continue;
        }
        classifyImport(filePath, specifier);
    }
}

function main() {
    const files = [];
    for (const root of SOURCE_ROOTS) {
        walk(path.join(ROOT, root), files);
    }

    for (const file of files) {
        parseImports(file);
    }

    const summary = Object.fromEntries(
        Object.entries(buckets).map(([bucket, entries]) => [bucket, entries.length])
    );

    const report = {
        generatedAt: new Date().toISOString(),
        summary,
        buckets,
    };

    const reportDir = path.join(ROOT, 'artifacts');
    fs.mkdirSync(reportDir, { recursive: true });
    const reportPath = path.join(reportDir, 'import-path-audit.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`Import path audit written to ${toPosix(path.relative(ROOT, reportPath))}`);
    for (const [bucket, count] of Object.entries(summary)) {
        console.log(`${bucket}: ${count}`);
    }
}

main();
