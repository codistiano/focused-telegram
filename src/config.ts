import fs from 'fs';

const CONFIG_PATH = 'config.json';

export interface WhitelistedItem {
  id: number | string;
  name: string;
  type: 'chat' | 'channel' | 'group' | 'folder';
  username?: string;
}

export interface Config {
  whitelisted: WhitelistedItem[];
}

export function loadConfig(): Config {
  if (!fs.existsSync(CONFIG_PATH)) {
    const defaultConfig: Config = { whitelisted: [] };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
}

export function saveConfig(config: Config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}
