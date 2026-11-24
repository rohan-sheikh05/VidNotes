import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

const ITEMS = [
  { to: '/library', label: 'Library', desc: 'Search every video, note and takeaway' },
  { to: '/stats', label: 'Stats', desc: 'Applied ratio, streak, retention, review load' },
  { to: '/goals', label: 'Goals', desc: 'What you are learning right now' },
  { to: '/settings', label: 'Settings', desc: 'Limits, theme, backup' },
];

export default function More() {
  return (
    <div className="space-y-4">
      <h1>More</h1>
      <ul className="space-y-2">
        {ITEMS.map((i) => (
          <li key={i.to}>
            <Link to={i.to} className="panel flex items-center justify-between min-h-[64px] transition-colors hover:border-primary/50">
              <span>
                <span className="block font-medium">{i.label}</span>
                <span className="hint">{i.desc}</span>
              </span>
              <ChevronRight size={20} aria-hidden className="text-fg-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
