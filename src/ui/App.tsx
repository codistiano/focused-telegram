import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { loadConfig, saveConfig, WhitelistedItem } from '../config';
import {
  DialogSummary,
  MessageSummary,
  getAllDialogs,
  getMessagesForDialog,
  sendMessageToDialog,
  sendReactionToMessage,
} from '../client';

type Step = 'loading' | 'setup' | 'main';
type FocusPane = 'chats' | 'messages' | 'composer';

const QUICK_REACTIONS = ['👍', '❤️', '🔥', '✅'];
const CHAT_PANE_WIDTH = 34;
const MAX_MESSAGES_VISIBLE = 18;

const truncate = (value: string, max: number): string => {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(1, max - 1))}…`;
};

const formatTime = (date: Date): string => {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

const App: React.FC = () => {
  const [step, setStep] = useState<Step>('loading');
  const [dialogs, setDialogs] = useState<DialogSummary[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [whitelisted, setWhitelisted] = useState<WhitelistedItem[]>([]);
  const [setupCursor, setSetupCursor] = useState(0);

  const [focus, setFocus] = useState<FocusPane>('chats');
  const [chatCursor, setChatCursor] = useState(0);
  const [messageCursor, setMessageCursor] = useState(0);
  const [activeDialogId, setActiveDialogId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageSummary[]>([]);
  const [composerText, setComposerText] = useState('');
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [status, setStatus] = useState('');
  const [reactionCursor, setReactionCursor] = useState(0);
  const [showAddMode, setShowAddMode] = useState(false);
  const [allDialogs, setAllDialogs] = useState<any[]>([]);
  const [addCursor, setAddCursor] = useState(0);
  const [selectedToAdd, setSelectedToAdd] = useState<number[]>([]);

  const activeDialog = useMemo(
    () => whitelisted.find((w) => w.id === activeDialogId) ?? whitelisted[chatCursor],
    [activeDialogId, chatCursor, whitelisted]
  );

  const visibleMessages = useMemo(() => {
    if (messages.length <= MAX_MESSAGES_VISIBLE) return messages;
    const start = Math.max(0, messageCursor - MAX_MESSAGES_VISIBLE + 1);
    return messages.slice(start, start + MAX_MESSAGES_VISIBLE);
  }, [messages, messageCursor]);

  const visibleMessageStartIndex = Math.max(0, messages.length - visibleMessages.length);

  const loadMessages = async (dialogId: string, silent = false) => {
    try {
      if (!silent) setStatus('Loading messages…');

      const next = await getMessagesForDialog(dialogId);
      setMessages(next);
      setMessageCursor(next.length > 0 ? next.length - 1 : 0);
      if (!silent) setStatus('');
    } catch (err) {
      setStatus(`Error loading messages: ${(err as Error).message}`);
    }
  };

  useEffect(() => {
    const load = async () => {
      const config = loadConfig();
      if (config.whitelisted.length > 0) {
        setWhitelisted(config.whitelisted);
        setStep('main');
        const first = config.whitelisted[0];
        setActiveDialogId(first.id);
        await loadMessages(first.id);
        return;
      }

      setStatus('Loading chats/channels/groups…');
      try {
        const allDialogs = await getAllDialogs();
        setDialogs(allDialogs);
        setStep('setup');
        setStatus('');
      } catch (err) {
        setStatus(`Error loading dialogs: ${(err as Error).message}`);
      }
    };

    void load();
  }, []);

  useEffect(() => {
    if (step !== 'main' || !activeDialog) return;

    const timer = setInterval(() => {
      void loadMessages(activeDialog.id, true);
    }, 8000);

    return () => clearInterval(timer);
  }, [activeDialog?.id, step]);

  useInput((input, key) => {
    if (step === 'setup') {
      if (key.upArrow || input === 'k') setSetupCursor((prev) => Math.max(0, prev - 1));
      else if (key.downArrow || input === 'j') setSetupCursor((prev) => Math.min(dialogs.length - 1, prev + 1));
      else if (input === ' ') {
        setSelected((prev) => (prev.includes(setupCursor) ? prev.filter((i) => i !== setupCursor) : [...prev, setupCursor]));
      } else if (key.return) {
        const chosen: WhitelistedItem[] = selected.map((idx) => ({
          id: String(dialogs[idx].id),
          name: dialogs[idx].name,
          type: dialogs[idx].type,
          username: dialogs[idx].username,
        }));

        saveConfig({ whitelisted: chosen });
        setWhitelisted(chosen);
        setStep('main');

        if (chosen.length > 0) {
          setActiveDialogId(chosen[0].id);
          void loadMessages(chosen[0].id);
        }
      } else if (input.toLowerCase() === 'q') process.exit(0);
      return;
    }

    if (step !== 'main') return;

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
        const text = composerText.trim();
        if (!text) return;

        void (async () => {
          try {
            await sendMessageToDialog(activeDialog.id, text);
            setComposerText('');
            await loadMessages(activeDialog.id, true);
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

    if (key.tab) {
      setFocus((prev) => (prev === 'chats' ? 'messages' : 'chats'));
      return;
    }

    if (input === 'i') {
      setFocus('composer');
      return;
    }

    if (input === 'r' && messages[messageCursor]) {
      setShowReactionPicker(true);
      setStatus('Pick reaction: 1-4');
      return;
    }

    if (input === 'R' && activeDialog) {
      void loadMessages(activeDialog.id);
      return;
    }

    if (focus === 'chats') {
      if (key.upArrow || input === 'k') setChatCursor((prev) => Math.max(0, prev - 1));
      else if (key.downArrow || input === 'j') setChatCursor((prev) => Math.min(whitelisted.length - 1, prev + 1));
      else if (key.return && whitelisted[chatCursor]) {
        const id = whitelisted[chatCursor].id;
        setActiveDialogId(id);
        void loadMessages(id);
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
        <Text bold color="cyan">Focused Telegram TUI • First run setup</Text>
        <Text dimColor>Select allowed chats only (Space select, Enter save, q quit)</Text>
        <Box marginTop={1} flexDirection="column" borderStyle="single" paddingX={1}>
          {dialogs.slice(0, 24).map((dialog, index) => {
            const absoluteIndex = index;
            const isSelected = selected.includes(absoluteIndex);
            const isCursor = setupCursor === absoluteIndex;
            const label = `${isSelected ? '●' : '○'} ${truncate(dialog.name, 50)} (${dialog.type})`;

            return (
              <Text key={String(dialog.id)} inverse={isCursor} color={isSelected ? 'green' : undefined}>
                {label}
              </Text>
            );
          })}
        </Box>
        <Text>Selected: {selected.length}</Text>
        {status ? <Text color="yellow">{status}</Text> : null}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box justifyContent="space-between">
        <Text bold color="green">Focused Telegram TUI</Text>
        <Text dimColor>{activeDialog ? `Active: ${truncate(activeDialog.name, 40)}` : 'No active chat'}</Text>
      </Box>

      <Box marginTop={1}>
        <Box width={CHAT_PANE_WIDTH} flexDirection="column" borderStyle="single" borderColor={focus === 'chats' ? 'cyan' : 'gray'} paddingX={1}>
          <Text bold>Chats</Text>
          {whitelisted.length === 0 ? <Text dimColor>No whitelisted chats</Text> : null}
          {whitelisted.slice(0, 18).map((item, i) => {
            const isCursor = i === chatCursor;
            const isActive = activeDialog?.id === item.id;
            const prefix = isActive ? '▶' : ' ';
            return (
              <Text key={item.id} inverse={focus === 'chats' && isCursor} color={isActive ? 'green' : undefined}>
                {prefix} {truncate(item.name, CHAT_PANE_WIDTH - 6)}
              </Text>
            );
          })}
        </Box>

        <Box marginLeft={1} flexDirection="column" flexGrow={1} borderStyle="single" borderColor={focus === 'messages' ? 'cyan' : 'gray'} paddingX={1}>
          <Text bold>Messages</Text>
          {visibleMessages.map((message, i) => {
            const absoluteIndex = visibleMessageStartIndex + i;
            const isCursor = absoluteIndex === messageCursor;
            const mediaTag = message.hasMedia ? ` [${message.mediaKind}]` : '';
            const prefix = message.outgoing ? 'You' : truncate(message.sender, 12);
            const row = `${formatTime(message.date)} ${prefix}: ${truncate(message.text, 72)}${mediaTag}`;
            return (
              <Text key={message.id} inverse={focus === 'messages' && isCursor}>
                {row}
              </Text>
            );
          })}
          {messages.length === 0 ? <Text dimColor>No messages loaded yet.</Text> : null}
        </Box>
      </Box>

      <Box marginTop={1} borderStyle="single" borderColor={focus === 'composer' ? 'cyan' : 'gray'} paddingX={1}>
        <Text>
          {focus === 'composer' ? 'Compose > ' : 'Press i to compose > '}
          {composerText.length ? truncate(composerText, 110) : <Text dimColor>(type message)</Text>}
        </Text>
      </Box>

      {showReactionPicker ? (
        <Text color="yellow">React: 1){QUICK_REACTIONS[0]} 2){QUICK_REACTIONS[1]} 3){QUICK_REACTIONS[2]} 4){QUICK_REACTIONS[3]}</Text>
      ) : null}

      <Text dimColor>Tab switch pane • Enter open/send • r react • Shift+R refresh • Esc leave compose • q quit</Text>
      {status ? <Text color="yellow">{status}</Text> : null}
    </Box>
  );
};

export default App;
