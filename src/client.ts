import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const apiId = parseInt(process.env.API_ID || '0', 10);
const apiHash = process.env.API_HASH || '';

const SESSION_DIR = path.join(__dirname, '../session');
const SESSION_PATH = path.join(SESSION_DIR, 'session.string');

const stringSession = new StringSession(
  fs.existsSync(SESSION_PATH) ? fs.readFileSync(SESSION_PATH, 'utf8') : ''
);

export type DialogType = 'chat' | 'channel' | 'group';

export interface DialogSummary {
  id: string;
  name: string;
  type: DialogType;
  username?: string;
  unreadCount: number;
  folderId?: number;
  archived: boolean;
  isBot: boolean;
  isContact: boolean;
}

export interface FolderSummary {
  id: number;
  title: string;
  contacts?: boolean;
  nonContacts?: boolean;
  groups?: boolean;
  broadcasts?: boolean;
  bots?: boolean;
  excludeMuted?: boolean;
  excludeRead?: boolean;
  excludeArchived?: boolean;
  includePeerIds: string[];
  pinnedPeerIds: string[];
  excludePeerIds: string[];
}

export interface MessageSummary {
  id: number;
  date: Date;
  sender: string;
  text: string;
  hasMedia: boolean;
  mediaKind?: string;
  outgoing: boolean;
}

export interface SendCapability {
  canSend: boolean;
  reason?: string;
}

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
    phoneNumber: async () =>
      new Promise((resolve) => {
        process.stdout.write('📱 Enter your phone number (+1XXXXXXXXXXXXX): ');
        process.stdin.once('data', (data) => resolve(data.toString().trim()));
      }),
    phoneCode: async () =>
      new Promise((resolve) => {
        process.stdout.write('🔢 Enter the code sent to your Telegram app: ');
        process.stdin.once('data', (data) => resolve(data.toString().trim()));
      }),
    password: async () =>
      new Promise((resolve) => {
        process.stdout.write('🔑 Enter your 2FA password: ');
        process.stdin.once('data', (data) => resolve(data.toString().trim()));
      }),
    onError: (err) => console.error('Telegram error:', err),
  });

  const savedSession = client.session.save();
  fs.mkdirSync(SESSION_DIR, { recursive: true });
  fs.writeFileSync(SESSION_PATH, typeof savedSession === 'string' ? savedSession : '');

  console.log('✅ Logged in successfully! Session saved.');
  return client;
}

function ensureClient(): TelegramClient {
  if (!client) throw new Error('Client not initialized');
  return client;
}

function mapDialogSummary(dialog: any): DialogSummary {
  return {
    id: String(dialog.id ?? ''),
    name: dialog.name || 'Unnamed',
    type: dialog.isChannel ? 'channel' : dialog.isGroup ? 'group' : 'chat',
    username: dialog.entity?.username,
    unreadCount: dialog.unreadCount || 0,
    folderId: dialog.folderId,
    archived: Boolean(dialog.archived ?? dialog.folderId !== undefined),
    isBot: Boolean(dialog.entity?.bot),
    isContact: Boolean(dialog.entity?.contact),
  };
}

export async function getAllDialogs(): Promise<DialogSummary[]> {
  const tg = ensureClient();
  const dialogs = await tg.getDialogs({ limit: 300 });

  return dialogs.map((dialog) => mapDialogSummary(dialog));
}

export async function getDialogFolders(): Promise<FolderSummary[]> {
  const tg = ensureClient();
  const result = (await tg.invoke(new Api.messages.GetDialogFilters())) as { filters?: unknown[] };

  const folders: FolderSummary[] = [];
  for (const filter of result.filters || []) {
    if (
      (filter instanceof Api.DialogFilter || filter instanceof Api.DialogFilterChatlist) &&
      typeof filter.id === 'number'
    ) {
      const title = typeof filter.title === 'string' ? filter.title : (filter.title as { text?: string })?.text || `Folder ${filter.id}`;
      const includePeerIds = await Promise.all((filter.includePeers || []).map((peer) => tg.getPeerId(peer)));
      const pinnedPeerIds = await Promise.all((filter.pinnedPeers || []).map((peer) => tg.getPeerId(peer)));
      const excludePeerIds =
        filter instanceof Api.DialogFilter
          ? await Promise.all((filter.excludePeers || []).map((peer) => tg.getPeerId(peer)))
          : [];

      folders.push({
        id: filter.id,
        title,
        contacts: filter instanceof Api.DialogFilter ? filter.contacts : undefined,
        nonContacts: filter instanceof Api.DialogFilter ? filter.nonContacts : undefined,
        groups: filter instanceof Api.DialogFilter ? filter.groups : undefined,
        broadcasts: filter instanceof Api.DialogFilter ? filter.broadcasts : undefined,
        bots: filter instanceof Api.DialogFilter ? filter.bots : undefined,
        excludeMuted: filter instanceof Api.DialogFilter ? filter.excludeMuted : undefined,
        excludeRead: filter instanceof Api.DialogFilter ? filter.excludeRead : undefined,
        excludeArchived: filter instanceof Api.DialogFilter ? filter.excludeArchived : undefined,
        includePeerIds,
        pinnedPeerIds,
        excludePeerIds,
      });
    }
  }

  return folders;
}

