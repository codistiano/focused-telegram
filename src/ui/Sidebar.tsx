import React from 'react';
import { Box, Text } from 'ink';
import { WhitelistedItem } from './types';

interface SidebarProps {
  chats: WhitelistedItem[];
  selectedIndex: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ chats, selectedIndex }) => {
  return (
    <Box width="35%" borderStyle="single" borderColor="blue" flexDirection="column">
      <Box padding={1}>
        <Text bold>Whitelisted Chats ({chats.length})</Text>
      </Box>
      <Box flexDirection="column" paddingX={1}>
        {chats.map((chat, i) => (
          <Text 
            key={i}
            color={i === selectedIndex ? "cyan" : undefined}
            bold={i === selectedIndex}
          >
            {i === selectedIndex ? "→ " : "  "}{chat.displayType} {chat.name}
          </Text>
        ))}
        {chats.length === 0 && <Text dimColor>No chats yet</Text>}
      </Box>
    </Box>
  );
};