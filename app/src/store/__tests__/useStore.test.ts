import { useStore } from '@/store/useStore';
import { BACKGROUNDS } from '@/theme/backgrounds';
import * as repo from '@/db/repo';
import { analyze } from '@/ai/anthropic';
import { getKey } from '@/store/secrets';

// getDb() opens a native expo-sqlite database and can't run under Jest, so
// stub it out along with the repo functions touched by moveNoteToFolder —
// same pattern the folder-screen and home-screen tests use for the store
// itself, just one layer down (mocking the db/repo instead of the store).
jest.mock('@/db/db', () => ({
  getDb: jest.fn(() => ({})),
}));

jest.mock('@/db/repo', () => ({
  moveNote: jest.fn(),
  listFolders: jest.fn(() => []),
  listNotes: jest.fn(() => []),
  listSegments: jest.fn(() => []),
  getNote: jest.fn(),
  addSegment: jest.fn(),
  updateNote: jest.fn(),
}));

jest.mock('@/ai/anthropic', () => ({
  analyze: jest.fn(),
}));

jest.mock('@/store/secrets', () => ({
  getKey: jest.fn(),
}));

describe('useStore', () => {
  it('initializes with defaults', () => {
    const state = useStore.getState();

    expect(state.folders).toEqual([]);
    expect(state.notes).toEqual([]);
    expect(state.selectedFolderId).toBeNull();
    expect(state.selectedBackgroundId).toBe(BACKGROUNDS[0]?.id);
  });

  it('setSelectedBackgroundId updates state', () => {
    useStore.getState().setSelectedBackgroundId('monet');
    expect(useStore.getState().selectedBackgroundId).toBe('monet');
  });

  describe('moveNoteToFolder', () => {
    it('moves the note via repo.moveNote, then reloads the note list and folder counts', () => {
      useStore.getState().moveNoteToFolder('note-1', 'folder-2');

      expect(repo.moveNote).toHaveBeenCalledWith(expect.anything(), 'note-1', 'folder-2');
      // loadNotes (source/current list refresh) and loadFolderCounts (which
      // recomputes every folder's count, covering both source + destination).
      expect(repo.listNotes).toHaveBeenCalled();
      expect(repo.listFolders).toHaveBeenCalled();
    });

    it('supports moving a note back to Inbox (folderId = null)', () => {
      useStore.getState().moveNoteToFolder('note-1', null);
      expect(repo.moveNote).toHaveBeenCalledWith(expect.anything(), 'note-1', null);
    });
  });

  describe('loadNote', () => {
    it('loads a note and its segments into currentNote/currentSegments', () => {
      const note = {
        id: 'note-1',
        folder_id: null,
        title: 'A note',
        summary: null,
        next_steps: [],
        audio_uri: null,
        created_at: 0,
        updated_at: 0,
      };
      const segments = [
        { id: 'seg-1', note_id: 'note-1', text: 'First', audio_uri: null, created_at: 0 },
      ];
      (repo.getNote as jest.Mock).mockReturnValue(note);
      (repo.listSegments as jest.Mock).mockReturnValue(segments);

      useStore.getState().loadNote('note-1');

      expect(useStore.getState().currentNote).toEqual(note);
      expect(useStore.getState().currentSegments).toEqual(segments);
    });
  });

  describe('appendToNote', () => {
    it('saves a new segment via repo.addSegment and refreshes currentNote/currentSegments', () => {
      const newSegment = {
        id: 'seg-2',
        note_id: 'note-1',
        text: 'Second thought',
        audio_uri: 'file:///a.m4a',
        created_at: 1,
      };
      (repo.addSegment as jest.Mock).mockReturnValue(newSegment);
      (repo.getNote as jest.Mock).mockReturnValue({ id: 'note-1' });
      (repo.listSegments as jest.Mock).mockReturnValue([newSegment]);

      const result = useStore.getState().appendToNote('note-1', 'Second thought', 'file:///a.m4a');

      expect(repo.addSegment).toHaveBeenCalledWith(expect.anything(), 'note-1', {
        text: 'Second thought',
        audioUri: 'file:///a.m4a',
      });
      expect(result).toEqual(newSegment);
      expect(useStore.getState().currentSegments).toEqual([newSegment]);
    });
  });

  describe('reanalyzeNote', () => {
    beforeEach(() => {
      (repo.updateNote as jest.Mock).mockClear();
      (analyze as jest.Mock).mockReset();
    });

    it('does nothing when no Anthropic key is available', async () => {
      (getKey as jest.Mock).mockResolvedValue(null);

      await useStore.getState().reanalyzeNote('note-1');

      expect(analyze).not.toHaveBeenCalled();
      expect(repo.updateNote).not.toHaveBeenCalled();
    });

    it('joins every segment and updates title/summary/next_steps on success', async () => {
      (getKey as jest.Mock).mockResolvedValue('sk-ant-test');
      (repo.listSegments as jest.Mock).mockReturnValue([
        { id: 's1', note_id: 'note-1', text: 'First part', audio_uri: null, created_at: 0 },
        { id: 's2', note_id: 'note-1', text: 'Second part', audio_uri: null, created_at: 1 },
      ]);
      (analyze as jest.Mock).mockResolvedValue({
        title: 'Combined idea',
        summary: 'Summary of both parts.',
        next_steps: ['Do the thing'],
      });
      (repo.getNote as jest.Mock).mockReturnValue({ id: 'note-1' });

      await useStore.getState().reanalyzeNote('note-1');

      expect(analyze).toHaveBeenCalledWith('First part\n\nSecond part', 'sk-ant-test');
      expect(repo.updateNote).toHaveBeenCalledWith(expect.anything(), 'note-1', {
        title: 'Combined idea',
        summary: 'Summary of both parts.',
        nextSteps: ['Do the thing'],
      });
    });

    it('fails silently when analyze() throws — never propagates', async () => {
      (getKey as jest.Mock).mockResolvedValue('sk-ant-test');
      (repo.listSegments as jest.Mock).mockReturnValue([
        { id: 's1', note_id: 'note-1', text: 'Text', audio_uri: null, created_at: 0 },
      ]);
      (analyze as jest.Mock).mockRejectedValue(new Error('network down'));

      await expect(useStore.getState().reanalyzeNote('note-1')).resolves.toBeUndefined();
      expect(repo.updateNote).not.toHaveBeenCalled();
    });
  });
});
