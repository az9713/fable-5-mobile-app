/**
 * Test-only DbAdapter implementation over better-sqlite3's in-memory
 * database. Mirrors src/db/db.ts (expo-sqlite) exactly so tests run the same
 * SQL the phone runs. Never imported by app runtime code.
 */
import Database from 'better-sqlite3';
import type { DbAdapter, SqlParams } from '@/db/adapter';

export function createTestAdapter(): DbAdapter {
  const db = new Database(':memory:');

  return {
    run(sql: string, params: SqlParams = []): void {
      db.prepare(sql).run(...params);
    },
    all<T = unknown>(sql: string, params: SqlParams = []): T[] {
      return db.prepare(sql).all(...params) as T[];
    },
    get<T = unknown>(sql: string, params: SqlParams = []): T | undefined {
      return db.prepare(sql).get(...params) as T | undefined;
    },
    exec(sql: string): void {
      db.exec(sql);
    },
    pragma(name: string, value?: string | number): unknown {
      if (value !== undefined) {
        return db.pragma(`${name} = ${value}`);
      }
      return db.pragma(name, { simple: true });
    },
  };
}
