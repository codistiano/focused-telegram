import fs from 'fs';
import path from 'path';

const CONFIG_PATH = 'config.json';
const DEFAULT_DOWNLOAD_DIRECTORY = path.resolve(process.cwd(), 'downloads');

export interface WhitelistedItem {
  id: string;
  name: string;
  type: 'chat' | 'channel' | 'group' | 'folder';
  username?: string;
}

export interface Config {
  whitelisted: WhitelistedItem[];
  downloadDirectory: string;
}

export function loadConfig(): Config {
  if (!fs.existsSync(CONFIG_PATH)) {
    const defaultConfig: Config = { whitelisted: [], downloadDirectory: DEFAULT_DOWNLOAD_DIRECTORY };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
  }

  const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) as Partial<Config>;
  return {
    whitelisted: (raw.whitelisted || []).map((item) => ({ ...item, id: String(item.id) })),
    downloadDirectory: raw.downloadDirectory || DEFAULT_DOWNLOAD_DIRECTORY,
  };
}

export function saveConfig(config: Config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}
