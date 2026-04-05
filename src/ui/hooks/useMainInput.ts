import { Dispatch, SetStateAction } from 'react';
import { useInput } from 'ink';
import { WhitelistedItem } from '../../config';
import { DialogSummary, FolderSummary, MessageSummary, SendCapability } from '../../client';
import { SelectableItem } from '../components/SetupScreen';
import { extractFirstUrl } from '../lib/links';
import { getMessageStorageKey } from '../lib/messageKeys';
import { findWhitelistedFolderForChat } from '../lib/whitelist';

interface MainInputOptions {
  step: 'loading' | 'setup' | 'main';
  setupCursor: number;
  setSetupCursor: Dispatch<SetStateAction<number>>;
  setupOptions: SelectableItem[];
  selectedSetup: number[];
  setSelectedSetup: Dispatch<SetStateAction<number[]>>;
  persistWhitelist: (next: WhitelistedItem[]) => void;
  downloadDirectory: string;
  setDownloadDirectory: Dispatch<SetStateAction<string>>;
  isEditingDownloadDirectory: boolean;
  setIsEditingDownloadDirectory: Dispatch<SetStateAction<boolean>>;
  setStep: Dispatch<SetStateAction<'loading' | 'setup' | 'main'>>;
  logoutMode: boolean;
  setLogoutMode: Dispatch<SetStateAction<boolean>>;
  addMode: boolean;
  setAddMode: Dispatch<SetStateAction<boolean>>;
  addCursor: number;
  setAddCursor: Dispatch<SetStateAction<number>>;
  addOptions: SelectableItem[];
  addSelected: number[];
  setAddSelected: Dispatch<SetStateAction<number[]>>;
  whitelisted: WhitelistedItem[];
  folders: FolderSummary[];
  showReactionPicker: boolean;
  setShowReactionPicker: Dispatch<SetStateAction<boolean>>;
  messages: MessageSummary[];
  messageCursor: number;
  focus: 'chats' | 'messages' | 'composer';
  setFocus: Dispatch<SetStateAction<'chats' | 'messages' | 'composer'>>;
  activeDialog: DialogSummary | null;
  sendCapability: SendCapability;
  composerText: string;
  setComposerText: Dispatch<SetStateAction<string>>;
  setStatus: Dispatch<SetStateAction<string>>;
  refreshDialogsAndFolders: () => Promise<void>;
  loadMessages: (dialogId: string, silent?: boolean, isActive?: boolean) => Promise<void>;
  sendMessageToActiveDialog: (dialogId: string, text: string) => Promise<void>;
  editMessageInActiveDialog: (dialogId: string, messageId: number, text: string) => Promise<void>;
  deleteMessageInActiveDialog: (dialogId: string, messageId: number) => Promise<void>;
  reactToActiveMessage: (dialogId: string, messageId: number, emoji: string) => Promise<void>;
  performLogout: () => Promise<void>;
  effectiveChats: DialogSummary[];
  chatCursor: number;
  setChatCursor: Dispatch<SetStateAction<number>>;
  setActiveDialogId: Dispatch<SetStateAction<string | null>>;
  setNewMessageByChat: Dispatch<SetStateAction<Record<string, boolean>>>;
  setMessageCursor: Dispatch<SetStateAction<number>>;
  refreshActiveSendCapability: (dialogId: string) => Promise<void>;
  editingMessageId: number | null;
  setEditingMessageId: Dispatch<SetStateAction<number | null>>;
  downloadedFilesByMessage: Record<string, string>;
  downloadSelectedDocument: (dialogId: string, chatName: string, message: MessageSummary) => Promise<void>;
  openSelectedLink: (message: MessageSummary) => Promise<void>;
  openSelectedDocument: (dialogId: string, chatName: string, message: MessageSummary) => Promise<void>;
}

const QUICK_REACTIONS = ['👍', '❤️', '🔥', '✅'];
const applyComposerEscapes = (value: string): string => value.replace(/\\n/g, '\n');

