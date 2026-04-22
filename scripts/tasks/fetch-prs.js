
const https = require('https');

const GITHUB_TOKEN = process.env.GH_TOKEN;
const REPO_OWNER = 'TengraStudio';
const REPO_NAME = 'tengra';

function makeRequest(path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            path: path,
            method: 'GET',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Tengra-PR-Fetcher'
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(JSON.parse(body));
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${body}`));
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

async function main() {
    try {
        console.log(`Fetching PRs for ${REPO_OWNER}/${REPO_NAME}...`);
        const prs = await makeRequest(`/repos/${REPO_OWNER}/${REPO_NAME}/pulls`);
        console.log(`\nFound ${prs.length} open PRs:`);
        prs.forEach(pr => {
            console.log(`- [#${pr.number}] ${pr.title} (${pr.user.login})`);
            console.log(`  State: ${pr.state}, Branch: ${pr.head.ref} -> ${pr.base.ref}`);
            console.log(`  URL: ${pr.html_url}\n`);
        });
    } catch (error) {
        console.error('Error fetching PRs:', error.message);
    }
}

main();
