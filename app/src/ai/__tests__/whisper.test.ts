import { formatParagraphs, transcribe } from '@/ai/whisper';

// jsdom's built-in FormData stringifies plain objects passed to append()
// (React Native's real FormData instead keeps a `{ uri, name, type }` part
// intact). Stub FormData so we can assert exactly what gets appended,
// matching the on-device behavior.
class FakeFormData {
  parts: [string, unknown][] = [];
  append(key: string, value: unknown) {
    this.parts.push([key, value]);
  }
}

describe('transcribe', () => {
  const originalFetch = global.fetch;
  const originalFormData = global.FormData;

  beforeEach(() => {
    global.FormData = FakeFormData as unknown as typeof FormData;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    global.FormData = originalFormData;
  });

  it('POSTs the audio file + model to the Whisper endpoint with a bearer token', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '  hello world  ',
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await transcribe('file:///tmp/note.m4a', 'sk-test-key');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/audio/transcriptions');
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('Bearer sk-test-key');

    const body = options.body as FakeFormData;
    const parts = Object.fromEntries(body.parts);
    expect(parts.file).toMatchObject({ uri: 'file:///tmp/note.m4a', type: 'audio/m4a' });
    expect(parts.model).toBe('whisper-1');
    expect(parts.response_format).toBe('text');

    expect(result).toBe('hello world');
  });

  it('throws an error including the status code when the response is not ok', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'invalid api key',
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(transcribe('file:///tmp/note.m4a', 'bad-key')).rejects.toThrow(/401/);
  });
});

describe('formatParagraphs', () => {
  it('leaves short text unchanged', () => {
    const short = 'This is one short idea. Nothing more to say.';
    expect(formatParagraphs(short)).toBe(short);
  });

  it('leaves empty text unchanged', () => {
    expect(formatParagraphs('')).toBe('');
  });

  it('breaks a long wall of text into multiple paragraphs', () => {
    const sentences = Array.from(
      { length: 12 },
      (_, i) => `This is sentence number ${i + 1} in a long idea.`
    );
    const wall = sentences.join(' ');

    const formatted = formatParagraphs(wall);

    expect(formatted).toContain('\n\n');
    const paragraphs = formatted.split('\n\n');
    expect(paragraphs.length).toBeGreaterThan(1);
    // No sentence content was lost in the reflow.
    for (const sentence of sentences) {
      expect(formatted).toContain(sentence);
    }
  });
});
