#!/usr/bin/env tsx
/**
 * Example client showing how to consume the streaming preview API
 */

const API_URL = process.env.API_URL || 'http://localhost:3001';

interface StreamMessage {
  type: 'start' | 'log' | 'complete' | 'error';
  message?: string;
  preview?: {
    id: string;
    urls?: {
      vscode: string;
      worker: string;
    };
    status: string;
  };
  error?: string;
}

async function createPreviewWithStreaming() {
  const response = await fetch(`${API_URL}/api/preview-stream/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      gitUrl: 'https://github.com/microsoft/vscode-remote-try-node',
      branch: 'main',
      hasDevcontainer: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) {
    throw new Error('No response body');
  }

  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    
    // Process complete SSE messages
    const messages = buffer.split('\n\n');
    buffer = messages.pop() || ''; // Keep incomplete message in buffer

    for (const message of messages) {
      if (!message.trim()) continue;
      
      // Parse SSE format
      const lines = message.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          try {
            const parsed: StreamMessage = JSON.parse(data);
            handleMessage(parsed);
          } catch (error) {
            console.error('Failed to parse message:', data);
          }
        }
      }
    }
  }
}

function handleMessage(message: StreamMessage) {
  switch (message.type) {
    case 'start':
      console.log('🚀 Starting:', message.message);
      break;
      
    case 'log':
      console.log('📝', message.message);
      break;
      
    case 'complete':
      console.log('\n✅ Preview created successfully!');
      if (message.preview) {
        console.log('ID:', message.preview.id);
        console.log('VSCode:', message.preview.urls?.vscode);
        console.log('Worker:', message.preview.urls?.worker);
      }
      break;
      
    case 'error':
      console.error('\n❌ Error:', message.error);
      break;
  }
}

// Run the example
console.log('Creating preview with streaming logs...\n');
createPreviewWithStreaming()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });