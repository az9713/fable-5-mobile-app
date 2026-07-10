import * as SecureStore from 'expo-secure-store';

export type SecretName = 'openai' | 'anthropic';

const KEYCHAIN_KEYS: Record<SecretName, string> = {
  openai: 'openai_api_key',
  anthropic: 'anthropic_api_key',
};

/**
 * Reads an API key from the Keychain. If the Keychain has no value, falls
 * back to the matching EXPO_PUBLIC_*_KEY env var (dev convenience). A
 * Keychain value always wins over the env var. Reads process.env at call
 * time (not module load time) so it stays testable.
 */
export async function getKey(name: SecretName): Promise<string | null> {
  const stored = await SecureStore.getItemAsync(KEYCHAIN_KEYS[name]);
  if (stored) {
    return stored;
  }
  const envKey =
    name === 'openai'
      ? process.env.EXPO_PUBLIC_OPENAI_KEY
      : process.env.EXPO_PUBLIC_ANTHROPIC_KEY;
  return envKey || null;
}

/** Writes an API key to the Keychain. */
export async function setKey(name: SecretName, value: string): Promise<void> {
  await SecureStore.setItemAsync(KEYCHAIN_KEYS[name], value);
}
