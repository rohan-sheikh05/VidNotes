import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Download, Upload } from 'lucide-react';
import * as repo from '../db/repo';
import { deleteAllData, downloadBackup, exportAll, importBackup, validateBackup, type ImportMode } from '../db/backup';
import type { Settings } from '../db/types';
import { formatDate, now } from '../lib/dates';

function NumberField({
  id,
  label,
  value,
  min,
  max,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        className="input w-32"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Math.round(Number(e.target.value));
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
      />
    </div>
  );
}

export default function SettingsPage() {
  const settings = useLiveQuery(() => repo.getSettings(), []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<ImportMode>('merge');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  if (!settings) return null;
  const update = (patch: Partial<Omit<Settings, 'id'>>) => repo.updateSettings(patch);

  async function onExport() {
    downloadBackup(await exportAll());
    setMsg({ kind: 'ok', text: 'Backup downloaded.' });
  }

  async function onImportFile(file: File) {
    setMsg(null);
    let data: unknown;
    try {
      data = JSON.parse(await file.text());
    } catch {
      setMsg({ kind: 'err', text: 'That file is not valid JSON.' });
      return;
    }
    const v = validateBackup(data);
    if (!v.ok) {
      setMsg({ kind: 'err', text: v.error });
      return;
    }
    if (mode === 'replace' && !confirm('Replace ALL current data with this backup? This cannot be undone.')) return;
    try {
      const counts = await importBackup(v.backup, mode);
      setMsg({
        kind: 'ok',
        text: `Imported (${mode}): ${counts.videos} videos, ${counts.cards} cards, ${counts.actions} actions, ${counts.goals} goals.`,
      });
    } catch (e) {
      setMsg({ kind: 'err', text: `Import failed: ${(e as Error).message}` });
    }
  }

  async function onDeleteAll() {
    const typed = prompt('This deletes every goal, video, card and action on this device. Type DELETE to confirm.');
    if (typed !== 'DELETE') return;
    await deleteAllData();
    setMsg({ kind: 'ok', text: 'All data deleted.' });
  }

  return (
    <div className="space-y-6">
      <h1>Settings</h1>

      <section className="panel space-y-4">
        <h2>Learning</h2>
        <NumberField
          id="maxNew"
          label="Max new videos per day (soft limit)"
          value={settings.maxNewVideosPerDay}
          min={1}
          max={50}
          onChange={(n) => update({ maxNewVideosPerDay: n })}
        />
        <NumberField
          id="reviewLimit"
          label="Daily review limit"
          value={settings.dailyReviewLimit}
          min={1}
          max={1000}
          onChange={(n) => update({ dailyReviewLimit: n })}
        />
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="h-5 w-5 shrink-0 accent-primary"
            checked={settings.pausePrompts}
            onChange={(e) => update({ pausePrompts: e.target.checked })}
          />
          <span>Pause prompts every 10 minutes while watching in the app</span>
        </label>
      </section>

      <section className="panel space-y-3">
        <h2>Appearance</h2>
        <div>
          <label className="label" htmlFor="theme">
            Theme
          </label>
          <select
            id="theme"
            className="input w-48"
            value={settings.theme}
            onChange={(e) => update({ theme: e.target.value as Settings['theme'] })}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
      </section>

      <section className="panel space-y-3">
        <h2>Backup</h2>
        <p className="hint">Your data lives only in this browser on this device. Export regularly.</p>
        <button type="button" className="btn-secondary" onClick={onExport}>
          <Download size={18} aria-hidden /> Export JSON
        </button>
        <div className="space-y-2 border-t border-border pt-3">
          <fieldset className="flex flex-col gap-2 text-sm">
            <legend className="label">Import mode</legend>
            {(['merge', 'replace'] as const).map((m) => (
              <label key={m} className="flex items-center gap-1.5">
                <input type="radio" name="mode" className="h-5 w-5 accent-primary" checked={mode === m} onChange={() => setMode(m)} />
                {m === 'merge' ? 'Merge (keep existing, update matching)' : 'Replace everything'}
              </label>
            ))}
          </fieldset>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImportFile(f);
              e.target.value = '';
            }}
          />
          <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}>
            <Upload size={18} aria-hidden /> Import JSON…
          </button>
        </div>
        {msg && <p className={`text-sm ${msg.kind === 'ok' ? 'font-medium text-on-success-soft' : 'font-medium text-danger'}`}>{msg.text}</p>}
      </section>

      <section className="panel space-y-3">
        <h2>Debug: time travel</h2>
        <p className="hint">
          Shift the app's "today" to test reviews and due dates. Currently: <strong>{formatDate(now())}</strong>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-secondary" onClick={() => update({ timeOffsetDays: settings.timeOffsetDays - 1 })}>
            − 1 day
          </button>
          <span className="w-20 text-center font-mono">
            {settings.timeOffsetDays > 0 ? '+' : ''}
            {settings.timeOffsetDays}d
          </span>
          <button type="button" className="btn-secondary" onClick={() => update({ timeOffsetDays: settings.timeOffsetDays + 1 })}>
            + 1 day
          </button>
          {settings.timeOffsetDays !== 0 && (
            <button type="button" className="btn-ghost" onClick={() => update({ timeOffsetDays: 0 })}>
              Reset
            </button>
          )}
        </div>
      </section>

      <section className="panel space-y-3 border-danger/40">
        <h2 className="text-danger">Danger zone</h2>
        <button type="button" className="btn-danger" onClick={onDeleteAll}>
          Delete all data
        </button>
      </section>
    </div>
  );
}
