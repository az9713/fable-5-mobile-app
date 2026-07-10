import type { DbAdapter } from '@/db/adapter';

export type RepoDeps = {
  uuid: () => string;
  now: () => number;
};

/**
 * Default deps for app runtime use. expo-crypto is required lazily, inside
 * the function body, so simply importing this module never touches
 * expo-crypto (which cannot run under Jest/Node) — it's only touched when
 * `uuid()` actually runs, which never happens in tests (tests always pass
 * their own fake `deps`).
 */
export const defaultDeps: RepoDeps = {
  uuid: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Crypto = require('expo-crypto');
    return Crypto.randomUUID();
  },
  now: () => Date.now(),
};

export type Folder = {
  id: string;
  name: string;
  created_at: number;
};

export type Note = {
  id: string;
  folder_id: string | null;
  title: string;
  summary: string | null;
  next_steps: string[];
  audio_uri: string | null;
  created_at: number;
  updated_at: number;
};

type NoteRow = Omit<Note, 'next_steps'> & { next_steps: string | null };

export type Segment = {
  id: string;
  note_id: string;
  text: string;
  audio_uri: string | null;
  created_at: number;
};

export type Message = {
  id: string;
  note_id: string;
  role: string;
  content: string;
  created_at: number;
};

function toNote(row: NoteRow): Note {
  return {
    ...row,
    next_steps: row.next_steps ? (JSON.parse(row.next_steps) as string[]) : [],
  };
}

// ---- Folders ----------------------------------------------------------

export function createFolder(
  db: DbAdapter,
  input: { name: string },
  deps: RepoDeps = defaultDeps
): Folder {
  const folder: Folder = {
    id: deps.uuid(),
    name: input.name,
    created_at: deps.now(),
  };
  db.run('INSERT INTO folders (id, name, created_at) VALUES (?, ?, ?)', [
    folder.id,
    folder.name,
    folder.created_at,
  ]);
  return folder;
}

export function listFolders(db: DbAdapter): Folder[] {
  return db.all<Folder>('SELECT * FROM folders ORDER BY created_at ASC');
}

// ---- Notes -------------------------------------------------------------

export function createNote(
  db: DbAdapter,
  input: {
    title: string;
    folderId: string | null;
    summary?: string | null;
    nextSteps?: string[];
    audioUri?: string | null;
  },
  deps: RepoDeps = defaultDeps
): Note {
  const now = deps.now();
  const note: Note = {
    id: deps.uuid(),
    folder_id: input.folderId ?? null,
    title: input.title,
    summary: input.summary ?? null,
    next_steps: input.nextSteps ?? [],
    audio_uri: input.audioUri ?? null,
    created_at: now,
    updated_at: now,
  };
  db.run(
    `INSERT INTO notes (id, folder_id, title, summary, next_steps, audio_uri, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      note.id,
      note.folder_id,
      note.title,
      note.summary,
      JSON.stringify(note.next_steps),
      note.audio_uri,
      note.created_at,
      note.updated_at,
    ]
  );
  return note;
}

export function getNote(db: DbAdapter, id: string): Note | undefined {
  const row = db.get<NoteRow>('SELECT * FROM notes WHERE id = ?', [id]);
  return row ? toNote(row) : undefined;
}

/** `folderId === null` returns Inbox notes (folder_id IS NULL). */
export function listNotes(db: DbAdapter, folderId: string | null): Note[] {
  const rows =
    folderId === null
      ? db.all<NoteRow>(
          'SELECT * FROM notes WHERE folder_id IS NULL ORDER BY updated_at DESC'
        )
      : db.all<NoteRow>(
          'SELECT * FROM notes WHERE folder_id = ? ORDER BY updated_at DESC',
          [folderId]
        );
  return rows.map(toNote);
}

export function updateNote(
  db: DbAdapter,
  id: string,
  patch: Partial<{
    title: string;
    summary: string | null;
    nextSteps: string[];
    audioUri: string | null;
  }>,
  deps: RepoDeps = defaultDeps
): Note {
  const existing = getNote(db, id);
  if (!existing) {
    throw new Error(`updateNote: no note with id ${id}`);
  }

  const next: Note = {
    ...existing,
    title: patch.title ?? existing.title,
    summary: 'summary' in patch ? patch.summary ?? null : existing.summary,
    next_steps: patch.nextSteps ?? existing.next_steps,
    audio_uri: 'audioUri' in patch ? patch.audioUri ?? null : existing.audio_uri,
    updated_at: deps.now(),
  };

  db.run(
    `UPDATE notes SET title = ?, summary = ?, next_steps = ?, audio_uri = ?, updated_at = ?
     WHERE id = ?`,
    [
      next.title,
      next.summary,
      JSON.stringify(next.next_steps),
      next.audio_uri,
      next.updated_at,
      id,
    ]
  );

  return next;
}

export function moveNote(
  db: DbAdapter,
  id: string,
  folderId: string | null,
  deps: RepoDeps = defaultDeps
): void {
  db.run('UPDATE notes SET folder_id = ?, updated_at = ? WHERE id = ?', [
    folderId,
    deps.now(),
    id,
  ]);
}

export function deleteNote(db: DbAdapter, id: string): void {
  db.run('DELETE FROM notes WHERE id = ?', [id]);
}

// ---- Segments ------------------------------------------------------------

export function addSegment(
  db: DbAdapter,
  noteId: string,
  input: { text: string; audioUri?: string | null },
  deps: RepoDeps = defaultDeps
): Segment {
  const segment: Segment = {
    id: deps.uuid(),
    note_id: noteId,
    text: input.text,
    audio_uri: input.audioUri ?? null,
    created_at: deps.now(),
  };
  db.run(
    'INSERT INTO segments (id, note_id, text, audio_uri, created_at) VALUES (?, ?, ?, ?, ?)',
    [segment.id, segment.note_id, segment.text, segment.audio_uri, segment.created_at]
  );
  return segment;
}

export function listSegments(db: DbAdapter, noteId: string): Segment[] {
  return db.all<Segment>(
    'SELECT * FROM segments WHERE note_id = ? ORDER BY created_at ASC',
    [noteId]
  );
}

// ---- Messages ------------------------------------------------------------

export function addMessage(
  db: DbAdapter,
  noteId: string,
  input: { role: string; content: string },
  deps: RepoDeps = defaultDeps
): Message {
  const message: Message = {
    id: deps.uuid(),
    note_id: noteId,
    role: input.role,
    content: input.content,
    created_at: deps.now(),
  };
  db.run(
    'INSERT INTO messages (id, note_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)',
    [message.id, message.note_id, message.role, message.content, message.created_at]
  );
  return message;
}

export function listMessages(db: DbAdapter, noteId: string): Message[] {
  return db.all<Message>(
    'SELECT * FROM messages WHERE note_id = ? ORDER BY created_at ASC',
    [noteId]
  );
}
