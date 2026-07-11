import { buildExport, type ExportJson } from '@/export/exportNotes';
import type { Folder, Note, Segment } from '@/db/repo';

const folders: Folder[] = [{ id: 'f1', name: 'Work', created_at: 1000 }];

const inboxNote: Note = {
  id: 'n1',
  folder_id: null,
  title: 'Grocery app idea',
  summary: 'An app for grocery lists.',
  next_steps: ['Sketch wireframes', 'Talk to a grocer'],
  audio_uri: 'file:///a.m4a',
  created_at: 2000,
  updated_at: 2000,
};

const workNote: Note = {
  id: 'n2',
  folder_id: 'f1',
  title: 'Quarterly planning',
  summary: null,
  next_steps: [],
  audio_uri: null,
  created_at: 3000,
  updated_at: 3000,
};

const segmentsByNote: Record<string, Segment[]> = {
  n1: [
    { id: 's1', note_id: 'n1', text: 'First thought about groceries.', audio_uri: null, created_at: 2000 },
    { id: 's2', note_id: 'n1', text: 'Second thought, added later.', audio_uri: null, created_at: 2100 },
  ],
  n2: [
    { id: 's3', note_id: 'n2', text: 'Planning notes for Q3.', audio_uri: null, created_at: 3000 },
  ],
};

describe('buildExport', () => {
  it('produces a Markdown section per note containing its full transcript', () => {
    const { markdown } = buildExport(folders, [inboxNote, workNote], segmentsByNote, {
      now: () => 5000,
    });

    // Both note titles present as sections.
    expect(markdown).toContain('## Grocery app idea');
    expect(markdown).toContain('## Quarterly planning');

    // Folder attribution.
    expect(markdown).toContain('Folder: Inbox');
    expect(markdown).toContain('Folder: Work');

    // Full transcript (every segment, not just the first) is present.
    expect(markdown).toContain('First thought about groceries.');
    expect(markdown).toContain('Second thought, added later.');
    expect(markdown).toContain('Planning notes for Q3.');

    // Summary + next steps included when present.
    expect(markdown).toContain('An app for grocery lists.');
    expect(markdown).toContain('- Sketch wireframes');
    expect(markdown).toContain('- Talk to a grocer');
  });

  it('handles a note with no segments and no summary gracefully', () => {
    const bareNote: Note = {
      id: 'n3',
      folder_id: null,
      title: '',
      summary: null,
      next_steps: [],
      audio_uri: null,
      created_at: 4000,
      updated_at: 4000,
    };

    const { markdown } = buildExport(folders, [bareNote], {}, { now: () => 5000 });

    expect(markdown).toContain('## Untitled');
    expect(markdown).toContain('_No transcript recorded._');
  });

  it('produces JSON that round-trips: parsing it back yields the same structured data', () => {
    const { json } = buildExport(folders, [inboxNote, workNote], segmentsByNote, {
      now: () => 5000,
    });

    const parsed = JSON.parse(json) as ExportJson;

    expect(parsed.exportedAt).toBe(5000);
    expect(parsed.folders).toEqual(folders);
    expect(parsed.notes).toHaveLength(2);

    const grocery = parsed.notes.find((n) => n.note.id === 'n1');
    expect(grocery).toBeDefined();
    expect(grocery?.note).toEqual(inboxNote);
    expect(grocery?.folderName).toBe('Inbox');
    expect(grocery?.transcript).toBe(
      'First thought about groceries.\n\nSecond thought, added later.'
    );
    expect(grocery?.segments).toEqual(segmentsByNote.n1);

    const planning = parsed.notes.find((n) => n.note.id === 'n2');
    expect(planning?.folderName).toBe('Work');
    expect(planning?.note).toEqual(workNote);
  });

  it('sorts notes by most-recently-updated first', () => {
    const { json } = buildExport(folders, [inboxNote, workNote], segmentsByNote, {
      now: () => 5000,
    });
    const parsed = JSON.parse(json) as ExportJson;
    expect(parsed.notes.map((n) => n.note.id)).toEqual(['n2', 'n1']);
  });

  it('returns an empty-but-valid export when there are no notes', () => {
    const { markdown, json } = buildExport([], [], {}, { now: () => 5000 });

    expect(markdown).toContain('0 notes');
    const parsed = JSON.parse(json) as ExportJson;
    expect(parsed.notes).toEqual([]);
    expect(parsed.folders).toEqual([]);
  });
});
