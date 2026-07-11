import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

// Rendering the real store would call getDb() (expo-sqlite, native-only —
// crashes under Jest), so give the settings screen a fixed, in-memory
// state, mirroring the pattern in src/app/__tests__/index.test.tsx.
const mockFixedState = {
  selectedBackgroundId: 'aurora',
  setSelectedBackgroundId: jest.fn(),
};

jest.mock('@/store/useStore', () => ({
  useStore: (selector: (state: typeof mockFixedState) => unknown) => selector(mockFixedState),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

jest.mock('@/db/db', () => ({
  getDb: jest.fn(() => ({})),
}));

jest.mock('@/db/repo', () => ({
  listFolders: jest.fn(() => []),
  listNotes: jest.fn(() => []),
  listSegments: jest.fn(() => []),
}));

const mockGetKey = jest.fn<Promise<string | null>, [string]>();
const mockSetKey = jest.fn<Promise<void>, [string, string]>(() => Promise.resolve());
jest.mock('@/store/secrets', () => ({
  getKey: (name: string) => mockGetKey(name),
  setKey: (name: string, value: string) => mockSetKey(name, value),
}));

const mockShareAsync = jest.fn<Promise<void>, [string, unknown?]>(() => Promise.resolve());
const mockIsAvailableAsync = jest.fn<Promise<boolean>, []>(() => Promise.resolve(true));
jest.mock('expo-sharing', () => ({
  shareAsync: (url: string, options?: unknown) => mockShareAsync(url, options),
  isAvailableAsync: () => mockIsAvailableAsync(),
}));

const mockCreateFile = jest.fn(() => ({ uri: 'file:///mock.txt', write: jest.fn() }));
const mockDirCreate = jest.fn();
jest.mock('expo-file-system', () => ({
  Directory: jest.fn().mockImplementation(() => ({
    create: mockDirCreate,
    createFile: mockCreateFile,
  })),
  Paths: { cache: 'file:///cache/' },
}));

import SettingsScreen from '@/app/settings';
import * as repo from '@/db/repo';

/**
 * Renders the screen and waits for its mount-time effect (loading both keys
 * via secrets.getKey) to fully settle before handing back to the test. The
 * screen also schedules a real setTimeout (flashSaved's "Saved" indicator)
 * on key-save — fake timers here so that never leaks a pending macrotask
 * into the next test and corrupts RNTL's act() tracking.
 */
async function renderSettings() {
  const utils = await render(<SettingsScreen />);
  // Wait for the mount effect's state update (not just the getKey calls) to
  // actually commit, so it's flushed inside waitFor's act() wrapper instead
  // of leaking into whatever runs next.
  await waitFor(() =>
    expect(utils.getByTestId('key-input-openai').props.value).toBe('sk-existing-openai-key')
  );
  return utils;
}

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetKey.mockImplementation((name: string) =>
      Promise.resolve(name === 'openai' ? 'sk-existing-openai-key' : null)
    );
    mockFixedState.selectedBackgroundId = 'aurora';
  });

  it('renders the API Keys, Background, and Backup sections', async () => {
    const { getByText } = await renderSettings();

    expect(getByText('API Keys')).toBeTruthy();
    expect(getByText('Background')).toBeTruthy();
    expect(getByText('Backup')).toBeTruthy();
    expect(getByText('Export all notes')).toBeTruthy();
    expect(getByText('Keys are stored securely on this device only.')).toBeTruthy();
  });

  it('loads and shows the existing OpenAI key in its masked field', async () => {
    const { getByTestId } = await renderSettings();

    expect(getByTestId('key-input-openai').props.value).toBe('sk-existing-openai-key');
    expect(getByTestId('key-input-openai').props.secureTextEntry).toBe(true);
  });

  it('saving a key calls secrets.setKey', async () => {
    const { getByTestId, getByLabelText } = await renderSettings();

    fireEvent.changeText(getByTestId('key-input-anthropic'), 'sk-ant-new');
    await waitFor(() =>
      expect(getByTestId('key-input-anthropic').props.value).toBe('sk-ant-new')
    );

    await fireEvent.press(getByLabelText('Save Anthropic (AI analysis & chat) key'));

    expect(mockSetKey).toHaveBeenCalledWith('anthropic', 'sk-ant-new');

    // handleSave schedules a real 1.5s setTimeout to clear the "Saved"
    // flash. Wait it out (wrapped in act, since it triggers a state update)
    // so it can't fire for real mid the next test.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1600));
    });
  });

  it('tapping a background thumbnail calls setSelectedBackgroundId', async () => {
    const { getByTestId } = await renderSettings();

    fireEvent.press(getByTestId('bg-thumb-monet'));

    expect(mockFixedState.setSelectedBackgroundId).toHaveBeenCalledWith('monet');
  });

  it('exporting with no notes shows an alert and never touches the filesystem', async () => {
    const { getByText } = await renderSettings();

    await fireEvent.press(getByText('Export all notes'));

    expect(mockShareAsync).not.toHaveBeenCalled();
  });

  it('exporting with notes writes both files and shares them', async () => {
    (repo.listNotes as jest.Mock).mockImplementation((_db: unknown, folderId: string | null) =>
      folderId === null
        ? [
            {
              id: 'n1',
              folder_id: null,
              title: 'An idea',
              summary: null,
              next_steps: [],
              audio_uri: null,
              created_at: 0,
              updated_at: 0,
            },
          ]
        : []
    );
    (repo.listSegments as jest.Mock).mockReturnValue([
      { id: 's1', note_id: 'n1', text: 'Hello world', audio_uri: null, created_at: 0 },
    ]);

    const { getByText } = await renderSettings();

    await fireEvent.press(getByText('Export all notes'));

    expect(mockCreateFile).toHaveBeenCalledWith('notes.md', 'text/markdown');
    expect(mockCreateFile).toHaveBeenCalledWith('notes.json', 'application/json');
    expect(mockShareAsync).toHaveBeenCalledTimes(2);
  });
});
