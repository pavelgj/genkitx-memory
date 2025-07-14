# Genkit Memory Tools

This package provides a set of powerful tools for Genkit to manage long-term memory using both a simple Key-Value store and a more complex Knowledge Graph. It allows your Genkit flows to store, retrieve, and manipulate structured and unstructured information, enabling more sophisticated and context-aware AI applications.

## Installation

```bash
npm install genkitx-memory
# or pnpm install genkitx-memory
# or yarn add genkitx-memory
```

## Basic Usage (Key-Value Memory)

To get started with the Key-Value memory store:

```typescript
import { genkit } from "genkit/beta";
import { googleAI } from "@genkit-ai/googleai";
import { defineMemoryTools } from "genkitx-memory";

const ai = genkit({
  plugins: [googleAI()],
  model: googleAI.model("gemini-2.5-flash"),
});

const memoryTools = defineMemoryTools(ai);

ai.defineFlow("populate_memory", async () => {
  const { text } = await ai.generate({
    system: [{ resource: { uri: "memory://instructions" } }], // Referencing KV memory instructions
    prompt: `Remember that my favorite color is blue.`,
    tools: [...memoryTools],
  });
  return text;
});
```

## Key-Value Memory Store

The `genkitx-memory` package provides a simple yet effective Key-Value memory store. This is ideal for storing discrete pieces of information that can be easily retrieved by a unique key.

### Available Key-Value Memory Tools

The `defineMemoryTools` function exposes the following tools:

- `memory/save`: Saves one or more key-value pairs. If a key already exists, its value will be overwritten.
  - Input: `{ entries: [{ key: string, value: string }] }`
- `memory/load`: Retrieves values for specified keys. If no keys are provided, all entries for the current session are loaded.
  - Input: `{ keys?: string[] }`
  - Output: `[{ key: string, value: string }]`
- `memory/list_keys`: Lists all keys currently stored in memory for the current session.
  - Input: `{}`
  - Output: `string[]`
- `memory/delete`: Deletes a specific key-value pair from memory.
  - Input: `{ key: string }`

### Example Usage (Key-Value Memory)

You can find a complete example in `samples/kv.ts`.

To save data:

```typescript
await ai.generate({
  system: [{ resource: { uri: "memory://instructions" } }],
  prompt: `Save my name as 'Paul' and my occupation as 'Software Developer'.`,
  tools: [...memoryTools],
});
```

To load data:

```typescript
const result = await ai.generate({
  system: [{ resource: { uri: "memory://instructions" } }],
  prompt: `What is my name and occupation?`,
  tools: [...memoryTools],
});
```

## Graph Memory Store (Advanced)

For more complex relationships and structured data, the package also offers a Knowledge Graph memory store. This is inspired by the Model Context Protocol (MCP) memory server and allows for storing entities, relationships, and observations, enabling sophisticated querying and reasoning.

### Available Graph Memory Tools

The `defineGraphMemoryTools` function exposes a comprehensive set of tools for interacting with the knowledge graph:

- `memory/create_entities`: Create multiple new entities.
- `memory/create_relationships`: Create multiple new relationships between entities.
- `memory/add_observations`: Add new observations to existing entities.
- `memory/delete_entities`: Delete specified entities and their associated relationships/observations.
- `memory/delete_observations`: Delete specific observations from entities.
- `memory/delete_relationships`: Delete specified relationships between entities.
- `memory/read_graph`: Read the entire knowledge graph.
- `memory/search_nodes`: Search for entities matching a query.
- `memory/read_nodes`: Read specific entities by name.

### Example Usage (Graph Memory)

You can find a complete example in `samples/graph.ts`.

To populate the graph:

