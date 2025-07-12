import { AddedObservationResult, DeletedObservation, Entity, KnowledgeGraph, Observation, Relationship } from './types.js';
import { promises as fs } from 'fs';

/**
 * Interface for defining how a knowledge graph is loaded and saved.
 */
export interface GraphStore {
  /**
   * Loads the knowledge graph from the store.
   * @returns A promise that resolves to the KnowledgeGraph.
   */
  loadGraph(): Promise<KnowledgeGraph>;
  /**
   * Saves the knowledge graph to the store.
   * @param graph The KnowledgeGraph to save.
   * @returns A promise that resolves when the graph is saved.
   */
  saveGraph(graph: KnowledgeGraph): Promise<void>;
}

/**
 * Implements GraphStore to load and save a knowledge graph from/to a file.
 * Each entity and relationship is stored as a JSON object on a new line.
 */
export class FileGraphStore implements GraphStore {
  private memoryFilePath: string;

  /**
   * Creates an instance of FileGraphStore.
   * @param memoryFilePath The path to the file where the graph will be stored.
   */
  constructor(memoryFilePath: string) {
    this.memoryFilePath = memoryFilePath;
  }

  /**
   * Loads the knowledge graph from the specified file.
   * If the file does not exist, an empty graph is returned.
   * @returns A promise that resolves to the loaded KnowledgeGraph.
   */
  async loadGraph(): Promise<KnowledgeGraph> {
    try {
      const fileContent = await fs.readFile(this.memoryFilePath, 'utf-8');
      const lines = fileContent.split('\n').filter((line) => line.trim() !== '');

      const loadedGraph: KnowledgeGraph = { entities: [], relationships: [] };

      for (const line of lines) {
        const item = JSON.parse(line);
        if (item.type === 'entity') {
          loadedGraph.entities.push(item as Entity);
        } else if (item.type === 'relationship') {
          loadedGraph.relationships.push(item as Relationship);
        }
      }
      return loadedGraph;
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as any).code === 'ENOENT') {
        return { entities: [], relationships: [] };
      }
      throw error;
    }
  }

  /**
   * Saves the knowledge graph to the specified file.
   * Each entity and relationship is stringified and written on a new line.
   * @param graph The KnowledgeGraph to save.
   * @returns A promise that resolves when the graph is saved.
   */
  async saveGraph(graph: KnowledgeGraph): Promise<void> {
    const lines = [
      ...graph.entities.map((e) => JSON.stringify({ type: 'entity', ...e })),
      ...graph.relationships.map((r) => JSON.stringify({ type: 'relationship', ...r })),
    ];
    await fs.writeFile(this.memoryFilePath, lines.join('\n'));
  }
}

/**
 * Manages operations on a knowledge graph, including creating, reading, updating, and deleting entities, relationships, and observations.
 * It uses a GraphStore implementation to persist the graph data.
 */
export class Graph {
  private store: GraphStore;

  /**
   * Creates an instance of Graph.
   * @param store An implementation of GraphStore to handle graph persistence.
   */
  constructor(store: GraphStore) {
    this.store = store;
  }

  /**
   * A private helper method to load, modify, and save the graph.
   * @param modifier A function that takes the graph and returns a result.
   * @returns A promise that resolves to the result of the modifier function.
   */
  private async _withGraphPersistence<T>(
    modifier: (graph: KnowledgeGraph) => T
  ): Promise<T> {
    const graph = await this.store.loadGraph();
    const result = modifier(graph);
    await this.store.saveGraph(graph);
    return result;
  }

  /**
   * Adds new entities to the graph. Only entities that do not already exist (based on name) are added.
   * @param entities An array of Entity objects to create.
   * @returns A promise that resolves to an array of newly created entities.
   */
  async createEntities(entities: Entity[]): Promise<Entity[]> {
    return this._withGraphPersistence((graph) => {
      const newEntities = entities.filter(
        (e) => !graph.entities.some((existingEntity) => existingEntity.name === e.name)
      );
      graph.entities.push(...newEntities);
      return newEntities;
    });
  }

  /**
   * Adds new relationships to the graph. Only relationships that do not already exist (based on from, to, and type) are added.
   * @param relationships An array of Relationship objects to create.
   * @returns A promise that resolves to an array of newly created relationships.
   */
  async createRelationships(relationships: Relationship[]): Promise<Relationship[]> {
    return this._withGraphPersistence((graph) => {
      const newRelationships = relationships.filter(
        (r) =>
          !graph.relationships.some(
            (existingRelationship) =>
              existingRelationship.from === r.from &&
              existingRelationship.to === r.to &&
              existingRelationship.relationshipType === r.relationshipType
          )
      );
      graph.relationships.push(...newRelationships);
      return newRelationships;
    });
  }

