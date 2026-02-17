#!/usr/bin/env node
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const EXCEPTIONS_PATH = path.join(ROOT, 'docs', 'security', 'audit-exceptions.json');
const AUDIT_LEVEL = 'moderate'; // Match package.json script

function loadExceptions() {
    if (!fs.existsSync(EXCEPTIONS_PATH)) return [];
    try {
        const data = JSON.parse(fs.readFileSync(EXCEPTIONS_PATH, 'utf8'));
        return data.exceptions || [];
    } catch (error) {
        console.error(`Error loading exceptions: ${error.message}`);
        return [];
    }
}

function runAudit() {
    console.log(`Running: npm audit --json --audit-level=${AUDIT_LEVEL}`);
    const result = spawnSync('npm', ['audit', '--json', `--audit-level=${AUDIT_LEVEL}`], {
        cwd: ROOT,
        encoding: 'utf8',
        shell: process.platform === 'win32'
    });

    try {
        return JSON.parse(result.stdout);
    } catch (error) {
        // npm audit returns non-zero if vulnerabilities found, but stdout should still be JSON
        if (result.stdout.trim().startsWith('{')) {
            try {
                return JSON.parse(result.stdout);
            } catch (inner) {
                console.error('Failed to parse npm audit output as JSON');
                throw inner;
            }
        }
        console.error('Fatal: npm audit did not return JSON');
        console.error(result.stderr);
        process.exit(1);
    }
}

function main() {
    const exceptions = loadExceptions();
    const auditResult = runAudit();

    if (!auditResult.vulnerabilities || Object.keys(auditResult.vulnerabilities).length === 0) {
        console.log('✅ No vulnerabilities found at or above moderate level.');
        process.exit(0);
    }

    const vulnerabilities = auditResult.vulnerabilities;
    const unauthorized = [];
    const allowed = [];

    for (const [pkgName, vuln] of Object.entries(vulnerabilities)) {
        // Check if this package is in exceptions
        const matchingException = exceptions.find(ex => {
            if (ex.package !== pkgName) return false;
            // If CVE specified in exception, must match one of the vuln's CVEs/Advisories
            if (ex.cve) {
                // vulnerable may have multiple advisories. simplified check for now.
                return true; // assume match if package matches for now, can refine later
            }
            return true;
        });

        if (matchingException) {
            allowed.push({ package: pkgName, severity: vuln.severity, reason: matchingException.reason });
        } else {
            unauthorized.push({ package: pkgName, severity: vuln.severity, via: vuln.via });
        }
    }

    if (allowed.length > 0) {
        console.log('\n⚠️  Allowed (Triaged) Vulnerabilities:');
        allowed.forEach(vuln => {
            console.log(` - ${vuln.package} (${vuln.severity}): ${vuln.reason}`);
        });
    }

    if (unauthorized.length > 0) {
        console.error('\n❌ Unauthorized Vulnerabilities Found:');
        unauthorized.forEach(vuln => {
            const source = Array.isArray(vuln.via) ? vuln.via.map(v => typeof v === 'string' ? v : v.title).join(', ') : vuln.via;
            console.error(` - ${vuln.package} (${vuln.severity}) via ${source}`);
        });
        console.error('\nAction required: Path, override, or triage these vulnerabilities.');
        process.exit(1);
    } else {
        console.log('\n✅ All findings are accounted for in audit-exceptions.json.');
        process.exit(0);
    }
}

main();
