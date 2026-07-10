import { create } from 'zustand';
import { getDb } from '@/db/db';
import * as repo from '@/db/repo';
import type { Folder, Note } from '@/db/repo';
import { BACKGROUNDS } from '@/theme/backgrounds';

/**
 * Thin zustand store: UI glue only. Actions call repo (against the real db
 * singleton) then refresh state from it. No business logic lives here.
 */
export type StoreState = {
  folders: Folder[];
  /** Notes currently loaded for the selected folder (null = Inbox). */
  notes: Note[];
  selectedFolderId: string | null;
  selectedBackgroundId: string;

  loadFolders: () => void;
  createFolder: (name: string) => Folder;
  selectFolder: (folderId: string | null) => void;
  loadNotes: (folderId?: string | null) => void;
  createNote: (input: { title: string; folderId?: string | null }) => Note;
  moveNote: (noteId: string, folderId: string | null) => void;
  deleteNote: (noteId: string) => void;
  setSelectedBackgroundId: (id: string) => void;
};

const defaultBackgroundId = BACKGROUNDS[0]?.id ?? '';

export const useStore = create<StoreState>((set, get) => ({
  folders: [],
  notes: [],
  selectedFolderId: null,
  selectedBackgroundId: defaultBackgroundId,

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
    set({ notes: repo.listNotes(db, id) });
  },

  createNote: (input: { title: string; folderId?: string | null }) => {
    const db = getDb();
    const folderId = input.folderId ?? get().selectedFolderId;
    const note = repo.createNote(db, { title: input.title, folderId });
    get().loadNotes();
    return note;
  },

  moveNote: (noteId: string, folderId: string | null) => {
    const db = getDb();
    repo.moveNote(db, noteId, folderId);
    get().loadNotes();
  },

  deleteNote: (noteId: string) => {
    const db = getDb();
    repo.deleteNote(db, noteId);
    get().loadNotes();
  },

  setSelectedBackgroundId: (id: string) => {
    set({ selectedBackgroundId: id });
  },
}));
