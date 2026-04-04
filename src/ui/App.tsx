import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { loadConfig, saveConfig, WhitelistedItem } from '../config';
import { getAllDialogs } from '../client';

const App: React.FC = () => {
  const [step, setStep] = useState<'loading' | 'setup' | 'main'>('loading');
  const [dialogs, setDialogs] = useState<any[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [whitelisted, setWhitelisted] = useState<WhitelistedItem[]>([]);
  const [cursor, setCursor] = useState(0);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const load = async () => {
      const config = loadConfig();
      if (config.whitelisted.length > 0) {
        setWhitelisted(config.whitelisted);
        setStep('main');
        return;
      }

      setStatus('Loading your chats, channels and groups...');
      try {
        const allDialogs = await getAllDialogs();
        setDialogs(allDialogs);
        setStep('setup');
      } catch (err: any) {
        setStatus('Error loading dialogs: ' + err.message);
      }
    };
    load();
  }, []);

  useInput((input, key) => {
    if (step !== 'setup') return;

    if (key.upArrow || input === 'k') {
      setCursor(prev => Math.max(0, prev - 1));
    } else if (key.downArrow || input === 'j') {
      setCursor(prev => Math.min(dialogs.length - 1, prev + 1));
    } else if (input === ' ') {  // Space to toggle selection
      const newSelected = selected.includes(cursor)
        ? selected.filter(i => i !== cursor)
        : [...selected, cursor];
      setSelected(newSelected);
    } else if (key.return) {  // Enter to save
      const chosen: WhitelistedItem[] = selected.map(idx => ({
        id: dialogs[idx].id,
        name: dialogs[idx].name,
        type: dialogs[idx].type,
        username: dialogs[idx].username,
      }));

      saveConfig({ whitelisted: chosen });
      setWhitelisted(chosen);
      setStep('main');
      setStatus('Whitelist saved! Starting main interface...');
    } else if (input.toLowerCase() === 'q') {
      process.exit(0);
    }
  });

  if (step === 'loading') {
    return (
      <Box padding={2}>
        <Text>{status || 'Loading...'}</Text>
      </Box>
    );
  }

  if (step === 'main') {
    return (
      <Box flexDirection="column" height="100%" padding={1}>
        <Text bold color="green">✅ Focused Telegram TUI</Text>
        <Text>Whitelisted chats: {whitelisted.length}</Text>
        <Box flexDirection="row" flexGrow={1} marginTop={1}>
          <Box width="35%" borderStyle="single" borderColor="blue" padding={1}>
            <Text bold>Whitelisted Chats:</Text>
            {whitelisted.map((item, i) => (
              <Text key={i}>• {item.name} ({item.type})\n</Text>
            ))}
            {whitelisted.length === 0 && <Text dimColor>None yet</Text>}
          </Box>
          <Box flexGrow={1} borderStyle="single" borderColor="gray" padding={1}>
            <Text>Main chat view (coming next)</Text>
            <Text dimColor>Only messages from whitelisted chats will appear here.</Text>
          </Box>
        </Box>
        <Box paddingTop={1}>
          <Text dimColor>Press Ctrl+C to quit • Run again to re-setup if needed</Text>
        </Box>
      </Box>
    );
  }

  // Setup screen
  return (
    <Box flexDirection="column" padding={2}>
      <Text bold color="yellow">📋 Whitelist Setup (First Run)</Text>
      <Text>Select chats/channels/groups you want to see (Space to toggle, Enter to save):</Text>
      <Text dimColor>Use ↑↓ or j/k • q to quit</Text>

      <Box flexDirection="column" marginY={1}>
        {dialogs.map((dialog, index) => (
          <Text key={index} color={cursor === index ? 'cyan' : undefined}>
            {selected.includes(index) ? '✓' : '○'} {dialog.name} 
            <Text dimColor> ({dialog.type}) {dialog.unreadCount ? `(${dialog.unreadCount})` : ''}</Text>
          </Text>
        ))}
      </Box>

      <Text dimColor>Selected: {selected.length} chats</Text>
      {status && <Text color="red">{status}</Text>}
    </Box>
  );
};

export default App;