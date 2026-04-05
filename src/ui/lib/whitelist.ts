import { WhitelistedItem } from '../../config';
import { DialogSummary, FolderSummary } from '../../client';
import { SelectableItem } from '../components/SetupScreen';

export const toFolderItem = (folder: FolderSummary): SelectableItem => ({
  id: `folder:${folder.id}`,
  name: `📁 ${folder.title}`,
  type: 'folder',
});

export const toDialogItem = (dialog: DialogSummary): SelectableItem => ({
  id: dialog.id,
  name: dialog.name,
  type: dialog.type,
  username: dialog.username,
});

export const buildEffectiveChats = (
  dialogs: DialogSummary[],
  folders: FolderSummary[],
  whitelisted: WhitelistedItem[]
): DialogSummary[] => {
  const chatsById = new Map<string, DialogSummary>();
  const whitelistedDirectChatIds = new Set(whitelisted.filter((entry) => entry.type !== 'folder').map((entry) => entry.id));
  const whitelistedFolders = new Map(
    whitelisted
      .filter((entry) => entry.type === 'folder')
      .map((entry) => [entry.id, folders.find((folder) => `folder:${folder.id}` === entry.id)] as const)
      .filter((entry): entry is readonly [string, FolderSummary] => Boolean(entry[1]))
  );

  for (const dialog of dialogs) {
    if (whitelistedDirectChatIds.has(dialog.id)) {
      chatsById.set(dialog.id, dialog);
    }
  }

  for (const folder of whitelistedFolders.values()) {
    const explicitPeerIds = [...folder.pinnedPeerIds, ...folder.includePeerIds].filter(
      (peerId) => !folder.excludePeerIds.includes(peerId)
    );

    for (const peerId of explicitPeerIds) {
      const dialog = dialogs.find((item) => item.id === peerId);
      if (dialog) chatsById.set(dialog.id, dialog);
    }
  }

  return Array.from(chatsById.values());
};

export const findWhitelistedFolderForChat = (
  chatId: string,
  folders: FolderSummary[],
  whitelisted: WhitelistedItem[]
): WhitelistedItem | null => {
  for (const item of whitelisted) {
    if (item.type !== 'folder') continue;

    const folder = folders.find((entry) => `folder:${entry.id}` === item.id);
    if (!folder) continue;

    const explicitPeerIds = [...folder.pinnedPeerIds, ...folder.includePeerIds].filter(
      (peerId) => !folder.excludePeerIds.includes(peerId)
    );

    if (explicitPeerIds.includes(chatId)) {
      return item;
    }
  }

  return null;
};
