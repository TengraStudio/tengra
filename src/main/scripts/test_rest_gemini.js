const https = require('https');

const ACCESS_TOKEN = 'ya29.a0Aa7pCA8-fQcHu9QtLMf6BKX0sh84KEy_Oq0vGGJUOAvC16b0otl6v6WISjAd5EQ_5hS42QjYZzGunTH88giy2QJu8KROrQtkHdqSqYYWOmDq_oUzY24PxrEU83JLlbJuea-cqLW7LTPIOhOGc2EZKCCe6uODmKSRret3LbiKXKHR_K6VHXTCUW0IYJiO7g_aXyj4UsxetNivcgaCgYKATsSARYSFQHGX2MiJ7Gbpu7F62ZP8pl-_lMa9g0213';

async function testRestModel(modelName) {
    console.log(`\n--- Testing REST model: ${modelName} ---`);
    const data = JSON.stringify({
        contents: [{
            parts: [{ text: 'Draw a simple Mario character' }]
        }]
    });

    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'generativelanguage.googleapis.com',
            port: 443,
            path: `/v1beta/models/${modelName}:generateContent`,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    console.log(`Status: ${res.statusCode}`);
                    if (res.statusCode === 200) {
                        // Check for images in candidates
                        const candidates = json.candidates || [];
                        let imageFound = false;
                        candidates.forEach((c, i) => {
                            const parts = c.content?.parts || [];
                            parts.forEach((p, j) => {
                                if (p.inlineData) {
                                    console.log(`Candidate ${i}, Part ${j}: Image found! (Mime: ${p.inlineData.mimeType})`);
                                    imageFound = true;
                                }
                            });
                        });
                        if (!imageFound) {
                            console.log('No images found in response content.');
                            if (json.candidates?.[0]?.content?.parts?.[0]?.text) {
                                console.log('Text response:', json.candidates[0].content.parts[0].text.substring(0, 100) + '...');
                            }
                        }
                    } else {
                        console.log('Error Response:', JSON.stringify(json, null, 2));
                    }
                    resolve({ status: res.statusCode, data: json });
                } catch (e) {
                    console.log(`Status: ${res.statusCode}`);
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
        await testRestModel(model);
    }
}

main();
