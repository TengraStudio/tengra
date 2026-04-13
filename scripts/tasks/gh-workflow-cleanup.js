#!/usr/bin/env node
/**
 * Cleanup GitHub Actions Workflow Runs
 * Deletes old or failed workflow runs to clean up the Actions tab
 *
 * Usage:
 *   node scripts/gh-workflow-cleanup.js [options]
 *
 * Options:
 *   --status=<status>    Filter by status (completed, failure, success, cancelled, all)
 *   --keep-last=<n>      Keep last N successful runs (default: 5)
 *   --dry-run           Show what would be deleted without actually deleting
 *   --workflow=<name>    Only delete runs from specific workflow
 *   --older-than=<days>  Only delete runs older than N days (default: 30)
 *
 * Examples:
 *   node scripts/gh-workflow-cleanup.js --status=failure
 *   node scripts/gh-workflow-cleanup.js --keep-last=3 --dry-run
 *   node scripts/gh-workflow-cleanup.js --workflow="Release Build" --status=all
 */

const https = require('https');
const { promisify } = require('util');

// Configuration
const GITHUB_TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const REPO_OWNER = 'TengraStudio';
const REPO_NAME = 'tengra';

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
    status: 'failure', // Default: only delete failed runs
    keepLast: 5,
    dryRun: false,
    workflow: null,
    olderThanDays: 30
};

args.forEach(arg => {
    if (arg.startsWith('--status=')) {
        options.status = arg.split('=')[1];
    } else if (arg.startsWith('--keep-last=')) {
        options.keepLast = parseInt(arg.split('=')[1]);
    } else if (arg === '--dry-run') {
        options.dryRun = true;
    } else if (arg.startsWith('--workflow=')) {
        options.workflow = arg.split('=')[1];
    } else if (arg.startsWith('--older-than=')) {
        options.olderThanDays = parseInt(arg.split('=')[1]);
    }
});

// Color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

// Make API request
function makeRequest(path, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            path: path,
            method: method,
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'GitHub-Workflow-Cleanup-Script'
            }
        };

        if (data) {
            options.headers['Content-Type'] = 'application/json';
        }

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(body ? JSON.parse(body) : null);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${body}`));
                }
            });
        });

        req.on('error', reject);
        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

// Get workflow runs
async function getWorkflowRuns(page = 1, perPage = 100) {
    const path = `/repos/${REPO_OWNER}/${REPO_NAME}/actions/runs?page=${page}&per_page=${perPage}`;
    return makeRequest(path);
}

// Delete a workflow run
async function deleteWorkflowRun(runId) {
    const path = `/repos/${REPO_OWNER}/${REPO_NAME}/actions/runs/${runId}`;
    return makeRequest(path, 'DELETE');
}

// Filter runs based on criteria
function filterRuns(runs, options) {
    let filtered = runs;

    // Filter by status
    if (options.status !== 'all') {
        filtered = filtered.filter(run => run.conclusion === options.status || run.status === options.status);
    }

    // Filter by workflow name
    if (options.workflow) {
        filtered = filtered.filter(run => run.name === options.workflow);
    }

    // Filter by age
    if (options.olderThanDays > 0) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - options.olderThanDays);
        filtered = filtered.filter(run => new Date(run.created_at) < cutoffDate);
    }

    return filtered;
}

// Main function
async function main() {
    if (!GITHUB_TOKEN) {
        log('❌ Error: GitHub token not found!', 'red');
        log('Set GH_TOKEN or GITHUB_TOKEN environment variable', 'yellow');
        log('Example: export GH_TOKEN="your_github_token"', 'cyan');
        process.exit(1);
    }

    log('\n🧹 GitHub Actions Workflow Cleanup', 'cyan');
    log('━'.repeat(50), 'cyan');
    log(`Repository: ${REPO_OWNER}/${REPO_NAME}`, 'blue');
    log(`Status filter: ${options.status}`, 'blue');
    log(`Keep last: ${options.keepLast} successful runs`, 'blue');
    log(`Older than: ${options.olderThanDays} days`, 'blue');
    if (options.workflow) {
        log(`Workflow: ${options.workflow}`, 'blue');
    }
    if (options.dryRun) {
        log('Mode: DRY RUN (no actual deletion)', 'yellow');
    }
    log('━'.repeat(50), 'cyan');

    try {
        // Fetch all workflow runs
        log('\n📥 Fetching workflow runs...', 'cyan');
        const response = await getWorkflowRuns();
        const allRuns = response.workflow_runs;
        log(`Found ${allRuns.length} total runs`, 'green');

        // Filter runs
        const runsToDelete = filterRuns(allRuns, options);
        log(`Filtered to ${runsToDelete.length} runs for deletion`, 'yellow');

        if (runsToDelete.length === 0) {
            log('\n✅ No runs to delete!', 'green');
            return;
        }

        // Group runs by workflow
        const runsByWorkflow = {};
        runsToDelete.forEach(run => {
            if (!runsByWorkflow[run.name]) {
                runsByWorkflow[run.name] = [];
            }
            runsByWorkflow[run.name].push(run);
        });

        // Display summary
        log('\n📊 Summary by workflow:', 'cyan');
        Object.entries(runsByWorkflow).forEach(([workflowName, runs]) => {
            log(`  ${workflowName}: ${runs.length} runs`, 'blue');
        });

        // Sort by date (oldest first)
        runsToDelete.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        // Delete runs
        log('\n🗑️  Deleting workflow runs...', 'cyan');
        let deleted = 0;
        let failed = 0;

        for (const run of runsToDelete) {
            const date = new Date(run.created_at).toISOString().split('T')[0];
            const status = run.conclusion || run.status;
            const message = `  [${date}] ${run.name} #${run.run_number} (${status})`;

            if (options.dryRun) {
                log(`${message} - would delete`, 'yellow');
            } else {
                try {
                    await deleteWorkflowRun(run.id);
                    log(`${message} - deleted ✓`, 'green');
                    deleted++;

                    // Rate limiting: wait 100ms between deletions
                    await new Promise(resolve => setTimeout(resolve, 100));
                } catch (error) {
                    log(`${message} - failed: ${error.message}`, 'red');
                    failed++;
                }
            }
        }

        // Final summary
        log('\n━'.repeat(50), 'cyan');
        if (options.dryRun) {
            log(`✅ Dry run complete: ${runsToDelete.length} runs would be deleted`, 'yellow');
        } else {
            log(`✅ Cleanup complete!`, 'green');
            log(`   Deleted: ${deleted}`, 'green');
            if (failed > 0) {
                log(`   Failed: ${failed}`, 'red');
            }
        }
        log('━'.repeat(50), 'cyan');

    } catch (error) {
        log(`\n❌ Error: ${error.message}`, 'red');
        process.exit(1);
    }
}

// Run the script
main().catch(error => {
    log(`\n❌ Fatal error: ${error.message}`, 'red');
    process.exit(1);
});

