import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const sanitizeSegment = (value: string): string =>
  value
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'unknown';

const ensureParentDir = (targetPath: string) => {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
};

export const buildDocumentPath = (baseDirectory: string, chatName: string, messageId: number, fileName: string): string => {
  const safeChat = sanitizeSegment(chatName);
  const safeFile = sanitizeSegment(fileName);
  return path.join(path.resolve(baseDirectory), safeChat, `${messageId}-${safeFile}`);
};

export const fileExists = (targetPath: string): boolean => fs.existsSync(targetPath);

export const prepareDownloadPath = (baseDirectory: string, chatName: string, messageId: number, fileName: string): string => {
  const targetPath = buildDocumentPath(baseDirectory, chatName, messageId, fileName);
  ensureParentDir(targetPath);
  return targetPath;
};

export const openLocalFile = async (targetPath: string): Promise<void> => {
  const command =
    process.platform === 'darwin'
      ? ['open', targetPath]
      : process.platform === 'win32'
        ? ['cmd', '/c', 'start', '', targetPath]
        : ['xdg-open', targetPath];

  await new Promise<void>((resolve, reject) => {
    const child = spawn(command[0], command.slice(1), {
      detached: true,
      stdio: 'ignore',
    });

    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
};

export const openExternalTarget = async (target: string): Promise<void> => openLocalFile(target);
