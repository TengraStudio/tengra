import { Activity, AlertTriangle, ExternalLink } from 'lucide-react';
import React, { useMemo } from 'react';

import logoBlack from '@/assets/tandem_black.png';
import logoWhite from '@/assets/tandem_white.png';
import { useTheme } from '@/hooks/useTheme';
import { appLogger } from '@/utils/renderer-logger';

interface AboutTabProps {
    onReset: () => void;
    t: (key: string) => string;
}

export const AboutTab: React.FC<AboutTabProps> = ({ onReset, t }) => {
    const { isLight } = useTheme();

    const logo = useMemo(() => {
        return isLight ? logoWhite : logoBlack;
    }, [isLight]);

    return (
        <div className="space-y-6">
            <div className="bg-card p-8 rounded-xl border border-border flex flex-col items-center text-center space-y-6">
                <div className="w-20 h-20 bg-primary/20 rounded-2xl flex items-center justify-center mb-2">
                    <img src={logo} alt={t('app.name')} className="w-12 h-12 opacity-80" />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-foreground tracking-tight">
                        {t('app.name')}
                    </h2>
                    <div className="flex items-center justify-center gap-2 mt-1">
                        <p className="text-sm text-primary font-mono font-bold">v1.2.1-dev</p>
                        <button
                            onClick={() => appLogger.warn('AboutTab', t('about.updateCheckAlert'))}
                            className="bg-primary/10 text-xxs text-primary px-2 py-0.5 rounded hover:bg-primary/20 transition-colors uppercase font-bold tracking-wide"
                        >
                            {t('about.checkUpdates')}
                        </button>
                    </div>
                </div>
                <p className="text-sm text-muted-foreground max-w-md">{t('about.description')}</p>
                <div className="flex gap-3">
                    <button
                        onClick={() =>
                            window.electron.openExternal('https://github.com/agnes0912491/Tandem')
                        }
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/30 hover:bg-muted/50 text-xs font-bold text-muted-foreground hover:text-foreground border border-border/50"
                    >
                        <ExternalLink className="w-3.5 h-3.5" /> {t('about.privacyPolicy')}
                    </button>
                    <button
                        onClick={() =>
                            window.electron.openExternal('https://github.com/agnes0912491/Tandem')
                        }
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/30 hover:bg-muted/50 text-xs font-bold text-muted-foreground hover:text-foreground border border-border/50"
                    >
                        <ExternalLink className="w-3.5 h-3.5" /> {t('about.github')}
                    </button>
                </div>
                <div className="pt-6 border-t border-border/50 w-full">
                    <p className="text-xxs text-muted-foreground/50 uppercase tracking-widest">
                        {t('about.copyright')}
                    </p>
                </div>
            </div>
            <div className="bg-card p-6 rounded-xl border border-border">
                <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" /> {t('advanced.systemInfo')}
                </h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                        <div className="text-xxs text-muted-foreground uppercase tracking-wide">
                            {t('advanced.platform')}
                        </div>
                        <div className="text-sm font-bold text-foreground">
                            {navigator.platform}
                        </div>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                        <div className="text-xxs text-muted-foreground uppercase tracking-wide">
                            {t('about.locale')}
                        </div>
                        <div className="text-sm font-bold text-foreground">
                            {navigator.language}
                        </div>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                        <div className="text-xxs text-muted-foreground uppercase tracking-wide">
                            {t('about.buildSync')}
                        </div>
                        <button
                            onClick={() => window.location.reload()}
                            className="mt-1 text-xxs bg-primary/10 text-primary px-2 py-0.5 rounded hover:bg-primary/20 transition-colors font-bold"
                        >
                            {t('about.forceReload')}
                        </button>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                        <div className="text-xxs text-muted-foreground uppercase tracking-wide">
                            {t('about.sessionStart')}
                        </div>
                        <div className="text-sm font-bold text-success">
                            {new Date().toLocaleTimeString()}
                        </div>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                        <div className="text-xxs text-muted-foreground uppercase tracking-wide">
                            {t('about.buildVersion')}
                        </div>
                        <div className="text-sm font-bold text-primary flex flex-col">
                            <span>v1.2.1-dev</span>
                            <span className="text-xxxs opacity-70 font-mono mt-1">
                                {typeof __BUILD_TIME__ !== 'undefined'
                                    ? new Date(__BUILD_TIME__).toLocaleString()
                                    : t('about.notAvailable')}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
            <div className="bg-card p-6 rounded-xl border border-destructive/20">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-bold text-destructive flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" /> {t('about.factoryReset')}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                            {t('about.factoryResetDesc')}
                        </p>
                    </div>
                    <button
                        onClick={onReset}
                        className="px-4 py-2 rounded-lg text-xs font-bold bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20"
                    >
                        {t('about.factoryReset')}
                    </button>
                </div>
            </div>
        </div>
    );
};
