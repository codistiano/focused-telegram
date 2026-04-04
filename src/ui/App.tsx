import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { loadConfig, saveConfig, WhitelistedItem } from '../config';
import {
  DialogSummary,
  FolderSummary,
  MessageSummary,
  SendCapability,
  getAllDialogs,
  getDialogFolders,
  getMessagesForDialog,
  getSendCapability,
  sendMessageToDialog,
  sendReactionToMessage,
} from '../client';
import SetupScreen, { SelectableItem } from './components/SetupScreen';
import MainScreen from './components/MainScreen';
import { getWindowedRange } from './lib/uiUtils';

type Step = 'loading' | 'setup' | 'main';
type FocusPane = 'chats' | 'messages' | 'composer';

const QUICK_REACTIONS = ['👍', '❤️', '🔥', '✅'];
const SETUP_WINDOW = 30;
const CHAT_WINDOW = 18;
const MESSAGE_WINDOW = 18;
const ADD_WINDOW = 20;

const toFolderItem = (folder: FolderSummary): SelectableItem => ({
  id: `folder:${folder.id}`,
  name: `📁 ${folder.title}`,
  type: 'folder',
});

const toDialogItem = (dialog: DialogSummary): SelectableItem => ({
  id: dialog.id,
  name: dialog.name,
  type: dialog.type,
  username: dialog.username,
});

