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

type Step = 'loading' | 'setup' | 'main';
type FocusPane = 'chats' | 'messages' | 'composer';

interface SelectableItem {
  id: string;
  name: string;
  type: WhitelistedItem['type'];
  username?: string;
}

const QUICK_REACTIONS = ['👍', '❤️', '🔥', '✅'];
const CHAT_PANE_WIDTH = 38;
const MAX_MESSAGES_VISIBLE = 18;

const truncate = (value: string, max: number): string => (value.length <= max ? value : `${value.slice(0, max - 1)}…`);
const formatTime = (date: Date): string => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

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
  const [addSelected, setAddSelected] = useState<number[]>([]);

  const [sendCapability, setSendCapability] = useState<SendCapability>({ canSend: true });
  const [lastSeenByChat, setLastSeenByChat] = useState<Record<string, number>>({});
  const [newMessageByChat, setNewMessageByChat] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState('');
  const [reactionCursor, setReactionCursor] = useState(0);
  const [showAddMode, setShowAddMode] = useState(false);
  const [allDialogs, setAllDialogs] = useState<any[]>([]);
  const [addCursor, setAddCursor] = useState(0);
  const [selectedToAdd, setSelectedToAdd] = useState<number[]>([]);

  const setupOptions = useMemo<SelectableItem[]>(() => {
    const folderOptions = folders.map(toFolderItem);
    const dialogOptions = dialogs.map(toDialogItem);
    return [...folderOptions, ...dialogOptions];
  }, [dialogs, folders]);

  const effectiveChats = useMemo(() => {
    const directChatIds = new Set(whitelisted.filter((w) => w.type !== 'folder').map((w) => w.id));

    for (const entry of whitelisted.filter((w) => w.type === 'folder')) {
      const folderId = Number(entry.id.replace('folder:', ''));
      dialogs.filter((dialog) => dialog.folderId === folderId).forEach((dialog) => directChatIds.add(dialog.id));
    }

    return dialogs.filter((dialog) => directChatIds.has(dialog.id));
  }, [dialogs, whitelisted]);

  const activeDialog = useMemo(() => {
    if (!activeDialogId) return effectiveChats[chatCursor] ?? null;
    return effectiveChats.find((dialog) => dialog.id === activeDialogId) ?? effectiveChats[chatCursor] ?? null;
  }, [activeDialogId, chatCursor, effectiveChats]);

  const addOptions = useMemo(() => {
    const existing = new Set(whitelisted.map((w) => w.id));
    return setupOptions.filter((item) => !existing.has(item.id));
  }, [setupOptions, whitelisted]);

  const visibleMessages = useMemo(() => {
    if (messages.length <= MAX_MESSAGES_VISIBLE) return messages;
    const start = Math.max(0, messageCursor - MAX_MESSAGES_VISIBLE + 1);
    return messages.slice(start, start + MAX_MESSAGES_VISIBLE);
  }, [messages, messageCursor]);

  const visibleMessageStartIndex = Math.max(0, messages.length - visibleMessages.length);

  const persistWhitelist = (next: WhitelistedItem[]) => {
    saveConfig({ whitelisted: next });
    setWhitelisted(next);
  };

  const refreshDialogsAndFolders = async () => {
    const [allDialogs, allFolders] = await Promise.all([getAllDialogs(), getDialogFolders()]);
    setDialogs(allDialogs);
    setFolders(allFolders);
  };

  const markChatFreshness = (chatId: string, nextMessages: MessageSummary[], isActive: boolean) => {
    const latestId = nextMessages.length ? nextMessages[nextMessages.length - 1].id : 0;
    setLastSeenByChat((prev) => ({ ...prev, [chatId]: Math.max(prev[chatId] || 0, latestId) }));

    setNewMessageByChat((prev) => {
      const previousSeen = lastSeenByChat[chatId] || 0;
      const hasNew = latestId > previousSeen && !isActive;
      return { ...prev, [chatId]: hasNew ? true : false };
    });
  };

  const loadMessages = async (dialogId: string, silent = false, isActive = true) => {
    try {
      if (!silent) setStatus('Loading messages…');
      const next = await getMessagesForDialog(dialogId);
      if (isActive) {
        setMessages(next);
        setMessageCursor(next.length > 0 ? next.length - 1 : 0);
      }
      markChatFreshness(dialogId, next, isActive);
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
        if (config.whitelisted.length > 0) {
          setWhitelisted(config.whitelisted);
          setStep('main');
        } else {
          setStep('setup');
        }
        setStatus('');
      } catch (err) {
        setStatus(`Failed to load Telegram data: ${(err as Error).message}`);
      }
    };

    void boot();
  }, []);

  useEffect(() => {
    if (step !== 'main' || !effectiveChats.length) return;

    const target = activeDialog ?? effectiveChats[0];
    if (!target) return;

    setActiveDialogId(target.id);
    setNewMessageByChat((prev) => ({ ...prev, [target.id]: false }));

    void (async () => {
      await loadMessages(target.id, false, true);
      const cap = await getSendCapability(target.id);
      setSendCapability(cap);
    })();
  }, [step, activeDialogId, effectiveChats.length]);

  useEffect(() => {
    if (step !== 'main' || !effectiveChats.length) return;

    const timer = setInterval(() => {
      for (const chat of effectiveChats) {
        const isActive = chat.id === activeDialog?.id;
        void loadMessages(chat.id, true, isActive);
      }
    }, 10000);

    return () => clearInterval(timer);
  }, [step, effectiveChats, activeDialog?.id, lastSeenByChat]);

  useInput((input, key) => {
    if (step === 'setup') {
      if (key.upArrow || input === 'k') setSetupCursor((prev) => Math.max(0, prev - 1));
      else if (key.downArrow || input === 'j') setSetupCursor((prev) => Math.min(setupOptions.length - 1, prev + 1));
      else if (input === ' ') {
        setSelectedSetup((prev) => (prev.includes(setupCursor) ? prev.filter((i) => i !== setupCursor) : [...prev, setupCursor]));
      } else if (key.return) {
        const chosen: WhitelistedItem[] = selectedSetup.map((idx) => setupOptions[idx]);
        persistWhitelist(chosen);
        setStep('main');
      } else if (input === 'q') process.exit(0);
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
        if (additions.length > 0) {
          persistWhitelist([...whitelisted, ...additions]);
          setStatus(`Added ${additions.length} whitelist item(s).`);
        }
        setAddSelected([]);
        setAddCursor(0);
        setAddMode(false);
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
      return;
    }

    if (input === 'a') {
      setAddMode(true);
      return;
    }

    if (input === 'i') {
      if (!activeDialog || !sendCapability.canSend) {
        setStatus(sendCapability.reason || 'This chat is read-only.');
        return;
      }
      setFocus('composer');
      return;
    }

    if (key.tab) {
      setFocus((prev) => (prev === 'chats' ? 'messages' : 'chats'));
      return;
    }

    if (input === 'R') {
      void refreshDialogsAndFolders();
      if (activeDialog) void loadMessages(activeDialog.id);
      return;
    }

    if (input === 'r' && messages[messageCursor]) {
      setShowReactionPicker(true);
      return;
    }

    if (focus === 'chats') {
      if (key.upArrow || input === 'k') setChatCursor((prev) => Math.max(0, prev - 1));
      else if (key.downArrow || input === 'j') setChatCursor((prev) => Math.min(effectiveChats.length - 1, prev + 1));
      else if (key.return && effectiveChats[chatCursor]) {
        const chat = effectiveChats[chatCursor];
        setActiveDialogId(chat.id);
        setNewMessageByChat((prev) => ({ ...prev, [chat.id]: false }));
        void (async () => {
          await loadMessages(chat.id, false, true);
          const cap = await getSendCapability(chat.id);
          setSendCapability(cap);
        })();
      }
      return;
    }

    if (focus === 'messages') {
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
      <Box flexDirection="column" padding={1}>
        <Text bold color="cyan">Setup whitelist (chats and folders)</Text>
        <Text dimColor>Space select • Enter save • q quit</Text>
        <Box borderStyle="single" paddingX={1} marginTop={1} flexDirection="column">
          {setupOptions.slice(0, 30).map((item, index) => {
            const isCursor = setupCursor === index;
            const isSelected = selectedSetup.includes(index);
            return (
              <Text key={item.id} inverse={isCursor} color={isSelected ? 'green' : undefined}>
                {isSelected ? '●' : '○'} {truncate(item.name, 60)} <Text dimColor>({item.type})</Text>
              </Text>
            );
          })}
        </Box>
        <Text>Selected: {selectedSetup.length}</Text>
        {status ? <Text color="yellow">{status}</Text> : null}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box justifyContent="space-between">
        <Text bold color="green">Focused Telegram TUI</Text>
        <Text dimColor>{activeDialog ? `Active: ${truncate(activeDialog.name, 36)}` : 'No active chat'}</Text>
      </Box>

      <Box marginTop={1}>
        <Box width={CHAT_PANE_WIDTH} borderStyle="single" borderColor={focus === 'chats' ? 'cyan' : 'gray'} paddingX={1} flexDirection="column">
          <Text bold>Whitelisted chats</Text>
          {effectiveChats.slice(0, 18).map((chat, i) => {
            const isCursor = chatCursor === i;
            const isActive = activeDialog?.id === chat.id;
            const hasNew = newMessageByChat[chat.id];
            return (
              <Text key={chat.id} inverse={focus === 'chats' && isCursor} color={isActive ? 'green' : hasNew ? 'yellow' : undefined}>
                {hasNew ? '•' : ' '} {isActive ? '▶' : ' '} {truncate(chat.name, CHAT_PANE_WIDTH - 8)}
              </Text>
            );
          })}
          {effectiveChats.length === 0 ? <Text dimColor>No chats in whitelist yet. Press a to add.</Text> : null}
        </Box>

        <Box marginLeft={1} flexGrow={1} borderStyle="single" borderColor={focus === 'messages' ? 'cyan' : 'gray'} paddingX={1} flexDirection="column">
          <Text bold>Messages</Text>
          {visibleMessages.map((message, i) => {
            const absoluteIndex = visibleMessageStartIndex + i;
            const isCursor = absoluteIndex === messageCursor;
            const sender = message.outgoing ? 'You' : truncate(message.sender, 12);
            const mediaTag = message.hasMedia ? ` [${message.mediaKind}]` : '';
            return (
              <Text key={message.id} inverse={focus === 'messages' && isCursor}>
                {formatTime(message.date)} {sender}: {truncate(message.text, 72)}{mediaTag}
              </Text>
            );
          })}
          {messages.length === 0 ? <Text dimColor>No messages loaded.</Text> : null}
        </Box>
      </Box>

      <Box marginTop={1} borderStyle="single" borderColor={focus === 'composer' ? 'cyan' : sendCapability.canSend ? 'gray' : 'red'} paddingX={1}>
        <Text>
          {focus === 'composer' ? 'Compose > ' : 'Press i to compose > '}
          {composerText ? truncate(composerText, 110) : <Text dimColor>(type message)</Text>}
        </Text>
      </Box>

      {!sendCapability.canSend ? <Text color="red">Read-only: {sendCapability.reason}</Text> : null}
      {showReactionPicker ? <Text color="yellow">React: 1){QUICK_REACTIONS[0]} 2){QUICK_REACTIONS[1]} 3){QUICK_REACTIONS[2]} 4){QUICK_REACTIONS[3]}</Text> : null}
      <Text dimColor>Tab switch pane • Enter open/send • a add whitelist • r react • Shift+R refresh • q quit</Text>
      {status ? <Text color="yellow">{status}</Text> : null}

      {addMode ? (
        <Box flexDirection="column" borderStyle="round" borderColor="magenta" paddingX={1} marginTop={1}>
          <Text bold color="magenta">Add to whitelist</Text>
          <Text dimColor>Space select • Enter add • Esc cancel</Text>
          {addOptions.slice(0, 20).map((item, index) => {
            const isCursor = addCursor === index;
            const isSelected = addSelected.includes(index);
            return (
              <Text key={`add-${item.id}`} inverse={isCursor} color={isSelected ? 'green' : undefined}>
                {isSelected ? '●' : '○'} {truncate(item.name, 58)} <Text dimColor>({item.type})</Text>
              </Text>
            );
          })}
          {addOptions.length === 0 ? <Text dimColor>Everything is already whitelisted.</Text> : null}
        </Box>
      ) : null}
    </Box>
  );
};

export default App;
