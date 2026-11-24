import { db, TABLE_NAMES, type TableName } from './db';
import { now } from '../lib/dates';
import { format } from 'date-fns';

export const BACKUP_SCHEMA_VERSION = 1;

export interface Backup {
  app: 'vidnotes';
  schemaVersion: number;
  exportedAt: number;
  tables: Record<TableName, Record<string, unknown>[]>;
}

export type ImportMode = 'merge' | 'replace';

export async function exportAll(): Promise<Backup> {
  const tables = {} as Backup['tables'];
  await db.transaction('r', db.tables, async () => {
    for (const name of TABLE_NAMES) {
      tables[name] = (await db.table(name).toArray()) as Record<string, unknown>[];
    }
  });
  return { app: 'vidnotes', schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: Date.now(), tables };
}

export function downloadBackup(backup: Backup): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vidnotes-backup-${format(now(), 'yyyy-MM-dd')}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type FieldType = 'string' | 'number' | 'boolean';
const REQUIRED: Record<TableName, Record<string, FieldType>> = {
  goals: { title: 'string', status: 'string', createdAt: 'number' },
  videos: { youtubeId: 'string', title: 'string', status: 'string', purpose: 'string', createdAt: 'number' },
  notes: { videoId: 'string', t: 'number', text: 'string' },
  cards: {
    cue: 'string',
    answer: 'string',
    due: 'number',
    intervalDays: 'number',
    ease: 'number',
    reps: 'number',
    lapses: 'number',
  },
  reviews: { cardId: 'string', rating: 'string', reviewedAt: 'number' },
  actions: { videoId: 'string', text: 'string', dueDate: 'number' },
  settings: {},
};

export type ValidationResult = { ok: true; backup: Backup } | { ok: false; error: string };

/** Structural validation of an imported file. Missing tables are treated as empty. */
export function validateBackup(data: unknown): ValidationResult {
  if (!data || typeof data !== 'object') return { ok: false, error: 'File is not a JSON object.' };
  const d = data as Record<string, unknown>;
  if (d.app !== 'vidnotes') return { ok: false, error: 'This is not a VidNotes backup file.' };
  if (typeof d.schemaVersion !== 'number' || d.schemaVersion > BACKUP_SCHEMA_VERSION) {
    return { ok: false, error: 'Backup is from a newer or unknown version of VidNotes.' };
  }
  if (!d.tables || typeof d.tables !== 'object') return { ok: false, error: 'Backup has no tables.' };
  const src = d.tables as Record<string, unknown>;
  const tables = {} as Backup['tables'];

  for (const name of TABLE_NAMES) {
    const rows = src[name] ?? [];
    if (!Array.isArray(rows)) return { ok: false, error: `Table "${name}" is not a list.` };
    for (const [i, row] of rows.entries()) {
      if (!row || typeof row !== 'object') return { ok: false, error: `${name}[${i}] is not an object.` };
      const r = row as Record<string, unknown>;
      if (typeof r.id !== 'string' || !r.id) return { ok: false, error: `${name}[${i}] has no id.` };
      for (const [field, type] of Object.entries(REQUIRED[name])) {
        if (typeof r[field] !== type) return { ok: false, error: `${name}[${i}].${field} should be a ${type}.` };
      }
    }
    tables[name] = rows as Record<string, unknown>[];
  }
  if (tables.settings.some((s) => s.id !== 'settings')) return { ok: false, error: 'Unexpected settings row.' };

  return {
    ok: true,
    backup: { app: 'vidnotes', schemaVersion: d.schemaVersion, exportedAt: Number(d.exportedAt) || 0, tables },
  };
}

/**
 * replace: wipe everything, then load the backup.
 * merge: upsert rows by id (backup wins on conflicts), keep everything else.
 * Afterwards, enforce the single-active-goal rule (the newest active goal wins).
 */
export async function importBackup(backup: Backup, mode: ImportMode): Promise<Record<TableName, number>> {
  const counts = {} as Record<TableName, number>;
  await db.transaction('rw', db.tables, async () => {
    if (mode === 'replace') for (const t of db.tables) await t.clear();
    for (const name of TABLE_NAMES) {
      const rows = backup.tables[name];
      if (rows.length) await db.table(name).bulkPut(rows);
      counts[name] = rows.length;
    }
    const active = await db.goals.where('status').equals('active').sortBy('createdAt');
    for (const g of active.slice(0, -1)) await db.goals.update(g.id, { status: 'archived' });
  });
  return counts;
}

export async function deleteAllData(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) await t.clear();
  });
}
