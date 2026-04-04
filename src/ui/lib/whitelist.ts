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

const matchesFolder = (dialog: DialogSummary, folder: FolderSummary): boolean => {
  const explicitInclude = folder.includePeerIds.includes(dialog.id) || folder.pinnedPeerIds.includes(dialog.id);
  if (folder.excludePeerIds.includes(dialog.id)) return false;
  if (explicitInclude) return true;
  if (folder.excludeRead && dialog.unreadCount === 0) return false;
  if (folder.excludeArchived && dialog.archived) return false;

  let matches = false;
  if (folder.groups && dialog.type === 'group') matches = true;
  if (folder.broadcasts && dialog.type === 'channel') matches = true;
  if (folder.bots && dialog.isBot) matches = true;
  if (folder.contacts && dialog.type === 'chat' && dialog.isContact && !dialog.isBot) matches = true;
  if (folder.nonContacts && dialog.type === 'chat' && !dialog.isContact && !dialog.isBot) matches = true;

  return matches;
};

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
      continue;
    }

    for (const folder of whitelistedFolders.values()) {
      if (matchesFolder(dialog, folder)) {
        chatsById.set(dialog.id, dialog);
        break;
      }
    }
  }

  for (const folder of whitelistedFolders.values()) {
    for (const peerId of [...folder.pinnedPeerIds, ...folder.includePeerIds]) {
      const dialog = dialogs.find((item) => item.id === peerId);
      if (dialog) chatsById.set(dialog.id, dialog);
    }
  }

  return Array.from(chatsById.values());
};
