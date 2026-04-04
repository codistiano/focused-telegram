import fs from 'fs';

const CONFIG_PATH = 'config.json';

export interface WhitelistedItem {
  id: string;
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

  const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) as Config;
  return {
    whitelisted: (raw.whitelisted || []).map((item) => ({ ...item, id: String(item.id) })),
  };
}

export function saveConfig(config: Config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}
