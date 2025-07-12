import { afterEach, beforeEach, describe, it } from 'node:test';
import * as assert from 'assert';
import { Graph, GraphStore } from '../src/graph.js';
import { Entity, KnowledgeGraph, Observation, Relationship } from '../src/types.js';

class MockGraphStore implements GraphStore {
  private graph: KnowledgeGraph = { entities: [], relationships: [] };

  async loadGraph(): Promise<KnowledgeGraph> {
    return JSON.parse(JSON.stringify(this.graph)); // Deep copy to avoid direct modification
  }

  async saveGraph(graph: KnowledgeGraph): Promise<void> {
    this.graph = JSON.parse(JSON.stringify(graph)); // Deep copy
  }

  setGraph(graph: KnowledgeGraph) {
    this.graph = JSON.parse(JSON.stringify(graph));
  }
}

describe('Graph', () => {
  let mockStore: MockGraphStore;
  let graph: Graph;

  beforeEach(() => {
    mockStore = new MockGraphStore();
    graph = new Graph(mockStore);
  });

  afterEach(() => {
    // Clean up if necessary, though mockStore is reset in beforeEach
  });

  it('should create new entities and not duplicate existing ones', async () => {
    const initialEntities: Entity[] = [{ name: 'Entity1', entityType: 'TypeA', observations: [] }];
    mockStore.setGraph({ entities: initialEntities, relationships: [] });

    const newEntities: Entity[] = [
      { name: 'Entity2', entityType: 'TypeB', observations: [] },
      { name: 'Entity1', entityType: 'TypeA', observations: [] }, // Duplicate
    ];

    const created = await graph.createEntities(newEntities);
    assert.strictEqual(created.length, 1, 'Should create only one new entity');
    assert.strictEqual(created[0].name, 'Entity2', 'Should return the new entity');

    const currentGraph = await mockStore.loadGraph();
    assert.strictEqual(currentGraph.entities.length, 2, 'Graph should contain two entities');
    assert.ok(currentGraph.entities.some((e) => e.name === 'Entity1'));
    assert.ok(currentGraph.entities.some((e) => e.name === 'Entity2'));
  });

  it('should create new relationships and not duplicate existing ones', async () => {
    const initialRelationships: Relationship[] = [
      { from: 'EntityA', to: 'EntityB', relationshipType: 'RELATES_TO' },
    ];
    mockStore.setGraph({ entities: [], relationships: initialRelationships });

    const newRelationships: Relationship[] = [
      { from: 'EntityC', to: 'EntityD', relationshipType: 'HAS_A' },
      { from: 'EntityA', to: 'EntityB', relationshipType: 'RELATES_TO' }, // Duplicate
    ];

    const created = await graph.createRelationships(newRelationships);
    assert.strictEqual(created.length, 1, 'Should create only one new relationship');
    assert.strictEqual(created[0].from, 'EntityC', 'Should return the new relationship');

    const currentGraph = await mockStore.loadGraph();
    assert.strictEqual(
      currentGraph.relationships.length,
      2,
      'Graph should contain two relationships'
    );
    assert.ok(currentGraph.relationships.some((r) => r.from === 'EntityA' && r.to === 'EntityB'));
    assert.ok(currentGraph.relationships.some((r) => r.from === 'EntityC' && r.to === 'EntityD'));
  });

  it('should add observations to existing entities', async () => {
    const initialEntities: Entity[] = [
      { name: 'Entity1', entityType: 'TypeA', observations: ['obs1'] },
    ];
    mockStore.setGraph({ entities: initialEntities, relationships: [] });

    const observations: Observation[] = [
      { entityName: 'Entity1', contents: ['obs2', 'obs1', 'obs3'] }, // obs1 is duplicate
    ];

    const results = await graph.addObservations(observations);
    assert.strictEqual(results.length, 1, 'Should process one entity');
    assert.strictEqual(results[0].entityName, 'Entity1');
    assert.deepStrictEqual(
      results[0].addedObservations.sort(),
      ['obs2', 'obs3'].sort(),
      'Should return only new observations'
    );

    const currentGraph = await mockStore.loadGraph();
    const entity1 = currentGraph.entities.find((e) => e.name === 'Entity1');
    assert.ok(entity1, 'Entity1 should exist');
    assert.deepStrictEqual(
      entity1.observations.sort(),
      ['obs1', 'obs2', 'obs3'].sort(),
      'Entity1 should have all observations'
    );
  });

  it('should throw error if entity not found when adding observations', async () => {
    const observations: Observation[] = [{ entityName: 'NonExistentEntity', contents: ['obs1'] }];
    await assert.rejects(
      graph.addObservations(observations),
      new Error('Entity with name NonExistentEntity not found'),
      'Should throw error for non-existent entity'
    );
  });

  it('should delete specified entities and their related relationships', async () => {
    const initialEntities: Entity[] = [
      { name: 'Entity1', entityType: 'TypeA', observations: [] },
      { name: 'Entity2', entityType: 'TypeB', observations: [] },
      { name: 'Entity3', entityType: 'TypeC', observations: [] },
    ];
    const initialRelationships: Relationship[] = [
      { from: 'Entity1', to: 'Entity2', relationshipType: 'RELATES_TO' },
      { from: 'Entity2', to: 'Entity3', relationshipType: 'HAS_A' },
      { from: 'Entity3', to: 'Entity1', relationshipType: 'OWNS' },
    ];
    mockStore.setGraph({ entities: initialEntities, relationships: initialRelationships });

    await graph.deleteEntities(['Entity1', 'Entity3']);

    const currentGraph = await mockStore.loadGraph();
    assert.strictEqual(currentGraph.entities.length, 1, 'Should have one entity left');
    assert.strictEqual(currentGraph.entities[0].name, 'Entity2', 'Entity2 should remain');
    assert.strictEqual(
      currentGraph.relationships.length,
      0,
      'All relationships involving deleted entities should be removed'
    );
  });

  it('should delete specified observations from entities', async () => {
    const initialEntities: Entity[] = [
      { name: 'Entity1', entityType: 'TypeA', observations: ['obs1', 'obs2', 'obs3'] },
      { name: 'Entity2', entityType: 'TypeB', observations: ['obs4', 'obs5'] },
    ];
    mockStore.setGraph({ entities: initialEntities, relationships: [] });

    const deletions = [
      { entityName: 'Entity1', observations: ['obs1', 'obs3'] },
      { entityName: 'Entity2', observations: ['obs5'] },
      { entityName: 'NonExistentEntity', observations: ['obsX'] }, // Should be ignored
    ];

    await graph.deleteObservations(deletions);

    const currentGraph = await mockStore.loadGraph();
    const entity1 = currentGraph.entities.find((e) => e.name === 'Entity1');
    const entity2 = currentGraph.entities.find((e) => e.name === 'Entity2');

    assert.ok(entity1, 'Entity1 should exist');
    assert.deepStrictEqual(entity1.observations, ['obs2'], 'Entity1 should have obs2 remaining');
    assert.ok(entity2, 'Entity2 should exist');
    assert.deepStrictEqual(entity2.observations, ['obs4'], 'Entity2 should have obs4 remaining');
  });

  it('should delete specified relationships', async () => {
    const initialRelationships: Relationship[] = [
      { from: 'A', to: 'B', relationshipType: 'TYPE1' },
      { from: 'B', to: 'C', relationshipType: 'TYPE2' },
      { from: 'C', to: 'A', relationshipType: 'TYPE3' },
    ];
    mockStore.setGraph({ entities: [], relationships: initialRelationships });

    const relationshipsToDelete: Relationship[] = [
      { from: 'A', to: 'B', relationshipType: 'TYPE1' },
      { from: 'X', to: 'Y', relationshipType: 'NON_EXISTENT' }, // Non-existent
    ];

    await graph.deleteRelationships(relationshipsToDelete);

    const currentGraph = await mockStore.loadGraph();
    assert.strictEqual(currentGraph.relationships.length, 2, 'Should have two relationships left');
    assert.ok(currentGraph.relationships.some((r) => r.from === 'B' && r.to === 'C'));
    assert.ok(currentGraph.relationships.some((r) => r.from === 'C' && r.to === 'A'));
  });

  it('should read the entire graph', async () => {
    const initialGraph: KnowledgeGraph = {
      entities: [{ name: 'E1', entityType: 'T1', observations: [] }],
      relationships: [{ from: 'E1', to: 'E2', relationshipType: 'R1' }],
    };
    mockStore.setGraph(initialGraph);

    const readGraph = await graph.readGraph();
    assert.deepStrictEqual(readGraph, initialGraph, 'Should return the exact graph from the store');
  });

  it('should search nodes by name, type, or observation content', async () => {
    const initialEntities: Entity[] = [
      { name: 'Apple', entityType: 'Fruit', observations: ['Red', 'Sweet'] },
      { name: 'Banana', entityType: 'Fruit', observations: ['Yellow', 'Long'] },
      { name: 'Car', entityType: 'Vehicle', observations: ['Fast', 'Wheels'] },
    ];
    const initialRelationships: Relationship[] = [
      { from: 'Apple', to: 'Banana', relationshipType: 'COMPLEMENTS' },
      { from: 'Car', to: 'Wheels', relationshipType: 'HAS_PART' },
    ];
    mockStore.setGraph({ entities: initialEntities, relationships: initialRelationships });

    // Search by name
    let result = await graph.searchNodes('apple');
    assert.strictEqual(result.entities.length, 1);
    assert.strictEqual(result.entities[0].name, 'Apple');
    assert.strictEqual(
      result.relationships.length,
      1,
      'Relationships should include those between filtered entities'
    );
    assert.strictEqual(result.relationships[0].from, 'Apple');

    // Search by entity type
    result = await graph.searchNodes('fruit');
    assert.strictEqual(result.entities.length, 2);
    assert.ok(result.entities.some((e) => e.name === 'Apple'));
    assert.ok(result.entities.some((e) => e.name === 'Banana'));
    assert.strictEqual(
      result.relationships.length,
      1,
      'Relationships should include those between filtered entities'
    );
    assert.strictEqual(result.relationships[0].from, 'Apple');

    // Search by observation
    result = await graph.searchNodes('yellow');
    assert.strictEqual(result.entities.length, 1);
    assert.strictEqual(result.entities[0].name, 'Banana');
    assert.strictEqual(
      result.relationships.length,
      1,
      'Should include relationships connected to the found entity'
    );
    assert.strictEqual(result.relationships[0].from, 'Apple');
    assert.strictEqual(result.relationships[0].to, 'Banana');

    // Search with no match
    result = await graph.searchNodes('xyz');
    assert.strictEqual(result.entities.length, 0);
    assert.strictEqual(result.relationships.length, 0);
  });

  it('should open nodes by exact name and include relevant relationships', async () => {
    const initialEntities: Entity[] = [
      { name: 'NodeA', entityType: 'Type1', observations: [] },
      { name: 'NodeB', entityType: 'Type2', observations: [] },
      { name: 'NodeC', entityType: 'Type3', observations: [] },
    ];
    const initialRelationships: Relationship[] = [
      { from: 'NodeA', to: 'NodeB', relationshipType: 'R1' },
      { from: 'NodeB', to: 'NodeC', relationshipType: 'R2' },
      { from: 'NodeX', to: 'NodeY', relationshipType: 'R3' }, // Not connected to A, B, C
    ];
    mockStore.setGraph({ entities: initialEntities, relationships: initialRelationships });

    const result = await graph.openNodes(['NodeA', 'NodeC', 'NonExistent']);

    assert.strictEqual(result.entities.length, 2, 'Should return only existing entities');
    assert.ok(result.entities.some((e) => e.name === 'NodeA'));
    assert.ok(result.entities.some((e) => e.name === 'NodeC'));

    assert.strictEqual(
      result.relationships.length,
      2,
      'Should include relationships connected to opened nodes'
    );
    assert.ok(result.relationships.some((r) => r.from === 'NodeA' && r.to === 'NodeB'));
    assert.ok(result.relationships.some((r) => r.from === 'NodeB' && r.to === 'NodeC'));
    assert.ok(!result.relationships.some((r) => r.from === 'NodeX'));
  });
});
