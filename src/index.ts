import { Genkit, ToolAction, z } from 'genkit';
import { EntitySchema, KnowledgeGraphSchema, ObservationSchema, RelationshipSchema } from './types.js';
import { FileGraphStore, Graph } from './graph.js';
import path from 'path';

// If MEMORY_FILE_PATH is just a filename, put it in the same directory as the script
const MEMORY_FILE_PATH = process.env.MEMORY_FILE_PATH ?? path.join(process.cwd(), 'memory.json');

const graph = new Graph(new FileGraphStore(MEMORY_FILE_PATH));

export function defineMemoryTools(ai: Genkit): ToolAction[] {
  const actions = [] as ToolAction[];
  actions.push(
    ai.defineTool(
      {
        name: 'memory/create_entities',
        description: 'Creates new entities in the knowledge graph. Entities represent distinct concepts or objects.',
        inputSchema: z.object({
          entities: z.array(EntitySchema),
        }),
        outputSchema: z.string(),
      },
      async ({ entities }) => {
        const newEntities = await graph.createEntities(entities);
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
        name: 'memory/create_relationships',
        description:
          'Creates new relationships between existing entities in the knowledge graph. Relationships define how entities are connected and should be expressed in active voice.',
        inputSchema: z.object({
          relationships: z.array(RelationshipSchema),
        }),
        outputSchema: z.string(),
      },
      async ({ relationships }) => {
        const newRelationships = await graph.createRelationships(relationships);
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
        name: 'memory/add_observations',
        description: 'Adds new observations to existing entities in the knowledge graph. Observations are factual details or attributes associated with an entity.',
        inputSchema: z.object({
          observations: z.array(ObservationSchema),
        }),
        outputSchema: z.string(),
      },
      async ({ observations }) => {
        const addedObservations = await graph.addObservations(observations);
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
        name: 'memory/delete_entities',
        description: 'Deletes specified entities from the knowledge graph. This action will also remove any relationships or observations associated with the deleted entities.',
        inputSchema: z.object({
          entityNames: z.array(z.string()),
        }),
        outputSchema: z.string(),
      },
      async ({ entityNames }) => {
        await graph.deleteEntities(entityNames);
        return 'Entities deleted successfully';
      }
    )
  );
  actions.push(
    ai.defineTool(
      {
        name: 'memory/delete_observations',
        description: 'Deletes specific observations from entities in the knowledge graph. You must specify the entity name and the exact observations to remove.',
        inputSchema: z.object({
          deletions: z.array(
            z.object({ entityName: z.string(), observations: z.array(z.string()) })
          ),
        }),
        outputSchema: z.string(),
      },
      async ({ deletions }) => {
        await graph.deleteObservations(deletions);
        return 'Observations deleted successfully';
      }
    )
  );
  actions.push(
    ai.defineTool(
      {
        name: 'memory/delete_relationships',
        description: 'Deletes specified relationships between entities in the knowledge graph. You must provide the exact relationship details to be deleted.',
        inputSchema: z.object({
          relationships: z.array(RelationshipSchema),
        }),
        outputSchema: z.string(),
      },
      async ({ relationships }) => {
        await graph.deleteRelationships(relationships);
        return 'Relationships deleted successfully';
      }
    )
  );
  actions.push(
    ai.defineTool(
      {
        name: 'memory/read_graph',
        description: 'Reads and returns the entire current state of the knowledge graph, including all entities, relationships, and observations.',
        outputSchema: KnowledgeGraphSchema,
      },
      async () => {
        return await graph.readGraph();
      }
    )
  );
  actions.push(
    ai.defineTool(
      {
        name: 'memory/search_nodes',
        description: 'Searches for entities (nodes) in the knowledge graph that match a given query. Returns a subgraph containing the matching entities and their direct relationships/observations.',
        inputSchema: z.object({
          query: z.string(),
        }),
        outputSchema: KnowledgeGraphSchema,
      },
      async ({ query }) => {
        return await graph.searchNodes(query);
      }
    )
  );
  actions.push(
    ai.defineTool(
      {
        name: 'memory/read_nodes',
        description: 'Reads and returns specific entities (nodes) from the knowledge graph by their exact names. Returns a subgraph containing the requested entities and their direct relationships/observations.',
        inputSchema: z.object({
          names: z.array(z.string()),
        }),
        outputSchema: KnowledgeGraphSchema,
      },
      async ({ names }) => {
        return await graph.openNodes(names);
      }
    )
  );
  return actions;
}

export const MEMORY_TOOLS = [
  'memory/create_entities',
  'memory/create_relationships',
  'memory/add_observations',
  'memory/delete_entities',
  'memory/delete_observations',
  'memory/delete_relationships',
  'memory/read_graph',
  'memory/search_nodes',
  'memory/read_nodes',
] as const;

export const MEMORY_TOOLS_INSTRUCTIONS = `[instructions about memory tools]
You have access to the following tools that help you manage long-term memory: ${MEMORY_TOOLS.join(
  ', '
)}

Use them when asked to remember things. Memory is a knowlege graph consisting of entities with observations and relationships between entities.
Always represent facts in those terms to make it easier to look up information later.

When asked to modify existing facts always look up correct entity/relationship names.

The search_nodes tool uses basic substring search, keep that in mind.

IMPORTANT:
 - If targeted search (search_nodes tool) returns nothing, awlays use read_graph tool next to get the full graph. search_nodes can be unreliable.
 - Never add or remove observations or relationships blindly, always look up current state first.
[end of instructions about memory tools]
`;
