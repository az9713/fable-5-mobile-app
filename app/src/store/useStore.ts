import { create } from 'zustand';
import { analyze } from '@/ai/anthropic';
import { getDb } from '@/db/db';
import * as repo from '@/db/repo';
import type { Folder, Note } from '@/db/repo';
import { getKey } from '@/store/secrets';
import { BACKGROUNDS } from '@/theme/backgrounds';

/**
 * Thin zustand store: UI glue only. Actions call repo (against the real db
 * singleton) then refresh state from it. No business logic lives here.
 */
export type StoreState = {
  folders: Folder[];
  /** Notes currently loaded for the selected folder (null = Inbox). */
  notes: Note[];
  /** First segment's transcript text per note.id, for the folder list preview. */
  noteSnippets: Record<string, string>;
  selectedFolderId: string | null;
  selectedBackgroundId: string;
  /** Note count per folder id, keyed by folder.id. Populated by loadFolderCounts. */
  folderCounts: Record<string, number>;
  /** Note count for the virtual Inbox (folder_id IS NULL). */
  inboxCount: number;

  loadFolders: () => void;
  createFolder: (name: string) => Folder;
  selectFolder: (folderId: string | null) => void;
  loadNotes: (folderId?: string | null) => void;
  createNote: (input: { title: string; folderId?: string | null }) => Note;
  /**
   * Records a captured voice note into the Inbox: creates the note (title =
   * first ~6 words of the transcript, else "New idea") with its audio uri,
   * adds the transcript as the note's first segment, then refreshes the
   * Inbox note list (if currently selected) and folder counts.
   */
  captureNote: (transcript: string, audioUri: string | null) => Note;
  /**
   * Phase 5: fire-and-forget AI pass on a just-captured note. Looks up the
   * Anthropic key; if missing, skips silently (no alert — analysis is a
   * nice-to-have, never blocking). On success, overwrites the placeholder
   * title with the AI title and stores summary/next_steps, then refreshes
   * whatever note list is currently loaded so the UI picks up the change.
   * On any failure (network, bad key, etc.), leaves the placeholder title in
   * place and does not alert — the transcript is already safely saved.
   */
  analyzeNote: (noteId: string, transcript: string) => Promise<void>;
  moveNote: (noteId: string, folderId: string | null) => void;
  /**
   * Folder-screen "Move to…" action: moves a note into `folderId` (null =
   * Inbox), then refreshes both the source and destination folder counts
   * (via loadFolderCounts) and reloads the currently-open note list (via
   * loadNotes) so the note disappears from view if it moved elsewhere.
   */
  moveNoteToFolder: (noteId: string, folderId: string | null) => void;
  deleteNote: (noteId: string) => void;
  setSelectedBackgroundId: (id: string) => void;
  /** Recomputes folderCounts + inboxCount from the db (home screen grid). */
  loadFolderCounts: () => void;
};

const defaultBackgroundId = BACKGROUNDS[0]?.id ?? '';

export const useStore = create<StoreState>((set, get) => ({
  folders: [],
  notes: [],
  noteSnippets: {},
  selectedFolderId: null,
  selectedBackgroundId: defaultBackgroundId,
  folderCounts: {},
  inboxCount: 0,

  loadFolders: () => {
    const db = getDb();
    set({ folders: repo.listFolders(db) });
  },

  createFolder: (name: string) => {
    const db = getDb();
    const folder = repo.createFolder(db, { name });
    set({ folders: repo.listFolders(db) });
    return folder;
  },

  selectFolder: (folderId: string | null) => {
    set({ selectedFolderId: folderId });
    get().loadNotes(folderId);
  },

  loadNotes: (folderId?: string | null) => {
    const db = getDb();
    const id = folderId === undefined ? get().selectedFolderId : folderId;
    const notes = repo.listNotes(db, id);
    const noteSnippets: Record<string, string> = {};
    for (const note of notes) {
      const [firstSegment] = repo.listSegments(db, note.id);
      if (firstSegment) noteSnippets[note.id] = firstSegment.text;
    }
    set({ notes, noteSnippets });
  },

  createNote: (input: { title: string; folderId?: string | null }) => {
    const db = getDb();
    const folderId = input.folderId ?? get().selectedFolderId;
    const note = repo.createNote(db, { title: input.title, folderId });
    get().loadNotes();
    return note;
  },

  captureNote: (transcript: string, audioUri: string | null) => {
    const db = getDb();
    const words = transcript.trim().split(/\s+/).filter(Boolean);
    const title = words.length > 0 ? words.slice(0, 6).join(' ') : 'New idea';

    const note = repo.createNote(db, { title, folderId: null, audioUri });
    repo.addSegment(db, note.id, { text: transcript, audioUri });

    if (get().selectedFolderId === null) {
      get().loadNotes(null);
    }
    get().loadFolderCounts();
    return note;
  },

  analyzeNote: async (noteId: string, transcript: string) => {
    const key = await getKey('anthropic');
    if (!key) return;

    try {
      const db = getDb();
      const result = await analyze(transcript, key);
      repo.updateNote(db, noteId, {
        title: result.title,
        summary: result.summary,
        nextSteps: result.next_steps,
      });
      get().loadNotes();
      get().loadFolderCounts();
    } catch {
      // Non-blocking, non-critical: leave the placeholder title/no-summary
      // in place. The transcript is already safely saved via captureNote.
    }
  },

  moveNote: (noteId: string, folderId: string | null) => {
    const db = getDb();
    repo.moveNote(db, noteId, folderId);
    get().loadNotes();
  },

  moveNoteToFolder: (noteId: string, folderId: string | null) => {
    const db = getDb();
    repo.moveNote(db, noteId, folderId);
    get().loadNotes();
    get().loadFolderCounts();
  },

  deleteNote: (noteId: string) => {
    const db = getDb();
    repo.deleteNote(db, noteId);
    get().loadNotes();
  },

  setSelectedBackgroundId: (id: string) => {
    set({ selectedBackgroundId: id });
  },

  loadFolderCounts: () => {
    const db = getDb();
    const folders = repo.listFolders(db);
    const inboxCount = repo.listNotes(db, null).length;
    const folderCounts: Record<string, number> = {};
    for (const folder of folders) {
      folderCounts[folder.id] = repo.listNotes(db, folder.id).length;
    }
    set({ folders, folderCounts, inboxCount });
  },
}));
