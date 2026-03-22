'use strict';

/** @type {Array<{ id: string, name: string, properties?: Record<string, unknown>, timestamp: number, sessionId: string }>} */
const queue = [];
let totalTrackedEvents = 0;
let totalFlushedEvents = 0;
let lastFlushTime = null;

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

function snapshot() {
    return {
        queueSize: queue.length,
        totalTrackedEvents,
        totalFlushedEvents,
        lastFlushTime,
    };
}

function pushEvents(events) {
    for (const event of events) {
        queue.push(event);
        totalTrackedEvents += 1;
    }
}

const port = getPort();
if (port) {
    port.on('message', (message) => {
        const requestId = typeof message?.requestId === 'string' ? message.requestId : '';
        const type = typeof message?.type === 'string' ? message.type : '';
        const payload = message?.payload ?? null;

        try {
            if (type === 'telemetry.track') {
                const events = Array.isArray(payload?.events)
                    ? payload.events
                    : payload?.event
                        ? [payload.event]
                        : [];
                pushEvents(events);
                postResponse(requestId, true, snapshot());
                return;
            }

            if (type === 'telemetry.flush') {
                const flushedCount = queue.length;
                queue.length = 0;
                totalFlushedEvents += flushedCount;
                lastFlushTime = Date.now();
                postResponse(requestId, true, {
                    flushedCount,
                    state: snapshot(),
                });
                return;
            }

            if (type === 'telemetry.snapshot') {
                postResponse(requestId, true, snapshot());
                return;
            }

            if (type === 'telemetry.reset') {
                queue.length = 0;
                totalTrackedEvents = 0;
                totalFlushedEvents = 0;
                lastFlushTime = null;
                postResponse(requestId, true, snapshot());
                return;
            }

            postResponse(requestId, false, null, `Unsupported telemetry worker message: ${type}`);
        } catch (error) {
            postResponse(requestId, false, null, error instanceof Error ? error.message : String(error));
        }
    });
}
