import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const apiId = parseInt(process.env.API_ID || '0');
const apiHash = process.env.API_HASH || '';

const SESSION_DIR = path.join(__dirname, '../session');
const SESSION_PATH = path.join(SESSION_DIR, 'session.string');

let stringSession = new StringSession(
  fs.existsSync(SESSION_PATH) ? fs.readFileSync(SESSION_PATH, 'utf8') : ''
);

export let client: TelegramClient | null = null;

export async function initClient() {
  if (!apiId || !apiHash) {
    throw new Error('❌ Set API_ID and API_HASH in .env');
  }

  client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  console.log('🔄 Connecting to Telegram...');

  await client.start({
    phoneNumber: async () => {
      // This will be called by GramJS — we'll handle input in console for now
      return new Promise((resolve) => {
        process.stdout.write('📱 Enter your phone number (+2519XXXXXXXXXX): ');
        process.stdin.once('data', (data) => {
          resolve(data.toString().trim());
        });
      });
    },
    phoneCode: async () => {
      return new Promise((resolve) => {
        process.stdout.write('🔢 Enter the code sent to your Telegram app: ');
        process.stdin.once('data', (data) => {
          resolve(data.toString().trim());
        });
      });
    },
    password: async () => {
      return new Promise((resolve) => {
        process.stdout.write('🔑 Enter your 2FA password: ');
        process.stdin.once('data', (data) => {
          resolve(data.toString().trim());
        });
      });
    },
    onError: (err) => console.error('Telegram error:', err),
  });

  const sessionString = client.session.save() as unknown as string;
  fs.mkdirSync(SESSION_DIR, { recursive: true });
  fs.writeFileSync(SESSION_PATH, sessionString);

  console.log('✅ Logged in successfully! Session saved.');
  return client;
}

export async function getAllDialogs() {
  if (!client) throw new Error('Client not initialized');

  const dialogs = await client.getDialogs({ limit: 200 });
  return dialogs.map(dialog => ({
    id: dialog.id,
    name: dialog.name || 'Unnamed',
    type: dialog.isChannel ? 'channel' : dialog.isGroup ? 'group' : 'chat',
    username: (dialog.entity as any)?.username || undefined,
    unreadCount: dialog.unreadCount || 0,
  }));
}

export async function getAllAvailableDialogs() {
  if (!client) throw new Error('Client not initialized');

  // Get ALL dialogs (chats, groups, channels, users)
  const dialogs = await client.getDialogs({ 
    limit: 300, 
    // folderId: undefined  → gets everything by default
  });

  return dialogs.map(dialog => ({
    id: dialog.id,
    name: dialog.name || (dialog.entity as any)?.username || 'Unnamed',
    type: dialog.isChannel ? 'channel' : dialog.isGroup ? 'group' : dialog.isUser ? 'chat' : 'unknown',
    username: (dialog.entity as any)?.username || undefined,
    unreadCount: dialog.unreadCount || 0,
  }));
}