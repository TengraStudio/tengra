import { AgentPerformanceMetrics } from '@shared/types/automation-workflow';
import React from 'react';

import { useTranslation } from '@/i18n';

import './AgentPerformancePanel.css';

interface AgentPerformancePanelProps {
    metrics: AgentPerformanceMetrics | null;
}

/**
 * Component to display agent performance metrics including error rates,
 * resource usage, and performance alerts
 */
export const AgentPerformancePanel: React.FC<AgentPerformancePanelProps> = ({ metrics }) => {
    const { t } = useTranslation();

    if (!metrics) {
        return (
            <div className="agent-performance-panel empty">
                <p>{t('agent.performance.noMetrics')}</p>
            </div>
        );
    }

    const formatPercent = (value: number): string => `${value.toFixed(1)}%`;
    const formatMemory = (mb: number): string => `${mb.toFixed(0)} MB`;
    const formatCost = (usd: number): string => `$${usd.toFixed(4)}`;
    const formatTime = (ms: number): string => `${(ms / 1000).toFixed(1)}s`;

    return (
        <div className="agent-performance-panel">
            {/* Performance Alerts */}
            {metrics.alerts.length > 0 && (
                <div className="performance-alerts">
                    <h3>{t('agent.performance.alerts')}</h3>
                    <div className="alerts-list">
                        {metrics.alerts.map((alert, index) => (
                            <div
                                key={index}
                                className={`alert alert-${alert.severity}`}
                            >
                                <span className="alert-icon">
                                    {alert.severity === 'critical' && '🔴'}
                                    {alert.severity === 'high' && '🟠'}
                                    {alert.severity === 'medium' && '🟡'}
                                    {alert.severity === 'low' && '🟢'}
                                </span>
                                <div className="alert-content">
                                    <span className="alert-type">{alert.type}</span>
                                    <span className="alert-message">{alert.message}</span>
                                    <span className="alert-time">
                                        {new Date(alert.timestamp).toLocaleTimeString()}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Execution Metrics */}
            <div className="metrics-section">
                <h3>{t('agent.performance.execution')}</h3>
                <div className="metrics-grid">
                    <div className="metric-card">
                        <span className="metric-label">{t('agent.performance.completionRate')}</span>
                        <span className="metric-value">{formatPercent(metrics.completionRate)}</span>
                    </div>
                    <div className="metric-card">
                        <span className="metric-label">{t('agent.performance.avgStepTime')}</span>
                        <span className="metric-value">{formatTime(metrics.avgStepExecutionTimeMs)}</span>
                    </div>
                    <div className="metric-card">
                        <span className="metric-label">{t('agent.performance.stepsCompleted')}</span>
                        <span className="metric-value">{metrics.stepsCompleted}</span>
                    </div>
                    <div className="metric-card">
                        <span className="metric-label">{t('agent.performance.stepsFailed')}</span>
                        <span className="metric-value error">{metrics.stepsFailed}</span>
                    </div>
                </div>
            </div>

            {/* Error Metrics */}
            <div className="metrics-section">
                <h3>{t('agent.performance.errors')}</h3>
                <div className="metrics-grid">
                    <div className="metric-card">
                        <span className="metric-label">{t('agent.performance.errorRate')}</span>
                        <span className={`metric-value ${metrics.errors.errorRate > 25 ? 'error' : ''}`}>
                            {formatPercent(metrics.errors.errorRate)}
                        </span>
                    </div>
                    <div className="metric-card">
                        <span className="metric-label">{t('agent.performance.totalErrors')}</span>
                        <span className="metric-value">{metrics.errors.totalErrors}</span>
                    </div>
                </div>
                {Object.keys(metrics.errors.errorsByType).length > 0 && (
                    <div className="errors-by-type">
                        <h4>{t('agent.performance.errorsByType')}</h4>
                        <ul>
                            {Object.entries(metrics.errors.errorsByType).map(([type, count]) => (
                                <li key={type}>
                                    <span className="error-type">{type}</span>
                                    <span className="error-count">{count}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* Resource Usage */}
            <div className="metrics-section">
                <h3>{t('agent.performance.resources')}</h3>
                <div className="metrics-grid">
                    <div className="metric-card">
                        <span className="metric-label">{t('agent.performance.memoryUsage')}</span>
                        <span className="metric-value">{formatMemory(metrics.resources.memoryUsageMb)}</span>
                        <span className="metric-sublabel">
                            {t('agent.performance.peak')}: {formatMemory(metrics.resources.peakMemoryMb)}
                        </span>
                    </div>
                    <div className="metric-card">
                        <span className="metric-label">{t('agent.performance.cpuUsage')}</span>
                        <span className="metric-value">{formatPercent(metrics.resources.cpuUsagePercent)}</span>
                    </div>
                    <div className="metric-card">
                        <span className="metric-label">{t('agent.performance.apiCalls')}</span>
                        <span className="metric-value">{metrics.resources.apiCallCount}</span>
                    </div>
                    <div className="metric-card">
                        <span className="metric-label">{t('agent.performance.tokensUsed')}</span>
                        <span className="metric-value">{metrics.resources.totalTokensUsed.toLocaleString()}</span>
                    </div>
                    <div className="metric-card">
                        <span className="metric-label">{t('agent.performance.totalCost')}</span>
                        <span className="metric-value">{formatCost(metrics.resources.totalCostUsd)}</span>
                    </div>
                    <div className="metric-card">
                        <span className="metric-label">{t('agent.performance.totalTime')}</span>
                        <span className="metric-value">{formatTime(metrics.resources.totalExecutionTimeMs)}</span>
                    </div>
                </div>
            </div>

            {/* Last Updated */}
            <div className="metrics-footer">
                <span className="last-updated">
                    {t('agent.performance.lastUpdated')}: {new Date(metrics.lastUpdatedAt).toLocaleString()}
                </span>
            </div>
        </div>
    );
};