export const useMainInput = ({
  step,
  setupCursor,
  setSetupCursor,
  setupOptions,
  selectedSetup,
  setSelectedSetup,
  persistWhitelist,
  downloadDirectory,
  setDownloadDirectory,
  isEditingDownloadDirectory,
  setIsEditingDownloadDirectory,
  setStep,
  logoutMode,
  setLogoutMode,
  addMode,
  setAddMode,
  addCursor,
  setAddCursor,
  addOptions,
  addSelected,
  setAddSelected,
  whitelisted,
  folders,
  showReactionPicker,
  setShowReactionPicker,
  messages,
  messageCursor,
  focus,
  setFocus,
  activeDialog,
  sendCapability,
  composerText,
  setComposerText,
  setStatus,
  refreshDialogsAndFolders,
  loadMessages,
  sendMessageToActiveDialog,
  editMessageInActiveDialog,
  deleteMessageInActiveDialog,
  reactToActiveMessage,
  performLogout,
  effectiveChats,
  chatCursor,
  setChatCursor,
  setActiveDialogId,
  setNewMessageByChat,
  setMessageCursor,
  refreshActiveSendCapability,
  editingMessageId,
  setEditingMessageId,
  downloadedFilesByMessage,
  downloadSelectedDocument,
  openSelectedLink,
  openSelectedDocument,
}: MainInputOptions) => {
  const selectedMessage = messages[messageCursor];
  const selectedDocument = selectedMessage?.mediaKind === 'document' && selectedMessage.fileName ? selectedMessage : null;
  const selectedLink = selectedMessage ? selectedMessage.linkUrl || extractFirstUrl(selectedMessage.text) : undefined;

  useInput((input, key) => {
    if (step === 'setup') {
      if (isEditingDownloadDirectory) {
        if (key.return) {
          if (!downloadDirectory.trim()) {
            setStatus('Download directory cannot be empty.');
          } else {
            setDownloadDirectory((prev) => prev.trim());
            setIsEditingDownloadDirectory(false);
            setStatus(`Download directory set to ${downloadDirectory.trim()}`);
          }
        } else if (key.escape) {
          setIsEditingDownloadDirectory(false);
        } else if (key.backspace || key.delete) {
          setDownloadDirectory((prev) => prev.slice(0, -1));
        } else if (!key.ctrl && !key.meta && input) {
          setDownloadDirectory((prev) => prev + input);
        }
        return;
      }

      if (key.upArrow || input === 'k') setSetupCursor((prev) => Math.max(0, prev - 1));
      else if (key.downArrow || input === 'j') setSetupCursor((prev) => Math.min(setupOptions.length - 1, prev + 1));
      else if (input === ' ') {
        setSelectedSetup((prev) => (prev.includes(setupCursor) ? prev.filter((i) => i !== setupCursor) : [...prev, setupCursor]));
      } else if (input === 'p') {
        setIsEditingDownloadDirectory(true);
      } else if (key.return) {
        persistWhitelist(selectedSetup.map((idx) => setupOptions[idx]));
        setStep('main');
      } else if (input === 'q') {
        process.exit(0);
      }
      return;
    }

    if (step !== 'main') return;

    if (logoutMode) {
      if (input.toLowerCase() === 'y') {
        void performLogout();
      } else if (input.toLowerCase() === 'n' || key.escape) {
        setLogoutMode(false);
      }
      return;
    }

    if (addMode) {
      if (key.upArrow || input === 'k') setAddCursor((prev) => Math.max(0, prev - 1));
      else if (key.downArrow || input === 'j') setAddCursor((prev) => Math.min(addOptions.length - 1, prev + 1));
      else if (input === ' ') {
        setAddSelected((prev) => (prev.includes(addCursor) ? prev.filter((i) => i !== addCursor) : [...prev, addCursor]));
      } else if (key.return) {
        const additions = addSelected.map((idx) => addOptions[idx]);
        if (additions.length) {
          persistWhitelist([...whitelisted, ...additions]);
          setStatus(`Added ${additions.length} whitelist item(s).`);
        }
        setAddMode(false);
        setAddCursor(0);
        setAddSelected([]);
      } else if (key.escape || input === 'q') {
        setAddMode(false);
        setAddSelected([]);
      }
      return;
    }

    if (showReactionPicker) {
      const idx = Number(input) - 1;
      if (idx >= 0 && idx < QUICK_REACTIONS.length && messages[messageCursor] && activeDialog) {
        void reactToActiveMessage(activeDialog.id, messages[messageCursor].id, QUICK_REACTIONS[idx]);
        setStatus(`Reacted with ${QUICK_REACTIONS[idx]}`);
      }
      if (key.escape || key.return || input) setShowReactionPicker(false);
      return;
    }

    if (focus === 'composer') {
      if (key.return && activeDialog) {
        if (!sendCapability.canSend) {
          setStatus(sendCapability.reason || 'Cannot send message in this chat.');
          return;
        }

        const text = composerText.trim();
        if (!text) return;

        void (async () => {
          try {
            if (editingMessageId) {
              await editMessageInActiveDialog(activeDialog.id, editingMessageId, text);
              setStatus(`Message #${editingMessageId} edited.`);
            } else {
              await sendMessageToActiveDialog(activeDialog.id, text);
              setStatus('Message sent.');
            }
            setComposerText('');
            setEditingMessageId(null);
            await loadMessages(activeDialog.id, true, true);
          } catch (err) {
            setStatus(`Failed to submit message: ${(err as Error).message}`);
          }
        })();
        return;
      }

      if (key.escape) {
        setFocus('messages');
        setEditingMessageId(null);
        return;
      }

      if (key.backspace || key.delete) {
        setComposerText((prev) => prev.slice(0, -1));
        return;
      }

      if (!key.ctrl && !key.meta && input) {
        setComposerText((prev) => applyComposerEscapes(prev + input));
      }
      return;
    }

    if (input === 'q') process.exit(0);
    else if (input === 'a') setAddMode(true);
    else if (input === 'd' && focus === 'chats' && effectiveChats[chatCursor]) {
      const selected = effectiveChats[chatCursor];
      const directlyWhitelisted = whitelisted.some((item) => item.id === selected.id);

      if (directlyWhitelisted) {
        const next = whitelisted.filter((item) => item.id !== selected.id);
        persistWhitelist(next);
        setChatCursor((prev) => Math.max(0, Math.min(prev, next.length - 1)));
        setStatus(`Removed "${selected.name}" from whitelist.`);
      } else {
        const folderItem = findWhitelistedFolderForChat(selected.id, folders, whitelisted);

        if (!folderItem) {
          setStatus('Could not find the whitelisted folder that provides this chat.');
        } else {
          const next = whitelisted.filter((item) => item.id !== folderItem.id);
          persistWhitelist(next);
          setChatCursor((prev) => Math.max(0, Math.min(prev, next.length - 1)));
          setStatus(`Removed folder "${folderItem.name}" from whitelist.`);
        }
      }
    } else if (input === 'l') setLogoutMode(true);
    else if (input === 'i') {
      if (!activeDialog || !sendCapability.canSend) setStatus(sendCapability.reason || 'This chat is read-only.');
      else setFocus('composer');
    } else if (key.tab) setFocus((prev) => (prev === 'chats' ? 'messages' : 'chats'));
    else if (input === 'R') {
      void refreshDialogsAndFolders();
      if (activeDialog) void loadMessages(activeDialog.id);
    } else if (input === 'r' && messages[messageCursor]) setShowReactionPicker(true);
    else if (input === 'f' && focus === 'messages' && activeDialog && selectedDocument) {
      void (async () => {
        try {
          await downloadSelectedDocument(activeDialog.id, activeDialog.name, selectedDocument);
        } catch (err) {
          setStatus(`Failed to download file: ${(err as Error).message}`);
        }
      })();
    } else if (input === 'o' && focus === 'messages' && selectedLink) {
      void (async () => {
        try {
          await openSelectedLink(selectedMessage);
        } catch (err) {
          setStatus(`Failed to open link: ${(err as Error).message}`);
        }
      })();
    } else if (input === 'o' && focus === 'messages' && activeDialog && selectedDocument) {
      void (async () => {
        try {
          await openSelectedDocument(activeDialog.id, activeDialog.name, selectedDocument);
        } catch (err) {
          const hasDownloadedFile = Boolean(downloadedFilesByMessage[getMessageStorageKey(activeDialog.id, selectedDocument.id)]);
          const fallback = hasDownloadedFile ? 'Failed to open file.' : 'Failed to download/open file.';
          setStatus(`${fallback} ${(err as Error).message}`);
        }
      })();
    }
    else if (input === 'e' && activeDialog) {
      const lastOwnMessage = [...messages].reverse().find((message) => message.outgoing);
      if (!lastOwnMessage) {
        setStatus('No outgoing messages to edit in this chat.');
      } else {
        setComposerText(lastOwnMessage.text || '');
        setEditingMessageId(lastOwnMessage.id);
        setFocus('composer');
        setStatus(`Editing your last message (#${lastOwnMessage.id}).`);
      }
    } else if (input === 'x' && activeDialog) {
      const lastOwnMessage = [...messages].reverse().find((message) => message.outgoing);
      if (!lastOwnMessage) {
        setStatus('No outgoing messages to delete in this chat.');
      } else {
        void (async () => {
          try {
            await deleteMessageInActiveDialog(activeDialog.id, lastOwnMessage.id);
            await loadMessages(activeDialog.id, true, true);
            setStatus(`Deleted your last message (#${lastOwnMessage.id}).`);
          } catch (err) {
            setStatus(`Failed to delete message: ${(err as Error).message}`);
          }
        })();
      }
    } else if (focus === 'chats') {
      if (key.upArrow || input === 'k') setChatCursor((prev) => Math.max(0, prev - 1));
      else if (key.downArrow || input === 'j') setChatCursor((prev) => Math.min(effectiveChats.length - 1, prev + 1));
      else if (key.return && effectiveChats[chatCursor]) {
        const chat = effectiveChats[chatCursor];
        setActiveDialogId(chat.id);
        setNewMessageByChat((prev) => ({ ...prev, [chat.id]: false }));
        void (async () => {
          await loadMessages(chat.id, false, true);
          await refreshActiveSendCapability(chat.id);
        })();
      }
    } else if (focus === 'messages') {
      if (key.upArrow || input === 'k') setMessageCursor((prev) => Math.max(0, prev - 1));
      else if (key.downArrow || input === 'j') setMessageCursor((prev) => Math.min(messages.length - 1, prev + 1));
    }
  });
};