export async function getMessagesForDialog(dialogId: string, limit = 25): Promise<MessageSummary[]> {
  const tg = ensureClient();
  const messages = await tg.getMessages(dialogId, { limit });
  const mapped: MessageSummary[] = [];

  for (const message of messages) {
    if (!message.id || !message.date) continue;

    const text = (message.message || '').trim();
    const hasMedia = Boolean(message.media);
    let mediaKind: string | undefined;

    if (message.media) {
      if (message.media instanceof Api.MessageMediaPhoto) mediaKind = 'photo';
      else if (message.media instanceof Api.MessageMediaDocument) mediaKind = 'document';
      else if (message.media instanceof Api.MessageMediaWebPage) mediaKind = 'link';
      else mediaKind = 'media';
    }

    const senderEntity = message.sender as { firstName?: string; username?: string } | undefined;
    const sender = message.out ? 'You' : senderEntity?.firstName || senderEntity?.username || 'Unknown';

    mapped.push({
      id: message.id,
      date: new Date(message.date * 1000),
      sender,
      text: text.length > 0 ? text : hasMedia ? '[Media message]' : '[Empty message]',
      hasMedia,
      mediaKind,
      outgoing: Boolean(message.out),
    });
  }

  return mapped.reverse();
}

export async function sendMessageToDialog(dialogId: string, text: string): Promise<void> {
  const tg = ensureClient();
  const trimmed = text.trim();
  if (!trimmed) return;
  await tg.sendMessage(dialogId, { message: trimmed });
}

export async function editMessageInDialog(dialogId: string, messageId: number, text: string): Promise<void> {
  const tg = ensureClient();
  const trimmed = text.trim();
  if (!trimmed) return;
  await tg.editMessage(dialogId, { message: messageId, text: trimmed });
}

export async function deleteMessageInDialog(dialogId: string, messageId: number): Promise<void> {
  const tg = ensureClient();
  await tg.deleteMessages(dialogId, [messageId], { revoke: true });
}

export async function sendReactionToMessage(dialogId: string, messageId: number, emoji: string): Promise<void> {
  const tg = ensureClient();
  const inputPeer = await tg.getInputEntity(dialogId);

  await tg.invoke(
    new Api.messages.SendReaction({
      peer: inputPeer,
      msgId: messageId,
      reaction: [new Api.ReactionEmoji({ emoticon: emoji })],
      addToRecent: true,
    })
  );
}


export async function logoutAndClearSession(): Promise<void> {
  const tg = ensureClient();

  try {
    await tg.invoke(new Api.auth.LogOut());
  } finally {
    await tg.disconnect();
    client = null;

    if (fs.existsSync(SESSION_PATH)) {
      fs.unlinkSync(SESSION_PATH);
    }
  }
}

export async function getSendCapability(dialogId: string): Promise<SendCapability> {
  const tg = ensureClient();
  const entity = await tg.getEntity(dialogId);

  if (entity instanceof Api.Channel) {
    if (entity.broadcast) {
      const canPost = Boolean(entity.creator || entity.adminRights?.postMessages);
      return canPost
        ? { canSend: true }
        : { canSend: false, reason: 'Posting disabled: this is a broadcast channel.' };
    }

    if (entity.defaultBannedRights?.sendMessages) {
      return { canSend: false, reason: 'You are restricted from sending messages in this group.' };
    }

    return { canSend: true };
  }

  if (entity instanceof Api.Chat) {
    if (entity.deactivated || entity.left) {
      return { canSend: false, reason: 'Cannot send: you are not an active member in this chat.' };
    }
    return { canSend: true };
  }

  if (entity instanceof Api.User) {
    if (entity.bot) {
      return { canSend: true };
    }
    return { canSend: true };
  }

  return { canSend: true };
}
