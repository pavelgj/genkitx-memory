#!/usr/bin/env node

import { createMcpServer } from '@genkit-ai/mcp';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { genkit } from 'genkit/beta';
import { defineMemoryTools } from './kv_tools.js';
import os from 'os';
import path from 'path';

const ai = genkit({});

defineMemoryTools(ai, {
  memoryFilePath:
    process.env.KV_MEMORY_FILE_PATH ?? path.join(os.homedir(), '.genkitx-memory', 'memory.json'),
});

const server = createMcpServer(ai, {
  name: 'genkitx-memory',
  version: '0.0.1',
});
server.setup().then(async () => {
  await server.start();
  const transport = new StdioServerTransport();
  await server!.server?.connect(transport);
});
