import { BaseService } from './base.service';
import { DataService } from './data/data.service';
import * as path from 'path';
import * as fs from 'fs';


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
        { id: 'new_agent_engine', enabled: false, description: 'Enable the new autonomous agent engine' },
        { id: 'event_sourcing_ui', enabled: false, description: 'Show event sourcing debug UI' },
        { id: 'experimental_models', enabled: true, description: 'Show experimental models in selection' }
    ];

    constructor(private dataService: DataService) {
        super('FeatureFlagService');
        this.configPath = path.join(this.dataService.getPath('config'), 'features.json');
    }

    override async initialize(): Promise<void> {
        await this.loadFlags();
        super.initialize();
    }

    private async loadFlags() {
        try {
            // Ensure Config Dir exists
            const configDir = path.dirname(this.configPath);
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }

            // Load from disk
            if (fs.existsSync(this.configPath)) {
                const content = fs.readFileSync(this.configPath, 'utf-8');
                const loaded = JSON.parse(content) as FeatureFlag[];
                loaded.forEach(f => this.flags.set(f.id, f));
            }

            // Merge defaults if not present
            this.defaults.forEach(def => {
                if (!this.flags.has(def.id)) {
                    this.flags.set(def.id, def);
                }
            });

            this.logInfo('Feature flags loaded', { count: this.flags.size });
        } catch (error) {
            this.logError('Failed to load feature flags', error);
            // Fallback to defaults in memory
            this.defaults.forEach(def => this.flags.set(def.id, def));
        }
    }

    private saveFlags() {
        try {
            const data = Array.from(this.flags.values());
            fs.writeFileSync(this.configPath, JSON.stringify(data, null, 2));
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
            this.saveFlags();
            this.logInfo(`Feature enabled: ${featureId}`);
        }
    }

    disable(featureId: string) {
        const flag = this.flags.get(featureId);
        if (flag) {
            flag.enabled = false;
            this.flags.set(featureId, flag);
            this.saveFlags();
            this.logInfo(`Feature disabled: ${featureId}`);
        }
    }

    getAllFlags(): FeatureFlag[] {
        return Array.from(this.flags.values());
    }
}