const App: React.FC = () => {
  const [step, setStep] = useState<Step>('loading');
  const [dialogs, setDialogs] = useState<DialogSummary[]>([]);
  const [folders, setFolders] = useState<FolderSummary[]>([]);

  const [selectedSetup, setSelectedSetup] = useState<number[]>([]);
  const [setupCursor, setSetupCursor] = useState(0);

  const [whitelisted, setWhitelisted] = useState<WhitelistedItem[]>([]);
  const [focus, setFocus] = useState<FocusPane>('chats');
  const [chatCursor, setChatCursor] = useState(0);
  const [activeDialogId, setActiveDialogId] = useState<string | null>(null);

  const [messages, setMessages] = useState<MessageSummary[]>([]);
  const [messageCursor, setMessageCursor] = useState(0);
  const [composerText, setComposerText] = useState('');
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  const [addMode, setAddMode] = useState(false);
  const [addCursor, setAddCursor] = useState(0);
  const [addSelected, setAddSelected] = useState<number[]>([]);

  const [sendCapability, setSendCapability] = useState<SendCapability>({ canSend: true });
  const [lastSeenByChat, setLastSeenByChat] = useState<Record<string, number>>({});
  const [newMessageByChat, setNewMessageByChat] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState('');

  const setupOptions = useMemo<SelectableItem[]>(() => [...folders.map(toFolderItem), ...dialogs.map(toDialogItem)], [dialogs, folders]);

  const effectiveChats = useMemo(() => {
    const directChatIds = new Set(whitelisted.filter((w) => w.type !== 'folder').map((w) => w.id));

    for (const entry of whitelisted.filter((w) => w.type === 'folder')) {
      const folderId = Number(entry.id.replace('folder:', ''));
      dialogs.filter((dialog) => dialog.folderId === folderId).forEach((dialog) => directChatIds.add(dialog.id));
    }

    return dialogs.filter((dialog) => directChatIds.has(dialog.id));
  }, [dialogs, whitelisted]);

  const activeDialog = useMemo(() => {
    if (activeDialogId) {
      return effectiveChats.find((dialog) => dialog.id === activeDialogId) ?? null;
    }
    return effectiveChats[chatCursor] ?? null;
  }, [activeDialogId, chatCursor, effectiveChats]);

  const addOptions = useMemo(() => {
    const existing = new Set(whitelisted.map((w) => w.id));
    return setupOptions.filter((item) => !existing.has(item.id));
  }, [setupOptions, whitelisted]);

  const setupRange = getWindowedRange(setupCursor, setupOptions.length, SETUP_WINDOW);
  const chatRange = getWindowedRange(chatCursor, effectiveChats.length, CHAT_WINDOW);
  const messageRange = getWindowedRange(messageCursor, messages.length, MESSAGE_WINDOW);
  const addRange = getWindowedRange(addCursor, addOptions.length, ADD_WINDOW);

  const persistWhitelist = (next: WhitelistedItem[]) => {
    saveConfig({ whitelisted: next });
    setWhitelisted(next);
  };

  const refreshDialogsAndFolders = async () => {
    const [allDialogs, allFolders] = await Promise.all([getAllDialogs(), getDialogFolders()]);
    setDialogs(allDialogs);
    setFolders(allFolders);
  };

  const updateFreshness = (chatId: string, latestId: number, isActive: boolean) => {
    setLastSeenByChat((prev) => {
      const previousSeen = prev[chatId] || 0;
      const nextSeen = Math.max(previousSeen, latestId);
      setNewMessageByChat((flags) => ({ ...flags, [chatId]: latestId > previousSeen && !isActive }));
      return { ...prev, [chatId]: nextSeen };
    });
  };

  const loadMessages = async (dialogId: string, silent = false, isActive = true) => {
    try {
      if (!silent) setStatus('Loading messages…');
      const next = await getMessagesForDialog(dialogId);
      const latestId = next.length ? next[next.length - 1].id : 0;

      if (isActive) {
        setMessages(next);
        setMessageCursor(Math.max(0, next.length - 1));
      }

      updateFreshness(dialogId, latestId, isActive);
      if (!silent) setStatus('');
    } catch (err) {
      setStatus(`Error loading messages: ${(err as Error).message}`);
    }
  };

  useEffect(() => {
    const boot = async () => {
      try {
        setStatus('Loading chats/folders…');
        await refreshDialogsAndFolders();

        const config = loadConfig();
        setWhitelisted(config.whitelisted);
        setStep(config.whitelisted.length > 0 ? 'main' : 'setup');
        setStatus('');
      } catch (err) {
        setStatus(`Failed to load Telegram data: ${(err as Error).message}`);
      }
    };

    void boot();
  }, []);

  useEffect(() => {
    if (step !== 'main' || !activeDialog) return;

    setActiveDialogId(activeDialog.id);
    setNewMessageByChat((prev) => ({ ...prev, [activeDialog.id]: false }));

    void (async () => {
      await loadMessages(activeDialog.id, false, true);
      setSendCapability(await getSendCapability(activeDialog.id));
    })();
  }, [step, activeDialog?.id]);

  useEffect(() => {
    if (step !== 'main' || !effectiveChats.length) return;

    const timer = setInterval(() => {
      for (const chat of effectiveChats) {
        const isActive = chat.id === activeDialog?.id;
        void loadMessages(chat.id, true, isActive);
      }
    }, 10000);

    return () => clearInterval(timer);
  }, [step, effectiveChats, activeDialog?.id]);

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
        void sendReactionToMessage(activeDialog.id, messages[messageCursor].id, QUICK_REACTIONS[idx]);
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
            await sendMessageToDialog(activeDialog.id, text);
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

    if (input === 'q') {
      process.exit(0);
    } else if (input === 'a') {
      setAddMode(true);
    } else if (input === 'i') {
      if (!activeDialog || !sendCapability.canSend) {
        setStatus(sendCapability.reason || 'This chat is read-only.');
      } else {
        setFocus('composer');
      }
    } else if (key.tab) {
      setFocus((prev) => (prev === 'chats' ? 'messages' : 'chats'));
    } else if (input === 'R') {
      void refreshDialogsAndFolders();
      if (activeDialog) void loadMessages(activeDialog.id);
    } else if (input === 'r' && messages[messageCursor]) {
      setShowReactionPicker(true);
    } else if (focus === 'chats') {
      if (key.upArrow || input === 'k') setChatCursor((prev) => Math.max(0, prev - 1));
      else if (key.downArrow || input === 'j') setChatCursor((prev) => Math.min(effectiveChats.length - 1, prev + 1));
      else if (key.return && effectiveChats[chatCursor]) {
        const chat = effectiveChats[chatCursor];
        setActiveDialogId(chat.id);
        setNewMessageByChat((prev) => ({ ...prev, [chat.id]: false }));
        void (async () => {
          await loadMessages(chat.id, false, true);
          setSendCapability(await getSendCapability(chat.id));
        })();
      }
    } else if (focus === 'messages') {
      if (key.upArrow || input === 'k') setMessageCursor((prev) => Math.max(0, prev - 1));
      else if (key.downArrow || input === 'j') setMessageCursor((prev) => Math.min(messages.length - 1, prev + 1));
    }
  });

  if (step === 'loading') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="cyan">Focused Telegram TUI</Text>
        <Text>{status || 'Loading…'}</Text>
      </Box>
    );
  }

  if (step === 'setup') {
    return (
      <SetupScreen
        options={setupOptions}
        selected={selectedSetup}
        cursor={setupCursor}
        visibleStart={setupRange.start}
        visibleEnd={setupRange.end}
        status={status}
      />
    );
  }

  return (
    <MainScreen
      focus={focus}
      chats={effectiveChats}
      chatCursor={chatCursor}
      activeDialogId={activeDialog?.id ?? null}
      newMessageByChat={newMessageByChat}
      messages={messages}
      messageCursor={messageCursor}
      visibleMessageStart={messageRange.start}
      visibleMessageEnd={messageRange.end}
      composerText={composerText}
      sendCapability={sendCapability}
      showReactionPicker={showReactionPicker}
      status={status}
      addMode={addMode}
      addOptions={addOptions}
      addCursor={addCursor}
      addSelected={addSelected}
      addVisibleStart={addRange.start}
      addVisibleEnd={addRange.end}
      chatVisibleStart={chatRange.start}
      chatVisibleEnd={chatRange.end}
    />
  );
};

export default App;
