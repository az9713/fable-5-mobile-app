import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';

import { GlassCard } from '@/components/GlassCard';

describe('GlassCard', () => {
  it('renders children without throwing when blur is true', async () => {
    const { getByText } = await render(
      <GlassCard blur>
        <Text>Hello Glass</Text>
      </GlassCard>
    );
    expect(getByText('Hello Glass')).toBeTruthy();
  });

  it('renders children without throwing when blur is false', async () => {
    const { getByText } = await render(
      <GlassCard blur={false}>
        <Text>Hello Flat</Text>
      </GlassCard>
    );
    expect(getByText('Hello Flat')).toBeTruthy();
  });
});
