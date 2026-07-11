import React from 'react';
import { render } from '@testing-library/react-native';

import type { Note } from '@/db/repo';

// Rendering the real store would call getDb() (expo-sqlite, native-only —
// crashes under Jest), so give the folder screen a fixed, in-memory state,
// mirroring the pattern in src/app/__tests__/index.test.tsx.
const mockFixedState: {
  folders: { id: string; name: string; created_at: number }[];
  notes: Note[];
  noteSnippets: Record<string, string>;
  selectedBackgroundId: string;
  loadNotes: jest.Mock;
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
  loadNotes: jest.fn(),
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
  });
});
