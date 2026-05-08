const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

async function run() {
    const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
    if (!token) {
        console.error("GH_TOKEN is not set!");
        process.exit(1);
    }
    
    console.log("Generating runtime-manifest.json...");
    execSync('node scripts/dump-manifest.js', { stdio: 'inherit' });
    
    // Fetch latest release
    console.log("Fetching latest release from GitHub...");
    const releasesResponse = await fetch('https://api.github.com/repos/TengraStudio/tengra/releases', {
        headers: {
            'Authorization': `Bearer ${token}`,
            'User-Agent': 'Node.js',
            'Accept': 'application/vnd.github.v3+json'
        }
    });
    
    if (!releasesResponse.ok) {
        console.error("Failed to fetch releases:", releasesResponse.status, await releasesResponse.text());
        process.exit(1);
    }
    
    const releases = await releasesResponse.json();
    if (releases.length === 0) {
        console.error("No releases found.");
        process.exit(1);
    }
    
    // We will upload to the latest release
    const latestRelease = releases[0];
    console.log(`Uploading to release: ${latestRelease.name} (${latestRelease.tag_name}), ID: ${latestRelease.id}`);
    
    // Check if runtime-manifest.json already exists as an asset and delete it if so
    const existingAsset = latestRelease.assets.find(a => a.name === 'runtime-manifest.json');
    if (existingAsset) {
        console.log(`Deleting existing asset ${existingAsset.id}...`);
        await fetch(`https://api.github.com/repos/TengraStudio/tengra/releases/assets/${existingAsset.id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'User-Agent': 'Node.js'
            }
        });
    }
    
    const manifestPath = path.resolve(__dirname, '..', 'runtime-manifest.json');
    const fileStats = fs.statSync(manifestPath);
    const fileBuffer = fs.readFileSync(manifestPath);
    
    console.log(`Uploading runtime-manifest.json (${fileStats.size} bytes)...`);
    const uploadUrl = latestRelease.upload_url.split('{')[0] + '?name=runtime-manifest.json';
    
    const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'User-Agent': 'Node.js',
            'Content-Type': 'application/json',
            'Content-Length': fileStats.size.toString()
        },
        body: fileBuffer
    });
    
    if (!uploadResponse.ok) {
        console.error("Failed to upload:", uploadResponse.status, await uploadResponse.text());
        process.exit(1);
    }
    
    console.log("Upload successful!");
}
run().catch(err => {
    console.error(err);
    process.exit(1);
});
