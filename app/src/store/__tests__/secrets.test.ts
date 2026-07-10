jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

import * as SecureStore from 'expo-secure-store';
import { getKey, setKey } from '@/store/secrets';

const getItemAsync = SecureStore.getItemAsync as jest.Mock;
const setItemAsync = SecureStore.setItemAsync as jest.Mock;

describe('secrets', () => {
  // IMPORTANT: mutate process.env's existing keys in place rather than
  // reassigning `process.env` itself. expo-router's babel transform rewrites
  // `process.env.EXPO_PUBLIC_*` reads into `env.EXPO_PUBLIC_*` from
  // `expo/virtual/env`, which does `export const env = process.env` — a live
  // reference to the *object*. Reassigning `process.env = {...}` would swap
  // in a new object that virtual module never sees.
  const ORIGINAL_OPENAI = process.env.EXPO_PUBLIC_OPENAI_KEY;
  const ORIGINAL_ANTHROPIC = process.env.EXPO_PUBLIC_ANTHROPIC_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.EXPO_PUBLIC_OPENAI_KEY;
    delete process.env.EXPO_PUBLIC_ANTHROPIC_KEY;
  });

  afterAll(() => {
    if (ORIGINAL_OPENAI !== undefined) process.env.EXPO_PUBLIC_OPENAI_KEY = ORIGINAL_OPENAI;
    if (ORIGINAL_ANTHROPIC !== undefined)
      process.env.EXPO_PUBLIC_ANTHROPIC_KEY = ORIGINAL_ANTHROPIC;
  });

  it('falls back to env var when Keychain has no value', async () => {
    getItemAsync.mockResolvedValueOnce(null);
    process.env.EXPO_PUBLIC_OPENAI_KEY = 'env-openai-key';

    const key = await getKey('openai');

    expect(key).toBe('env-openai-key');
    expect(getItemAsync).toHaveBeenCalledWith('openai_api_key');
  });

  it('returns the Keychain value when set, ignoring env', async () => {
    getItemAsync.mockResolvedValueOnce('keychain-openai-key');
    process.env.EXPO_PUBLIC_OPENAI_KEY = 'env-openai-key';

    const key = await getKey('openai');

    expect(key).toBe('keychain-openai-key');
  });

  it('returns null when neither Keychain nor env has a value', async () => {
    getItemAsync.mockResolvedValueOnce(null);
    delete process.env.EXPO_PUBLIC_ANTHROPIC_KEY;

    const key = await getKey('anthropic');

    expect(key).toBeNull();
  });

  it('uses the anthropic env var for the anthropic key', async () => {
    getItemAsync.mockResolvedValueOnce(null);
    process.env.EXPO_PUBLIC_ANTHROPIC_KEY = 'env-anthropic-key';

    const key = await getKey('anthropic');

    expect(key).toBe('env-anthropic-key');
  });

  it('setKey writes to the Keychain', async () => {
    await setKey('openai', 'new-key');

    expect(setItemAsync).toHaveBeenCalledWith('openai_api_key', 'new-key');
  });
});
