import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { loadConfig, saveConfig } from '../config';
import { client, getAllAvailableDialogs } from '../client';
import { Sidebar } from './Sidebar';
import { ChatView } from './ChatView';
import { ReactionPicker } from './ReactionPicker';
import { AddChatModal } from './AddChatModal';
import { InputHandler } from './InputHandler';
import { WhitelistedItem, Message } from './types';
import { Api } from 'telegram/tl';

const App: React.FC = () => {
  const [chats, setChats] = useState<WhitelistedItem[]>([]);
  const [selectedChatIndex, setSelectedChatIndex] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('');
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [reactionCursor, setReactionCursor] = useState(0);
  const [showAddMode, setShowAddMode] = useState(false);
  const [allDialogs, setAllDialogs] = useState<any[]>([]);
  const [addCursor, setAddCursor] = useState(0);
  const [selectedToAdd, setSelectedToAdd] = useState<number[]>([]);

  // Load whitelist
  useEffect(() => {
    const config = loadConfig();
    const improved = config.whitelisted.map((item: any) => ({
      ...item,
      displayType: item.type === 'channel' ? '📢 Channel' : 
                   item.type === 'group' ? '👥 Group' : '💬 Chat'
    }));
    setChats(improved);
  }, []);

  // Real-time & history (same working logic)
  useEffect(() => {
    if (!client) return;

    const handler = async (update: any) => {
      try {
        if (update instanceof Api.UpdateNewMessage || update instanceof Api.UpdateNewChannelMessage) {
          const msg = update.message;
          if (!msg) return;

          const peerId = msg.peerId?.channelId || msg.peerId?.chatId || msg.peerId?.userId;
          if (!chats.some(w => String(w.id) === String(peerId))) return;

          const newMsg: Message = {
            id: msg.id,
            text: msg.message,
            sender: 'Unknown',
            date: new Date(msg.date * 1000),
            isOutgoing: msg.out || false,
            mediaType: msg.photo ? 'Photo' : msg.video ? 'Video' : msg.document ? 'Document' : undefined,
            fileName: msg.document?.attributes?.[0]?.fileName || '',
            messageObj: msg,
          };

          if (String(chats[selectedChatIndex]?.id) === String(peerId)) {
            setMessages(prev => [...prev, newMsg].slice(-150));
          }
        }
      } catch (_) {}
    };

    client.addEventHandler(handler);
    return () => client.removeEventHandler(handler);
  }, [chats, selectedChatIndex]);

  useEffect(() => {
    const load = async () => {
      if (!client || !chats[selectedChatIndex]) return;
      setMessages([]);
      const history = await client.getMessages(chats[selectedChatIndex].id, { limit: 80 });
      const formatted = history.map((msg: any) => ({
        id: msg.id,
        text: msg.message,
        sender: msg.sender ? (msg.sender as any).firstName || 'Unknown' : 'Unknown',
        date: new Date(msg.date * 1000),
        isOutgoing: msg.out || false,
        mediaType: msg.photo ? 'Photo' : msg.video ? 'Video' : msg.document ? 'Document' : undefined,
        fileName: msg.document?.attributes?.[0]?.fileName || '',
        messageObj: msg,
      })).reverse();
      setMessages(formatted);
    };
    load();
  }, [selectedChatIndex, chats]);

  const handleSend = (text: string) => {
    const current = chats[selectedChatIndex];
    if (text && current && current.type !== 'channel') {
      client?.sendMessage(current.id, { message: text });
      setInput('');
    }
  };

  const handleCommand = (command: string) => {
    if (command === '/add') {
      setStatus('Loading chats...');
      getAllAvailableDialogs().then(dialogs => {
        const existing = new Set(chats.map(c => String(c.id)));
        setAllDialogs(dialogs.filter((d: any) => !existing.has(String(d.id))));
        setShowAddMode(true);
        setAddCursor(0);
        setSelectedToAdd([]);
        setStatus('');
      });
    }
  };

  const currentChat = chats[selectedChatIndex];
  const isReadOnly = currentChat?.type === 'channel';

  return (
    <Box flexDirection="column" height="100%">
      <Box paddingX={1}>
        <Text bold color="green">📟 Focused Telegram TUI</Text>
        <Text dimColor> ↑↓ navigate • r react • /add new chat</Text>
      </Box>

      <Box flexDirection="row" flexGrow={1}>
        <Sidebar chats={chats} selectedIndex={selectedChatIndex} />
        <ChatView 
          currentChat={currentChat}
          messages={messages}
          input={input}
          status={status}
          isChannel={isReadOnly}
        />
      </Box>

      <ReactionPicker visible={showReactionPicker} cursor={reactionCursor} />

      {showAddMode && (
        <AddChatModal 
          visible={showAddMode}
          dialogs={allDialogs}
          cursor={addCursor}
          selected={selectedToAdd}
          onClose={() => setShowAddMode(false)}
          onConfirm={(toAdd) => {
            const newChats = [...chats, ...toAdd];
            saveConfig({ whitelisted: newChats.map(({displayType, ...rest}) => rest) });
            setChats(newChats);
            setShowAddMode(false);
            setStatus(`Added ${toAdd.length} chats!`);
          }}
        />
      )}

      <InputHandler
        onNavigateUp={() => setSelectedChatIndex(p => Math.max(0, p - 1))}
        onNavigateDown={() => setSelectedChatIndex(p => Math.min(chats.length - 1, p + 1))}
        onSend={handleSend}
        onCommand={handleCommand}
        onType={(char) => setInput(prev => prev + char)}
        onBackspace={() => setInput(prev => prev.slice(0, -1))}
        onReaction={() => {
          if (messages.length > 0) setShowReactionPicker(true);
        }}
        disabled={showAddMode || showReactionPicker}
      />

      <Box padding={1}>
        <Text dimColor>Status: {status || 'Ready'}</Text>
      </Box>
    </Box>
  );
};

export default App;