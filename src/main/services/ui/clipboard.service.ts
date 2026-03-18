import { BaseService } from '@main/services/base.service';
import { JobSchedulerService } from '@main/services/system/job-scheduler.service';
import { PowerManagerService } from '@main/services/system/power-manager.service';
import { clipboard, nativeImage } from 'electron';

const CLIPBOARD_MESSAGE_KEY = {
    IMAGE_NOT_FOUND: 'mainProcess.clipboardService.imageNotFound'
} as const;
const CLIPBOARD_ERROR_MESSAGE = {
    IMAGE_NOT_FOUND: 'Clipboard does not contain an image'
} as const;

export class ClipboardService extends BaseService {
    private static readonly WATCH_JOB_ID = 'clipboard:watch';
    private static readonly DEFAULT_WATCH_INTERVAL_MS = 2000;
    private static readonly LOW_POWER_WATCH_INTERVAL_MS = 5000;
    private history: string[] = [];
    private maxHistory = 50;
    private lastText = '';
    private watcherInterval: NodeJS.Timeout | null = null;

    constructor(
        private readonly jobScheduler?: JobSchedulerService,
        private readonly powerManager?: PowerManagerService
    ) {
        super('ClipboardService');
    }

    override async initialize(): Promise<void> {
        this.startWatcher();
    }

    override async cleanup(): Promise<void> {
        this.jobScheduler?.unregisterRecurringJob(ClipboardService.WATCH_JOB_ID);
        if (this.watcherInterval) {
            clearInterval(this.watcherInterval);
            this.watcherInterval = null;
        }
    }

    private startWatcher() {
        if (this.jobScheduler) {
            this.jobScheduler.registerRecurringJob(
                ClipboardService.WATCH_JOB_ID,
                async () => {
                    this.pollClipboard();
                },
                () => this.getWatchIntervalMs(),
                {
                    persistState: false,
                    runOnStart: false,
                }
            );
            return;
        }

        this.watcherInterval = setInterval(() => {
            this.pollClipboard();
        }, ClipboardService.DEFAULT_WATCH_INTERVAL_MS);
    }

    private getWatchIntervalMs(): number {
        if (this.powerManager?.isLowPowerMode()) {
            return ClipboardService.LOW_POWER_WATCH_INTERVAL_MS;
        }
        return ClipboardService.DEFAULT_WATCH_INTERVAL_MS;
    }

    private pollClipboard(): void {
        const text = clipboard.readText();
        if (text && text !== this.lastText) {
            this.lastText = text;
            this.addToHistory(text);
        }
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
        if (img.isEmpty()) {
            return {
                success: false,
                error: CLIPBOARD_ERROR_MESSAGE.IMAGE_NOT_FOUND,
                messageKey: CLIPBOARD_MESSAGE_KEY.IMAGE_NOT_FOUND
            };
        }
        return { success: true, dataUrl: img.toDataURL() };
    }

    writeImage(dataUrl: string) {
        const img = nativeImage.createFromDataURL(dataUrl);
        clipboard.writeImage(img);
        return { success: true };
    }
}
