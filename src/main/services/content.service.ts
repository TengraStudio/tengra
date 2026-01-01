import { ServiceResponse } from '../../shared/types';

export class ContentService {
    base64Encode(text: string): ServiceResponse<{ result: string }> {
        return { success: true, result: { result: Buffer.from(text).toString('base64') } };
    }

    base64Decode(encoded: string): ServiceResponse<{ result: string }> {
        return { success: true, result: { result: Buffer.from(encoded, 'base64').toString('utf8') } };
    }

    formatJson(jsonStr: string): ServiceResponse<{ result: string }> {
        try {
            const parsed = JSON.parse(jsonStr);
            return { success: true, result: { result: JSON.stringify(parsed, null, 4) } };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }

    convertUnits(value: number, from: string, to: string): ServiceResponse<{ result: number }> {
        const conversions: any = {
            'km_to_mi': value * 0.621371,
            'mi_to_km': value / 0.621371,
            'kg_to_lb': value * 2.20462,
            'lb_to_kg': value / 2.20462,
            'c_to_f': (value * 9 / 5) + 32,
            'f_to_c': (value - 32) * 5 / 9
        };
        const key = `${from}_to_${to}`;
        return conversions[key] ? { success: true, result: { result: conversions[key] } } : { success: false, error: 'Unsupported unit conversion' };
    }

    convertTimezone(dateStr: string, _fromTz: string, toTz: string): ServiceResponse<{ result: string }> {
        try {
            const date = new Date(dateStr);
            const result = date.toLocaleString('en-US', { timeZone: toTz });
            return { success: true, result: { result } };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }

    generateQrCode(text: string): ServiceResponse<{ url: string; note: string }> {
        const url = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(text)}`;
        return { success: true, result: { url, note: 'Generated via external API' } };
    }

    async shortenUrl(url: string): Promise<ServiceResponse<{ shortUrl: string }>> {
        try {
            const response = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`);
            const shortUrl = await response.text();
            return { success: true, result: { shortUrl } };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }

    async readRss(url: string): Promise<ServiceResponse<{ items: any[] }>> {
        try {
            const res = await fetch(url);
            const xml = await res.text();
            const items: any[] = [];
            const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);

            for (const match of itemMatches) {
                const content = match[1];
                const title = content.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1] || 'No Title';
                const link = content.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/)?.[1] || '';
                const description = content.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/)?.[1] || '';
                items.push({ title, link, description: description.replace(/<[^>]*>/g, '').slice(0, 150) + '...' });
                if (items.length >= 10) break;
            }
            return { success: true, result: { items } };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }

    async getYouTubeTranscript(videoIdOrUrl: string): Promise<ServiceResponse<{ videoId: string; message: string }>> {
        try {
            let videoId = videoIdOrUrl;
            if (videoIdOrUrl.includes('v=')) {
                videoId = new URL(videoIdOrUrl).searchParams.get('v') || videoId;
            } else if (videoIdOrUrl.includes('youtu.be/')) {
                videoId = videoIdOrUrl.split('/').pop() || videoId;
            }
            const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
            const html = await response.text();
            const match = html.match(/"captionTracks":\[(.*?)\]/);
            if (!match) return { success: false, error: 'Captions not found for this video.' };
            return { success: true, result: { videoId, message: 'Transcript metadata found.' } };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }
}
