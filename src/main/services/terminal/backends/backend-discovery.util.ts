import { execFile } from 'child_process';
import { constants as fsConstants, promises as fs } from 'fs';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export async function findExecutableInPath(executableName: string): Promise<string | null> {
    const locator = process.platform === 'win32' ? 'where' : 'which';

    try {
        const { stdout } = await execFileAsync(locator, [executableName], {
            windowsHide: true,
        });
        const candidates = stdout
            .split(/\r?\n/)
            .map(candidate => candidate.trim())
            .filter(candidate => candidate.length > 0);
        return candidates[0] ?? null;
    } catch {
        return null;
    }
}

export async function pathExists(candidatePath: string): Promise<boolean> {
    try {
        await fs.access(candidatePath, fsConstants.F_OK);
        return true;
    } catch {
        return false;
    }
}

export async function findFirstExistingPath(
    candidatePaths: readonly string[]
): Promise<string | null> {
    for (const candidatePath of candidatePaths) {
        if (await pathExists(candidatePath)) {
            return candidatePath;
        }
    }
    return null;
}
