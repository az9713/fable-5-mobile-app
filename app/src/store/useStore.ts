import { create } from 'zustand';
import { analyze, chat } from '@/ai/anthropic';
import { getDb } from '@/db/db';
import * as repo from '@/db/repo';
import type { Folder, Message, Note, Segment } from '@/db/repo';
import { getKey, getSetting, setSetting } from '@/store/secrets';
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
  /** The note currently open on the note-detail screen, loaded by loadNote. */
  currentNote: Note | null;
  /** currentNote's segments (original capture + any appends), oldest first. */
  currentSegments: Segment[];
  /** Chat-with-note drawer: persisted chat history for the currently-open note, oldest first. */
  chatMessages: Message[];

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
  /**
   * Note-detail screen: loads a single note plus its segments (original
   * capture + any "add to note" appends, oldest first) into currentNote /
   * currentSegments.
   */
  loadNote: (noteId: string) => void;
  /**
   * Note-detail screen's "add to this note" record button: saves a new
   * segment for an already-transcribed recording and refreshes
   * currentNote/currentSegments. Kept synchronous and side-effect-free
   * beyond the db write so it's instant/reliable — re-running AI analysis
   * on the combined transcript is a separate, best-effort step
   * (reanalyzeNote) callers fire off afterwards without awaiting.
   */
  appendToNote: (
    noteId: string,
    transcript: string,
    audioUri: string | null
  ) => Segment;
  /**
   * Best-effort re-analysis after an append: joins every segment's text into
   * one transcript and re-runs analyze() over it, same fail-silent pattern
   * as analyzeNote — a missing key or a thrown request never breaks the
   * append, the segment is already saved by the time this runs.
   */
  reanalyzeNote: (noteId: string) => Promise<void>;
  /** Chat drawer: loads persisted chat history for a note into chatMessages. */
  loadChatMessages: (noteId: string) => void;
  /**
   * Chat drawer's send action. Always resolves to SOME state — the user's
   * message is saved immediately (so it appears instantly), and an
   * assistant reply always follows: the model's answer on success, a
   * "add your key" nudge if no Anthropic key is configured, or a
   * connection-error message if the request throws. Chat is an explicit
   * user action (unlike the passive auto-analysis above), so every path
   * gives the user visible feedback — never a silent no-op.
   */
  sendChatMessage: (noteId: string, transcript: string, userText: string) => Promise<void>;
  /**
   * App-start hydration: reads the last-chosen background id (persisted via
   * setSelectedBackgroundId below) from secure storage and applies it, so
   * the chosen background survives an app restart instead of resetting to
   * the default every launch. No-ops if nothing was ever persisted.
   */
  loadSelectedBackground: () => Promise<void>;
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
  currentNote: null,
  currentSegments: [],
  chatMessages: [],

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

  loadNote: (noteId: string) => {
    const db = getDb();
    const note = repo.getNote(db, noteId) ?? null;
    const currentSegments = repo.listSegments(db, noteId);
    set({ currentNote: note, currentSegments });
  },

  appendToNote: (noteId: string, transcript: string, audioUri: string | null) => {
    const db = getDb();
    const segment = repo.addSegment(db, noteId, { text: transcript, audioUri });
    get().loadNote(noteId);
    return segment;
  },

  reanalyzeNote: async (noteId: string) => {
    const key = await getKey('anthropic');
    if (!key) return;

    try {
      const db = getDb();
      const segments = repo.listSegments(db, noteId);
      const combined = segments.map((s) => s.text).join('\n\n');
      const result = await analyze(combined, key);
      repo.updateNote(db, noteId, {
        title: result.title,
        summary: result.summary,
        nextSteps: result.next_steps,
      });
      get().loadNote(noteId);
      get().loadNotes();
    } catch {
      // Non-blocking, non-critical: leave the previous title/summary in
      // place. The segment is already safely saved via appendToNote.
    }
  },

  loadChatMessages: (noteId: string) => {
    const db = getDb();
    set({ chatMessages: repo.listMessages(db, noteId) });
  },

  sendChatMessage: async (noteId: string, transcript: string, userText: string) => {
    const db = getDb();

    // 1. Save the user's message immediately and refresh — it appears
    // instantly regardless of what happens next.
    repo.addMessage(db, noteId, { role: 'user', content: userText });
    get().loadChatMessages(noteId);

    // 2. No key configured: chat is an explicit user action, so give
    // feedback instead of silently doing nothing.
    const key = await getKey('anthropic');
    if (!key) {
      repo.addMessage(db, noteId, {
        role: 'assistant',
        content: 'Add your Anthropic key in Settings to chat.',
      });
      get().loadChatMessages(noteId);
      return;
    }

    // 3. Call the model over the full history (existing + the message just
    // saved above), grounded in the note's transcript.
    try {
      const history = repo
        .listMessages(db, noteId)
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
      const reply = await chat(history, transcript, key);
      repo.addMessage(db, noteId, { role: 'assistant', content: reply });
    } catch {
      repo.addMessage(db, noteId, {
        role: 'assistant',
        content: "Sorry, I couldn't respond — check your connection and try again.",
      });
    } finally {
      get().loadChatMessages(noteId);
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
    // Persist so the choice survives an app restart. Best-effort/fire-and-
    // forget: the UI already reflects the new background synchronously
    // above, and a failed write here just means next launch falls back to
    // the default — never worth blocking or alerting over.
    setSetting('selectedBackgroundId', id).catch(() => {});
  },

  loadSelectedBackground: async () => {
    const id = await getSetting('selectedBackgroundId');
    if (id) set({ selectedBackgroundId: id });
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
