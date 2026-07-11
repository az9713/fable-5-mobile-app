import React from 'react';
import { render } from '@testing-library/react-native';

import { NoteRow } from '@/components/NoteRow';
import type { Note } from '@/db/repo';

const note: Note = {
  id: 'n1',
  folder_id: null,
  title: 'A great idea about ships',
  summary: null,
  next_steps: [],
  audio_uri: 'file:///audio/n1.m4a',
  created_at: Date.parse('2026-01-05T00:00:00Z'),
  updated_at: Date.parse('2026-01-05T00:00:00Z'),
};

describe('NoteRow', () => {
  it('renders the title, date, and snippet', async () => {
    const { getByText } = await render(
      <NoteRow note={note} snippet="This is the first thing I said." onPress={jest.fn()} />
    );

    expect(getByText('A great idea about ships')).toBeTruthy();
    expect(getByText('This is the first thing I said.')).toBeTruthy();
  });

  it('renders without a snippet', async () => {
    const { getByText, queryByText } = await render(
      <NoteRow note={note} onPress={jest.fn()} />
    );

    expect(getByText('A great idea about ships')).toBeTruthy();
    expect(queryByText('This is the first thing I said.')).toBeNull();
  });
});
