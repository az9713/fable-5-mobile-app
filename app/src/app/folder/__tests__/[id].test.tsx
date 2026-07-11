import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import type { Note } from '@/db/repo';

// Rendering the real store would call getDb() (expo-sqlite, native-only —
// crashes under Jest), so give the folder screen a fixed, in-memory state,
// mirroring the pattern in src/app/__tests__/index.test.tsx.
const mockFixedState: {
  folders: { id: string; name: string; created_at: number }[];
  notes: Note[];
  noteSnippets: Record<string, string>;
  selectedBackgroundId: string;
  loadFolders: jest.Mock;
  loadNotes: jest.Mock;
  moveNoteToFolder: jest.Mock;
} = {
  folders: [{ id: 'f1', name: 'Work', created_at: 0 }],
  notes: [
    {
      id: 'n1',
      folder_id: null,
      title: 'A great idea about ships',
      summary: null,
      next_steps: [],
      audio_uri: 'file:///audio/n1.m4a',
      created_at: 0,
      updated_at: 0,
    },
  ],
  noteSnippets: { n1: 'This is the first thing I said.' },
  selectedBackgroundId: 'aurora',
  loadFolders: jest.fn(),
  loadNotes: jest.fn(),
  moveNoteToFolder: jest.fn(),
};

jest.mock('@/store/useStore', () => ({
  useStore: (selector: (state: typeof mockFixedState) => unknown) => selector(mockFixedState),
}));

jest.mock('expo-router', () => {
  const react = require('react');
  return {
    useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
    useLocalSearchParams: () => ({ id: 'inbox' }),
    useFocusEffect: (effect: () => void) => react.useEffect(effect, []),
  };
});

import FolderScreen from '@/app/folder/[id]';

describe('FolderScreen (Inbox)', () => {
  beforeEach(() => {
    mockFixedState.moveNoteToFolder.mockClear();
  });

  it('renders the Inbox header and its notes', async () => {
    const { getByText } = await render(<FolderScreen />);

    expect(getByText('Inbox')).toBeTruthy();
    expect(getByText('A great idea about ships')).toBeTruthy();
    expect(getByText('This is the first thing I said.')).toBeTruthy();
  });

  it('shows an empty state when there are no notes', async () => {
    mockFixedState.notes = [];
    mockFixedState.noteSnippets = {};

    const { getByText } = await render(<FolderScreen />);
    expect(getByText('No notes yet')).toBeTruthy();

    // Restore for the tests below.
    mockFixedState.notes = [
      {
        id: 'n1',
        folder_id: null,
        title: 'A great idea about ships',
        summary: null,
        next_steps: [],
        audio_uri: 'file:///audio/n1.m4a',
        created_at: 0,
        updated_at: 0,
      },
    ];
    mockFixedState.noteSnippets = { n1: 'This is the first thing I said.' };
  });

  it('long-pressing a note opens the "Move to…" sheet listing other folders', async () => {
    // Fire the longPress on the note's title Text node rather than the
    // outer accessibilityLabel host view: RNTL's fireEvent walks up the
    // fiber tree to find the Pressable's onLongPress either way, but firing
    // directly on the Pressable's own host node (inside a FlatList cell)
    // gets gated by its touch-responder check and silently no-ops.
    const { getByText, queryByText } = await render(<FolderScreen />);

    expect(queryByText('Move to…')).toBeNull();

    await fireEvent(getByText('A great idea about ships'), 'longPress');

    expect(getByText('Move to…')).toBeTruthy();
    expect(getByText('Work')).toBeTruthy();
  });

  it('tapping a destination calls moveNoteToFolder and closes the sheet', async () => {
    const { getByText, queryByText } = await render(<FolderScreen />);

    await fireEvent(getByText('A great idea about ships'), 'longPress');
    await fireEvent.press(getByText('Work'));

    expect(mockFixedState.moveNoteToFolder).toHaveBeenCalledWith('n1', 'f1');
    expect(queryByText('Move to…')).toBeNull();
  });
});
