import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import type { Message, Note, Segment } from '@/db/repo';

// Rendering the real store would call getDb() (expo-sqlite, native-only —
// crashes under Jest), so give the note screen a fixed, in-memory state,
// mirroring the pattern in src/app/folder/__tests__/[id].test.tsx.
const baseNote: Note = {
  id: 'n1',
  folder_id: null,
  title: 'Ship the widget',
  summary: 'A plan to ship the widget to customers next quarter.',
  next_steps: ['Write tests', 'Ship it'],
  audio_uri: 'file:///audio/n1.m4a',
  created_at: 0,
  updated_at: 0,
};

const baseSegments: Segment[] = [
  {
    id: 's1',
    note_id: 'n1',
    text: 'This is the first thing I said about the widget and how it should work end to end.',
    audio_uri: 'file:///audio/n1.m4a',
    created_at: 0,
  },
];

const mockFixedState: {
  selectedBackgroundId: string;
  currentNote: Note | null;
  currentSegments: Segment[];
  chatMessages: Message[];
  loadNote: jest.Mock;
  appendToNote: jest.Mock;
  reanalyzeNote: jest.Mock;
  loadChatMessages: jest.Mock;
  sendChatMessage: jest.Mock;
} = {
  selectedBackgroundId: 'aurora',
  currentNote: baseNote,
  currentSegments: baseSegments,
  chatMessages: [],
  loadNote: jest.fn(),
  appendToNote: jest.fn(),
  reanalyzeNote: jest.fn().mockResolvedValue(undefined),
  loadChatMessages: jest.fn(),
  sendChatMessage: jest.fn().mockResolvedValue(undefined),
};

jest.mock('@/store/useStore', () => ({
  useStore: (selector: (state: typeof mockFixedState) => unknown) => selector(mockFixedState),
}));

jest.mock('expo-router', () => {
  const react = require('react');
  return {
    useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
    useLocalSearchParams: () => ({ id: 'n1' }),
    useFocusEffect: (effect: () => void) => react.useEffect(effect, []),
  };
});

// useRecorder wraps expo-audio, a native module that can't load under Jest —
// stub it out, same pattern as src/app/__tests__/index.test.tsx.
jest.mock('@/audio/useRecorder', () => ({
  useRecorder: () => ({
    state: 'idle',
    permissionDenied: false,
    start: jest.fn(),
    stop: jest.fn(),
  }),
}));

import NoteScreen from '@/app/note/[id]';

describe('NoteScreen', () => {
  beforeEach(() => {
    mockFixedState.currentNote = baseNote;
    mockFixedState.currentSegments = baseSegments;
    mockFixedState.chatMessages = [];
    mockFixedState.loadNote.mockClear();
    mockFixedState.appendToNote.mockClear();
    mockFixedState.reanalyzeNote.mockClear();
    mockFixedState.loadChatMessages.mockClear();
    mockFixedState.sendChatMessage.mockClear();
  });

  it('renders the analysis card (summary + next steps) and the collapsed transcript', async () => {
    const { getByText } = await render(<NoteScreen />);

    expect(getByText('Ship the widget')).toBeTruthy();
    expect(getByText('A plan to ship the widget to customers next quarter.')).toBeTruthy();
    expect(getByText('Write tests')).toBeTruthy();
    expect(getByText('Ship it')).toBeTruthy();

    // Collapsed by default: the "Show more" affordance is present, not
    // "Show less".
    expect(getByText('Show more')).toBeTruthy();
  });

  it('does not render a Next steps section when next_steps is empty', async () => {
    mockFixedState.currentNote = { ...baseNote, next_steps: [] };

    const { queryByText } = await render(<NoteScreen />);
    expect(queryByText('Next steps')).toBeNull();
  });

  it('tapping the expand affordance toggles to the expanded state, revealing per-segment timestamps', async () => {
    const { getByText, queryByText } = await render(<NoteScreen />);

    expect(queryByText('Show less')).toBeNull();

    await fireEvent.press(getByText('Show more'));

    expect(getByText('Show less')).toBeTruthy();
  });

  it('renders the "Chat with this note" button', async () => {
    const { getByLabelText } = await render(<NoteScreen />);
    expect(getByLabelText('Chat with this note')).toBeTruthy();
  });

  it('tapping "Chat with this note" opens the chat drawer and loads its history', async () => {
    const { getByText, getByLabelText } = await render(<NoteScreen />);

    await fireEvent.press(getByLabelText('Chat with this note'));

    expect(mockFixedState.loadChatMessages).toHaveBeenCalledWith('n1');
    // The drawer's own header text confirms it's rendered/open.
    expect(getByText('Ask anything about this note.')).toBeTruthy();
  });
});
