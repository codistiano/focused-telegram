import React from 'react';
import { Box, Text } from 'ink';
import { WhitelistedItem } from './types';

interface AddChatModalProps {
  visible: boolean;
  dialogs: any[];
  cursor: number;
  selected: number[];
}

export const AddChatModal: React.FC<AddChatModalProps> = ({ 
  visible, 
  dialogs, 
  cursor, 
  selected 
}) => {
  if (!visible) return null;

  return (
    <Box 
      position="absolute" 
      marginTop={5} 
      marginLeft={10} 
      width="70%" 
      height="70%" 
      borderStyle="double" 
      borderColor="cyan" 
      flexDirection="column" 
      padding={1}
    >
      <Text bold color="cyan">Add New Chat to Whitelist</Text>
      <Text dimColor>Space = toggle • Enter = confirm • q = cancel</Text>

      <Box flexDirection="column" marginTop={1}>
        {dialogs.map((d, i) => (
          <Text key={i} color={cursor === i ? "cyan" : undefined}>
            {selected.includes(i) ? "✓" : "○"} {d.type} {d.name}
          </Text>
        ))}
      </Box>
    </Box>
  );
};