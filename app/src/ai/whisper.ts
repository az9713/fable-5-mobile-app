/**
 * Thin client for OpenAI's Whisper transcription endpoint, plus a helper to
 * reflow the raw transcript into readable paragraphs (PRD 4.2 — a note
 * should never render as one giant wall of text).
 */

/** Uploads a recorded audio file and returns the raw transcript text. */
export async function transcribe(audioUri: string, apiKey: string): Promise<string> {
  const form = new FormData();
  form.append('file', { uri: audioUri, name: 'note.m4a', type: 'audio/m4a' } as any);
  form.append('model', 'whisper-1');
  form.append('response_format', 'text');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    throw new Error(`Whisper ${res.status}: ${await res.text()}`);
  }

  return (await res.text()).trim();
}

/** Sentences per paragraph when reflowing a long transcript. */
const SENTENCES_PER_PARAGRAPH = 3;
/** Below this many sentences, text is already readable as a single block. */
const MIN_SENTENCES_TO_SPLIT = 4;

/**
 * Breaks a long unbroken transcript into paragraphs, grouping a few
 * sentences at a time. Short text (already a couple of sentences or less)
 * is returned unchanged.
 */
export function formatParagraphs(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;

  // Split into sentences, keeping the terminating punctuation attached.
  const sentences = (trimmed.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [trimmed]).map((s) => s.trim());

  if (sentences.length < MIN_SENTENCES_TO_SPLIT) {
    return trimmed;
  }

  const paragraphs: string[] = [];
  for (let i = 0; i < sentences.length; i += SENTENCES_PER_PARAGRAPH) {
    paragraphs.push(sentences.slice(i, i + SENTENCES_PER_PARAGRAPH).join(' '));
  }
  return paragraphs.join('\n\n');
}
