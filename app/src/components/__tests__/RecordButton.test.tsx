import React from 'react';
import { render } from '@testing-library/react-native';

import { RecordButton } from '@/components/RecordButton';

describe('RecordButton', () => {
  it('renders without throwing', async () => {
    const { getByRole } = await render(<RecordButton />);
    expect(getByRole('button')).toBeTruthy();
  });
});
