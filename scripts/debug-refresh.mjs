
import fs from 'fs';
import path from 'path';
import os from 'os';
import axios from 'axios';
import { URLSearchParams } from 'url';

const ANTIGRAVITY_CLIENT_ID = '764086051850-6qr4k6gpi6l50o75675v56474l9p63dd.apps.googleusercontent.com'
const ANTIGRAVITY_CLIENT_SECRET = 'd-Jz5s9l5Q_s6-y98k7e7Q'

const authDir = path.join(os.homedir(), 'AppData', 'Roaming', 'orbit-ai', 'cliproxy-auth-work');

async function testRefresh() {
    try {
        const files = fs.readdirSync(authDir).filter(f => f.startsWith('antigravity-') && f.endsWith('.json'));
        if (files.length === 0) {
            console.log('No auth file found.');
            return;
        }

        const filePath = path.join(authDir, files[0]);
        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const refreshToken = content.refresh_token;

        if (!refreshToken) {
            console.log('No refresh token in file.');
            return;
        }

        console.log('Attempting refresh with token:', refreshToken.substring(0, 10) + '...');

        const params = new URLSearchParams()
        params.append('client_id', ANTIGRAVITY_CLIENT_ID)
        params.append('client_secret', ANTIGRAVITY_CLIENT_SECRET)
        params.append('refresh_token', refreshToken)
        params.append('grant_type', 'refresh_token')

        const res = await axios.post('https://oauth2.googleapis.com/token', params.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            validateStatus: () => true // Do not throw on 4xx/5xx
        })

        console.log('Status:', res.status);
        console.log('Data:', JSON.stringify(res.data, null, 2));

    } catch (e) {
        console.error('Script error:', e.message);
    }
}

testRefresh();
