import { JsonValue } from '@shared/types/common';
import { RefreshCw, Save } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

/** Schema field descriptor for a plugin config option */
interface PluginConfigField {
    type: 'string' | 'number' | 'boolean' | 'select';
    label?: string;
    description?: string;
    default?: JsonValue;
    required?: boolean;
    options?: string[];
}

interface PluginConfigPanelProps {
    pluginName: string;
    schema: Record<string, PluginConfigField> | null;
    values: Record<string, JsonValue>;
    onSave: (values: Record<string, JsonValue>) => Promise<{ success: boolean }>;
    onReload?: () => Promise<{ success: boolean; error?: string }>;
}

/** Render a single config field based on its type */
const ConfigField: React.FC<{
    fieldKey: string;
    field: PluginConfigField;
    value: JsonValue;
    onChange: (key: string, value: JsonValue) => void;
}> = ({ fieldKey, field, value, onChange }) => {
    const { t } = useTranslation();
    const label = field.label ?? fieldKey;

    if (field.type === 'boolean') {
        return (
            <label className="flex items-center gap-2 py-2">
                <input
                    type="checkbox"
                    checked={value === true}
                    onChange={(e) => onChange(fieldKey, e.target.checked)}
                    className="rounded border-border"
                />
                <span className="text-sm font-medium text-foreground">{label}</span>
                {field.description && (
                    <span className="text-xs text-muted-foreground">{field.description}</span>
                )}
            </label>
        );
    }

    if (field.type === 'select' && field.options) {
        return (
            <div className="flex flex-col gap-1 py-2">
                <label className="text-sm font-medium text-foreground">{label}</label>
                {field.description && (
                    <span className="text-xs text-muted-foreground">{field.description}</span>
                )}
                <select
                    value={String(value ?? '')}
                    onChange={(e) => onChange(fieldKey, e.target.value)}
                    className="rounded border border-border bg-background px-2 py-1 text-sm"
                >
                    {field.options.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                    ))}
                </select>
            </div>
        );
    }

    if (field.type === 'number') {
        return (
            <div className="flex flex-col gap-1 py-2">
                <label className="text-sm font-medium text-foreground">{label}</label>
                {field.description && (
                    <span className="text-xs text-muted-foreground">{field.description}</span>
                )}
                <input
                    type="number"
                    value={typeof value === 'number' ? value : ''}
                    onChange={(e) => onChange(fieldKey, Number(e.target.value))}
                    className="rounded border border-border bg-background px-2 py-1 text-sm"
                />
            </div>
        );
    }

    // Default: string
    return (
        <div className="flex flex-col gap-1 py-2">
            <label className="text-sm font-medium text-foreground">{label}</label>
            {field.description && (
                <span className="text-xs text-muted-foreground">{field.description}</span>
            )}
            <input
                type="text"
                value={String(value ?? '')}
                onChange={(e) => onChange(fieldKey, e.target.value)}
                placeholder={String(field.default ?? '')}
                className="rounded border border-border bg-background px-2 py-1 text-sm"
            />
            {field.required && !value && (
                <span className="text-xs text-destructive">{t('mcp.pluginConfig.fieldRequired')}</span>
            )}
        </div>
    );
};

/**
 * Per-plugin configuration panel.
 * Renders form fields from plugin's declared config schema and saves via IPC.
 */
export const PluginConfigPanel: React.FC<PluginConfigPanelProps> = ({
    pluginName,
    schema,
    values: initialValues,
    onSave,
    onReload,
}) => {
    const { t } = useTranslation();
    const [formValues, setFormValues] = useState<Record<string, JsonValue>>(initialValues);
    const [saving, setSaving] = useState(false);
    const [reloading, setReloading] = useState(false);
    const [status, setStatus] = useState<string | null>(null);

    const fields = useMemo(() => {
        if (!schema) { return []; }
        return Object.entries(schema) as Array<[string, PluginConfigField]>;
    }, [schema]);

    const handleChange = useCallback((key: string, value: JsonValue) => {
        setFormValues((prev) => ({ ...prev, [key]: value }));
        setStatus(null);
    }, []);

    const handleSave = useCallback(async () => {
        setSaving(true);
        setStatus(null);
        try {
            const result = await onSave(formValues);
            setStatus(result.success ? t('mcp.pluginConfig.saved') : t('mcp.pluginConfig.error'));
        } catch {
            setStatus(t('mcp.pluginConfig.error'));
        } finally {
            setSaving(false);
        }
    }, [formValues, onSave, t]);

    const handleReload = useCallback(async () => {
        if (!onReload) { return; }
        setReloading(true);
        setStatus(null);
        try {
            const result = await onReload();
            setStatus(result.success ? t('mcp.pluginConfig.reloaded') : (result.error ?? t('mcp.pluginConfig.error')));
        } catch {
            setStatus(t('mcp.pluginConfig.error'));
        } finally {
            setReloading(false);
        }
    }, [onReload, t]);

    return (
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-foreground">
                    {t('mcp.pluginConfig.title')} — {pluginName}
                </h3>
                {onReload && (
                    <button
                        onClick={() => void handleReload()}
                        disabled={reloading}
                        className={cn(
                            'flex items-center gap-1.5 rounded px-3 py-1.5 text-sm',
                            'bg-secondary text-secondary-foreground hover:bg-secondary/80',
                            'disabled:opacity-50'
                        )}
                    >
                        <RefreshCw className={cn('h-3.5 w-3.5', reloading && 'animate-spin')} />
                        {reloading ? t('mcp.pluginConfig.reloading') : t('mcp.pluginConfig.reload')}
                    </button>
                )}
            </div>

            {fields.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('mcp.pluginConfig.noSchema')}</p>
            ) : (
                <div className="flex flex-col divide-y divide-border">
                    {fields.map(([key, field]) => (
                        <ConfigField
                            key={key}
                            fieldKey={key}
                            field={field}
                            value={formValues[key] ?? field.default ?? ''}
                            onChange={handleChange}
                        />
                    ))}
                </div>
            )}

            {fields.length > 0 && (
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => void handleSave()}
                        disabled={saving}
                        className={cn(
                            'flex items-center gap-1.5 rounded px-4 py-2 text-sm font-medium',
                            'bg-primary text-primary-foreground hover:bg-primary/90',
                            'disabled:opacity-50'
                        )}
                    >
                        <Save className="h-3.5 w-3.5" />
                        {saving ? t('mcp.pluginConfig.saving') : t('mcp.pluginConfig.save')}
                    </button>
                    {status && (
                        <span className="text-sm text-muted-foreground">{status}</span>
                    )}
                </div>
            )}
        </div>
    );
};
