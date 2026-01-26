import { appLogger } from '@main/logging/logger';
import { getErrorMessage } from '@shared/utils/error.util';
import axios from 'axios';

interface PageSpeedParams {
    url: string;
    strategy: 'mobile' | 'desktop';
    category: string;
    key?: string;
}

interface LighthouseAudit {
    title: string;
    description: string;
    score: number;
    displayValue?: string;
    details?: {
        type?: string;
        overallSavingsMs?: number;
    };
}

export interface PageSpeedResult {
    url: string;
    performanceScore: number;
    metrics: {
        fcp: string; // First Contentful Paint
        lcp: string; // Largest Contentful Paint
        tbt: string; // Total Blocking Time
        cls: string; // Cumulative Layout Shift
        speedIndex: string;
    };
    opportunities: Array<{
        title: string;
        description: string;
        savings: string;
    }>;
}

export class PageSpeedService {
    private apiKey: string = ''; // Optional, but recommended for higher limits

    constructor() { }

    setApiKey(key: string) {
        this.apiKey = key;
    }

    async analyze(url: string, strategy: 'mobile' | 'desktop' = 'mobile'): Promise<PageSpeedResult> {
        try {
            const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed`;
            const params: PageSpeedParams = {
                url,
                strategy,
                category: 'PERFORMANCE'
            };

            if (this.apiKey) {
                params.key = this.apiKey;
            }

            appLogger.info('pagespeed.service', `[PageSpeedService] Analyzing ${url} (${strategy})...`);

            const response = await axios.get(endpoint, { params });
            const data = response.data;
            const lighthouse = data.lighthouseResult;

            const audits = lighthouse.audits as Record<string, LighthouseAudit>;
            const result = this.parseLighthouseResult(url, lighthouse, audits);
            result.opportunities = this.extractOpportunities(audits);
            return result;

        } catch (error) {
            appLogger.error('PageSpeedService', `Analysis failed: ${getErrorMessage(error)}`);
            throw new Error(`PageSpeed analysis failed: ${getErrorMessage(error)}`);
        }
    }

    private parseLighthouseResult(url: string, lighthouse: { categories: { performance: { score: number } } }, audits: Record<string, LighthouseAudit>): PageSpeedResult {
        return {
            url,
            performanceScore: lighthouse.categories.performance.score * 100,
            metrics: {
                fcp: audits['first-contentful-paint'].displayValue ?? '',
                lcp: audits['largest-contentful-paint'].displayValue ?? '',
                tbt: audits['total-blocking-time'].displayValue ?? '',
                cls: audits['cumulative-layout-shift'].displayValue ?? '',
                speedIndex: audits['speed-index'].displayValue ?? ''
            },
            opportunities: []
        };
    }

    private extractOpportunities(audits: Record<string, LighthouseAudit>): Array<{ title: string; description: string; savings: string }> {
        return Object.values(audits)
            .filter((audit) => audit.details?.type === 'opportunity' && audit.score < 0.9)
            .sort((a, b) => a.score - b.score)
            .slice(0, 5)
            .map((audit) => ({
                title: audit.title,
                description: audit.description,
                savings: audit.details?.overallSavingsMs !== undefined ? `${Math.round(audit.details.overallSavingsMs)}ms` : ''
            }));
    }

    getToolDefinition() {
        return {
            type: 'function',
            function: {
                name: 'analyze_page_performance',
                description: 'Analyze the performance of a website using Google PageSpeed Insights. Returns Core Web Vitals (LCP, CLS, FCP) and improvement opportunities.',
                parameters: {
                    type: 'object',
                    properties: {
                        url: {
                            type: 'string',
                            description: 'The full URL of the website to analyze (e.g., https://google.com)'
                        },
                        strategy: {
                            type: 'string',
                            enum: ['mobile', 'desktop'],
                            description: 'The analysis strategy (default: mobile)'
                        }
                    },
                    required: ['url']
                }
            }
        };
    }
}
