import { useStore } from '@/store/useStore';
import { BACKGROUNDS } from '@/theme/backgrounds';
import * as repo from '@/db/repo';

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
});
