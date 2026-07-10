import { createTestAdapter } from '@/db/__tests__/testAdapter';
import { migrate } from '@/db/schema';
import * as repo from '@/db/repo';
import type { DbAdapter } from '@/db/adapter';
import type { RepoDeps } from '@/db/repo';

function makeDeps(): RepoDeps {
  let counter = 0;
  let clock = 1000;
  return {
    uuid: () => `id-${++counter}`,
    now: () => clock++,
  };
}

function setup(): { db: DbAdapter; deps: RepoDeps } {
  const db = createTestAdapter();
  migrate(db);
  return { db, deps: makeDeps() };
}

describe('folders', () => {
  it('creates and lists folders', () => {
    const { db, deps } = setup();
    const folder = repo.createFolder(db, { name: 'Work' }, deps);

    expect(folder.id).toBeTruthy();
    expect(folder.name).toBe('Work');
    expect(folder.created_at).toBeGreaterThan(0);

    const folders = repo.listFolders(db);
    expect(folders).toHaveLength(1);
    expect(folders[0]).toEqual(folder);
  });
});

describe('notes', () => {
  it('creates a note and reads it back', () => {
    const { db, deps } = setup();
    const note = repo.createNote(
      db,
      { title: 'Idea', folderId: null, summary: null, nextSteps: [], audioUri: null },
      deps
    );

    const fetched = repo.getNote(db, note.id);
    expect(fetched).toEqual(note);
  });

  it('listNotes(null) returns Inbox notes (folder_id IS NULL)', () => {
    const { db, deps } = setup();
    const folder = repo.createFolder(db, { name: 'Work' }, deps);
    const inboxNote = repo.createNote(db, { title: 'Inbox note', folderId: null }, deps);
    repo.createNote(db, { title: 'Work note', folderId: folder.id }, deps);

    const inboxNotes = repo.listNotes(db, null);
    expect(inboxNotes.map((n) => n.id)).toEqual([inboxNote.id]);

    const folderNotes = repo.listNotes(db, folder.id);
    expect(folderNotes).toHaveLength(1);
    expect(folderNotes[0].title).toBe('Work note');
  });

  it('moveNote moves a note into a folder and back to Inbox', () => {
    const { db, deps } = setup();
    const folder = repo.createFolder(db, { name: 'Work' }, deps);
    const note = repo.createNote(db, { title: 'Idea', folderId: null }, deps);

    repo.moveNote(db, note.id, folder.id);
    expect(repo.getNote(db, note.id)?.folder_id).toBe(folder.id);
    expect(repo.listNotes(db, null)).toHaveLength(0);
    expect(repo.listNotes(db, folder.id)).toHaveLength(1);

    repo.moveNote(db, note.id, null);
    expect(repo.getNote(db, note.id)?.folder_id).toBeNull();
    expect(repo.listNotes(db, null)).toHaveLength(1);
  });

  it('updateNote applies a partial patch, leaving other fields intact', () => {
    const { db, deps } = setup();
    const note = repo.createNote(
      db,
      { title: 'Idea', folderId: null, summary: 'orig summary', nextSteps: ['a'] },
      deps
    );

    const updated = repo.updateNote(db, note.id, { title: 'New title' }, deps);

    expect(updated.title).toBe('New title');
    expect(updated.summary).toBe('orig summary');
    expect(updated.next_steps).toEqual(['a']);
    expect(updated.updated_at).toBeGreaterThanOrEqual(note.updated_at);
  });

  it('next_steps round-trips as a string array', () => {
    const { db, deps } = setup();
    const note = repo.createNote(
      db,
      { title: 'Idea', folderId: null, nextSteps: ['call bob', 'buy milk'] },
      deps
    );

    const fetched = repo.getNote(db, note.id);
    expect(fetched?.next_steps).toEqual(['call bob', 'buy milk']);

    const listed = repo.listNotes(db, null);
    expect(listed[0].next_steps).toEqual(['call bob', 'buy milk']);
  });

  it('deleteNote cascades to segments and messages', () => {
    const { db, deps } = setup();
    const note = repo.createNote(db, { title: 'Idea', folderId: null }, deps);
    repo.addSegment(db, note.id, { text: 'seg 1' }, deps);
    repo.addSegment(db, note.id, { text: 'seg 2' }, deps);
    repo.addMessage(db, note.id, { role: 'user', content: 'hi' }, deps);

    expect(repo.listSegments(db, note.id)).toHaveLength(2);
    expect(repo.listMessages(db, note.id)).toHaveLength(1);

    repo.deleteNote(db, note.id);

    expect(repo.getNote(db, note.id)).toBeUndefined();
    expect(repo.listSegments(db, note.id)).toHaveLength(0);
    expect(repo.listMessages(db, note.id)).toHaveLength(0);
  });
});

describe('segments', () => {
  it('adds and lists segments for a note', () => {
    const { db, deps } = setup();
    const note = repo.createNote(db, { title: 'Idea', folderId: null }, deps);

    const seg = repo.addSegment(db, note.id, { text: 'hello world', audioUri: 'file://a.m4a' }, deps);
    expect(seg.note_id).toBe(note.id);
    expect(seg.text).toBe('hello world');

    const segments = repo.listSegments(db, note.id);
    expect(segments).toEqual([seg]);
  });
});

describe('messages', () => {
  it('adds and lists messages for a note', () => {
    const { db, deps } = setup();
    const note = repo.createNote(db, { title: 'Idea', folderId: null }, deps);

    const msg = repo.addMessage(db, note.id, { role: 'assistant', content: 'sure thing' }, deps);
    expect(msg.note_id).toBe(note.id);
    expect(msg.role).toBe('assistant');

    const messages = repo.listMessages(db, note.id);
    expect(messages).toEqual([msg]);
  });
});
