import { Target } from 'lucide-react';
import type { Goal } from '../db/types';

export default function GoalBadge({ goal }: { goal?: Goal }) {
  if (!goal) return null;
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-on-primary-soft">
      <Target size={12} aria-hidden className="shrink-0" />
      <span className="truncate">{goal.title}</span>
    </span>
  );
}
