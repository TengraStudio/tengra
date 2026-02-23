const fs = require('fs');
const path = require('path');

const root = process.cwd();
const eslintPath = path.join(root, 'eslint_report.json');
const typecheckPath = path.join(root, 'typecheck_output.txt');
const outputPath = path.join(root, 'logs', 'lint-typecheck-dashboard.json');

/** @type {Map<string, { eslint: number; typecheck: number }>} */
const fileStats = new Map();

function upsert(filePath, kind) {
    const current = fileStats.get(filePath) ?? { eslint: 0, typecheck: 0 };
    current[kind] += 1;
    fileStats.set(filePath, current);
}

if (fs.existsSync(eslintPath)) {
    const eslintReport = JSON.parse(fs.readFileSync(eslintPath, 'utf8'));
    for (const fileEntry of eslintReport) {
        const issueCount = (fileEntry.messages ?? []).length;
        if (issueCount > 0) {
            const relativePath = path.relative(root, fileEntry.filePath);
            for (let i = 0; i < issueCount; i += 1) {
                upsert(relativePath, 'eslint');
            }
        }
    }
}

if (fs.existsSync(typecheckPath)) {
    const lines = fs.readFileSync(typecheckPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
        const match = line.match(/^([^(]+)\(\d+,\d+\): error TS\d+:/);
        if (!match) {
            continue;
        }
        const relativePath = path.relative(root, match[1].trim());
        upsert(relativePath, 'typecheck');
    }
}

const topFiles = Array.from(fileStats.entries())
    .map(([file, counts]) => ({
        file,
        eslint: counts.eslint,
        typecheck: counts.typecheck,
        total: counts.eslint + counts.typecheck,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 30);

if (!fs.existsSync(path.dirname(outputPath))) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
}

const payload = {
    generatedAt: new Date().toISOString(),
    topFiles,
};

fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(`Dashboard written: ${outputPath}`);
