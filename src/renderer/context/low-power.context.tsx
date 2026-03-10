import React, { createContext, useContext, useEffect, useState } from 'react';

interface LowPowerContextType {
    isLowPowerMode: boolean;
}

const LowPowerContext = createContext<LowPowerContextType>({ isLowPowerMode: false });

export const LowPowerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isLowPowerMode, setIsLowPowerMode] = useState(false);

    useEffect(() => {
        const handler = (_event: Electron.IpcRendererEvent, state: { lowPowerMode: boolean }) => {
            setIsLowPowerMode(state.lowPowerMode);
        };

        if (window.electron?.ipcRenderer) {
            window.electron.ipcRenderer.on('power:state-changed', handler);
        }

        return () => {
            if (window.electron?.ipcRenderer) {
                window.electron.ipcRenderer.off('power:state-changed', handler);
            }
        };
    }, []);

    return (
        <LowPowerContext.Provider value={{ isLowPowerMode }}>
            {children}
        </LowPowerContext.Provider>
    );
};

export const useLowPowerMode = () => useContext(LowPowerContext);
