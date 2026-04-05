import React from 'react';
import { render } from 'ink';
import App from './ui/App';
import { initClient } from './client';

(async () => {
  try {
    console.log('🚀 Starting Focused Telegram...\n');

    await initClient();

    // Once logged in, start the TUI
    console.clear();
    render(<App />);
  } catch (err: any) {
    console.error('\n❌ Failed to start:', err.message || err);
    process.exit(1);
  }
})();
