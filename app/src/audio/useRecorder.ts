import { useCallback, useState } from 'react';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { Directory, File, Paths } from 'expo-file-system';

export type RecorderPhase = 'idle' | 'recording' | 'processing';

export type UseRecorderResult = {
  state: RecorderPhase;
  /** True once a permission request has come back denied, so the UI can prompt the user. */
  permissionDenied: boolean;
  start: () => Promise<void>;
  /**
   * Stops recording, moves the file out of cache into documentDirectory for
   * durability, and resolves its new uri (or null if nothing was recorded).
   */
  stop: () => Promise<string | null>;
};

const AUDIO_DIR_NAME = 'audio';

/** Ensures documentDirectory/audio/ exists (expo-audio records into cache, which iOS can purge) and returns it. */
function getAudioDirectory(): Directory {
  const dir = new Directory(Paths.document, AUDIO_DIR_NAME);
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

/**
 * Owns a single expo-audio recorder instance. Fires the start/stop haptics
 * itself, so callers that drive a controlled `RecordButton` from this hook's
 * `state` should pass `state` (not `onToggle`-triggered local state) and
 * must NOT also fire haptics on press — `RecordButton` skips its own
 * haptics whenever it's given a controlled `state` prop, to avoid a double
 * buzz.
 */
export function useRecorder(): UseRecorderResult {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [state, setState] = useState<RecorderPhase>('idle');
  const [permissionDenied, setPermissionDenied] = useState(false);

  const start = useCallback(async () => {
    const permission = await AudioModule.requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setPermissionDenied(true);
      return;
    }
    setPermissionDenied(false);

    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setState('recording');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [recorder]);

  const stop = useCallback(async (): Promise<string | null> => {
    setState('processing');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    await recorder.stop();
    const cacheUri = recorder.uri;
    if (!cacheUri) {
      setState('idle');
      return null;
    }

    try {
      const audioDir = getAudioDirectory();
      const source = new File(cacheUri);
      const dest = new File(audioDir, `${Crypto.randomUUID()}.m4a`);
      source.move(dest);
      setState('idle');
      return source.uri;
    } catch {
      // Move failed — fall back to the (less durable) cache uri rather than lose the recording.
      setState('idle');
      return cacheUri;
    }
  }, [recorder]);

  return { state, permissionDenied, start, stop };
}

export default useRecorder;
