import type { Folder, Note, Segment } from '@/db/repo';

/**
 * Full backup export (Settings > Backup). This is the only copy of the
 * user's notes, so buildExport is kept pure and dependency-free (no db, no
 * filesystem, no dates-as-Date-objects) so it's trivial to test: feed in
 * fixture data, assert on the two output strings.
 */

export type ExportJson = {
  exportedAt: number;
  folders: Folder[];
  notes: Array<{
    note: Note;
    folderName: string;
    transcript: string;
    segments: Segment[];
  }>;
};

export type ExportResult = {
  markdown: string;
  json: string;
};

const INBOX_LABEL = 'Inbox';

function folderName(folders: Folder[], folderId: string | null): string {
  if (folderId === null) return INBOX_LABEL;
  return folders.find((f) => f.id === folderId)?.name ?? INBOX_LABEL;
}

function formatDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function noteMarkdown(
  note: Note,
  folder: string,
  segments: Segment[]
): string {
  const lines: string[] = [];
  lines.push(`## ${note.title || 'Untitled'}`);
  lines.push('');
  lines.push(`- Date: ${formatDate(note.created_at)}`);
  lines.push(`- Folder: ${folder}`);
  lines.push('');

  if (note.summary) {
    lines.push('**Summary**');
    lines.push('');
    lines.push(note.summary);
    lines.push('');
  }

  if (note.next_steps.length > 0) {
    lines.push('**Next steps**');
    lines.push('');
    for (const step of note.next_steps) {
      lines.push(`- ${step}`);
    }
    lines.push('');
  }

  lines.push('**Transcript**');
  lines.push('');
  if (segments.length > 0) {
    lines.push(segments.map((s) => s.text).join('\n\n'));
  } else {
    lines.push('_No transcript recorded._');
  }
  lines.push('');

  return lines.join('\n');
}

/**
 * Serializes every folder + note + transcript into a human-readable
 * Markdown document and a structured JSON document. Pure function: no I/O.
 * Callers (Settings screen) gather the data via `@/db/repo` and write these
 * two strings to disk via expo-file-system, then share via expo-sharing.
 */
export function buildExport(
  folders: Folder[],
  notes: Note[],
  segmentsByNote: Record<string, Segment[]>,
  deps: { now?: () => number } = {}
): ExportResult {
  const now = deps.now ? deps.now() : Date.now();

  const sortedNotes = [...notes].sort((a, b) => b.updated_at - a.updated_at);

  const markdownSections = sortedNotes.map((note) =>
    noteMarkdown(note, folderName(folders, note.folder_id), segmentsByNote[note.id] ?? [])
  );

  const markdown = [
    '# Ideas export',
    '',
    `Exported ${formatDate(now)} — ${sortedNotes.length} note${sortedNotes.length === 1 ? '' : 's'}.`,
    '',
    markdownSections.join('\n---\n\n'),
  ].join('\n');

  const exportJson: ExportJson = {
    exportedAt: now,
    folders,
    notes: sortedNotes.map((note) => ({
      note,
      folderName: folderName(folders, note.folder_id),
      transcript: (segmentsByNote[note.id] ?? []).map((s) => s.text).join('\n\n'),
      segments: segmentsByNote[note.id] ?? [],
    })),
  };

  const json = JSON.stringify(exportJson, null, 2);

  return { markdown, json };
}
