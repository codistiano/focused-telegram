import React from 'react';
import { Box, Text, useStdout } from 'ink';
import { WhitelistedItem } from '../../config';
import { truncate } from '../lib/uiUtils';
import Intro from './Intro';

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
  downloadDirectory: string;
  editingDownloadDirectory: boolean;
}

const SetupScreen: React.FC<SetupScreenProps> = ({
  options,
  selected,
  cursor,
  visibleStart,
  visibleEnd,
  status,
  downloadDirectory,
  editingDownloadDirectory,
}) => {
  const { stdout } = useStdout();
  const frameWidth = Math.max(36, Math.min(88, (stdout.columns || 120) - 2));
  const visible = options.slice(visibleStart, visibleEnd);

  return (
    <Box flexDirection="column" alignItems="center" paddingY={1}>
      <Box width={frameWidth} flexDirection="column">
        <Intro />
        <Text bold color="cyan">Setup whitelist (chats and folders)</Text>
        <Text dimColor>{editingDownloadDirectory ? 'Type path • Enter save path • Esc cancel' : 'Space select • p edit download path • Enter save • q quit'}</Text>
        <Box borderStyle="single" paddingX={1} marginTop={1} flexDirection="column">
          {visible.map((item, idx) => {
            const absoluteIndex = visibleStart + idx;
            const isCursor = cursor === absoluteIndex;
              const isSelected = selected.includes(absoluteIndex);
              return (
                <Text key={item.id} inverse={isCursor} color={isSelected ? 'green' : undefined}>
                  {isSelected ? '●' : '○'} {truncate(item.name, Math.max(10, frameWidth - 12))} <Text dimColor>({item.type})</Text>
                </Text>
              );
            })}
        </Box>
        <Box borderStyle="single" paddingX={1} marginTop={1} flexDirection="column">
          <Text bold>Download directory</Text>
          <Text color={editingDownloadDirectory ? 'cyan' : undefined} wrap="wrap">
            {downloadDirectory}
          </Text>
        </Box>
        <Text wrap="truncate-end">
          Selected: {selected.length} • Showing {visibleStart + 1}-{Math.max(visibleStart + 1, visibleEnd)} / {options.length}
        </Text>
        {status ? <Text color="yellow" wrap="truncate-end">{status}</Text> : null}
      </Box>
    </Box>
  );
};

export default SetupScreen;
