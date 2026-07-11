import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { FolderTile } from '@/components/FolderTile';

describe('FolderTile', () => {
  it('renders without throwing and shows label + count', async () => {
    const { getByText } = await render(
      <FolderTile label="Inbox" count={3} onPress={() => {}} />
    );
    expect(getByText('Inbox')).toBeTruthy();
    expect(getByText('3')).toBeTruthy();
  });

  it('fires onPress when tapped', async () => {
    const onPress = jest.fn();
    const { getByRole } = await render(
      <FolderTile label="Work" count={0} onPress={onPress} />
    );
    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders the dashed New folder tile without a count', async () => {
    const { getByText, queryByText } = await render(
      <FolderTile label="New folder" icon="add" dashed onPress={() => {}} />
    );
    expect(getByText('New folder')).toBeTruthy();
    expect(queryByText('undefined')).toBeNull();
  });
});
