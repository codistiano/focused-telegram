import { useInput } from 'ink';
import { useCallback } from 'react';

interface InputHandlerProps {
  onNavigateUp: () => void;
  onNavigateDown: () => void;
  onSend: (text: string) => void;
  onCommand: (command: string) => void;
  onType: (char: string) => void;
  onBackspace: () => void;
  onReaction: () => void;
  disabled?: boolean;
}

export const InputHandler: React.FC<InputHandlerProps> = ({
  onNavigateUp,
  onNavigateDown,
  onSend,
  onCommand,
  onType,
  onBackspace,
  onReaction,
  disabled = false,
}) => {
  useInput((inputKey, key) => {
    if (disabled) return;

    if (key.ctrl && inputKey === 'c') {
      process.exit(0);
      return;
    }

    // Navigation - only arrow keys
    if (key.upArrow) {
      onNavigateUp();
      return;
    }
    if (key.downArrow) {
      onNavigateDown();
      return;
    }

    // Special keys
    if (inputKey === 'r') {
      onReaction();
      return;
    }

    if (key.return) {
      if (inputKey.trim() === '/add') {
        onCommand('/add');
      } else {
        onSend(inputKey.trim());
      }
      return;
    }

    // Typing
    if (inputKey === 'Backspace') {
      onBackspace();
    } else if (inputKey.length === 1) {
      onType(inputKey);
    }
  });

  return null; // This component only handles input, renders nothing
};