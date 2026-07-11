import React from 'react';
import { render } from '@testing-library/react-native';

// Rendering the real store would call getDb() (expo-sqlite, native-only —
// crashes under Jest), so give the home screen a fixed, in-memory state.
// Jest only allows `mock`-prefixed out-of-scope variables inside a
// jest.mock() factory, hence the name.
const mockFixedState = {
  folders: [{ id: 'f1', name: 'Work', created_at: 0 }],
  folderCounts: { f1: 2 },
  inboxCount: 5,
  selectedBackgroundId: 'aurora',
  loadFolders: jest.fn(),
  loadFolderCounts: jest.fn(),
  createFolder: jest.fn(),
  captureNote: jest.fn(),
};

jest.mock('@/store/useStore', () => ({
  useStore: (selector: (state: typeof mockFixedState) => unknown) => selector(mockFixedState),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

// useRecorder wraps expo-audio, a native module that can't load under Jest
// (same reason src/db/db.ts is never imported by tests) — stub it out.
jest.mock('@/audio/useRecorder', () => ({
  useRecorder: () => ({
    state: 'idle',
    permissionDenied: false,
    start: jest.fn(),
    stop: jest.fn(),
  }),
}));

import HomeScreen from '@/app/index';

describe('HomeScreen', () => {
  it('renders Inbox, known folders, and the New-folder affordance', async () => {
    const { getByText } = await render(<HomeScreen />);

    expect(getByText('Ideas')).toBeTruthy();
    expect(getByText('Inbox')).toBeTruthy();
    expect(getByText('5')).toBeTruthy();
    expect(getByText('Work')).toBeTruthy();
    expect(getByText('New folder')).toBeTruthy();
  });
});
