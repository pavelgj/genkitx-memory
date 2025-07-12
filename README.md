# Genkit Memory Tools

This package provides a set of powerful tools for Genkit to manage long-term memory using a knowledge graph. It allows your Genkit flows to store, retrieve, and manipulate structured information, enabling more sophisticated and context-aware AI applications.

## Installation

```bash
npm install genkitx-memory
# or pnpm install genkitx-memory
# or yarn add genkitx-memory
```

## Basic usage

```typescript
import { genkit } from "genkit";
import { googleAI } from "@genkit-ai/googleai";
import { defineMemoryTools, MEMORY_TOOLS_INSTRUCTIONS } from "genkitx-memory";

const ai = genkit({
  plugins: [googleAI()],
  model: googleAI.model("gemini-2.5-flash"),
});

const memoryTools = defineMemoryTools(ai);

ai.defineFlow("populate_graph", async () => {
  const { text } = await ai.generate({
    system: MEMORY_TOOLS_INSTRUCTIONS, // Crucial for guiding the LLM
    prompt: `Remember that my name is Paul and I'm a Software Developer and I work at company Placeholder Software Inc.`,
    tools: [...memoryTools], // Pass the memory tools to the LLM
  });
  return text;
});
```

## Usage

The `genkitx-memory` package exposes `defineMemoryTools`, `MEMORY_TOOLS`, and `MEMORY_TOOLS_INSTRUCTIONS`.

- `defineMemoryTools`: This function takes your Genkit instance (`ai`) and returns an array of `ToolAction` objects, which are the actual memory tools. You should include these in your Genkit `tools` array when defining flows that need memory access.
- `MEMORY_TOOLS_INSTRUCTIONS`: This is a string containing important instructions for the LLM on how to effectively use the memory tools. **It is crucial to include these instructions in the prompt (either system or user) of your `ai.generate` calls when using memory tools.** This guides the LLM to properly format its requests and understand the memory graph structure. You don't have to use these specific instructions, just remember that without any instructions the LLM is unlikely to use these tools correctly.
- `MEMORY_TOOLS`: This is a constant array of strings, listing the names of all available memory tools (e.g., `'memory/create_entities'`). It can be used in place of tools returned from `defineMemoryTools`.

## Examples

### Populating the Knowledge Graph

To store information in the memory:

```typescript
ai.generate({
  system: MEMORY_TOOLS_INSTRUCTIONS, // Crucial for guiding the LLM
  prompt: `Remember that my name is Paul and I'm a Software Developer and I work at company Placeholder Software Inc.`,
  tools: [...memoryTools], // Expose all memory tools to the LLM
});
```

In this example:

- The `system` prompt includes `MEMORY_TOOLS_INSTRUCTIONS`, which tells the LLM how to interact with the memory tools.
- The `prompt` instructs the LLM to "remember" facts. The LLM, guided by the `MEMORY_TOOLS_INSTRUCTIONS`, will then call appropriate memory tools (like `memory/create_entities` and `memory/create_relationships`) to store this information in the knowledge graph.
- `tools: [...memoryTools]` ensures that all memory management tools are available for the LLM to use.

### Checking Stored Information

To query the memory:

```typescript
ai.generate({
  system: MEMORY_TOOLS_INSTRUCTIONS,
  prompt: `do you remember my name? check memory.`,
  tools: [...memoryTools], // Use the defined memoryTools
});
```

### Other Memory Operations

Here are examples of other memory operations:

- **Adding observations**:
  ```typescript
  ai.generate({
    system: MEMORY_TOOLS_INSTRUCTIONS,
    prompt: `Paul likes TypeScript. Remember this observation`,
    tools: [...memoryTools],
  });
  ```
- **Deleting observations**:
  ```typescript
  ai.generate({
    system: MEMORY_TOOLS_INSTRUCTIONS,
    prompt: `Forget that Paul likes TypeScript. `,
    tools: [...memoryTools],
  });
  ```
- **Deleting relationships**:
  ```typescript
  ai.generate({
    system: MEMORY_TOOLS_INSTRUCTIONS,
    prompt: `Forget that Paul is a Software Developer.`,
    tools: [...memoryTools],
  });
  ```

## Available Memory Tools

This plugin provides the following tools, which are exposed via `defineMemoryTools`:

- `memory/create_entities`: Create multiple new entities in the knowledge graph.
- `memory/create_relationships`: Create multiple new relationships between existing entities in the knowledge graph. Relationships should be in active voice.
- `memory/add_observations`: Add new observations to existing entities in the knowledge graph.
- `memory/delete_entities`: Delete specified entities from the knowledge graph. This action will also remove any relationships or observations associated with the deleted entities.
- `memory/delete_observations`: Delete specific observations from entities in the knowledge graph. You must specify the entity name and the exact observations to remove.
- `memory/delete_relationships`: Delete specified relationships between entities in the knowledge graph. You must provide the exact relationship details to be deleted.
- `memory/read_graph`: Read the entire knowledge graph, including all entities, relationships, and observations.
- `memory/search_nodes`: Search for entities (nodes) in the knowledge graph that match a given query. Returns a subgraph containing the matching entities and their direct relationships/observations.
- `memory/read_nodes`: Read and return specific entities (nodes) from the knowledge graph by their exact names. Returns a subgraph containing the requested entities and their direct relationships/observations.

This is inspired by MCP memory server from: https://github.com/modelcontextprotocol/servers/tree/main/src/memory

## Memory File Management

The `genkitx-memory` package stores its knowledge graph data in a local file. The path to this file can be controlled via the `MEMORY_FILE_PATH` environment variable.

- If `MEMORY_FILE_PATH` is set, the package will use the specified path for the memory file.
- If `MEMORY_FILE_PATH` is not set, the memory file will default to `memory.json` located in the current working directory where the application is run.

This allows for flexible management of your knowledge graph data, enabling you to specify a custom location or rely on the default behavior for quick setup.

Learn more about genkit on https://genkit.dev
