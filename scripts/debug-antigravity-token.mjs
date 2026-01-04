
import fs from 'fs';
import path from 'path';
import os from 'os';

const authDir = path.join(os.homedir(), 'AppData', 'Roaming', 'orbit-ai', 'cliproxy-auth-work');
console.log('Auth Dir:', authDir);

try {
    const files = fs.readdirSync(authDir).filter(f => f.startsWith('antigravity-') && f.endsWith('.json'));
    if (files.length === 0) {
        console.log('No Antigravity auth file found.');
    } else {
        const filePath = path.join(authDir, files[0]);
        console.log('Reading file:', filePath);
        const content = fs.readFileSync(filePath, 'utf8');
        const json = JSON.parse(content);
        console.log('Keys found:', Object.keys(json));
        console.log('Has refresh_token:', !!json.refresh_token);
        console.log('Timestamp:', json.timestamp, 'Date:', new Date(json.timestamp));
        console.log('Expired?', (Date.now() - json.timestamp) / 1000 > (json.expires_in || 3600));
    }
} catch (e) {
    console.error('Error:', e);
}
