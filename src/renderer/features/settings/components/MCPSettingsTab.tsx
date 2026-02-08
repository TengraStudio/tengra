import { MCPServersTab } from '@renderer/features/settings/components/MCPServersTab';

import { useTranslation } from '@/i18n';

export const MCPSettingsTab = () => {
    const { t } = useTranslation();

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border/40">
                <h1 className="text-xl font-bold">{t('settings.mcp.title')}</h1>
                <p className="text-sm text-muted-foreground">{t('settings.mcp.subtitle')}</p>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
                <MCPServersTab />
            </div>
        </div>
    );
};
