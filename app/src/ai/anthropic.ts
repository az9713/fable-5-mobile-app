/**
 * Thin client for Anthropic's Messages API — produces an auto-title,
 * summary, and next-steps list for a captured voice note (Phase 5).
 *
 * Budget constraint: this app runs on ~$2 of Anthropic API credit, so every
 * call MUST use claude-haiku-4-5 with a tight max_tokens. Do not change the
 * model here without updating the budget note in AGENTS.md / the phase spec.
 */

const URL = 'https://api.anthropic.com/v1/messages';

export type Analysis = {
  title: string;
  summary: string;
  next_steps: string[];
};

const FALLBACK: Analysis = { title: 'Untitled idea', summary: '', next_steps: [] };

/**
 * Sends the transcript to Claude Haiku and returns a structured
 * title/summary/next_steps analysis. Throws on a non-2xx HTTP response
 * (network/auth errors) — callers should catch this and treat analysis as
 * best-effort. Never throws on a malformed *model* response; that case is
 * handled by parseAnalysis's safe fallback.
 */
export async function analyze(transcript: string, apiKey: string): Promise<Analysis> {
  const res = await fetch(URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 600,
      system:
        'Return ONLY minified JSON: {"title": string (<=6 words), "summary": string (2-3 sentences), "next_steps": string[]}. No prose, no markdown fences.',
      messages: [{ role: 'user', content: transcript }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const text = data?.content?.[0]?.text ?? '';
  return parseAnalysis(text);
}

/**
 * Parses the model's raw text output into an Analysis, stripping optional
 * ```json fences. On ANY failure (bad JSON, missing fields, wrong types)
 * returns the safe fallback — never throws, never half-populates from a
 * malformed shape (a corrupted-JSON guard downstream relies on next_steps
 * always being a clean string[]).
 */
export function parseAnalysis(raw: string): Analysis {
  try {
    const stripped = stripFences(raw);
    const parsed: unknown = JSON.parse(stripped);
    if (!isValidAnalysisShape(parsed)) {
      return FALLBACK;
    }
    return {
      title: parsed.title,
      summary: parsed.summary,
      next_steps: parsed.next_steps,
    };
  } catch {
    return FALLBACK;
  }
}

function stripFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function isValidAnalysisShape(
  value: unknown
): value is { title: string; summary: string; next_steps: string[] } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.title === 'string' &&
    typeof v.summary === 'string' &&
    Array.isArray(v.next_steps) &&
    v.next_steps.every((step) => typeof step === 'string')
  );
}
