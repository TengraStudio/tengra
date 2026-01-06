const http = require('http');

const PROXY_URL = 'http://127.0.0.1:8317/v1/chat/completions';
const PROXY_KEY = 'sk-cliproxy-test-key';

async function testModel(modelName) {
    console.log(`\n--- Testing model: ${modelName} ---`);
    const data = JSON.stringify({
        model: modelName,
        messages: [{ role: 'user', content: 'Draw a simple Mario character' }],
        stream: false
    });

    return new Promise((resolve, reject) => {
        const url = new URL(PROXY_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${PROXY_KEY}`,
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    if (json.choices && json.choices[0].message) {
                        const msg = json.choices[0].message;
                        console.log(`Success! Content length: ${msg.content?.length || 0}`);
                        if (msg.images) {
                            console.log(`Images found: ${msg.images.length}`);
                        } else if (msg.content && msg.content.includes('data:image')) {
                            console.log('Image data found in content!');
                        } else {
                            console.log('No images found in response.');
                        }
                    }
                    resolve({ status: res.statusCode, data: json });
                } catch (e) {
                    resolve({ status: res.statusCode, raw: body });
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.write(data);
        req.end();
    });
}

async function listModels() {
    console.log(`\n--- Listing all models ---`);
    return new Promise((resolve, reject) => {
        const url = new URL('http://127.0.0.1:8317/v1/models');
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${PROXY_KEY}`
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    const modelIds = json.data?.map(m => m.id) || [];
                    console.log(`Found ${modelIds.length} models.`);
                    console.log('Antigravity models:', modelIds.filter(id => id.includes('gemini') || id.includes('antigravity')));
                    resolve(modelIds);
                } catch (e) {
                    console.log('Invalid JSON response for models list');
                    resolve([]);
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.end();
    });
}

async function main() {
    try {
        console.log('Starting Antigravity Image Investigation...');

        await listModels();

        const res1 = await testModel('gemini-3-pro-image');
        console.log('Status:', res1.status);
        if (res1.status !== 200) console.log('Error:', res1.data || res1.raw);

        const res2 = await testModel('gemini-3-pro-image-preview');
        console.log('Status:', res2.status);
        if (res2.status !== 200) console.log('Error:', res2.data || res2.raw);

        const res3 = await testModel('antigravity/gemini-3-pro-image');
        console.log('Status:', res3.status);
        if (res3.status !== 200) console.log('Error:', res3.data || res3.raw);

    } catch (e) {
        console.error('Fatal Error:', e);
    }
}

main();
