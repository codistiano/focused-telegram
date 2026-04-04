import React from 'react';
import { Box, Text } from 'ink';
import { WhitelistedItem } from '../../config';
import { truncate } from '../lib/uiUtils';

export interface SelectableItem {
  id: string;
  name: string;
  type: WhitelistedItem['type'];
  username?: string;
}

interface SetupScreenProps {
  options: SelectableItem[];
  selected: number[];
  cursor: number;
  visibleStart: number;
  visibleEnd: number;
  status: string;
}

const SetupScreen: React.FC<SetupScreenProps> = ({ options, selected, cursor, visibleStart, visibleEnd, status }) => {
  const visible = options.slice(visibleStart, visibleEnd);

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">Setup whitelist (chats and folders)</Text>
      <Text dimColor>Space select • Enter save • q quit</Text>
      <Box borderStyle="single" paddingX={1} marginTop={1} flexDirection="column">
        {visible.map((item, idx) => {
          const absoluteIndex = visibleStart + idx;
          const isCursor = cursor === absoluteIndex;
          const isSelected = selected.includes(absoluteIndex);
          return (
            <Text key={item.id} inverse={isCursor} color={isSelected ? 'green' : undefined}>
              {isSelected ? '●' : '○'} {truncate(item.name, 60)} <Text dimColor>({item.type})</Text>
            </Text>
          );
        })}
      </Box>
      <Text>
        Selected: {selected.length} • Showing {visibleStart + 1}-{Math.max(visibleStart + 1, visibleEnd)} / {options.length}
      </Text>
      {status ? <Text color="yellow">{status}</Text> : null}
    </Box>
  );
};

export default SetupScreen;
