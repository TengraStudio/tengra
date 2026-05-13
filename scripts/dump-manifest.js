const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SHA256_HEX_RE = /^[a-fA-F0-9]{64}$/;
const DUMMY_SHA256 = '0000000000000000000000000000000000000000000000000000000000000000';

const tsPath = path.join(__dirname, '..', 'src', 'main', 'services', 'system', 'runtime-manifest.service.ts');
const outPath = path.join(__dirname, '..', 'runtime-manifest.json');
const cacheDir = path.join(__dirname, '..', 'assets', 'runtime');

const tsContent = fs.readFileSync(tsPath, 'utf8');

const match = tsContent.match(/BUILTIN_COMPONENTS:\s*RuntimeManifestComponent\[\]\s*=\s*(\[[\s\S]*?\]);\s*constructor/);
if (!match) {
    throw new Error('Could not find BUILTIN_COMPONENTS in runtime-manifest.service.ts');
}

let arrayStr = match[1];

// Mock translation calls in the static array.
arrayStr = arrayStr.replace(/t\((['"`].*?['"`])\)/g, '$1');

// Repo-local script; evaluates checked-in manifest data.
const components = eval(`(${arrayStr})`);

function isRealSha256(value) {
    return typeof value === 'string'
        && SHA256_HEX_RE.test(value.trim())
        && value.trim() !== DUMMY_SHA256;
}

function sha256(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

function getAssetPlatformDir(target) {
    return `${target.platform}-${target.arch}`.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function safeAssetCacheName(target) {
    return target.assetName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function getAssetCachePath(target) {
    return path.join(cacheDir, getAssetPlatformDir(target), safeAssetCacheName(target));
}

async function downloadBuffer(url) {
    const response = await fetch(url, {
        redirect: 'follow',
        headers: {
            'User-Agent': 'Tengra-runtime-manifest-generator',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to download ${url}: HTTP ${response.status} ${response.statusText}`);
    }

    return Buffer.from(await response.arrayBuffer());
}

async function resolveTargetSha256(component, target) {
    if (isRealSha256(target.sha256)) {
        return target.sha256.trim().toLowerCase();
    }

    if (!target.downloadUrl) {
        throw new Error(`${component.id}/${target.assetName} is missing downloadUrl`);
    }
    
    const cachePath = getAssetCachePath(target);
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    let buffer;

    if (fs.existsSync(cachePath)) {
        buffer = fs.readFileSync(cachePath);
        console.log(`Using cached asset for ${component.id}: ${target.assetName}`);
    } else {
        console.log(`Downloading ${component.id}: ${target.assetName}`);
        buffer = await downloadBuffer(target.downloadUrl);
        fs.writeFileSync(cachePath, buffer);
    }

    const digest = sha256(buffer);
    console.log(`SHA-256 ${component.id}/${target.platform}/${target.arch}: ${digest}`);

    return digest;
}

async function normalizeManifestComponents(rawComponents) {
    const result = [];

    for (const component of rawComponents) {
        const targets = [];

        for (const target of component.targets ?? []) {
            targets.push({
                ...target,
                sha256: await resolveTargetSha256(component, target),
            });
        }

        result.push({
            ...component,
            targets,
        });
    }

    return result;
}

function assertManifestShape(manifest) {
    if (manifest.schemaVersion !== 1) {
        throw new Error('runtime-manifest.json schemaVersion must be 1');
    }

    if (!Array.isArray(manifest.components)) {
        throw new Error('runtime-manifest.json components must be an array');
    }

    for (const [componentIndex, component] of manifest.components.entries()) {
        if (typeof component.id !== 'string' || component.id.trim().length === 0) {
            throw new Error(`components[${componentIndex}].id must be a non-empty string`);
        }

        if (!Array.isArray(component.targets)) {
            throw new Error(`components[${componentIndex}].targets must be an array`);
        }

        for (const [targetIndex, target] of component.targets.entries()) {
            if (!isRealSha256(target.sha256)) {
                throw new Error(
                    `components[${componentIndex}] ${component.id} targets[${targetIndex}] has invalid or dummy sha256: ${JSON.stringify(target.sha256)}`
                );
            }
        }
    }
}

async function run() {
    const manifest = {
        schemaVersion: 1,
        releaseTag: 'latest',
        generatedAt: new Date().toISOString(),
        components: await normalizeManifestComponents(components),
    };

    assertManifestShape(manifest);

    fs.writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log('Manifest written to runtime-manifest.json');
}

run().catch(error => {
    console.error(error);
    process.exit(1);
});