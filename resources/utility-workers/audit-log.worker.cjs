'use strict';

const { createHash } = require('crypto');

function getPort() {
    return process.parentPort || null;
}

function postResponse(requestId, success, payload, error) {
    const port = getPort();
    if (!port) {
        return;
    }
    port.postMessage({ requestId, success, payload, error });
}

function buildIntegrityHash(entry, prevHash, timestamp, details) {
    return createHash('sha256').update(JSON.stringify({
        action: entry.action,
        category: entry.category,
        success: entry.success,
        userId: entry.userId,
        details,
        prevHash,
        timestamp,
    })).digest('hex');
}

function prepareEntry(entry, prevHash) {
    const timestamp = Date.now();
    const normalizedPrevHash = typeof prevHash === 'string' && prevHash.length > 0
        ? prevHash
        : 'genesis';
    const details = entry && typeof entry.details === 'object' && entry.details !== null
        ? entry.details
        : {};
    const integrityHash = buildIntegrityHash(entry, normalizedPrevHash, timestamp, details);

    return {
        fullEntry: {
            ...entry,
            timestamp,
            details: {
                ...details,
                integrity: {
                    prevHash: normalizedPrevHash,
                    hash: integrityHash,
                },
            },
        },
        nextHash: integrityHash,
    };
}

function verifyIntegrity(logs, sampleSize) {
    const boundedLogs = Array.isArray(logs) ? logs.slice(0, Math.max(1, sampleSize)) : [];
    let previous = 'genesis';

    for (let index = boundedLogs.length - 1; index >= 0; index -= 1) {
        const entry = boundedLogs[index];
        if (!entry) {
            continue;
        }

        const details = entry.details && typeof entry.details === 'object' ? { ...entry.details } : {};
        const integrity = details.integrity;
        if (!integrity || typeof integrity !== 'object' || typeof integrity.hash !== 'string' || typeof integrity.prevHash !== 'string') {
            return { ok: false, checked: boundedLogs.length - index, firstInvalidAt: entry.timestamp };
        }

        delete details.integrity;
        const digest = buildIntegrityHash(entry, integrity.prevHash, entry.timestamp, details);
        if (integrity.hash !== digest || integrity.prevHash !== previous) {
            return { ok: false, checked: boundedLogs.length - index, firstInvalidAt: entry.timestamp };
        }
        previous = integrity.hash;
    }

    return { ok: true, checked: boundedLogs.length };
}

const port = getPort();
if (port) {
    port.on('message', (message) => {
        const requestId = typeof message?.requestId === 'string' ? message.requestId : '';
        const type = typeof message?.type === 'string' ? message.type : '';
        const payload = message?.payload ?? null;

        try {
            if (type === 'audit.prepareEntry') {
                postResponse(
                    requestId,
                    true,
                    prepareEntry(payload?.entry ?? {}, payload?.prevHash)
                );
                return;
            }

            if (type === 'audit.verifyIntegrity') {
                postResponse(
                    requestId,
                    true,
                    verifyIntegrity(payload?.logs, payload?.sampleSize ?? 200)
                );
                return;
            }

            postResponse(requestId, false, null, `Unsupported audit worker message: ${type}`);
        } catch (error) {
            postResponse(requestId, false, null, error instanceof Error ? error.message : String(error));
        }
    });
}
