import React from 'react';
import { Box, Text } from 'ink';

interface ReactionPickerProps {
  visible: boolean;
  cursor: number;
}

export const ReactionPicker: React.FC<ReactionPickerProps> = ({ visible, cursor }) => {
  const reactions = ['❤️', '🔥', '👍', '👎', '🎉', '😢', '❤️‍🔥', '😂'];

  if (!visible) return null;

  return (
    <Box position="absolute" marginTop={8} marginLeft={40} borderStyle="double" borderColor="yellow" padding={2} flexDirection="column">
      <Text bold color="yellow">Choose reaction:</Text>
      {reactions.map((emoji, i) => (
        <Text key={i} color={i === cursor ? "cyan" : undefined}>
          {i === cursor ? "→ " : "  "}{emoji}
        </Text>
      ))}
      <Text dimColor>↑↓ or j/k • Enter to send • q to cancel</Text>
    </Box>
  );
};