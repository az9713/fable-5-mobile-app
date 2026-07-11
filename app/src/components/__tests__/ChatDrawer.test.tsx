import React from 'react';
import { fireEvent, render, userEvent } from '@testing-library/react-native';

import type { Message } from '@/db/repo';

const mockFixedState: {
  chatMessages: Message[];
  sendChatMessage: jest.Mock;
} = {
  chatMessages: [],
  sendChatMessage: jest.fn().mockResolvedValue(undefined),
};

jest.mock('@/store/useStore', () => ({
  useStore: (selector: (state: typeof mockFixedState) => unknown) => selector(mockFixedState),
}));

import { ChatDrawer } from '@/components/ChatDrawer';

describe('ChatDrawer', () => {
  beforeEach(() => {
    mockFixedState.chatMessages = [];
    mockFixedState.sendChatMessage.mockClear();
  });

  it('renders nothing when not visible', async () => {
    const { queryByText, toJSON } = await render(
      <ChatDrawer visible={false} noteId="n1" transcript="transcript text" onClose={jest.fn()} />
    );

    expect(toJSON()).toBeNull();
    expect(queryByText('Chat with this note')).toBeNull();
  });

  it('renders the header, empty state, and suggested prompt chips when visible', async () => {
    const { getByText } = await render(
      <ChatDrawer visible noteId="n1" transcript="transcript text" onClose={jest.fn()} />
    );

    expect(getByText('Chat with this note')).toBeTruthy();
    expect(getByText('Ask anything about this note.')).toBeTruthy();
    expect(getByText('What were the next steps from this?')).toBeTruthy();
    expect(getByText('What was the idea as a whole?')).toBeTruthy();
  });

  it('renders persisted chat messages', async () => {
    mockFixedState.chatMessages = [
      { id: 'm1', note_id: 'n1', role: 'user', content: 'What next?', created_at: 0 },
      { id: 'm2', note_id: 'n1', role: 'assistant', content: 'Ship it.', created_at: 1 },
    ];

    const { getByText } = await render(
      <ChatDrawer visible noteId="n1" transcript="transcript text" onClose={jest.fn()} />
    );

    expect(getByText('What next?')).toBeTruthy();
    expect(getByText('Ship it.')).toBeTruthy();
  });

  it('calls onClose when the backdrop is tapped', async () => {
    const onClose = jest.fn();
    const { getByTestId } = await render(
      <ChatDrawer visible noteId="n1" transcript="transcript text" onClose={onClose} />
    );

    fireEvent.press(getByTestId('chat-drawer-backdrop'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the close button is tapped', async () => {
    const onClose = jest.fn();
    const { getByLabelText } = await render(
      <ChatDrawer visible noteId="n1" transcript="transcript text" onClose={onClose} />
    );

    fireEvent.press(getByLabelText('Close'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('tapping a suggested prompt chip fills the input field', async () => {
    const user = userEvent.setup();
    const { getByText, getByTestId } = await render(
      <ChatDrawer visible noteId="n1" transcript="transcript text" onClose={jest.fn()} />
    );

    await user.press(getByText('What was the idea as a whole?'));

    expect(getByTestId('chat-drawer-input').props.value).toBe('What was the idea as a whole?');
  });

  it('sending a message calls sendChatMessage with the noteId, transcript, and trimmed text, then clears the input', async () => {
    const user = userEvent.setup();
    const { getByTestId } = await render(
      <ChatDrawer visible noteId="n1" transcript="the transcript" onClose={jest.fn()} />
    );

    const input = getByTestId('chat-drawer-input');
    await user.type(input, '  What next?  ');
    await user.press(getByTestId('chat-drawer-send'));

    expect(mockFixedState.sendChatMessage).toHaveBeenCalledWith('n1', 'the transcript', 'What next?');
    expect(getByTestId('chat-drawer-input').props.value).toBe('');
  });

  it('does not send an empty or whitespace-only message', async () => {
    const user = userEvent.setup();
    const { getByTestId } = await render(
      <ChatDrawer visible noteId="n1" transcript="the transcript" onClose={jest.fn()} />
    );

    await user.type(getByTestId('chat-drawer-input'), '   ');
    await user.press(getByTestId('chat-drawer-send'));

    expect(mockFixedState.sendChatMessage).not.toHaveBeenCalled();
  });
});
