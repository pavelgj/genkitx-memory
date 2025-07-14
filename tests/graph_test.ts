import { afterEach, beforeEach, describe, it } from 'node:test';
import * as assert from 'assert';
import { Graph, GraphStore } from '../src/graph.js';
import { Entity, KnowledgeGraph, Observation, Relationship } from '../src/types.js';

class MockGraphStore implements GraphStore {
  private graphs: Map<string, KnowledgeGraph> = new Map();
  private readonly GLOBAL_SESSION_KEY = '__GLOBAL__';

  private getSessionKey(sessionId: string | undefined): string {
    return sessionId === undefined ? this.GLOBAL_SESSION_KEY : sessionId;
  }

  async loadGraph(sessionId: string | undefined): Promise<KnowledgeGraph> {
    const key = this.getSessionKey(sessionId);
    const graph = this.graphs.get(key) || { entities: [], relationships: [] };
    return JSON.parse(JSON.stringify(graph)); // Deep copy to avoid direct modification
  }

  async saveGraph(sessionId: string | undefined, graph: KnowledgeGraph): Promise<void> {
    const key = this.getSessionKey(sessionId);
    this.graphs.set(key, JSON.parse(JSON.stringify(graph))); // Deep copy
  }

  setGraph(graph: KnowledgeGraph, sessionId: string | undefined = undefined) {
    const key = this.getSessionKey(sessionId);
    this.graphs.set(key, JSON.parse(JSON.stringify(graph)));
  }
}

