import { Dispatch, SetStateAction } from 'react';
import { useInput } from 'ink';
import { WhitelistedItem } from '../../config';
import { DialogSummary, MessageSummary, SendCapability } from '../../client';
import { SelectableItem } from '../components/SetupScreen';

interface MainInputOptions {
  step: 'loading' | 'setup' | 'main';
  setupCursor: number;
  setSetupCursor: Dispatch<SetStateAction<number>>;
  setupOptions: SelectableItem[];
  selectedSetup: number[];
  setSelectedSetup: Dispatch<SetStateAction<number[]>>;
  persistWhitelist: (next: WhitelistedItem[]) => void;
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
}: MainInputOptions) => {
  useInput((input, key) => {
    if (step === 'setup') {
      if (key.upArrow || input === 'k') setSetupCursor((prev) => Math.max(0, prev - 1));
      else if (key.downArrow || input === 'j') setSetupCursor((prev) => Math.min(setupOptions.length - 1, prev + 1));
      else if (input === ' ') {
        setSelectedSetup((prev) => (prev.includes(setupCursor) ? prev.filter((i) => i !== setupCursor) : [...prev, setupCursor]));
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
      const next = whitelisted.filter((item) => item.id !== selected.id);
      if (next.length === whitelisted.length) {
        setStatus('Selected chat comes from a folder; remove the folder from whitelist to hide it.');
      } else {
        persistWhitelist(next);
        setChatCursor((prev) => Math.max(0, Math.min(prev, next.length - 1)));
        setStatus(`Removed "${selected.name}" from whitelist.`);
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
