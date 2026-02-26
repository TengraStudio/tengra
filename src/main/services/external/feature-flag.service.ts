import * as fs from 'fs';
import * as path from 'path';

import { BaseService } from '@main/services/base.service';
import { DataService } from '@main/services/data/data.service';
import { safeJsonParse } from '@shared/utils/sanitize.util';


export interface FeatureFlag {
    id: string;
    enabled: boolean;
    description?: string;
    rolloutPercentage?: number; // Future use
}

export class FeatureFlagService extends BaseService {
    private flags: Map<string, FeatureFlag> = new Map();
    private configPath: string;

    // Default flags
    private defaults: FeatureFlag[] = [
        // Flags removed (DEBT-01): new_agent_engine, event_sourcing_ui, experimental_models
    ];


    constructor(private dataService: DataService) {
        super('FeatureFlagService');
        this.configPath = path.join(this.dataService.getPath('config'), 'features.json');
    }

    override async initialize(): Promise<void> {
        await this.loadFlags();
        void super.initialize();
    }

    private async loadFlags() {
        try {
            // Ensure Config Dir exists
            const configDir = path.dirname(this.configPath);
            try {
                await fs.promises.access(configDir);
            } catch {
                await fs.promises.mkdir(configDir, { recursive: true, mode: 0o700 });
            }

            // Load from disk
            try {
                const content = await fs.promises.readFile(this.configPath, 'utf-8');
                const loaded = safeJsonParse<FeatureFlag[]>(content, []);
                loaded.forEach(f => this.flags.set(f.id, f));
            } catch {
                // Ignore if file doesn't exist
            }

            // Merge defaults if not present
            this.defaults.forEach(def => {
                if (!this.flags.has(def.id)) {
                    this.flags.set(def.id, def);
                }
            });

            this.logInfo('Feature flags loaded');
        } catch (error) {
            this.logError('Failed to load feature flags', error);
            // Fallback to defaults in memory
            this.defaults.forEach(def => this.flags.set(def.id, def));
        }
    }

    private async saveFlags() {
        try {
            const data = Array.from(this.flags.values());
            await fs.promises.writeFile(this.configPath, JSON.stringify(data, null, 2));
        } catch (error) {
            this.logError('Failed to save feature flags', error);
        }
    }

    isEnabled(featureId: string): boolean {
        const flag = this.flags.get(featureId);
        return flag ? flag.enabled : false;
    }

    enable(featureId: string) {
        const flag = this.flags.get(featureId);
        if (flag) {
            flag.enabled = true;
            this.flags.set(featureId, flag);
            void this.saveFlags();
            this.logInfo(`Feature enabled: ${featureId}`);
        }
    }

    disable(featureId: string) {
        const flag = this.flags.get(featureId);
        if (flag) {
            flag.enabled = false;
            this.flags.set(featureId, flag);
            void this.saveFlags();
            this.logInfo(`Feature disabled: ${featureId}`);
        }
    }

    getAllFlags(): FeatureFlag[] {
        return Array.from(this.flags.values());
    }
}
