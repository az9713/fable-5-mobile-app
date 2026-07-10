import type { DbAdapter } from '@/db/adapter';

/**
 * Ordered list of migrations. Each entry is raw DDL applied once, in order.
 * Applied migrations are tracked via `PRAGMA user_version` (index + 1), so
 * `migrate()` is idempotent and safe to call on every app start.
 */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    summary TEXT,
    next_steps TEXT,
    audio_uri TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS segments (
    id TEXT PRIMARY KEY,
    note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    audio_uri TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_notes_folder_id ON notes(folder_id);
  CREATE INDEX IF NOT EXISTS idx_segments_note_id ON segments(note_id);
  CREATE INDEX IF NOT EXISTS idx_messages_note_id ON messages(note_id);
  `,
];

/**
 * Applies any migrations not yet applied to `db`, tracked via
 * `PRAGMA user_version`. Also ensures foreign key enforcement is on (needed
 * for ON DELETE CASCADE / SET NULL to actually take effect). Safe to call on
 * every app start.
 */
export function migrate(db: DbAdapter): void {
  db.pragma('foreign_keys', 'ON');

  const currentVersion = Number(db.pragma('user_version')) || 0;

  for (let i = currentVersion; i < MIGRATIONS.length; i++) {
    db.exec(MIGRATIONS[i]);
    db.pragma('user_version', i + 1);
  }
}
