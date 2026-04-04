import React from 'react';
import { Box, Text, useStdout } from 'ink';
import { DialogSummary, MessageSummary, SendCapability } from '../../client';
import { truncate, formatTime } from '../lib/uiUtils';
import { SelectableItem } from './SetupScreen';
import ConfirmModal from './ConfirmModal';
import { buildVisibleMessages, getMessageLineBudget, getMessagePaneWidth } from '../lib/messageLayout';

interface MainScreenProps {
  focus: 'chats' | 'messages' | 'composer';
  chats: DialogSummary[];
  chatCursor: number;
  activeDialogId: string | null;
  newMessageByChat: Record<string, boolean>;
  messages: MessageSummary[];
  messageCursor: number;
  composerText: string;
  sendCapability: SendCapability;
  showReactionPicker: boolean;
  status: string;
  addMode: boolean;
  addOptions: SelectableItem[];
  addCursor: number;
  addSelected: number[];
  addVisibleStart: number;
  addVisibleEnd: number;
  chatVisibleStart: number;
  chatVisibleEnd: number;
  logoutMode: boolean;
}

const CHAT_PANE_WIDTH = 38;

const MainScreen: React.FC<MainScreenProps> = (props) => {
  const { stdout } = useStdout();
  const visibleChats = props.chats.slice(props.chatVisibleStart, props.chatVisibleEnd);
  const visibleAdd = props.addOptions.slice(props.addVisibleStart, props.addVisibleEnd);
  const activeDialog = props.chats.find((d) => d.id === props.activeDialogId);
  const paneWidth = getMessagePaneWidth(stdout.columns || 120, CHAT_PANE_WIDTH);
  const bodyWidth = Math.max(10, paneWidth - 6);
  const lineBudget = getMessageLineBudget(stdout.rows || 24);
  const visibleMessages = buildVisibleMessages(props.messages, props.messageCursor, bodyWidth, lineBudget, (message) => {
    const sender = message.outgoing ? 'You' : truncate(message.sender, 12);
    const mediaTag = message.hasMedia ? ` [${message.mediaKind}]` : '';
    return `${formatTime(message.date)} ${sender}${mediaTag}`;
  });
  const hasMessagesAbove = visibleMessages.length > 0 && visibleMessages[0]?.message.id !== props.messages[0]?.id;
  const hasMessagesBelow =
    visibleMessages.length > 0 && visibleMessages[visibleMessages.length - 1]?.message.id !== props.messages[props.messages.length - 1]?.id;

  return (
    <Box flexDirection="column" padding={1}>
      <Box justifyContent="space-between">
        <Text bold color="green">Focused Telegram TUI</Text>
        <Text dimColor>{activeDialog ? `Active: ${truncate(activeDialog.name, 36)}` : 'No active chat'}</Text>
      </Box>

      <Box marginTop={1}>
        <Box width={CHAT_PANE_WIDTH} borderStyle="single" borderColor={props.focus === 'chats' ? 'cyan' : 'gray'} paddingX={1} flexDirection="column">
          <Text bold>Whitelisted chats</Text>
          {visibleChats.map((chat, idx) => {
            const absoluteIndex = props.chatVisibleStart + idx;
            const isCursor = props.chatCursor === absoluteIndex;
            const isActive = props.activeDialogId === chat.id;
            const hasNew = props.newMessageByChat[chat.id];
            return (
              <Text key={chat.id} inverse={props.focus === 'chats' && isCursor} color={isActive ? 'green' : hasNew ? 'yellow' : undefined}>
                {hasNew ? '•' : ' '} {isActive ? '▶' : ' '} {truncate(chat.name, CHAT_PANE_WIDTH - 8)}
              </Text>
            );
          })}
          {props.chats.length === 0 ? <Text dimColor>No chats in whitelist yet. Press a to add.</Text> : null}
        </Box>

        <Box
          marginLeft={1}
          width={paneWidth}
          flexGrow={1}
          borderStyle="single"
          borderColor={props.focus === 'messages' ? 'cyan' : 'gray'}
          paddingX={1}
          flexDirection="column"
        >
          <Text bold>Messages</Text>
          {hasMessagesAbove ? <Text dimColor>... older messages above ...</Text> : null}
          {visibleMessages.map((entry) => {
            const { message, isCursor, header, bodyLines } = entry;

            return (
              <Box key={message.id} flexDirection="column" marginBottom={1}>
                <Text color={props.focus === 'messages' && isCursor ? 'cyan' : undefined}>
                  {isCursor ? '▶ ' : '  '}
                  {header}
                </Text>
                {bodyLines.map((line, lineIndex) => (
                  <Text key={`${message.id}-${lineIndex}`} wrap="truncate-end">
                    {'   '}
                    {line}
                  </Text>
                ))}
              </Box>
            );
          })}
          {hasMessagesBelow ? <Text dimColor>... newer messages below ...</Text> : null}
          {props.messages.length === 0 ? <Text dimColor>No messages loaded.</Text> : null}
        </Box>
      </Box>

      <Box marginTop={1} borderStyle="single" borderColor={props.focus === 'composer' ? 'cyan' : props.sendCapability.canSend ? 'gray' : 'red'} paddingX={1}>
        <Text>
          {props.focus === 'composer' ? 'Compose > ' : 'Press i to compose > '}
          {props.composerText ? truncate(props.composerText, 110) : <Text dimColor>(type message)</Text>}
        </Text>
      </Box>

      {!props.sendCapability.canSend ? <Text color="red">Read-only: {props.sendCapability.reason}</Text> : null}
      {props.showReactionPicker ? <Text color="yellow">React: 1)👍 2)❤️ 3)🔥 4)✅</Text> : null}
      <Text dimColor>Tab switch pane • Enter open/send • a add whitelist • r react • l logout • Shift+R refresh • q quit</Text>
      {props.status ? <Text color="yellow">{props.status}</Text> : null}


      {props.logoutMode ? (
        <ConfirmModal
          title="Logout current account"
          description="This will remove the saved session so next start asks for new account login."
        />
      ) : null}

      {props.addMode ? (
        <Box flexDirection="column" borderStyle="round" borderColor="magenta" paddingX={1} marginTop={1}>
          <Text bold color="magenta">Add to whitelist</Text>
          <Text dimColor>Space select • Enter add • Esc cancel</Text>
          {visibleAdd.map((item, idx) => {
            const absoluteIndex = props.addVisibleStart + idx;
            const isCursor = props.addCursor === absoluteIndex;
            const isSelected = props.addSelected.includes(absoluteIndex);
            return (
              <Text key={`add-${item.id}`} inverse={isCursor} color={isSelected ? 'green' : undefined}>
                {isSelected ? '●' : '○'} {truncate(item.name, 58)} <Text dimColor>({item.type})</Text>
              </Text>
            );
          })}
          <Text dimColor>
            Showing {props.addVisibleStart + 1}-{Math.max(props.addVisibleStart + 1, props.addVisibleEnd)} / {props.addOptions.length}
          </Text>
          {props.addOptions.length === 0 ? <Text dimColor>Everything is already whitelisted.</Text> : null}
        </Box>
      ) : null}
    </Box>
  );
};

export default MainScreen;
