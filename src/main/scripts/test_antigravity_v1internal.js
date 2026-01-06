const https = require('https');
const crypto = require('crypto');

const ACCESS_TOKEN = 'ya29.a0Aa7pCA8-fQcHu9QtLMf6BKX0sh84KEy_Oq0vGGJUOAvC16b0otl6v6WISjAd5EQ_5hS42QjYZzGunTH88giy2QJu8KROrQtkHdqSqYYWOmDq_oUzY24PxrEU83JLlbJuea-cqLW7LTPIOhOGc2EZKCCe6uODmKSRret3LbiKXKHR_K6VHXTCUW0IYJiO7g_aXyj4UsxetNivcgaCgYKATsSARYSFQHGX2MiJ7Gbpu7F62ZP8pl-_lMa9g0213';

function generateProjectId() {
    const adjs = ['swift', 'bold', 'calm', 'vibrant', 'swift'];
    const nouns = ['spark', 'flow', 'wave', 'core', 'peak'];
    return `${adjs[Math.floor(Math.random() * adjs.length)]}-${nouns[Math.floor(Math.random() * nouns.length)]}-${crypto.randomBytes(3).toString('hex')}`;
}

async function testInternalModel(modelName) {
    console.log(`\n--- Testing Internal model: ${modelName} ---`);
    const payload = {
        model: modelName,
        userAgent: 'antigravity',
        project: generateProjectId(),
        requestId: `agent-${crypto.randomUUID()}`,
        request: {
            sessionId: `-${Math.floor(Math.random() * 9000000000000000)}`,
            contents: [{
                role: 'user',
                parts: [{ text: 'Draw a simple Mario character' }]
            }],
            toolConfig: {
                functionCallingConfig: { mode: 'VALIDATED' }
            }
        }
    };

    const data = JSON.stringify(payload);

    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'cloudcode-pa.googleapis.com',
            port: 443,
            path: '/v1internal:generateContent',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
                'Content-Length': data.length,
                'User-Agent': 'antigravity/1.104.0 darwin/arm64'
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                console.log(`Status: ${res.statusCode}`);
                try {
                    const json = JSON.parse(body);
                    console.log('Response Body:', JSON.stringify(json, null, 2));
                    if (res.statusCode === 200) {
                        // Check for images in candidates
                        const candidates = json.candidates || [];
                        let imageFound = false;
                        candidates.forEach((c, i) => {
                            const parts = c.content?.parts || [];
                            parts.forEach((p, j) => {
                                if (p.inlineData) {
                                    console.log(`Candidate ${i}, Part ${j}: Image found! (Mime: ${p.inlineData.mimeType}, Length: ${p.inlineData.data.length})`);
                                    imageFound = true;
                                }
                            });
                        });
                        if (!imageFound) {
                            console.log('No images found in response.');
                            if (json.candidates?.[0]?.content?.parts?.[0]?.text) {
                                console.log('Text response:', json.candidates[0].content.parts[0].text.substring(0, 100) + '...');
                            }
                        }
                    } else {
                        console.log('Error Response:', JSON.stringify(json, null, 2));
                    }
                    resolve({ status: res.statusCode, data: json });
                } catch (e) {
                    console.log('Raw body (first 100 chars):', body.substring(0, 100));
                    resolve({ status: res.statusCode, raw: body });
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.write(data);
        req.end();
    });
}

async function main() {
    const models = [
        'gemini-3-pro-image-preview',
        'gemini-3-pro-image',
        'gemini-2.5-flash-image-preview',
        'gemini-2.5-flash-image'
    ];

    for (const model of models) {
        await testInternalModel(model);
    }
}

main();
