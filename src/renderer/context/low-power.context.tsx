/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';

interface LowPowerContextType {
    isLowPowerMode: boolean;
}

const LowPowerContext = createContext<LowPowerContextType>({ isLowPowerMode: false });

export const LowPowerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isLowPowerMode, setIsLowPowerMode] = useState(false);

    useEffect(() => {
        return window.electron.power.onStateChanged((state) => {
            setIsLowPowerMode(state.lowPowerMode);
        });
    }, []);

    return (
        <LowPowerContext.Provider value={{ isLowPowerMode }}>
            {children}
        </LowPowerContext.Provider>
    );
};

export const useLowPowerMode = () => useContext(LowPowerContext);