describe('Graph', () => {
  let mockStore: MockGraphStore;
  let graph: Graph;
  const testSessionId = 'test-session';

  beforeEach(() => {
    mockStore = new MockGraphStore();
    graph = new Graph(mockStore);
  });

  afterEach(() => {
    // Clean up if necessary, though mockStore is reset in beforeEach
  });

  function assertGraphContent(
    actualGraph: KnowledgeGraph,
    expectedEntities: Entity[],
    expectedRelationships: Relationship[],
    messagePrefix: string = ''
  ) {
    assert.strictEqual(
      actualGraph.entities.length,
      expectedEntities.length,
      `${messagePrefix}Expected ${expectedEntities.length} entities`
    );
    expectedEntities.forEach((expected) => {
      assert.ok(
        actualGraph.entities.some(
          (e) => e.name === expected.name && e.entityType === expected.entityType
        ),
        `${messagePrefix}Expected entity ${expected.name} not found`
      );
    });

    assert.strictEqual(
      actualGraph.relationships.length,
      expectedRelationships.length,
      `${messagePrefix}Expected ${expectedRelationships.length} relationships`
    );
    expectedRelationships.forEach((expected) => {
      assert.ok(
        actualGraph.relationships.some(
          (r) =>
            r.from === expected.from &&
            r.to === expected.to &&
            r.relationshipType === expected.relationshipType
        ),
        `${messagePrefix}Expected relationship ${expected.from}-${expected.relationshipType}->${expected.to} not found`
      );
    });
  }

  async function loadAndAssertGraph(
    sessionId: string | undefined,
    expectedEntities: Entity[],
    expectedRelationships: Relationship[],
    messagePrefix: string = ''
  ) {
    const currentGraph = await mockStore.loadGraph(sessionId);
    assertGraphContent(currentGraph, expectedEntities, expectedRelationships, messagePrefix);
  }

  async function assertSearchResults(
    sessionId: string | undefined,
    searchTerm: string,
    expectedEntities: Entity[],
    expectedRelationships: Relationship[]
  ) {
    const result = await graph.searchNodes(sessionId, searchTerm);
    assertGraphContent(
      result,
      expectedEntities,
      expectedRelationships,
      `Search term '${searchTerm}': `
    );
  }

  it('should create new entities and not duplicate existing ones', async () => {
    const initialEntities: Entity[] = [{ name: 'Entity1', entityType: 'TypeA', observations: [] }];
    mockStore.setGraph({ entities: initialEntities, relationships: [] }, testSessionId);

    const newEntities: Entity[] = [
      { name: 'Entity2', entityType: 'TypeB', observations: [] },
      { name: 'Entity1', entityType: 'TypeA', observations: [] }, // Duplicate
    ];

    const created = await graph.createEntities(testSessionId, newEntities);
    assert.strictEqual(created.length, 1, 'Should create only one new entity');
    assert.strictEqual(created[0].name, 'Entity2', 'Should return the new entity');

    await loadAndAssertGraph(
      testSessionId,
      [
        { name: 'Entity1', entityType: 'TypeA', observations: [] },
        { name: 'Entity2', entityType: 'TypeB', observations: [] },
      ],
      [],
      'After creating entities: '
    );
  });

  it('should create new relationships and not duplicate existing ones', async () => {
    const initialRelationships: Relationship[] = [
      { from: 'EntityA', to: 'EntityB', relationshipType: 'RELATES_TO' },
    ];
    mockStore.setGraph({ entities: [], relationships: initialRelationships }, testSessionId);

    const newRelationships: Relationship[] = [
      { from: 'EntityC', to: 'EntityD', relationshipType: 'HAS_A' },
      { from: 'EntityA', to: 'EntityB', relationshipType: 'RELATES_TO' }, // Duplicate
    ];

    const created = await graph.createRelationships(testSessionId, newRelationships);
    assert.strictEqual(created.length, 1, 'Should create only one new relationship');
    assert.strictEqual(created[0].from, 'EntityC', 'Should return the new relationship');

    await loadAndAssertGraph(
      testSessionId,
      [],
      [
        { from: 'EntityA', to: 'EntityB', relationshipType: 'RELATES_TO' },
        { from: 'EntityC', to: 'EntityD', relationshipType: 'HAS_A' },
      ],
      'After creating relationships: '
    );
  });

  it('should add observations to existing entities', async () => {
    const initialEntities: Entity[] = [
      { name: 'Entity1', entityType: 'TypeA', observations: ['obs1'] },
    ];
    mockStore.setGraph({ entities: initialEntities, relationships: [] }, testSessionId);

    const observations: Observation[] = [
      { entityName: 'Entity1', contents: ['obs2', 'obs1', 'obs3'] }, // obs1 is duplicate
    ];

    const results = await graph.addObservations(testSessionId, observations);
    assert.strictEqual(results.length, 1, 'Should process one entity');
    assert.strictEqual(results[0].entityName, 'Entity1');
    assert.deepStrictEqual(
      results[0].addedObservations.sort(),
      ['obs2', 'obs3'].sort(),
      'Should return only new observations'
    );

    const currentGraph = await mockStore.loadGraph(testSessionId);
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
      graph.addObservations(testSessionId, observations),
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
    mockStore.setGraph(
      { entities: initialEntities, relationships: initialRelationships },
      testSessionId
    );

    await graph.deleteEntities(testSessionId, ['Entity1', 'Entity3']);

    await loadAndAssertGraph(
      testSessionId,
      [{ name: 'Entity2', entityType: 'TypeB', observations: [] }],
      [],
      'After deleting entities: '
    );
  });

  it('should delete specified observations from entities', async () => {
    const initialEntities: Entity[] = [
      { name: 'Entity1', entityType: 'TypeA', observations: ['obs1', 'obs2', 'obs3'] },
      { name: 'Entity2', entityType: 'TypeB', observations: ['obs4', 'obs5'] },
    ];
    mockStore.setGraph({ entities: initialEntities, relationships: [] }, testSessionId);

    const deletions = [
      { entityName: 'Entity1', observations: ['obs1', 'obs3'] },
      { entityName: 'Entity2', observations: ['obs5'] },
      { entityName: 'NonExistentEntity', observations: ['obsX'] }, // Should be ignored
    ];

    await graph.deleteObservations(testSessionId, deletions);

    const currentGraph = await mockStore.loadGraph(testSessionId);
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
    mockStore.setGraph({ entities: [], relationships: initialRelationships }, testSessionId);

    const relationshipsToDelete: Relationship[] = [
      { from: 'A', to: 'B', relationshipType: 'TYPE1' },
      { from: 'X', to: 'Y', relationshipType: 'NON_EXISTENT' }, // Non-existent
    ];

    await graph.deleteRelationships(testSessionId, relationshipsToDelete);

    await loadAndAssertGraph(
      testSessionId,
      [],
      [
        { from: 'B', to: 'C', relationshipType: 'TYPE2' },
        { from: 'C', to: 'A', relationshipType: 'TYPE3' },
      ],
      'After deleting relationships: '
    );
  });

  it('should read the entire graph', async () => {
    const initialGraph: KnowledgeGraph = {
      entities: [{ name: 'E1', entityType: 'T1', observations: [] }],
      relationships: [{ from: 'E1', to: 'E2', relationshipType: 'R1' }],
    };
    mockStore.setGraph(initialGraph, testSessionId);

    const readGraph = await graph.readGraph(testSessionId);
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
    mockStore.setGraph(
      { entities: initialEntities, relationships: initialRelationships },
      testSessionId
    );

    // Search by name
    await assertSearchResults(
      testSessionId,
      'apple',
      [{ name: 'Apple', entityType: 'Fruit', observations: ['Red', 'Sweet'] }],
      [{ from: 'Apple', to: 'Banana', relationshipType: 'COMPLEMENTS' }]
    );

    // Search by entity type
    await assertSearchResults(
      testSessionId,
      'fruit',
      [
        { name: 'Apple', entityType: 'Fruit', observations: ['Red', 'Sweet'] },
        { name: 'Banana', entityType: 'Fruit', observations: ['Yellow', 'Long'] },
      ],
      [{ from: 'Apple', to: 'Banana', relationshipType: 'COMPLEMENTS' }]
    );

    // Search by observation
    await assertSearchResults(
      testSessionId,
      'yellow',
      [{ name: 'Banana', entityType: 'Fruit', observations: ['Yellow', 'Long'] }],
      [{ from: 'Apple', to: 'Banana', relationshipType: 'COMPLEMENTS' }]
    );

    // Search with no match
    await assertSearchResults(testSessionId, 'xyz', [], []);
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
    mockStore.setGraph(
      { entities: initialEntities, relationships: initialRelationships },
      testSessionId
    );

    const result = await graph.openNodes(testSessionId, ['NodeA', 'NodeC', 'NonExistent']);

    assertGraphContent(
      result,
      [
        { name: 'NodeA', entityType: 'Type1', observations: [] },
        { name: 'NodeC', entityType: 'Type3', observations: [] },
      ],
      [
        { from: 'NodeA', to: 'NodeB', relationshipType: 'R1' },
        { from: 'NodeB', to: 'NodeC', relationshipType: 'R2' },
      ],
      'After opening nodes: '
    );
  });

  describe('Session ID Handling', () => {
    it('should use global memory when sessionId is undefined', async () => {
      const entityGlobal: Entity = {
        name: 'GlobalEntity',
        entityType: 'GlobalType',
        observations: [],
      };
      await graph.createEntities(undefined, [entityGlobal]);

      await loadAndAssertGraph(
        undefined,
        [{ name: 'GlobalEntity', entityType: 'GlobalType', observations: [] }],
        [],
        'Global graph after creating global entity: '
      );

      await loadAndAssertGraph(
        testSessionId,
        [],
        [],
        'Session graph after creating global entity: '
      );
    });

    it('should isolate memory between different session IDs', async () => {
      const entitySession1: Entity = {
        name: 'Session1Entity',
        entityType: 'TypeA',
        observations: [],
      };
      const entitySession2: Entity = {
        name: 'Session2Entity',
        entityType: 'TypeB',
        observations: [],
      };

      await graph.createEntities('session1', [entitySession1]);
      await graph.createEntities('session2', [entitySession2]);

      await loadAndAssertGraph(
        'session1',
        [{ name: 'Session1Entity', entityType: 'TypeA', observations: [] }],
        [],
        'Session1 graph: '
      );

      await loadAndAssertGraph(
        'session2',
        [{ name: 'Session2Entity', entityType: 'TypeB', observations: [] }],
        [],
        'Session2 graph: '
      );

      await loadAndAssertGraph(undefined, [], [], 'Global graph after session creations: ');
    });

    it('should not leak memory from session to global or other sessions', async () => {
      const entitySession: Entity = {
        name: 'SessionOnlyEntity',
        entityType: 'TypeS',
        observations: [],
      };
      await graph.createEntities(testSessionId, [entitySession]);

      await loadAndAssertGraph(
        testSessionId,
        [{ name: 'SessionOnlyEntity', entityType: 'TypeS', observations: [] }],
        [],
        'Session graph after creating session entity: '
      );

      await loadAndAssertGraph(undefined, [], [], 'Global graph after creating session entity: ');

      await loadAndAssertGraph(
        'another-session',
        [],
        [],
        'Other session graph after creating session entity: '
      );
    });

    it('should not leak memory from global to sessions', async () => {
      const entityGlobal: Entity = {
        name: 'GlobalOnlyEntity',
        entityType: 'TypeG',
        observations: [],
      };
      await graph.createEntities(undefined, [entityGlobal]);

      await loadAndAssertGraph(
        undefined,
        [{ name: 'GlobalOnlyEntity', entityType: 'TypeG', observations: [] }],
        [],
        'Global graph after creating global entity: '
      );

      await loadAndAssertGraph(
        testSessionId,
        [],
        [],
        'Session graph after creating global entity: '
      );
    });

    it('should correctly read graph for specific session ID', async () => {
      // The mockStore.setGraph method now takes an optional sessionId.
      // For this test, we want to ensure that the graph is correctly read for a specific session ID.
      // We will create entities and relationships directly using the graph object with a specific session ID.
      // The previous comment about `mockStore.setGraph(initialGraphSession);` was misleading
      // because the `setGraph` method on the mock store was not session-aware before.
      // Now that it is, we can use it to pre-populate a session's graph if needed,
      // but for this test, creating entities/relationships via `graph.create*` is more appropriate
      // as it simulates the actual usage of the `Graph` class.

      await graph.createEntities('session-read', [
        { name: 'EntityForRead', entityType: 'TypeR', observations: [] },
      ]);
      await graph.createRelationships('session-read', [
        { from: 'EntityForRead', to: 'AnotherEntity', relationshipType: 'HAS' },
      ]);

      const readGraph = await graph.readGraph('session-read');
      assertGraphContent(
        readGraph,
        [{ name: 'EntityForRead', entityType: 'TypeR', observations: [] }],
        [{ from: 'EntityForRead', to: 'AnotherEntity', relationshipType: 'HAS' }],
        'Read graph for session-read: '
      );

      const readGlobalGraph = await graph.readGraph(undefined);
      assertGraphContent(readGlobalGraph, [], [], 'Read global graph: ');
    });
  });
});
