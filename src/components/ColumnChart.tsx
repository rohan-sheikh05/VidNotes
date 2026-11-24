import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface ColumnDatum {
  key: string | number;
  label: string; // axis label
  fullLabel?: string; // tooltip / table label
  value: number;
  emphasis?: boolean; // the one bar the story is about (accent); the rest are de-emphasis grey
}

const tok = (name: string) => `rgb(var(--${name}))`;

/**
 * Single-series column chart in the dataviz "emphasis" form (one accent bar, the rest grey).
 * Specs: ≤24px columns, 4px rounded data-end, square at the baseline, hairline solid grid,
 * direct label only on the emphasised column, per-bar tooltip, and a table view.
 */
export default function ColumnChart({
  data,
  unit,
  summary,
  height = 200,
}: {
  data: ColumnDatum[];
  unit: [singular: string, plural: string];
  /** Accessible one-sentence description of what the chart shows. */
  summary: string;
  height?: number;
}) {
  const fmt = (n: number) => `${n} ${n === 1 ? unit[0] : unit[1]}`;
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div>
      <div role="img" aria-label={summary} style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 4, bottom: 0, left: -12 }} barCategoryGap="20%">
            <CartesianGrid vertical={false} stroke={tok('chart-grid')} strokeWidth={1} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: tok('chart-grid') }}
              tick={{ fill: tok('fg-muted'), fontSize: 11 }}
              interval="preserveStartEnd"
              minTickGap={8}
            />
            <YAxis
              allowDecimals={false}
              domain={[0, Math.max(2, Math.ceil(max * 1.15))]}
              tickLine={false}
              axisLine={false}
              tick={{ fill: tok('fg-muted'), fontSize: 11 }}
              width={36}
            />
            <Tooltip
              cursor={{ fill: tok('surface-2') }}
              isAnimationActive={false}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as ColumnDatum;
                return (
                  <div className="rounded-control border border-border bg-surface px-3 py-2 text-sm">
                    <p className="font-semibold text-fg">{fmt(d.value)}</p>
                    <p className="text-xs text-fg-muted">{d.fullLabel ?? d.label}</p>
                  </div>
                );
              }}
            />
            <Bar dataKey="value" maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.key} fill={d.emphasis ? tok('chart-accent') : tok('chart-muted')} />
              ))}
              {/* Direct label on the emphasised column only: never a number on every bar. */}
              <LabelList
                dataKey="value"
                position="top"
                content={(p) => {
                  const i = Number(p.index);
                  if (!data[i]?.emphasis) return null;
                  const x = Number(p.x) + Number(p.width) / 2;
                  return (
                    <text x={x} y={Number(p.y) - 6} textAnchor="middle" fontSize={12} fontWeight={600} fill={tok('fg')}>
                      {data[i].value}
                    </text>
                  );
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-2">
        <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-sm font-medium text-link">Show as table</summary>
        <table className="mt-1 w-full text-sm">
          <tbody>
            {data.map((d) => (
              <tr key={d.key} className="border-t border-border">
                <td className="py-1.5 text-fg-muted">{d.fullLabel ?? d.label}</td>
                <td className={`py-1.5 text-right tabular-nums ${d.emphasis ? 'font-semibold' : ''}`}>{d.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
