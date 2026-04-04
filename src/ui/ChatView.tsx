import React from 'react';
import { Box, Text } from 'ink';
import { Message, WhitelistedItem } from './types';

interface ChatViewProps {
  currentChat: WhitelistedItem | undefined;
  messages: Message[];
  input: string;
  status: string;
  isChannel: boolean;
}

export const ChatView: React.FC<ChatViewProps> = ({ 
  currentChat, 
  messages, 
  input, 
  status,
  isChannel 
}) => {
  return (
    <Box flexGrow={1} borderStyle="single" borderColor="gray" flexDirection="column">
      <Box padding={1} borderBottom>
        <Text bold>📬 {currentChat?.name || "No chat selected"}</Text>
      </Box>

      <Box flexGrow={1} padding={1} flexDirection="column">
        {messages.map((msg, i) => (
          <Box key={i}>
            <Text>
              <Text dimColor>
                {msg.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>{' '}
              <Text color={msg.isOutgoing ? "green" : undefined}>
                {msg.isOutgoing ? "You" : msg.sender}
              </Text>: {' '}
              {msg.mediaType ? (
                <Text color="magenta">[{msg.mediaType}] {msg.fileName || ''}</Text>
              ) : (msg.text || "[Media]")}
            </Text>
          </Box>
        ))}
        {messages.length === 0 && <Text dimColor>No messages yet...</Text>}
      </Box>

      <Box padding={1} borderStyle="single" borderColor={isChannel ? "red" : "gray"}>
        {isChannel ? (
          <Text color="red">📢 This is a channel — read only</Text>
        ) : (
          <>
            <Text bold>&gt; </Text>
            <Text>{input}</Text>
            {input === '' && <Text dimColor>Type message or /add to whitelist new chat...</Text>}
          </>
        )}
      </Box>
    </Box>
  );
};