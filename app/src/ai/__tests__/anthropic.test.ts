import { analyze, chat, parseAnalysis } from '@/ai/anthropic';

describe('analyze', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('POSTs to the Anthropic Messages endpoint with the correct headers, model, and transcript', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        content: [
          {
            type: 'text',
            text: '{"title":"Ship the widget","summary":"A plan to ship the widget.","next_steps":["Write tests","Ship it"]}',
          },
        ],
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await analyze('We should build a widget and ship it.', 'sk-ant-test-key');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(options.method).toBe('POST');
    expect(options.headers['x-api-key']).toBe('sk-ant-test-key');
    expect(options.headers['anthropic-version']).toBe('2023-06-01');
    expect(options.headers['content-type']).toBe('application/json');

    const body = JSON.parse(options.body as string);
    expect(body.model).toBe('claude-haiku-4-5');
    expect(body.max_tokens).toBe(600);
    expect(body.messages[0].content).toBe('We should build a widget and ship it.');

    expect(result).toEqual({
      title: 'Ship the widget',
      summary: 'A plan to ship the widget.',
      next_steps: ['Write tests', 'Ship it'],
    });
  });

  it('throws an error including the status code when the response is not ok', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'invalid api key',
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(analyze('transcript', 'bad-key')).rejects.toThrow(/401/);
  });

  it('never throws on a malformed model response — falls back safely', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        content: [{ type: 'text', text: 'not json at all' }],
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await analyze('transcript', 'sk-ant-test-key');

    expect(result).toEqual({ title: 'Untitled idea', summary: '', next_steps: [] });
  });
});

describe('chat', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('POSTs to the Anthropic Messages endpoint with the correct model, max_tokens, and a system prompt embedding the transcript', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        content: [{ type: 'text', text: '  The next steps were to write tests and ship it.  ' }],
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const history = [{ role: 'user' as const, content: 'What were the next steps from this?' }];
    const result = await chat(history, 'We should build a widget and ship it.', 'sk-ant-test-key');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(options.method).toBe('POST');
    expect(options.headers['x-api-key']).toBe('sk-ant-test-key');
    expect(options.headers['anthropic-version']).toBe('2023-06-01');
    expect(options.headers['content-type']).toBe('application/json');

    const body = JSON.parse(options.body as string);
    expect(body.model).toBe('claude-haiku-4-5');
    expect(body.max_tokens).toBeLessThanOrEqual(1000);
    expect(body.system).toEqual(expect.stringContaining('We should build a widget and ship it.'));

    // Result text is trimmed.
    expect(result).toBe('The next steps were to write tests and ship it.');
  });

  it('maps conversation history to messages, preserving roles and order', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ content: [{ type: 'text', text: 'Sure, here you go.' }] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const history = [
      { role: 'user' as const, content: 'What was the idea as a whole?' },
      { role: 'assistant' as const, content: 'The idea was to build a widget.' },
      { role: 'user' as const, content: 'Tell me more.' },
    ];
    await chat(history, 'Transcript text.', 'sk-ant-test-key');

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body as string);
    expect(body.messages).toEqual([
      { role: 'user', content: 'What was the idea as a whole?' },
      { role: 'assistant', content: 'The idea was to build a widget.' },
      { role: 'user', content: 'Tell me more.' },
    ]);
  });

  it('throws a clear Error on a non-2xx response', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'server error',
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      chat([{ role: 'user', content: 'hi' }], 'transcript', 'sk-ant-test-key')
    ).rejects.toThrow(/500/);
  });
});

describe('parseAnalysis', () => {
  it('parses clean JSON', () => {
    const raw = '{"title":"Buy milk","summary":"Remember to buy milk.","next_steps":["Go to store"]}';

    expect(parseAnalysis(raw)).toEqual({
      title: 'Buy milk',
      summary: 'Remember to buy milk.',
      next_steps: ['Go to store'],
    });
  });

  it('parses JSON wrapped in ```json fences', () => {
    const raw = '```json\n{"title":"Buy milk","summary":"Remember to buy milk.","next_steps":["Go to store"]}\n```';

    expect(parseAnalysis(raw)).toEqual({
      title: 'Buy milk',
      summary: 'Remember to buy milk.',
      next_steps: ['Go to store'],
    });
  });

  it('parses JSON wrapped in plain ``` fences', () => {
    const raw = '```\n{"title":"Buy milk","summary":"Remember to buy milk.","next_steps":["Go to store"]}\n```';

    expect(parseAnalysis(raw)).toEqual({
      title: 'Buy milk',
      summary: 'Remember to buy milk.',
      next_steps: ['Go to store'],
    });
  });

  it('returns the safe fallback for garbage input without throwing', () => {
    expect(() => parseAnalysis('this is not json { at all')).not.toThrow();
    expect(parseAnalysis('this is not json { at all')).toEqual({
      title: 'Untitled idea',
      summary: '',
      next_steps: [],
    });
  });

  it('returns the safe fallback for empty input', () => {
    expect(parseAnalysis('')).toEqual({ title: 'Untitled idea', summary: '', next_steps: [] });
  });

  it('falls back safely (without half-populating) when next_steps is missing', () => {
    const raw = '{"title":"Buy milk","summary":"Remember to buy milk."}';

    expect(parseAnalysis(raw)).toEqual({ title: 'Untitled idea', summary: '', next_steps: [] });
  });

  it('falls back safely when next_steps has the wrong type', () => {
    const raw = '{"title":"Buy milk","summary":"Remember to buy milk.","next_steps":"not an array"}';

    expect(parseAnalysis(raw)).toEqual({ title: 'Untitled idea', summary: '', next_steps: [] });
  });

  it('falls back safely when next_steps contains non-string items', () => {
    const raw = '{"title":"Buy milk","summary":"Remember to buy milk.","next_steps":["ok", 5]}';

    expect(parseAnalysis(raw)).toEqual({ title: 'Untitled idea', summary: '', next_steps: [] });
  });

  it('falls back safely when title is missing or wrong type', () => {
    expect(parseAnalysis('{"summary":"x","next_steps":[]}')).toEqual({
      title: 'Untitled idea',
      summary: '',
      next_steps: [],
    });
    expect(parseAnalysis('{"title":5,"summary":"x","next_steps":[]}')).toEqual({
      title: 'Untitled idea',
      summary: '',
      next_steps: [],
    });
  });

  it('falls back safely when summary is missing or wrong type', () => {
    expect(parseAnalysis('{"title":"x","next_steps":[]}')).toEqual({
      title: 'Untitled idea',
      summary: '',
      next_steps: [],
    });
    expect(parseAnalysis('{"title":"x","summary":5,"next_steps":[]}')).toEqual({
      title: 'Untitled idea',
      summary: '',
      next_steps: [],
    });
  });

  it('falls back safely when the top-level value is not an object', () => {
    expect(parseAnalysis('["title","summary"]')).toEqual({
      title: 'Untitled idea',
      summary: '',
      next_steps: [],
    });
    expect(parseAnalysis('null')).toEqual({ title: 'Untitled idea', summary: '', next_steps: [] });
    expect(parseAnalysis('"just a string"')).toEqual({
      title: 'Untitled idea',
      summary: '',
      next_steps: [],
    });
  });
});
