/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export const formatNumber = (num: number): string => {
    if (typeof num !== 'number' || isNaN(num)) { return '0'; }
    if (num >= 1000000) { return (num / 1000000).toFixed(1) + 'M'; }
    if (num >= 1000) { return (num / 1000).toFixed(1) + 'K'; }
    return num.toLocaleString();
};

export const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) { return `${days}d ${hours % 24}h`; }
    if (hours > 0) { return `${hours}h ${minutes % 60}m`; }
    if (minutes > 0) { return `${minutes}m ${seconds % 60}s`; }
    return `${seconds}s`;
};

export const formatReset = (value?: string, locale: string = 'en-US'): string => {
    if (!value || value === '-') { return '-'; }
    try {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) { return String(value); }
        return date.toLocaleString(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch {
        return value;
    }
};
