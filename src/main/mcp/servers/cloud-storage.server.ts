import { buildActions, McpDeps, validateNumber, validateString, validateUrl } from '@main/mcp/server-utils';
import { McpService } from '@main/mcp/types';

interface CloudProviderProfile {
    id: 'aws' | 'azure' | 'gcp'
    strengths: string[]
    monitoringService: string
    deploymentService: string
    securityService: string
    estimatedMonthlyBaseUsd: number
}

const CLOUD_PROVIDER_PROFILES: CloudProviderProfile[] = [
    {
        id: 'aws',
        strengths: ['broad service ecosystem', 'mature AI platform tooling'],
        monitoringService: 'CloudWatch',
        deploymentService: 'CodePipeline',
        securityService: 'Security Hub',
        estimatedMonthlyBaseUsd: 120
    },
    {
        id: 'azure',
        strengths: ['enterprise identity integration', 'strong hybrid cloud support'],
        monitoringService: 'Azure Monitor',
        deploymentService: 'Azure DevOps Pipelines',
        securityService: 'Microsoft Defender for Cloud',
        estimatedMonthlyBaseUsd: 115
    },
    {
        id: 'gcp',
        strengths: ['managed data + ML stack', 'high-performance analytics'],
        monitoringService: 'Cloud Monitoring',
        deploymentService: 'Cloud Deploy',
        securityService: 'Security Command Center',
        estimatedMonthlyBaseUsd: 110
    }
];

export function buildCloudStorageServer(deps: McpDeps): McpService {
    return {
        name: 'cloud-storage',
        description: 'Cloud storage discovery and metadata helpers',
        actions: buildActions([
            {
                name: 'supportedProviders',
                description: 'List supported cloud providers and expected auth env keys',
                handler: async () => ({
                    success: true,
                    data: [
                        { id: 's3', authEnv: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'] },
                        { id: 'gcs', authEnv: ['GOOGLE_APPLICATION_CREDENTIALS'] },
                        { id: 'azure-blob', authEnv: ['AZURE_STORAGE_CONNECTION_STRING'] },
                        { id: 'r2', authEnv: ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'] }
                    ]
                })
            },
            {
                name: 'inspectPublicObject',
                description: 'Fetch public object metadata from a cloud URL',
                handler: async ({ url }) => {
                    const safeUrl = validateUrl(url, ['https:']);
                    const parsedUrl = new URL(safeUrl);
                    const proxiedUrl = `https://r.jina.ai/${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}${parsedUrl.search}`;
                    return deps.web.fetchJson(proxiedUrl);
                }
            },
            {
                name: 'buildObjectPath',
                description: 'Build canonical provider/object path string',
                handler: async ({ provider, bucket, objectKey }) => {
                    const safeProvider = validateString(provider, 64).toLowerCase();
                    const safeBucket = validateString(bucket, 200);
                    const safeObjectKey = validateString(objectKey, 2000);
                    return {
                        success: true,
                        data: `${safeProvider}://${safeBucket}/${safeObjectKey.replace(/^\/+/, '')}`
                    };
                }
            },
            {
                name: 'planMultiCloudAssistant',
                description: 'Generate a minimal AWS/Azure/GCP assistant plan with cost, security, and ops guidance',
                handler: async ({ workloadType, monthlyBudgetUsd, requiredRegions }) => {
                    const safeWorkloadType = validateString(workloadType, 120);
                    const safeBudget = validateNumber(monthlyBudgetUsd ?? 600, 100, 100000);
                    const safeRegionsRaw = Array.isArray(requiredRegions)
                        ? requiredRegions.slice(0, 5).map(region => validateString(region, 32))
                        : [];
                    const safeRegions = safeRegionsRaw.length > 0 ? safeRegionsRaw : ['us-east-1'];

                    const scoredProviders = CLOUD_PROVIDER_PROFILES.map(provider => {
                        const affordabilityScore =
                            provider.estimatedMonthlyBaseUsd <= safeBudget / 3 ? 10 : 7;
                        const multiRegionScore = safeRegions.length > 1 ? 9 : 8;
                        return {
                            ...provider,
                            score: affordabilityScore + multiRegionScore
                        };
                    }).sort((a, b) => b.score - a.score);

                    return {
                        success: true,
                        data: {
                            workloadType: safeWorkloadType,
                            integrations: scoredProviders.map(provider => ({
                                provider: provider.id,
                                strengths: provider.strengths
                            })),
                            costOptimization: [
                                'Use autoscaling and spot/preemptible instances for burst workloads',
                                'Set per-environment budgets and anomaly alerts',
                                'Right-size AI endpoints monthly based on usage telemetry'
                            ],
                            resourceMonitoring: scoredProviders.map(provider => ({
                                provider: provider.id,
                                service: provider.monitoringService
                            })),
                            deploymentAutomation: scoredProviders.map(provider => ({
                                provider: provider.id,
                                service: provider.deploymentService
                            })),
                            securityComplianceChecks: scoredProviders.map(provider => ({
                                provider: provider.id,
                                service: provider.securityService
                            })),
                            multiCloudComparisonInsights: scoredProviders.map(provider => ({
                                provider: provider.id,
                                estimatedMonthlyBaseUsd: provider.estimatedMonthlyBaseUsd,
                                score: provider.score
                            })),
                            recommendedPrimary: scoredProviders[0].id,
                            requiredRegions: safeRegions
                        }
                    };
                }
            }
        ], 'cloud-storage', deps.auditLog)
    };
}
