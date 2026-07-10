import { createTestAdapter } from '@/db/__tests__/testAdapter';
import { migrate } from '@/db/schema';

describe('schema migrate', () => {
  it('creates all four tables', () => {
    const db = createTestAdapter();
    migrate(db);

    const tables = db
      .all<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
      )
      .map((row) => row.name)
      .sort();

    expect(tables).toEqual(['folders', 'messages', 'notes', 'segments']);
  });

  it('turns foreign_keys pragma on', () => {
    const db = createTestAdapter();
    migrate(db);

    expect(db.pragma('foreign_keys')).toBe(1);
  });

  it('is idempotent (safe to call migrate twice)', () => {
    const db = createTestAdapter();
    migrate(db);
    expect(() => migrate(db)).not.toThrow();

    const tables = db
      .all<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
      )
      .map((row) => row.name)
      .sort();
    expect(tables).toEqual(['folders', 'messages', 'notes', 'segments']);
  });

  it('sets user_version after migrating', () => {
    const db = createTestAdapter();
    migrate(db);
    expect(db.pragma('user_version')).toBeGreaterThan(0);
  });
});
