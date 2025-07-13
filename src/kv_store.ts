import * as fs from 'fs/promises';
import { z } from 'genkit';
import * as path from 'path';

export const EntrySchema = z.object({
  key: z.string().describe('The key to set the value for.'),
  value: z.string().describe('The value to store.'),
});

export type Entry = z.infer<typeof EntrySchema>;

export interface KeyValueStore {
  // renamed from set
  save(opts: { sessionId?: string; entries: Entry[] }): Promise<void>;
  // renamed from get. note the optional keys -- if not set load EVERYTHING
  load(opts: { sessionId?: string; keys?: string[] }): Promise<Entry[]>;
  delete(opts: { sessionId?: string; key: string }): Promise<void>;
  listKeys(opts: { sessionId?: string }): Promise<string[]>;
}

export class FileKeyValueStore implements KeyValueStore {
  private memoryFilePath: string;

  constructor(memoryFilePath: string) {
    this.memoryFilePath = memoryFilePath;
  }

  private getSessionFilePath(sessionId: string | undefined): string {
    const fileName = sessionId ? `kv_memory.${sessionId}.json` : `kv_memory.json`;
    return path.join(this.memoryFilePath, fileName);
  }

  private async _load(sessionId: string | undefined): Promise<Map<string, string>> {
    const filePath = this.getSessionFilePath(sessionId);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      return new Map(Object.entries(parsed));
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File does not exist, return empty map
        return new Map();
      } else {
        throw new Error(`Failed to load memory file for session ${sessionId}: ${error.message}`);
      }
    }
  }

  private async _save(sessionId: string | undefined, data: Map<string, string>): Promise<void> {
    const filePath = this.getSessionFilePath(sessionId);
    const obj = Object.fromEntries(data);
    await fs.mkdir(path.dirname(filePath), { recursive: true }); // Ensure base directory exists
    await fs.writeFile(filePath, JSON.stringify(obj, null, 2), 'utf-8');
  }

  async save(opts: { sessionId?: string; entries: Entry[] }): Promise<void> {
    const data = await this._load(opts.sessionId);
    for (const entry of opts.entries) {
      data.set(entry.key, entry.value);
    }
    await this._save(opts.sessionId, data);
  }

  async load(opts: { sessionId?: string; keys?: string[] }): Promise<Entry[]> {
    const data = await this._load(opts.sessionId);
    const results: Entry[] = [];
    if (opts.keys) {
      for (const key of opts.keys) {
        const value = data.get(key);
        if (value !== undefined) {
          results.push({ key, value });
        }
      }
    } else {
      // If keys are not set, load everything
      for (const [key, value] of data.entries()) {
        results.push({ key, value });
      }
    }
    return results;
  }

  async listKeys(opts: { sessionId?: string }): Promise<string[]> {
    const data = await this._load(opts.sessionId);
    return Array.from(data.keys());
  }

  async delete(opts: { sessionId?: string; key: string }): Promise<void> {
    const data = await this._load(opts.sessionId);
    data.delete(opts.key);
    await this._save(opts.sessionId, data);
  }
}
