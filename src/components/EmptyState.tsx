import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export default function EmptyState({
  title,
  icon: Icon,
  children,
  action,
}: {
  title: string;
  icon?: LucideIcon;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-card border border-dashed border-border-strong/60 px-6 py-8 text-center">
      {Icon && (
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-on-primary-soft">
          <Icon size={22} aria-hidden />
        </span>
      )}
      <p className="font-semibold">{title}</p>
      {children && <div className="hint mt-1 max-w-sm">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
