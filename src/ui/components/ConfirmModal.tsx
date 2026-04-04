import React from 'react';
import { Box, Text } from 'ink';

interface ConfirmModalProps {
  title: string;
  description: string;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ title, description }) => (
  <Box flexDirection="column" borderStyle="round" borderColor="red" paddingX={1} marginTop={1}>
    <Text bold color="red">{title}</Text>
    <Text>{description}</Text>
    <Text dimColor>Press y to confirm • n or Esc to cancel</Text>
  </Box>
);

export default ConfirmModal;
