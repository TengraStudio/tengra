/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

function normalizeCssVariableName(name: string): string {
    return name.startsWith('--') ? name : `--${name}`;
}

type ResolvableStyleProperty =
    | 'backgroundColor'
    | 'borderRadius'
    | 'boxShadow'
    | 'color'
    | 'fontFamily'
    | 'padding';

function canResolveCssValues(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function resolveCssStyleValue(
    property: ResolvableStyleProperty,
    value: string,
    fallback: string
): string {
    if (!canResolveCssValues()) {
        return fallback;
    }

    const host = document.body ?? document.documentElement;
    const probe = document.createElement('div');

    probe.style.position = 'absolute';
    probe.style.opacity = '0';
    probe.style.pointerEvents = 'none';
    probe.style[property] = fallback;
    probe.style[property] = value;

    host.appendChild(probe);
    const resolved = window.getComputedStyle(probe)[property];
    probe.remove();

    return typeof resolved === 'string' && resolved.trim().length > 0 ? resolved.trim() : fallback;
}

function normalizeHexColor(value: string): string | null {
    const match = value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!match) {
        return null;
    }

    const [, hex] = match;
    if (hex.length === 6) {
        return `#${hex.toLowerCase()}`;
    }

    return `#${hex
        .split('')
        .map(char => `${char}${char}`)
        .join('')
        .toLowerCase()}`;
}

function rgbStringToHex(value: string): string | null {
    const match = value
        .trim()
        .match(/^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})(?:[\s,/]+[\d.]+)?\s*\)$/i);

    if (!match) {
        return null;
    }

    const toHex = (channel: string): string =>
        Math.max(0, Math.min(255, Number(channel))).toString(16).padStart(2, '0');

    return `#${toHex(match[1])}${toHex(match[2])}${toHex(match[3])}`;
}

export function getRootCssVariable(name: string): string | null {
    if (!canResolveCssValues()) {
        return null;
    }

    const value = window
        .getComputedStyle(document.documentElement)
        .getPropertyValue(normalizeCssVariableName(name))
        .trim();

    return value.length > 0 ? value : null;
}

export function resolveCssVariableValue(name: string, fallback: string): string {
    return getRootCssVariable(name) ?? fallback;
}

export function resolveCssColorVariable(name: string, fallback: string): string {
    const token = getRootCssVariable(name);
    if (!token) {
        return fallback;
    }

    if (/^[-+]?\d/.test(token)) {
        return resolveCssColorValue(`hsl(var(${normalizeCssVariableName(name)}))`, fallback);
    }

    return resolveCssColorValue(`var(${normalizeCssVariableName(name)})`, fallback);
}

export function resolveCssColorValue(value: string, fallback: string): string {
    return resolveCssStyleValue('color', value, fallback);
}

export function resolveCssColorValueAsHex(value: string, fallback: string): string {
    const directHex = normalizeHexColor(value);
    if (directHex) {
        return directHex;
    }

    const resolved = resolveCssColorValue(value, fallback);
    if (normalizeHexColor(resolved)) {
        return normalizeHexColor(resolved) ?? resolved;
    }

    if (rgbStringToHex(resolved)) {
        return rgbStringToHex(resolved) ?? resolved;
    }

    const fallbackResolved = normalizeHexColor(fallback)
        ?? rgbStringToHex(fallback)
        ?? normalizeHexColor(resolveCssColorValue(fallback, 'black'))
        ?? rgbStringToHex(resolveCssColorValue(fallback, 'black'))
        ?? rgbStringToHex(resolveCssColorValue('black', 'black'))
        ?? 'black';

    return fallbackResolved;
}

export function resolveCssVariableStyle(
    property: ResolvableStyleProperty,
    name: string,
    fallback: string
): string {
    return resolveCssStyleValue(property, `var(${normalizeCssVariableName(name)})`, fallback);
}
