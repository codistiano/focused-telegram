import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text } from 'ink';
import { loadConfig, saveConfig, WhitelistedItem } from '../config';
import { fileExists, openExternalTarget, openLocalFile, prepareDownloadPath } from '../fileActions';
import {
  DownloadedDocument,
  DialogSummary,
  FolderSummary,
  MessageSummary,
  SendCapability,
  deleteMessageInDialog,
  downloadDocumentFromDialog,
  editMessageInDialog,
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
import { extractFirstUrl } from './lib/links';
import { getMessageStorageKey } from './lib/messageKeys';
import { getWindowedRange } from './lib/uiUtils';
import { useMainInput } from './hooks/useMainInput';
import { buildEffectiveChats, toDialogItem, toFolderItem } from './lib/whitelist';

type Step = 'loading' | 'setup' | 'main';
type FocusPane = 'chats' | 'messages' | 'composer';

const SETUP_WINDOW = 30;
const CHAT_WINDOW = 18;
const ADD_WINDOW = 20;
const ACTIVE_CHAT_REFRESH_MS = 10000;
const DIALOG_REFRESH_MS = 15000;

const App: React.FC = () => {
  const [step, setStep] = useState<Step>('loading');
  const [dialogs, setDialogs] = useState<DialogSummary[]>([]);
  const [folders, setFolders] = useState<FolderSummary[]>([]);

  const [selectedSetup, setSelectedSetup] = useState<number[]>([]);
  const [setupCursor, setSetupCursor] = useState(0);
  const [downloadDirectory, setDownloadDirectory] = useState('');
  const [isEditingDownloadDirectory, setIsEditingDownloadDirectory] = useState(false);

  const [whitelisted, setWhitelisted] = useState<WhitelistedItem[]>([]);
  const [focus, setFocus] = useState<FocusPane>('chats');
  const [chatCursor, setChatCursor] = useState(0);
  const [activeDialogId, setActiveDialogId] = useState<string | null>(null);

  const [messages, setMessages] = useState<MessageSummary[]>([]);
  const [messageCursor, setMessageCursor] = useState(0);
  const [composerText, setComposerText] = useState('');
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);

  const [addMode, setAddMode] = useState(false);
  const [logoutMode, setLogoutMode] = useState(false);
  const [addCursor, setAddCursor] = useState(0);
  const [addSelected, setAddSelected] = useState<number[]>([]);

  const [sendCapability, setSendCapability] = useState<SendCapability>({ canSend: true });
  const [lastSeenByChat, setLastSeenByChat] = useState<Record<string, number>>({});
  const [newMessageByChat, setNewMessageByChat] = useState<Record<string, boolean>>({});
  const [downloadedFilesByMessage, setDownloadedFilesByMessage] = useState<Record<string, string>>({});
  const [status, setStatus] = useState('');
  const activeDialogIdRef = useRef<string | null>(null);
  const pendingMessageLoadsRef = useRef(new Map<string, Promise<void>>());
  const pendingDialogsRefreshRef = useRef<Promise<void> | null>(null);
  const pendingDialogsOnlyRefreshRef = useRef<Promise<void> | null>(null);
  const pendingSendCapabilityRef = useRef(new Map<string, Promise<void>>());

  useEffect(() => {
    activeDialogIdRef.current = activeDialogId;
  }, [activeDialogId]);

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

  const persistConfig = useCallback(
    (nextWhitelisted: WhitelistedItem[], nextDownloadDirectory = downloadDirectory) => {
      saveConfig({ whitelisted: nextWhitelisted, downloadDirectory: nextDownloadDirectory });
    },
    [downloadDirectory]
  );

  const persistWhitelist = (next: WhitelistedItem[]) => {
    persistConfig(next);
    setWhitelisted(next);
  };

  const refreshDialogsAndFolders = useCallback(async () => {
    if (pendingDialogsRefreshRef.current) {
      return pendingDialogsRefreshRef.current;
    }

    const request = (async () => {
      const [allDialogs, allFolders] = await Promise.all([getAllDialogs(), getDialogFolders()]);
      setDialogs(allDialogs);
      setFolders(allFolders);
      setNewMessageByChat((prev) => {
        const next = { ...prev };

        for (const dialog of allDialogs) {
          if (dialog.id !== activeDialogIdRef.current) {
            next[dialog.id] = dialog.unreadCount > 0;
          }
        }

        return next;
      });
    })();

    pendingDialogsRefreshRef.current = request;

    try {
      await request;
    } finally {
      pendingDialogsRefreshRef.current = null;
    }
  }, []);

  const refreshDialogs = useCallback(async () => {
    if (pendingDialogsOnlyRefreshRef.current) {
      return pendingDialogsOnlyRefreshRef.current;
    }

    const request = (async () => {
      const allDialogs = await getAllDialogs();
      setDialogs(allDialogs);
      setNewMessageByChat((prev) => {
        const next = { ...prev };

        for (const dialog of allDialogs) {
          if (dialog.id !== activeDialogIdRef.current) {
            next[dialog.id] = dialog.unreadCount > 0;
          }
        }

        return next;
      });
    })();

    pendingDialogsOnlyRefreshRef.current = request;

    try {
      await request;
    } finally {
      pendingDialogsOnlyRefreshRef.current = null;
    }
  }, []);

  const refreshActiveSendCapability = useCallback(async (dialogId: string) => {
    const existing = pendingSendCapabilityRef.current.get(dialogId);
    if (existing) {
      return existing;
    }

    const request = (async () => {
      const capability = await getSendCapability(dialogId);
      if (activeDialogIdRef.current === dialogId) {
        setSendCapability(capability);
      }
    })();

    pendingSendCapabilityRef.current.set(dialogId, request);

    try {
      await request;
    } finally {
      pendingSendCapabilityRef.current.delete(dialogId);
    }
  }, []);

  const updateFreshness = (chatId: string, latestId: number, isActive: boolean) => {
    setLastSeenByChat((prev) => {
      const previousSeen = prev[chatId] || 0;
      const nextSeen = Math.max(previousSeen, latestId);
      setNewMessageByChat((flags) => ({ ...flags, [chatId]: latestId > previousSeen && !isActive }));
      return { ...prev, [chatId]: nextSeen };
    });
  };

  const loadMessages = useCallback(async (dialogId: string, silent = false, isActive = true) => {
    const existing = pendingMessageLoadsRef.current.get(dialogId);
    if (existing) {
      return existing;
    }

    const request = (async () => {
      try {
        if (!silent && isActive) setStatus('Loading messages…');
        const next = await getMessagesForDialog(dialogId);
        const latestId = next.length ? next[next.length - 1].id : 0;
        const stillActive = isActive && activeDialogIdRef.current === dialogId;

        if (stillActive) {
          setMessages(next);
          setMessageCursor(Math.max(0, next.length - 1));
        }

        updateFreshness(dialogId, latestId, stillActive);
        if (!silent && stillActive) setStatus('');
      } catch (err) {
        if (!silent && isActive) {
          setStatus(`Error loading messages: ${(err as Error).message}`);
        }
      }
    })();

    pendingMessageLoadsRef.current.set(dialogId, request);

    try {
      await request;
    } finally {
      pendingMessageLoadsRef.current.delete(dialogId);
    }
  }, []);

  const registerDownloadedDocument = useCallback((dialogId: string, messageId: number, targetPath: string) => {
    setDownloadedFilesByMessage((prev) => ({ ...prev, [getMessageStorageKey(dialogId, messageId)]: targetPath }));
  }, []);

  const ensureDocumentDownloaded = useCallback(
    async (dialogId: string, chatName: string, message: MessageSummary): Promise<DownloadedDocument> => {
      if (!message.fileName) {
        throw new Error('This document does not expose a file name.');
      }

      const targetPath = prepareDownloadPath(downloadDirectory, chatName, message.id, message.fileName);

      if (!fileExists(targetPath)) {
        const downloaded = await downloadDocumentFromDialog(dialogId, message.id, targetPath);
        registerDownloadedDocument(dialogId, message.id, downloaded.path);
        return downloaded;
      }

      registerDownloadedDocument(dialogId, message.id, targetPath);
      return {
        fileName: message.fileName,
        mimeType: message.mimeType,
        path: targetPath,
      };
    },
    [downloadDirectory, registerDownloadedDocument]
  );

  useEffect(() => {
    const boot = async () => {
      try {
        setStatus('Loading chats/folders…');
        await refreshDialogsAndFolders();

        const config = loadConfig();
        setWhitelisted(config.whitelisted);
        setDownloadDirectory(config.downloadDirectory);
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
    if (step !== 'main') return;

    const timer = setInterval(() => {
      void refreshDialogs().catch(() => {
        // Background refresh failures should not spam the status line.
      });
    }, DIALOG_REFRESH_MS);

    return () => clearInterval(timer);
  }, [step, refreshDialogs]);

  useEffect(() => {
    if (step !== 'main' || !activeDialog) return;

    const timer = setInterval(() => {
      void loadMessages(activeDialog.id, true, true);
    }, ACTIVE_CHAT_REFRESH_MS);

    return () => clearInterval(timer);
  }, [step, activeDialog?.id, loadMessages]);

  useMainInput({
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
    sendMessageToActiveDialog: sendMessageToDialog,
    editMessageInActiveDialog: editMessageInDialog,
    deleteMessageInActiveDialog: deleteMessageInDialog,
    reactToActiveMessage: sendReactionToMessage,
    performLogout: async () => {
      setStatus('Logging out...');
      await logoutAndClearSession();
      persistConfig([], downloadDirectory);
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
    editingMessageId,
    setEditingMessageId,
    downloadedFilesByMessage,
    downloadSelectedDocument: async (dialogId, chatName, message) => {
      const downloaded = await ensureDocumentDownloaded(dialogId, chatName, message);
      setStatus(`Saved ${downloaded.fileName} to ${downloaded.path}`);
    },
    openSelectedLink: async (message) => {
      const linkUrl = message.linkUrl || extractFirstUrl(message.text);
      if (!linkUrl) {
        throw new Error('Selected message does not contain an openable link.');
      }

      await openExternalTarget(linkUrl);
      setStatus(`Opened ${linkUrl}`);
    },
    openSelectedDocument: async (dialogId, chatName, message) => {
      const downloaded = await ensureDocumentDownloaded(dialogId, chatName, message);
      await openLocalFile(downloaded.path);
      setStatus(`Opened ${downloaded.fileName}`);
    },
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
        downloadDirectory={downloadDirectory}
        editingDownloadDirectory={isEditingDownloadDirectory}
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
      editingMessageId={editingMessageId}
      sendCapability={sendCapability}
      showReactionPicker={showReactionPicker}
      status={status}
      downloadedFilesByMessage={downloadedFilesByMessage}
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
