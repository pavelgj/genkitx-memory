import { ToolAction, z } from 'genkit';
import { GenkitBeta } from 'genkit/beta';
import path from 'path';
import { EntrySchema, FileKeyValueStore, KeyValueStore } from './kv_store.js';

export function defineKeyValueMemoryTools(
  ai: GenkitBeta,
  opts?: { store?: KeyValueStore; memoryFilePath?: string }
): ToolAction[] {
  const memoryFilePath =
    opts?.memoryFilePath ??
    process.env.KV_MEMORY_FILE_PATH ??
    path.join(process.cwd(), 'memory_kv.json'); // Use a directory for session files

  const store = opts?.store ?? new FileKeyValueStore(memoryFilePath);

  const actions = [] as ToolAction[];

  actions.push(
    ai.defineTool(
      {
        name: 'memory/set',
        description:
          'Sets one or more key-value pairs in memory. Overwrites if keys already exist.',
        inputSchema: z.object({
          entries: z.array(EntrySchema).describe('An array of key-value pairs to set.'),
        }),
        outputSchema: z.string(),
      },
      async ({ entries }, { context }) => {
        const sessionId = context?.memory?.sessionId;
        await store.save({ sessionId, entries });
        const keys = entries.map((e) => e.key).join(', ');
        return `Successfully set memory for keys: ${keys} in session: ${sessionId || 'global'}`;
      }
    )
  );

  actions.push(
    ai.defineTool(
      {
        name: 'memory/get',
        description: 'Retrieves one or more values from memory for given keys.',
        inputSchema: z.object({
          keys: z.array(z.string()).describe('An array of keys to retrieve values for.'),
        }),
        outputSchema: z.array(EntrySchema).describe('An array of retrieved key-value pairs.'),
      },
      async ({ keys }, { context }) => {
        const sessionId = context?.memory?.sessionId;
        const entries = await store.load({ sessionId, keys });
        return entries;
      }
    )
  );

  actions.push(
    ai.defineTool(
      {
        name: 'memory/list_keys',
        description: 'Lists all keys currently stored in memory.',
        inputSchema: z.object({}),
        outputSchema: z.array(z.string()),
      },
      async (_, { context }) => {
        const sessionId = context?.memory?.sessionId;
        const keys = await store.listKeys({ sessionId });
        return keys;
      }
    )
  );

  actions.push(
    ai.defineTool(
      {
        name: 'memory/delete',
        description: 'Deletes a value from memory for a given key.',
        inputSchema: z.object({
          key: z.string().describe('The key to delete.'),
        }),
        outputSchema: z.string(),
      },
      async ({ key }, { context }) => {
        const sessionId = context?.memory?.sessionId;
        await store.delete({ sessionId, key });
        return `Successfully deleted memory for key: ${key} in session: ${sessionId || 'global'}`;
      }
    )
  );

  ai.defineResource(
    {
      name: 'memory_instructions',
      description: 'Provides instruction for how to use memory tools',
      uri: 'memory://kv/instructions',
    },
    async () => ({
      content: [{ text: KEY_VALUE_MEMORY_TOOLS_INSTRUCTIONS }],
    })
  );

  return actions;
}

export const KEY_VALUE_MEMORY_TOOLS = [
  'memory/set',
  'memory/get',
  'memory/list_keys',
  'memory/delete',
] as const;

export const KEY_VALUE_MEMORY_TOOLS_INSTRUCTIONS = `[instructions about memory tools]

You have access to the following tools that help you manage long-term memory: ${KEY_VALUE_MEMORY_TOOLS.join(
  ', '
)}

Use them when asked to remember things. Memory is a simple key-value store.
- Use 'memory/set' to store information with a specific key.
- Use 'memory/get' to retrieve information by its key.
- Use 'memory/list_keys' to see all stored keys.
- Use 'memory/delete' to delete information by its key.

When setting memory, choose a descriptive key that will help you retrieve the information later. It can a whole sentense if necessary.
When getting memory, ensure you use the exact key that was used to set the value.
When deleting memory, ensure you use the exact key that was used to set the value.

IMPORTANT:
 - Always start by listing available keys. It's important to know what you's been worked on in the past that is not avilable in the immediate converation history.
 - Never guess a key when deleting or getting entries. You MUST look up existing keys first.

[end of instructions about memory tools]
`;