```typescript
import { defineGraphMemoryTools } from "genkitx-memory";

const graphMemoryTools = defineGraphMemoryTools(ai);

await ai.generate({
  system: [{ resource: { uri: "memory://instructions" } }], // Referencing Graph memory instructions
  prompt: `Remember that my name is Paul and I'm a Software Developer and I work at company Placeholder Software Inc.`,
  tools: [...graphMemoryTools],
});
```

To query the graph:

```typescript
const result = await ai.generate({
  system: [{ resource: { uri: "memory://instructions" } }],
  prompt: `Do you remember my name and where I work?`,
  tools: [...graphMemoryTools],
});
```

## Memory File Management

Both the Key-Value and Graph memory stores persist their data to local files. The base path for these files can be controlled via the `KV_MEMORY_FILE_PATH` and `GRAPH_MEMORY_FILE_PATH` environment variables respectively.

- If the environment variable is set, the package will use the specified path for the memory file.
- If not set, the memory files will default to `kv_memory.json` and `memory_graph.json` (or `kv_memory.json.<sessionId>` and `memory_graph.json.<sessionId>` for session-specific data) located in the current working directory.

This allows for flexible management of your memory data, enabling you to specify custom locations or rely on the default behavior for quick setup.

## Custom Store Implementations

Both `defineMemoryTools` and `defineGraphMemoryTools` accept an optional second parameter, `opts`, which allows you to provide your own custom implementations of `KeyValueStore` and `GraphStore` respectively. This is useful if you want to integrate with different storage backends (e.g., a database, a cloud storage service) instead of the default file-based storage.

For example:

```typescript
import { defineMemoryTools, KeyValueStore, Entry } from "genkitx-memory";

class MyCustomKeyValueStore implements KeyValueStore {
  async save(opts: { sessionId?: string; entries: Entry[] }): Promise<void> {
    // Implement custom save logic here (e.g., save to a database)
    console.log(`Saving to custom store for session ${opts.sessionId}:`, opts.entries);
  }
  async load(opts: { sessionId?: string; keys?: string[] }): Promise<Entry[]> {
    // Implement custom load logic here (e.g., load from a database)
    console.log(`Loading from custom store for session ${opts.sessionId}, keys:`, opts.keys);
    return []; // Return actual data from your store
  }
  async delete(opts: { sessionId?: string; key: string }): Promise<void> {
    // Implement custom delete logic here
    console.log(`Deleting from custom store for session ${opts.sessionId}, key:`, opts.key);
  }
  async listKeys(opts: { sessionId?: string }): Promise<string[]> {
    // Implement custom listKeys logic here
    console.log(`Listing keys from custom store for session ${opts.sessionId}`);
    return []; // Return actual keys from your store
  }
}

const myCustomStore = new MyCustomKeyValueStore();
const memoryTools = defineMemoryTools(ai, { store: myCustomStore });
```

By implementing the `KeyValueStore` or `GraphStore` interfaces, you can seamlessly swap out the underlying storage mechanism without altering your Genkit flow logic.

## Running as an MCP Server

You can run `genkitx-memory` as an MCP server (stdio) using the following command:

```bash
npx -y genkitx-memory
```

### Agent Rules for MCP Server Usage

To enable agents (like Gemini CLI, Cline, or Claude Code) to effectively use the `genkitx-memory` MCP server, include the following rules in their configuration (e.g., `GEMINI.md`, `.clienerule`, `CLAUDE.md`):

```
[instructions about memory tools]

You have access to tools that help you manage long-term memory.
Use them when asked to remember things. Memory is a simple key-value store.
- Use 'memory_set' to store information with a specific key.
- Use 'memory_get' to retrieve information by its key.
- Use 'memory_list_keys' to see all stored keys.
- Use 'memory_delete' to delete information by its key.

When setting memory, choose a descriptive key that will help you retrieve the information later. It can be a whole sentense if necessary.
When getting memory, ensure you use the exact key that was used to set the value.
When deleting memory, ensure you use the exact key that was used to set the value.

IMPORTANT:
 - Always start by listing available keys. It's important to know what you's been worked on in the past that is not avilable in the immediate converation history.
 - Never guess a key when deleting or getting entries. You MUST look up existing keys first.

[end of instructions about memory tools]
```


Learn more about Genkit on https://genkit.dev

Get started with Genkit: https://genkit.dev/docs/get-started/