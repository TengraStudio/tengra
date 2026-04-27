/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import path from 'path';

import { app, BrowserWindow, nativeImage } from 'electron';

let splashWindow: BrowserWindow | null = null;

function getSplashIconPath(): string {
    return app.isPackaged
        ? path.join(process.resourcesPath, 'icon.ico')
        : path.join(__dirname, '../../resources/icon.ico');
}

function getSplashHtml(): string {
    return `
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Tengra</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #0c0d10;
      --accent: #3b82f6;
      --fg: #f8fafc;
      --muted: #94a3b8;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      width: 100%;
      height: 100%;
      background: var(--bg);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: var(--fg);
      overflow: hidden;
    }
    .wrap {
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 20px;
      user-select: none;
    }
    .brand {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: 0.25em;
      text-transform: uppercase;
      background: linear-gradient(135deg, #fff 0%, #94a3b8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .subtitle {
      font-size: 11px;
      font-weight: 600;
      color: var(--muted);
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
    .progress {
      width: 200px;
      height: 2px;
      border-radius: 999px;
      overflow: hidden;
      background: rgba(255, 255, 255, 0.05);
    }
    .bar {
      width: 40%;
      height: 100%;
      background: var(--accent);
      box-shadow: 0 0 15px var(--accent);
      animation: slide 1.5s cubic-bezier(0.65, 0, 0.35, 1) infinite;
    }
    @keyframes slide {
      0% { transform: translateX(-150%); }
      100% { transform: translateX(250%); }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="brand">TENGRA</div>
    <div class="subtitle">Initializing Services</div>
    <div class="progress"><div class="bar"></div></div>
  </div>
</body>
</html>`;
}

export function shouldShowSplashWindow(): boolean {
    const hiddenByArg = process.argv.includes('--hidden') || process.argv.includes('/hidden');
    const openedAtLogin = process.platform === 'win32' ? app.getLoginItemSettings().wasOpenedAtLogin : false;
    return !hiddenByArg && !openedAtLogin;
}

export function showSplashWindow(): BrowserWindow {
    if (splashWindow && !splashWindow.isDestroyed()) {
        return splashWindow;
    }

    const splash = new BrowserWindow({
        width: 430,
        height: 270,
        show: false,
        frame: false,
        resizable: false,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        skipTaskbar: true,
        autoHideMenuBar: true,
        alwaysOnTop: true,
        center: true,
        backgroundColor: '#0c0d10',
        icon: nativeImage.createFromPath(getSplashIconPath()),
        webPreferences: {
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    splash.once('ready-to-show', () => {
        if (!splash.isDestroyed()) {
            splash.show();
        }
    });

    splash.on('closed', () => {
        splashWindow = null;
    });

    void splash.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(getSplashHtml())}`);
 
    splashWindow = splash;
    return splash;
}

export function closeSplashWindow(): void {
    if (!splashWindow || splashWindow.isDestroyed()) {
        splashWindow = null;
        return;
    }
    splashWindow.close();
    splashWindow = null;
}
