import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text } from 'ink';
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
  logoutAndClearSession,
} from '../client';
import SetupScreen, { SelectableItem } from './components/SetupScreen';
import MainScreen from './components/MainScreen';
import { getWindowedRange } from './lib/uiUtils';
import { useMainInput } from './hooks/useMainInput';
import { buildEffectiveChats, toDialogItem, toFolderItem } from './lib/whitelist';

type Step = 'loading' | 'setup' | 'main';
type FocusPane = 'chats' | 'messages' | 'composer';

const SETUP_WINDOW = 30;
const CHAT_WINDOW = 18;
const ADD_WINDOW = 20;

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
  const [logoutMode, setLogoutMode] = useState(false);
  const [addCursor, setAddCursor] = useState(0);
  const [addSelected, setAddSelected] = useState<number[]>([]);

  const [sendCapability, setSendCapability] = useState<SendCapability>({ canSend: true });
  const [lastSeenByChat, setLastSeenByChat] = useState<Record<string, number>>({});
  const [newMessageByChat, setNewMessageByChat] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState('');

  const setupOptions = useMemo<SelectableItem[]>(() => [...folders.map(toFolderItem), ...dialogs.map(toDialogItem)], [dialogs, folders]);

  const effectiveChats = useMemo(() => buildEffectiveChats(dialogs, folders, whitelisted), [dialogs, folders, whitelisted]);

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

  const refreshActiveSendCapability = async (dialogId: string) => {
    setSendCapability(await getSendCapability(dialogId));
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
      await refreshActiveSendCapability(activeDialog.id);
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

  useMainInput({
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
    sendMessageToActiveDialog: sendMessageToDialog,
    reactToActiveMessage: sendReactionToMessage,
    performLogout: async () => {
      setStatus('Logging out...');
      await logoutAndClearSession();
      saveConfig({ whitelisted: [] });
      setStatus('Logged out. Restart app to sign in with another account.');
      process.exit(0);
    },
    effectiveChats,
    chatCursor,
    setChatCursor,
    setActiveDialogId,
    setNewMessageByChat,
    setMessageCursor,
    refreshActiveSendCapability,
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
      logoutMode={logoutMode}
    />
  );
};

export default App;
