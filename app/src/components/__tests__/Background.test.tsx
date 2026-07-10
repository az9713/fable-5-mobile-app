import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';

import { Background } from '@/components/Background';

describe('Background', () => {
  it('renders children without throwing for a painting background', async () => {
    const { getByText } = await render(
      <Background backgroundId="seurat">
        <Text>Over Painting</Text>
      </Background>
    );
    expect(getByText('Over Painting')).toBeTruthy();
  });

  it('renders children without throwing for the gradient background', async () => {
    const { getByText } = await render(
      <Background backgroundId="aurora">
        <Text>Over Gradient</Text>
      </Background>
    );
    expect(getByText('Over Gradient')).toBeTruthy();
  });
});
