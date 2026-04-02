import { Badge } from '@renderer/components/ui/badge';
import { Button } from '@renderer/components/ui/button';
import { 
    AlertTriangle, 
    Clock, 
    Cpu, 
    ExternalLink, 
    Globe, 
    RefreshCw, 
    Smartphone, 
    Terminal,
    Zap} from 'lucide-react';
import React, { useMemo } from 'react';

import logoBlack from '@/assets/tengra_black.png';
import logoWhite from '@/assets/tengra_white.png';
import { useTheme } from '@/hooks/useTheme';
import { appLogger } from '@/utils/renderer-logger';

interface AboutTabProps {
    onReset: () => void;
    t: (key: string) => string;
}

declare const __BUILD_TIME__: number;

export const AboutTab: React.FC<AboutTabProps> = ({ onReset, t }) => {
    const { isLight } = useTheme();

    const logo = useMemo(() => {
        return isLight ? logoWhite : logoBlack;
    }, [isLight]);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 ease-out pb-16">
            <div className="flex flex-col items-center space-y-8 rounded-3xl border border-border/30 bg-card p-8 text-center sm:p-10">
                <div className="relative">
                    <div className="relative mb-2 flex h-28 w-28 items-center justify-center rounded-[2rem] border border-border/20 bg-muted/10 sm:h-32 sm:w-32">
                        <img
                            src={logo}
                            alt={t('app.name')}
                            className="h-16 w-16 opacity-90 brightness-110"
                        />
                    </div>
                </div>

                <div className="space-y-4">
                    <h2 className="text-4xl font-semibold leading-none text-foreground sm:text-5xl">
                        {t('app.name')}
                    </h2>
                    <div className="flex flex-wrap items-center justify-center gap-3">
                        <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/10 px-4 py-1.5 text-[11px] font-medium text-primary">
                            v1.2.1-dev
                        </Badge>
                        <button
                            onClick={() => appLogger.warn('AboutTab', t('about.updateCheckAlert'))}
                            className="h-8 rounded-full border border-border/20 px-5 text-[10px] font-medium text-muted-foreground/60 hover:bg-muted/10 hover:text-foreground"
                        >
                            {t('about.checkUpdates')}
                        </button>
                    </div>
                </div>

                <p className="max-w-lg text-sm leading-relaxed text-muted-foreground/70">
                    {t('about.description')}
                </p>

                <div className="grid w-full max-w-md grid-cols-1 gap-4 sm:grid-cols-2">
                    <Button
                        variant="outline"
                        onClick={() =>
                            window.electron.openExternal('https://github.com/agnes0912491/Tengra')
                        }
                        className="group/btn h-12 rounded-2xl border-border/30 bg-background text-[10px] font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                    >
                        <ExternalLink className="mr-3 h-4 w-4" />
                        {t('about.privacyPolicy')}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() =>
                            window.electron.openExternal('https://github.com/agnes0912491/Tengra')
                        }
                        className="group/btn h-12 rounded-2xl border-border/30 bg-background text-[10px] font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                    >
                        <Globe className="mr-3 h-4 w-4" />
                        {t('about.github')}
                    </Button>
                </div>

                <div className="mt-2 w-full border-t border-border/10 px-6 pt-8 opacity-60 sm:px-12">
                    <p className="mb-1 text-[10px] font-medium text-muted-foreground">
                        {t('about.copyright')}
                    </p>
                    <div className="mt-2 flex items-center justify-center gap-2 text-[9px] font-medium text-muted-foreground/60">
                        <Terminal className="w-2.5 h-2.5" />
                        <span>{t('about.kernelRevision')}</span>
                    </div>
                </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-border/30 bg-card p-6 sm:p-8">
                <div className="relative z-10 flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <Cpu className="w-4 h-4 text-primary" />
                        <h4 className="text-[10px] font-medium text-muted-foreground/60">{t('about.systemTelemetry')}</h4>
                    </div>
                    <Badge variant="outline" className="h-5 border-primary/20 px-2 text-[9px] font-medium text-primary">{t('about.nativeDiagnostics')}</Badge>
                </div>

                <div className="relative z-10 mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    <div className="rounded-[2rem] border border-border/20 bg-muted/5 p-5 transition-colors hover:bg-muted/10">
                        <div className="flex items-center gap-2 mb-4">
                            <Smartphone className="w-3.5 h-3.5 text-primary/60" />
                            <div className="text-[9px] font-medium text-muted-foreground/60">
                                {t('advanced.platform')}
                            </div>
                        </div>
                        <div className="text-sm font-bold text-foreground truncate">
                            {navigator.platform}
                        </div>
                    </div>

                    <div className="rounded-[2rem] border border-border/20 bg-muted/5 p-5 transition-colors hover:bg-muted/10">
                        <div className="flex items-center gap-2 mb-4">
                            <Globe className="w-3.5 h-3.5 text-primary/60" />
                            <div className="text-[9px] font-medium text-muted-foreground/60">
                                {t('about.locale')}
                            </div>
                        </div>
                        <div className="text-sm font-bold text-foreground">
                            {navigator.language}
                        </div>
                    </div>

                    <div className="rounded-[2rem] border border-border/20 bg-muted/5 p-5 transition-colors hover:bg-muted/10">
                        <div className="flex items-center gap-2 mb-4">
                            <RefreshCw className="w-3.5 h-3.5 text-primary/60" />
                            <div className="text-[9px] font-medium text-muted-foreground/60">
                                {t('about.buildSync')}
                            </div>
                        </div>
                        <button
                            onClick={() => window.location.reload()}
                            className="group/reload flex h-10 w-full items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-[10px] font-medium text-primary hover:bg-primary/20"
                        >
                            <RefreshCw className="mr-3 h-3.5 w-3.5" />
                            {t('about.forceReload')}
                        </button>
                    </div>

                    <div className="rounded-[2rem] border border-border/20 bg-muted/5 p-5 transition-colors hover:bg-muted/10">
                        <div className="flex items-center gap-2 mb-4">
                            <Clock className="w-3.5 h-3.5 text-primary/60" />
                            <div className="text-[9px] font-medium text-muted-foreground/60">
                                {t('about.sessionStart')}
                            </div>
                        </div>
                        <div className="flex items-center gap-3 text-sm font-medium text-foreground">
                            <div className="relative">
                                <div className="absolute inset-0 bg-primary/40 rounded-full blur-sm animate-pulse" />
                                <div className="relative w-2 h-2 rounded-full bg-primary" />
                            </div>
                            {new Date().toLocaleTimeString()}
                        </div>
                    </div>

                    <div className="flex flex-col justify-between gap-4 rounded-[2rem] border border-border/20 bg-muted/5 p-5 transition-colors hover:bg-muted/10 sm:col-span-2 md:flex-row md:items-center">
                         <div className="flex flex-col gap-4">
                            <div className="flex items-center gap-2">
                                <Zap className="w-3.5 h-3.5 text-primary/60" />
                                <div className="text-[9px] font-medium text-muted-foreground/60">
                                    {t('about.buildVersion')}
                                </div>
                            </div>
                             <div className="text-sm font-medium text-primary">
                                v1.2.1-RELEASE-DEV
                            </div>
                        </div>
                        <Badge variant="outline" className="rounded-xl border-border/20 bg-background/50 px-4 py-2 font-mono text-[10px] font-medium text-muted-foreground">
                            {typeof __BUILD_TIME__ !== 'undefined'
                                ? new Date(__BUILD_TIME__).toLocaleString()
                                : t('about.notAvailable')}
                        </Badge>
                    </div>
                </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-destructive/20 bg-destructive/5 p-6 transition-colors hover:bg-destructive/10 sm:p-8">
                <div className="relative z-10 flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
                    <div className="text-center md:text-left space-y-4 max-w-xl">
                        <div className="flex items-center gap-4">
                            <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-2.5 text-destructive">
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                            <h3 className="text-xl font-semibold text-destructive">
                                {t('about.factoryReset')}
                            </h3>
                        </div>
                        <p className="text-sm leading-relaxed text-muted-foreground/70">
                            {t('about.factoryResetDesc')}
                        </p>
                    </div>
                    <Button
                        variant="destructive"
                        onClick={onReset}
                        className="h-12 rounded-2xl px-8 text-[11px] font-medium"
                    >
                        <RefreshCw className="w-4 h-4 mr-3" />
                        {t('about.executeWipe')}
                    </Button>
                </div>
            </div>
        </div>
    );
};


