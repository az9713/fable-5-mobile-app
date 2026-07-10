/**
 * DbAdapter is the sync SQL interface shared by the real app (expo-sqlite,
 * src/db/db.ts) and by tests (better-sqlite3, src/db/__tests__/testAdapter.ts).
 *
 * All schema/migration/repo code is written against this interface only, so
 * tests exercise the exact same SQL the phone runs. Both backends are
 * synchronous, so this interface has no Promises.
 */

export type SqlParam = string | number | null;
export type SqlParams = ReadonlyArray<SqlParam>;

export interface DbAdapter {
  /** Execute a write statement (INSERT/UPDATE/DELETE) with bound params. */
  run(sql: string, params?: SqlParams): void;
  /** Execute a SELECT and return all matching rows. */
  all<T = unknown>(sql: string, params?: SqlParams): T[];
  /** Execute a SELECT and return the first matching row, or undefined. */
  get<T = unknown>(sql: string, params?: SqlParams): T | undefined;
  /** Execute raw SQL (DDL, or multiple ';'-separated statements). No params. */
  exec(sql: string): void;
  /**
   * Get or set a PRAGMA. With no `value`, returns the pragma's scalar value
   * (e.g. `pragma('foreign_keys')` -> 1 | 0). With `value`, sets the pragma.
   */
  pragma(name: string, value?: string | number): unknown;
}
