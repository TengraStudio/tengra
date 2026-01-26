import { BaseService } from '@main/services/base.service';
import { clipboard, nativeImage } from 'electron';

export class ClipboardService extends BaseService {
    private history: string[] = [];
    private maxHistory = 50;
    private lastText = '';
    private watcherInterval: NodeJS.Timeout | null = null;

    constructor() {
        super('ClipboardService');
    }

    override async initialize(): Promise<void> {
        this.startWatcher();
    }

    override async cleanup(): Promise<void> {
        if (this.watcherInterval) {
            clearInterval(this.watcherInterval);
            this.watcherInterval = null;
        }
    }

    private startWatcher() {
        this.watcherInterval = setInterval(() => {
            const text = clipboard.readText();
            if (text && text !== this.lastText) {
                this.lastText = text;
                this.addToHistory(text);
            }
        }, 2000);
    }

    private addToHistory(text: string) {
        if (this.history.includes(text)) {
            this.history = this.history.filter(t => t !== text);
        }
        this.history.unshift(text);
        if (this.history.length > this.maxHistory) {
            this.history.pop();
        }
    }

    writeText(text: string) {
        this.lastText = text;
        clipboard.writeText(text);
        this.addToHistory(text);
        return { success: true };
    }

    readText() {
        return { success: true, text: clipboard.readText() };
    }

    appendText(text: string) {
        const current = clipboard.readText();
        const next = current + '\n' + text;
        this.writeText(next);
        return { success: true, text: next };
    }

    getHistory() {
        return { success: true, history: this.history };
    }

    clear() {
        clipboard.clear();
        this.history = [];
        this.lastText = '';
        return { success: true };
    }

    readImage() {
        const img = clipboard.readImage();
        if (img.isEmpty()) {return { success: false, error: 'Clipboard does not contain an image' };}
        return { success: true, dataUrl: img.toDataURL() };
    }

    writeImage(dataUrl: string) {
        const img = nativeImage.createFromDataURL(dataUrl);
        clipboard.writeImage(img);
        return { success: true };
    }
}
