/// <reference lib="deno.ns" />
/// <reference lib="deno.unstable" />
/// <reference lib="dom" />

import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { delay } from 'https://deno.land/std@0.168.0/async/delay.ts';

Deno.test('OpenAI Edge Function - Embeddings', async () => {
  const response = await fetch('http://localhost:54321/functions/v1/openai-edge', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: 'Hello, world!',
      model: 'text-embedding-3-small',
    }),
  });

  assertEquals(response.status, 200);
  const data = await response.json();
  assertEquals(data.object, 'list');
  assertEquals(Array.isArray(data.data), true);
  assertEquals(data.data[0].embedding.length > 0, true);
});

Deno.test('OpenAI Edge Function - Streaming', async () => {
  const response = await fetch('http://localhost:54321/functions/v1/openai-edge', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: 'Tell me a short joke',
      stream: true,
    }),
  });

  assertEquals(response.status, 200);
  assertEquals(response.headers.get('Content-Type'), 'text/event-stream');

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No reader available');
  }

  let receivedData = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = new TextDecoder().decode(value);
    if (chunk.includes('data:')) {
      receivedData = true;
      break;
    }
    
    await delay(100);
  }

  assertEquals(receivedData, true);
});

Deno.test('OpenAI Edge Function - Error Handling', async () => {
  const response = await fetch('http://localhost:54321/functions/v1/openai-edge', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      // Missing input field
      model: 'text-embedding-3-small',
    }),
  });

  assertEquals(response.status, 400);
  const data = await response.json();
  assertEquals(data.error, 'Input is required');
}); 