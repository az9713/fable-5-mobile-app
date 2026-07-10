/**
 * App-runtime database singleton, backed by expo-sqlite's synchronous API
 * (SDK 57: openDatabaseSync / execSync / runSync / getAllSync / getFirstSync).
 *
 * This file is NEVER imported by tests — expo-sqlite is a native module and
 * cannot run under Jest/Node. Tests use src/db/__tests__/testAdapter.ts
 * (better-sqlite3) instead, which implements the same DbAdapter interface.
 */
import * as SQLite from 'expo-sqlite';
import type { DbAdapter, SqlParams } from '@/db/adapter';
import { migrate } from '@/db/schema';

const DATABASE_NAME = 'ideas.db';

function createExpoSqliteAdapter(database: SQLite.SQLiteDatabase): DbAdapter {
  return {
    run(sql: string, params: SqlParams = []): void {
      database.runSync(sql, params as (string | number | null)[]);
    },
    all<T = unknown>(sql: string, params: SqlParams = []): T[] {
      return database.getAllSync<T>(sql, params as (string | number | null)[]);
    },
    get<T = unknown>(sql: string, params: SqlParams = []): T | undefined {
      const row = database.getFirstSync<T>(sql, params as (string | number | null)[]);
      return row ?? undefined;
    },
    exec(sql: string): void {
      database.execSync(sql);
    },
    pragma(name: string, value?: string | number): unknown {
      if (value !== undefined) {
        database.execSync(`PRAGMA ${name} = ${value};`);
        return undefined;
      }
      const row = database.getFirstSync<Record<string, unknown>>(`PRAGMA ${name};`);
      if (row && typeof row === 'object') {
        const keys = Object.keys(row);
        return keys.length ? row[keys[0]] : undefined;
      }
      return row ?? undefined;
    },
  };
}

let dbInstance: DbAdapter | null = null;

/** Returns the singleton app database, opening + migrating it on first call. */
export function getDb(): DbAdapter {
  if (!dbInstance) {
    const database = SQLite.openDatabaseSync(DATABASE_NAME);
    dbInstance = createExpoSqliteAdapter(database);
    migrate(dbInstance);
  }
  return dbInstance;
}
