export const formatSize = (bytes: number) => {
    if (bytes === 0) { return '0 B'; }
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const parsePulls = (pulls?: string): number => {
    if (!pulls) { return 0; }
    const str = pulls.toUpperCase().replace(/\s+PULLS/i, '').trim();
    const num = parseFloat(str);
    if (isNaN(num)) { return 0; }
    if (str.endsWith('M')) { return num * 1000000; }
    if (str.endsWith('K')) { return num * 1000; }
    if (str.endsWith('B')) { return num * 1000000000; }
    return num;
};
