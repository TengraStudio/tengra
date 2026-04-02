import React from 'react';

import './command-footer.css';

interface CommandFooterProps {
    t: (key: string) => string;
}

export const CommandFooter: React.FC<CommandFooterProps> = ({ t }) => {
    return (
        <div className="tengra-command-footer">
            <span className="tengra-command-footer__item">{t('commandPalette.navigate')}</span>
            <span className="tengra-command-footer__item">
                <kbd className="tengra-command-footer__kbd">↵</kbd>
                {t('commandPalette.select')}
            </span>
            <span className="tengra-command-footer__item">
                <kbd className="tengra-command-footer__kbd">{t('common.escKey')}</kbd>
                {t('commandPalette.close')}
            </span>
            <div className="tengra-command-footer__right">
                <span>{t('commandPalette.engineLabel')}</span>
                <div className="tengra-command-footer__pulse" />
            </div>
        </div>
    );
};

CommandFooter.displayName = 'CommandFooter';
