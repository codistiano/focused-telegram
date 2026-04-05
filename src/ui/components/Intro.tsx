import React from 'react';
import { Box, Text } from 'ink';

const LINE = ['Focused Telegram'];

const AsciiIntro: React.FC = () => (
  <Box flexDirection="column" marginBottom={1} alignItems="center">
    {LINE.map((line, index) => (
      <Text key={line} color="cyan">
        {line}
      </Text>
    ))}
  </Box>
);

export default AsciiIntro;
