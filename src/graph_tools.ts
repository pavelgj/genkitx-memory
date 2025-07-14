import { ToolAction, z } from 'genkit';
import {
  EntitySchema,
  KnowledgeGraphSchema,
  ObservationSchema,
  RelationshipSchema,
} from './types.js';
import { FileGraphStore, Graph, GraphStore } from './graph.js';
import path from 'path';
import { GenkitBeta } from 'genkit/beta';

export function defineGraphMemoryTools(
  ai: GenkitBeta,
  opts?: { store?: GraphStore; memoryFilePath?: string }
): ToolAction[] {
  const memoryFilePath =
    opts?.memoryFilePath ?? process.env.GRAPH_MEMORY_FILE_PATH ?? path.join(process.cwd(), 'memory_graph.json');

  const graph = new Graph(opts?.store ?? new FileGraphStore(memoryFilePath));

  const actions = [] as ToolAction[];
  actions.push(
    ai.defineTool(
      {
        name: 'memory_create_entities',
        description:
          'Creates new entities in the knowledge graph. Entities represent distinct concepts or objects.',
        inputSchema: z.object({
          entities: z.array(EntitySchema),
        }),
        outputSchema: z.string(),
      },
      async ({ entities }, { context }) => {
        const sessionId = context?.memory?.sessionId;
        const newEntities = await graph.createEntities(sessionId, entities);
        return `Created the following new entities:\n\n${JSON.stringify(
          newEntities,
          undefined,
          2
        )}`;
      }
    )
  );
  actions.push(
    ai.defineTool(
      {
        name: 'memory_create_relationships',
        description:
          'Creates new relationships between existing entities in the knowledge graph. Relationships define how entities are connected and should be expressed in active voice.',
        inputSchema: z.object({
          relationships: z.array(RelationshipSchema),
        }),
        outputSchema: z.string(),
      },
      async ({ relationships }, { context }) => {
        const sessionId = context?.memory?.sessionId;
        const newRelationships = await graph.createRelationships(sessionId, relationships);
        return `Created the following new relationships:\n\n${JSON.stringify(
          newRelationships,
          undefined,
          2
        )}`;
      }
    )
  );
  actions.push(
    ai.defineTool(
      {
        name: 'memory_add_observations',
        description:
          'Adds new observations to existing entities in the knowledge graph. Observations are factual details or attributes associated with an entity.',
        inputSchema: z.object({
          observations: z.array(ObservationSchema),
        }),
        outputSchema: z.string(),
      },
      async ({ observations }, { context }) => {
        const sessionId = context?.memory?.sessionId;
        const addedObservations = await graph.addObservations(sessionId, observations);
        return `Added the following observations:\n\n${JSON.stringify(
          addedObservations,
          undefined,
          2
        )}`;
      }
    )
  );
  actions.push(
    ai.defineTool(
      {
        name: 'memory_delete_entities',
        description:
          'Deletes specified entities from the knowledge graph. This action will also remove any relationships or observations associated with the deleted entities.',
        inputSchema: z.object({
          entityNames: z.array(z.string()),
        }),
        outputSchema: z.string(),
      },
      async ({ entityNames }, { context }) => {
        const sessionId = context?.memory?.sessionId;
        await graph.deleteEntities(sessionId, entityNames);
        return 'Entities deleted successfully';
      }
    )
  );
  actions.push(
    ai.defineTool(
      {
        name: 'memory_delete_observations',
        description:
          'Deletes specific observations from entities in the knowledge graph. You must specify the entity name and the exact observations to remove.',
        inputSchema: z.object({
          deletions: z.array(
            z.object({ entityName: z.string(), observations: z.array(z.string()) })
          ),
        }),
        outputSchema: z.string(),
      },
      async ({ deletions }, { context }) => {
        const sessionId = context?.memory?.sessionId;
        await graph.deleteObservations(sessionId, deletions);
        return 'Observations deleted successfully';
      }
    )
  );
  actions.push(
    ai.defineTool(
      {
        name: 'memory_delete_relationships',
        description:
          'Deletes specified relationships between entities in the knowledge graph. You must provide the exact relationship details to be deleted.',
        inputSchema: z.object({
          relationships: z.array(RelationshipSchema),
        }),
        outputSchema: z.string(),
      },
      async ({ relationships }, { context }) => {
        const sessionId = context?.memory?.sessionId;
        await graph.deleteRelationships(sessionId, relationships);
        return 'Relationships deleted successfully';
      }
    )
  );
  actions.push(
    ai.defineTool(
      {
        name: 'memory_read_graph',
        description:
          'Reads and returns the entire current state of the knowledge graph, including all entities, relationships, and observations.',
        outputSchema: KnowledgeGraphSchema,
      },
      async (_, { context }) => {
        const sessionId = context?.memory?.sessionId;
        return await graph.readGraph(sessionId);
      }
    )
  );
  actions.push(
    ai.defineTool(
      {
        name: 'memory_search_nodes',
        description:
          'Searches for entities (nodes) in the knowledge graph that match a given query. Returns a subgraph containing the matching entities and their direct relationships/observations.',
        inputSchema: z.object({
          query: z.string(),
        }),
        outputSchema: KnowledgeGraphSchema,
      },
      async ({ query }, { context }) => {
        const sessionId = context?.memory?.sessionId;
        return await graph.searchNodes(sessionId, query);
      }
    )
  );
  actions.push(
    ai.defineTool(
      {
        name: 'memory_read_nodes',
        description:
          'Reads and returns specific entities (nodes) from the knowledge graph by their exact names. Returns a subgraph containing the requested entities and their direct relationships/observations.',
        inputSchema: z.object({
          names: z.array(z.string()),
        }),
        outputSchema: KnowledgeGraphSchema,
      },
      async ({ names }, { context }) => {
        const sessionId = context?.memory?.sessionId;
        return await graph.openNodes(sessionId, names);
      }
    )
  );

  ai.defineResource(
    {
      name: 'memory_graph_instructions',
      description: 'Provides instruction for how to use memory graph tools',
      uri: 'memory://instructions',
    },
    async () => ({
      content: [{ text: GRAPH_MEMORY_TOOLS_INSTRUCTIONS }],
    })
  );

  return actions;
}

export const GRAPH_MEMORY_TOOLS = [
  'memory_create_entities',
  'memory_create_relationships',
  'memory_add_observations',
  'memory_delete_entities',
  'memory_delete_observations',
  'memory_delete_relationships',
  'memory_read_graph',
  'memory_search_nodes',
  'memory_read_nodes',
] as const;

export const GRAPH_MEMORY_TOOLS_INSTRUCTIONS = `[instructions about memory tools]

You have access to the following tools that help you manage long-term memory: ${GRAPH_MEMORY_TOOLS.join(
  ', '
)}

Use them when asked to remember things. Memory is a knowlege graph consisting of entities with observations and relationships between entities.
Always represent facts in those terms to make it easier to look up information later.

When asked to modify existing facts always look up correct entity/relationship names.

The search_nodes tool uses basic substring search, keep that in mind.

IMPORTANT:
 - If targeted search (search_nodes tool) returns nothing, awlays use read_graph tool next to get the full graph. search_nodes can be unreliable.
 - Never guess entity names, you MUST look up current state first.

[end of instructions about memory tools]
`;
