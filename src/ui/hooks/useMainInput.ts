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
  reactToActiveMessage: (dialogId: string, messageId: number, emoji: string) => Promise<void>;
  performLogout: () => Promise<void>;
  effectiveChats: DialogSummary[];
  chatCursor: number;
  setChatCursor: Dispatch<SetStateAction<number>>;
  setActiveDialogId: Dispatch<SetStateAction<string | null>>;
  setNewMessageByChat: Dispatch<SetStateAction<Record<string, boolean>>>;
  setMessageCursor: Dispatch<SetStateAction<number>>;
  refreshActiveSendCapability: (dialogId: string) => Promise<void>;
}

const QUICK_REACTIONS = ['👍', '❤️', '🔥', '✅'];

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
  reactToActiveMessage,
  performLogout,
  effectiveChats,
  chatCursor,
  setChatCursor,
  setActiveDialogId,
  setNewMessageByChat,
  setMessageCursor,
  refreshActiveSendCapability,
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
            await sendMessageToActiveDialog(activeDialog.id, text);
            setComposerText('');
            await loadMessages(activeDialog.id, true, true);
            setStatus('Message sent.');
          } catch (err) {
            setStatus(`Failed to send message: ${(err as Error).message}`);
          }
        })();
        return;
      }

      if (key.escape) {
        setFocus('messages');
        return;
      }

      if (key.backspace || key.delete) {
        setComposerText((prev) => prev.slice(0, -1));
        return;
      }

      if (!key.ctrl && !key.meta && input) setComposerText((prev) => prev + input);
      return;
    }

    if (input === 'q') process.exit(0);
    else if (input === 'a') setAddMode(true);
    else if (input === 'l') setLogoutMode(true);
    else if (input === 'i') {
      if (!activeDialog || !sendCapability.canSend) setStatus(sendCapability.reason || 'This chat is read-only.');
      else setFocus('composer');
    } else if (key.tab) setFocus((prev) => (prev === 'chats' ? 'messages' : 'chats'));
    else if (input === 'R') {
      void refreshDialogsAndFolders();
      if (activeDialog) void loadMessages(activeDialog.id);
    } else if (input === 'r' && messages[messageCursor]) setShowReactionPicker(true);
    else if (focus === 'chats') {
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