  /**
   * Adds observations to existing entities. If an entity does not exist, an error is thrown.
   * Only new observations (not already present for the entity) are added.
   * @param observations An array of Observation objects to add.
   * @returns A promise that resolves to an array of objects, each indicating the entity name and the observations that were added.
   */
  async addObservations(observations: Observation[]): Promise<AddedObservationResult[]> {
    return this._withGraphPersistence((graph) => {
      const results = observations.map((o) => {
        const entity = graph.entities.find((e) => e.name === o.entityName);
        if (!entity) {
          throw new Error(`Entity with name ${o.entityName} not found`);
        }
        const newObservations = o.contents.filter(
          (content) => !entity.observations.includes(content)
        );
        entity.observations.push(...newObservations);
        return { entityName: o.entityName, addedObservations: newObservations };
      });
      return results;
    });
  }

  /**
   * Deletes entities and any relationships connected to them from the graph.
   * @param entityNames An array of entity names to delete.
   * @returns A promise that resolves when the entities and related relationships are deleted.
   */
  async deleteEntities(entityNames: string[]): Promise<void> {
    await this._withGraphPersistence((graph) => {
      graph.entities = graph.entities.filter((e) => !entityNames.includes(e.name));
      graph.relationships = graph.relationships.filter(
        (r) => !entityNames.includes(r.from) && !entityNames.includes(r.to)
      );
    });
  }

  /**
   * Deletes specific observations from entities.
   * @param deletions An array of objects, each specifying an entity name and an array of observations to delete from it.
   * @returns A promise that resolves when the observations are deleted.
   */
  async deleteObservations(deletions: DeletedObservation[]): Promise<void> {
    await this._withGraphPersistence((graph) => {
      deletions.forEach((d) => {
        const entity = graph.entities.find((e) => e.name === d.entityName);
        if (entity) {
          entity.observations = entity.observations.filter((o) => !d.observations.includes(o));
        }
      });
    });
  }

  /**
   * Deletes specific relationships from the graph.
   * @param relationships An array of Relationship objects to delete.
   * @returns A promise that resolves when the relationships are deleted.
   */
  async deleteRelationships(relationships: Relationship[]): Promise<void> {
    await this._withGraphPersistence((graph) => {
      graph.relationships = graph.relationships.filter(
        (r) =>
          !relationships.some(
            (delRelationship) =>
              r.from === delRelationship.from &&
              r.to === delRelationship.to &&
              delRelationship.relationshipType === r.relationshipType
          )
      );
    });
  }

  /**
   * Reads and returns the entire knowledge graph.
   * @returns A promise that resolves to the complete KnowledgeGraph.
   */
  async readGraph(): Promise<KnowledgeGraph> {
    return this.store.loadGraph();
  }

  /**
   * A private helper method to filter entities and their connected relationships from a given graph.
   * @param graph The KnowledgeGraph to filter.
   * @param entityFilter A function that takes an Entity and returns true if it should be included.
   * @returns A KnowledgeGraph containing the filtered entities and their relevant relationships.
   */
  private _filterGraph(
    graph: KnowledgeGraph,
    entityFilter: (entity: Entity) => boolean
  ): KnowledgeGraph {
    const filteredEntities = graph.entities.filter(entityFilter);
    const filteredEntityNames = new Set(filteredEntities.map((entity) => entity.name));

    const filteredRelationships = graph.relationships.filter(
      (relationship) =>
        filteredEntityNames.has(relationship.from) ||
        filteredEntityNames.has(relationship.to)
    );

    return {
      entities: filteredEntities,
      relationships: filteredRelationships,
    };
  }

  /**
   * Searches for entities and their connected relationships based on a query string.
   * The search is performed on entity name, entity type, and observations.
   * @param query The search string.
   * @returns A promise that resolves to a KnowledgeGraph containing matching entities and their relevant relationships.
   */
  async searchNodes(query: string): Promise<KnowledgeGraph> {
    const graph = await this.store.loadGraph();
    const lowerCaseQuery = query.toLowerCase();

    return this._filterGraph(
      graph,
      (entity) =>
        entity.name.toLowerCase().includes(lowerCaseQuery) ||
        entity.entityType.toLowerCase().includes(lowerCaseQuery) ||
        entity.observations.some((observation) =>
          observation.toLowerCase().includes(lowerCaseQuery)
        )
    );
  }

  /**
   * Retrieves a subgraph containing specific entities by name and their connected relationships.
   * @param names An array of entity names to retrieve.
   * @returns A promise that resolves to a KnowledgeGraph containing the specified entities and their relevant relationships.
   */
  async openNodes(names: string[]): Promise<KnowledgeGraph> {
    const graph = await this.store.loadGraph();
    return this._filterGraph(graph, (entity) => names.includes(entity.name));
  }
}
