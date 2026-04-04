import React from 'react';
import { Box, Text } from 'ink';
import { DialogSummary, MessageSummary, SendCapability } from '../../client';
import { truncate, formatTime } from '../lib/uiUtils';
import { SelectableItem } from './SetupScreen';

interface MainScreenProps {
  focus: 'chats' | 'messages' | 'composer';
  chats: DialogSummary[];
  chatCursor: number;
  activeDialogId: string | null;
  newMessageByChat: Record<string, boolean>;
  messages: MessageSummary[];
  messageCursor: number;
  visibleMessageStart: number;
  visibleMessageEnd: number;
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
}

const CHAT_PANE_WIDTH = 38;

const MainScreen: React.FC<MainScreenProps> = (props) => {
  const visibleChats = props.chats.slice(props.chatVisibleStart, props.chatVisibleEnd);
  const visibleMessages = props.messages.slice(props.visibleMessageStart, props.visibleMessageEnd);
  const visibleAdd = props.addOptions.slice(props.addVisibleStart, props.addVisibleEnd);

  const activeDialog = props.chats.find((d) => d.id === props.activeDialogId);

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

        <Box marginLeft={1} flexGrow={1} borderStyle="single" borderColor={props.focus === 'messages' ? 'cyan' : 'gray'} paddingX={1} flexDirection="column">
          <Text bold>Messages</Text>
          {visibleMessages.map((message, idx) => {
            const absoluteIndex = props.visibleMessageStart + idx;
            const isCursor = absoluteIndex === props.messageCursor;
            const sender = message.outgoing ? 'You' : truncate(message.sender, 12);
            const mediaTag = message.hasMedia ? ` [${message.mediaKind}]` : '';

            return (
              <Text key={message.id} inverse={props.focus === 'messages' && isCursor}>
                {formatTime(message.date)} {sender}: {truncate(message.text, 72)}{mediaTag}
              </Text>
            );
          })}
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
      <Text dimColor>Tab switch pane • Enter open/send • a add whitelist • r react • Shift+R refresh • q quit</Text>
      {props.status ? <Text color="yellow">{props.status}</Text> : null}

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
