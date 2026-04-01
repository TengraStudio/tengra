import { buildActions, McpDeps } from '@main/mcp/server-utils';
import { McpService } from '@main/mcp/types';

export function buildCoreServers(deps: McpDeps): McpService[] {
    return [
        {
            name: 'filesystem',
            description: 'Dosya okuma, yazma, listeleme ve yönetim araçları (zip, indirme vb. dahil)',
            actions: buildActions([
                { name: 'read', description: 'Dosya içeriğini metin olarak okur', handler: ({ path }) => deps.filesystem.readFile(path as string) },
                { name: 'write', description: 'Dosyaya metin yazar veya günceller', handler: ({ path, content }) => deps.filesystem.writeFile(path as string, content as string) },
                { name: 'list', description: 'Dizin içeriğini listeler', handler: ({ path }) => deps.filesystem.listDirectory(path as string) },
                { name: 'extractStrings', description: 'Dosyadaki okunabilir karakterleri ayıklar', handler: ({ path, minLength }) => deps.file.extractStrings(path as string, minLength as number) },
                { name: 'unzip', description: 'Zip arşivini dışarı çıkarır', handler: ({ zipPath, destPath }) => deps.file.unzip(zipPath as string, destPath as string) },
                { name: 'download', description: 'İnternet üzerinden dosya indirir', handler: ({ url, destPath }) => deps.file.downloadFile(url as string, destPath as string) }
            ], 'filesystem', deps.auditLog)
        },
        {
            name: 'command',
            description: 'Güvenlik kontrolleri ile yerel komut çalıştırma sistemi',
            actions: buildActions([
                { name: 'run', description: 'Terminal komutu çalıştırır', handler: ({ command, cwd }) => deps.command.executeCommand(command as string, { cwd: cwd as string }) },
                { name: 'kill', description: 'Çalışan bir süreci durdurur', handler: ({ id }) => Promise.resolve({ success: deps.command.killCommand(id as string) }) }
            ], 'command', deps.auditLog)
        },
        {
            name: 'system',
            description: 'Donanım kaynakları, CPU/bellek kullanımı ve sistem durumu izleme araçları',
            actions: buildActions([
                { name: 'diskSpace', description: 'Disk kapasite bilgilerini getirir', handler: () => deps.system.getDiskSpace() },
                { name: 'processOnPort', description: 'Bir portu kullanan işlemi tespit eder', handler: ({ port }) => deps.system.getProcessOnPort(Number(port)) },
                { name: 'usage', description: 'CPU ve bellek kullanım verilerini getirir', handler: () => deps.system.getUsage() }
            ], 'system', deps.auditLog)
        }
    ];
}
