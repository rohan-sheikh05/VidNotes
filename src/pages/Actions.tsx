import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ListChecks } from 'lucide-react';
import * as repo from '../db/repo';
import ActionItem from '../components/ActionItem';
import EmptyState from '../components/EmptyState';
import type { Video } from '../db/types';

export default function Actions() {
  const [tab, setTab] = useState<'open' | 'done'>('open');
  const open = useLiveQuery(() => repo.listOpenActions(), []);
  const done = useLiveQuery(() => repo.listDoneActions(), []);
  const list = tab === 'open' ? open : done;
  const videos = useLiveQuery(async () => {
    const vids = await repo.getVideos([...new Set((list ?? []).map((a) => a.videoId))]);
    return Object.fromEntries(vids.filter((v): v is Video => !!v).map((v) => [v.id, v]));
  }, [list]);

  return (
    <div className="space-y-4">
      <h1>Actions</h1>
      <div role="tablist" className="flex gap-2">
        {(['open', 'done'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={`min-h-[44px] rounded-full px-4 text-sm font-medium capitalize transition-colors ${
              tab === t ? 'bg-primary text-on-primary' : 'bg-surface-2 text-fg hover:bg-border'
            }`}
            onClick={() => setTab(t)}
          >
            {t} {t === 'open' ? `(${open?.length ?? 0})` : `(${done?.length ?? 0})`}
          </button>
        ))}
      </div>

      {list === undefined ? null : list.length === 0 ? (
        <EmptyState icon={ListChecks} title={tab === 'open' ? 'No open actions' : 'Nothing done yet'}>
          {tab === 'open'
            ? 'Every logged video ends with one concrete action. Applying it is what turns watching into a skill.'
            : 'Tick off an action once you have tried it. Add a line about what happened.'}
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {list.map((a) => (
            <ActionItem key={a.id} action={a} video={videos?.[a.videoId]} />
          ))}
        </ul>
      )}
    </div>
  );
}
