import { afterEach, beforeEach, describe, it } from 'node:test';
import * as assert from 'assert';
import { Entry, FileKeyValueStore } from '../src/kv_store.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('FileKeyValueStore', () => {
  const testBaseDir = path.join(os.tmpdir(), 'genkitx-memory-test', Date.now().toString());
  let store: FileKeyValueStore;

  beforeEach(async () => {
    // Ensure the test directory is clean before each test
    try {
      await fs.rm(testBaseDir, { recursive: true, force: true });
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
    await fs.mkdir(testBaseDir, { recursive: true });
    store = new FileKeyValueStore(testBaseDir);
  });

  afterEach(async () => {
    // Clean up the test directory after each test
    try {
      await fs.rm(testBaseDir, { recursive: true, force: true });
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  });

  it('should set and get a value in the global session', async () => {
    await store.save({ sessionId: undefined, entries: [{ key: 'key1', value: 'value1' }] });
    const entries = await store.load({ sessionId: undefined, keys: ['key1'] });
    assert.strictEqual(entries[0]?.value, 'value1', 'Should retrieve the correct value from global session');
  });

  it('should return empty array for a non-existent key in the global session', async () => {
    const entries = await store.load({ sessionId: undefined, keys: ['nonExistentKey'] });
    assert.deepStrictEqual(
      entries,
      [],
      'Should return empty array for a non-existent key in global session'
    );
  });

  it('should overwrite an existing key in the global session', async () => {
    await store.save({ sessionId: undefined, entries: [{ key: 'key1', value: 'value1' }] });
    await store.save({ sessionId: undefined, entries: [{ key: 'key1', value: 'newValue' }] });
    const entries = await store.load({ sessionId: undefined, keys: ['key1'] });
    assert.strictEqual(entries[0]?.value, 'newValue', 'Should overwrite the existing value in global session');
  });

  it('should list all keys in the global session', async () => {
    await store.save({ sessionId: undefined, entries: [{ key: 'keyA', value: 'valueA' }] });
    await store.save({ sessionId: undefined, entries: [{ key: 'keyB', value: 'valueB' }] });
    await store.save({ sessionId: undefined, entries: [{ key: 'keyC', value: 'valueC' }] });
    const keys = await store.listKeys({ sessionId: undefined });
    assert.deepStrictEqual(
      keys.sort(),
      ['keyA', 'keyB', 'keyC'].sort(),
      'Should list all keys in global session'
    );
  });

  it('should handle empty store when listing keys in the global session', async () => {
    const keys = await store.listKeys({ sessionId: undefined });
    assert.deepStrictEqual(keys, [], 'Should return an empty array for an empty global store');
  });

  it('should persist data across store instances in the global session', async () => {
    await store.save({ sessionId: undefined, entries: [{ key: 'persistentKey', value: 'persistentValue' }] });

    // Create a new store instance pointing to the same base directory
    const newStore = new FileKeyValueStore(testBaseDir);
    const entries = await newStore.load({ sessionId: undefined, keys: ['persistentKey'] });
    assert.strictEqual(
      entries[0]?.value,
      'persistentValue',
      'Data should persist across instances in global session'
    );
  });

  it('should handle multiple sets and gets correctly in the global session', async () => {
    await store.save({ sessionId: undefined, entries: [{ key: 'k1', value: 'v1' }, { key: 'k2', value: 'v2' }, { key: 'k3', value: 'v3' }] });

    const entries = await store.load({ sessionId: undefined, keys: ['k1', 'k2', 'k3', 'nonexistent'] });
    const expectedEntries: Entry[] = [
      { key: 'k1', value: 'v1' },
      { key: 'k2', value: 'v2' },
      { key: 'k3', value: 'v3' },
    ];
    assert.deepStrictEqual(entries.sort((a, b) => a.key.localeCompare(b.key)), expectedEntries.sort((a, b) => a.key.localeCompare(b.key)));
  });

  it('should correctly load data if global file exists on initialization', async () => {
    // Manually create a file with some content for the global session
    const initialData = {
      preExistingKey: 'preExistingValue',
      anotherKey: 'anotherValue',
    };
    await fs.writeFile(
      path.join(testBaseDir, 'kv_memory.json'),
      JSON.stringify(initialData, null, 2),
      'utf-8'
    );

    // Initialize a new store and check its content
    const newStore = new FileKeyValueStore(testBaseDir);
    assert.strictEqual((await newStore.load({ sessionId: undefined, keys: ['preExistingKey'] }))[0]?.value, 'preExistingValue');
    assert.strictEqual((await newStore.load({ sessionId: undefined, keys: ['anotherKey'] }))[0]?.value, 'anotherValue');
    assert.deepStrictEqual(
      (await newStore.listKeys({ sessionId: undefined })).sort(),
      ['preExistingKey', 'anotherKey'].sort()
    );

    // Ensure new data can be added and persisted
    await newStore.save({ sessionId: undefined, entries: [{ key: 'newKey', value: 'newValue' }] });
    assert.strictEqual((await newStore.load({ sessionId: undefined, keys: ['newKey'] }))[0]?.value, 'newValue');
    assert.deepStrictEqual(
      (await newStore.listKeys({ sessionId: undefined })).sort(),
      ['preExistingKey', 'anotherKey', 'newKey'].sort()
    );
  });

  it('should isolate memory between different session IDs', async () => {
    const sessionId1 = 'session1';
    const sessionId2 = 'session2';

    await store.save({ sessionId: sessionId1, entries: [{ key: 'key1', value: 'value1_session1' }] });
    await store.save({ sessionId: sessionId2, entries: [{ key: 'key1', value: 'value1_session2' }] });
    await store.save({ sessionId: undefined, entries: [{ key: 'key1', value: 'value1_global' }] }); // Ensure global is separate

    assert.strictEqual(
      (await store.load({ sessionId: sessionId1, keys: ['key1'] }))[0]?.value,
      'value1_session1',
      'Session 1 should have its own value'
    );
    assert.strictEqual(
      (await store.load({ sessionId: sessionId2, keys: ['key1'] }))[0]?.value,
      'value1_session2',
      'Session 2 should have its own value'
    );
    assert.strictEqual(
      (await store.load({ sessionId: undefined, keys: ['key1'] }))[0]?.value,
      'value1_global',
      'Global session should have its own value'
    );

    assert.deepStrictEqual(
      await store.load({ sessionId: sessionId1, keys: ['key2'] }),
      [],
      'Session 1 should not see key2'
    );
    assert.deepStrictEqual(
      await store.load({ sessionId: sessionId2, keys: ['key2'] }),
      [],
      'Session 2 should not see key2'
    );

    await store.save({ sessionId: sessionId1, entries: [{ key: 'key2', value: 'value2_session1' }] });
    assert.strictEqual(
      (await store.load({ sessionId: sessionId1, keys: ['key2'] }))[0]?.value,
      'value2_session1',
      'Session 1 should now have key2'
    );
    assert.deepStrictEqual(
      await store.load({ sessionId: sessionId2, keys: ['key2'] }),
      [],
      'Session 2 should still not see key2'
    );

    const keys1 = await store.listKeys({ sessionId: sessionId1 });
    assert.deepStrictEqual(
      keys1.sort(),
      ['key1', 'key2'].sort(),
      'Session 1 should list its own keys'
    );

    const keys2 = await store.listKeys({ sessionId: sessionId2 });
    assert.deepStrictEqual(keys2.sort(), ['key1'].sort(), 'Session 2 should list its own keys');

    const globalKeys = await store.listKeys({ sessionId: undefined });
    assert.deepStrictEqual(
      globalKeys.sort(),
      ['key1'].sort(),
      'Global session should list its own keys'
    );
  });

  it('should handle non-existent sessions gracefully', async () => {
    const nonExistentSession = 'nonExistentSession';
    const entries = await store.load({ sessionId: nonExistentSession, keys: ['someKey'] });
    assert.deepStrictEqual(entries, [], 'Should return empty array for key in non-existent session');

    const keys = await store.listKeys({ sessionId: nonExistentSession });
    assert.deepStrictEqual(keys, [], 'Should return empty array for keys in non-existent session');

    await store.save({ sessionId: nonExistentSession, entries: [{ key: 'newKey', value: 'newValue' }] });
    const newEntries = await store.load({ sessionId: nonExistentSession, keys: ['newKey'] });
    assert.strictEqual(newEntries[0]?.value, 'newValue', 'Should be able to set and retrieve in a new session');
  });
});
