const { readFileSync } = require('fs');
const { join } = require('path');

async function main() {
    const envContent = readFileSync(join(process.cwd(), '.env'), 'utf-8');
    const tokenMatch = envContent.match(/^GH_TOKEN=(.*)$/m);
    if (!tokenMatch) {
        console.error('GH_TOKEN not found in .env');
        process.exit(1);
    }
    const token = tokenMatch[1].trim();
    const owner = 'TengraStudio';
    const repo = 'tengra';

    console.log(`Searching for failed workflow runs in ${owner}/${repo}...`);

    async function ghApi(path, options = {}) {
        const url = `https://api.github.com${path}`;
        const res = await fetch(url, {
            ...options,
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
                'User-Agent': 'Tengra-Cleanup-Script',
                ...options.headers,
            },
        });
        if (!res.ok) {
            const body = await res.text();
            throw new Error(`GitHub API error: ${res.status} ${res.statusText}\n${body}`);
        }
        if (res.status === 204) return null;
        return res.json();
    }

    try {
        const runsData = await ghApi(`/repos/${owner}/${repo}/actions/runs?status=failure&per_page=100`);
        const failedRuns = runsData.workflow_runs;

        if (failedRuns.length === 0) {
            console.log('No failed workflow runs found.');
            return;
        }

        console.log(`Found ${failedRuns.length} failed runs. Deleting...`);

        for (const run of failedRuns) {
            console.log(`Deleting run #${run.id} (${run.display_title})...`);
            await ghApi(`/repos/${owner}/${repo}/actions/runs/${run.id}`, { method: 'DELETE' });
        }

        console.log('Successfully deleted all failed runs.');
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

main();
