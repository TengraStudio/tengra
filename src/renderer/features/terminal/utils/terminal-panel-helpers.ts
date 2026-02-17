export function buildFormattedClipboardHtml(selectedText: string): string {
    const escaped = selectedText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    return `<pre style="font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace; font-size: 13px; background: #1e1e1e; color: #d4d4d4; padding: 8px; border-radius: 4px; overflow-x: auto;">${escaped}</pre>`;
}

export function summarizePasteText(text: string, hasAnsi: boolean): string {
    const lineCount = text.split(/\r?\n/).length;
    const charCount = text.length;
    const hasSpecialChars = Array.from(text).some(c => {
        const code = c.charCodeAt(0);
        return (code >= 0 && code <= 31) || code === 127;
    });
    const preview = text.slice(0, 500);

    return [
        `Paste Test Results:`,
        `• ${lineCount} line(s)`,
        `• ${charCount} character(s)`,
        `• Special characters: ${hasSpecialChars ? 'Yes' : 'No'}`,
        `• ANSI codes: ${hasAnsi ? 'Yes' : 'No'}`,
        '',
        'Preview:',
        preview + (text.length > 500 ? '...' : ''),
    ].join('\n');
}
