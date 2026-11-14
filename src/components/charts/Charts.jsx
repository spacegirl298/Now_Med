// Small dependency-free charts for the analytics page. SVG/HTML only, so they
// print cleanly to PDF and follow the app's colour tokens.
// Every chart takes plain arrays and shows an empty message when there is
// nothing to plot.

const COLORS = {
  onTime: "var(--color-green)",
  delayed: "#D99A2B",
  cancelled: "#B9535A",
  bar: "var(--color-rose)",
  barSoft: "var(--color-blush)",
  axis: "var(--color-stone)",
  text: "var(--color-slate)",
};

function Empty({ children = "Nothing to show for this month yet." }) {
  return (
    <div className="rounded-xl border border-dashed border-sand bg-mist px-4 py-8 text-center text-sm text-slate">
      {children}
    </div>
  );
}

function niceMax(value) {
  if (value <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / pow) * pow;
}

export function Legend({ items }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate mb-3">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block w-2.5 h-2.5 rounded-sm"
            style={{ background: i.color }}
          />
          {i.label}
        </span>
      ))}
    </div>
  );
}

// Appointments per day / week / month (the caller decides), stacked:
// on time / delayed / cancelled. Each item: { label, title, onTime, delayed, cancelled }.
export function PeriodStackChart({ data, unit = "day" }) {
  const total = data.reduce((s, d) => s + d.onTime + d.delayed + d.cancelled, 0);
  if (!total) return <Empty />;

  const W = 640;
  const H = 220;
  const pad = { l: 28, r: 8, t: 8, b: 22 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const max = niceMax(
    Math.max(...data.map((d) => d.onTime + d.delayed + d.cancelled)),
  );
  const step = innerW / data.length;
  const barW = Math.max(step * 0.66, 3);
  const ticks = [0, max / 2, max];
  const every = Math.max(1, Math.ceil(data.length / 12)); // thin the x labels

  return (
    <>
      <Legend
        items={[
          { label: "On time", color: COLORS.onTime },
          { label: "Delayed", color: COLORS.delayed },
          { label: "Cancelled", color: COLORS.cancelled },
        ]}
      />
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label={`Appointments per ${unit}, split into on time, delayed and cancelled`}
      >
        {ticks.map((t) => {
          const y = pad.t + innerH - (t / max) * innerH;
          return (
            <g key={t}>
              <line
                x1={pad.l}
                x2={W - pad.r}
                y1={y}
                y2={y}
                stroke={COLORS.axis}
                strokeOpacity="0.35"
                strokeDasharray={t === 0 ? "0" : "3 3"}
              />
              <text x={pad.l - 6} y={y + 3} textAnchor="end" fontSize="10" fill={COLORS.text}>
                {Number.isInteger(t) ? t : t.toFixed(1)}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const x = pad.l + i * step + (step - barW) / 2;
          let y = pad.t + innerH;
          const segs = [
            ["onTime", d.onTime, COLORS.onTime],
            ["delayed", d.delayed, COLORS.delayed],
            ["cancelled", d.cancelled, COLORS.cancelled],
          ];
          return (
            <g key={d.label + i}>
              <title>{`${d.title || d.label}: ${d.onTime} on time, ${d.delayed} delayed, ${d.cancelled} cancelled`}</title>
              {segs.map(([key, val, color]) => {
                if (!val) return null;
                const h = (val / max) * innerH;
                y -= h;
                return <rect key={key} x={x} y={y} width={barW} height={h} fill={color} />;
              })}
              {i % every === 0 && (
                <text
                  x={x + barW / 2}
                  y={H - 7}
                  textAnchor="middle"
                  fontSize="10"
                  fill={COLORS.text}
                >
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </>
  );
}

// Horizontal bars with a label, value text and optional sub-text.
export function HBarChart({ items, color = COLORS.bar, empty }) {
  if (!items.length) return <Empty>{empty}</Empty>;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="space-y-3" role="list">
      {items.map((i) => (
        <li key={i.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm mb-1">
            <span className="text-ink min-w-0 break-words">{i.label}</span>
            <span className="text-slate shrink-0 tabular-nums">{i.valueLabel}</span>
          </div>
          <div className="h-2.5 rounded-full bg-sand overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${(i.value / max) * 100}%`, background: color }}
            />
          </div>
          {i.sub && <p className="text-xs text-slate mt-1">{i.sub}</p>}
        </li>
      ))}
    </ul>
  );
}

// Vertical columns, e.g. average delay per weekday.
export function ColumnChart({ items, unit = "", empty }) {
  if (!items.some((i) => i.value > 0)) return <Empty>{empty}</Empty>;
  const W = 420;
  const H = 190;
  const pad = { l: 30, r: 8, t: 14, b: 24 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const max = niceMax(Math.max(...items.map((i) => i.value)));
  const step = innerW / items.length;
  const barW = Math.min(step * 0.6, 34);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto"
      role="img"
      aria-label={`Average delay by weekday in ${unit || "units"}`}
    >
      {[0, max / 2, max].map((t) => {
        const y = pad.t + innerH - (t / max) * innerH;
        return (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke={COLORS.axis} strokeOpacity="0.35" strokeDasharray={t === 0 ? "0" : "3 3"} />
            <text x={pad.l - 6} y={y + 3} textAnchor="end" fontSize="10" fill={COLORS.text}>
              {Math.round(t)}
            </text>
          </g>
        );
      })}
      {items.map((i, idx) => {
        const h = (i.value / max) * innerH;
        const x = pad.l + idx * step + (step - barW) / 2;
        return (
          <g key={i.label}>
            <title>{`${i.label}: ${i.tooltip ?? i.value}`}</title>
            <rect x={x} y={pad.t + innerH - h} width={barW} height={h} rx="3" fill={COLORS.bar} />
            {i.value > 0 && (
              <text x={x + barW / 2} y={pad.t + innerH - h - 4} textAnchor="middle" fontSize="10" fill={COLORS.text}>
                {Math.round(i.value)}
              </text>
            )}
            <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize="10" fill={COLORS.text}>
              {i.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// Line chart for the 6-month trend.
export function LineChart({ points, unit = "", empty }) {
  if (!points.some((p) => p.value > 0)) return <Empty>{empty}</Empty>;
  const W = 420;
  const H = 190;
  const pad = { l: 30, r: 14, t: 16, b: 24 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const max = niceMax(Math.max(...points.map((p) => p.value)));
  const x = (i) => pad.l + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v) => pad.t + innerH - (v / max) * innerH;
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.value)}`).join(" ");
  const every = Math.max(1, Math.ceil(points.length / 8)); // thin the x labels
  const showValues = points.length <= 12;
  const showDots = points.length <= 40;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`Trend over the selected period in ${unit}`}>
      {[0, max / 2, max].map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={COLORS.axis} strokeOpacity="0.35" strokeDasharray={t === 0 ? "0" : "3 3"} />
          <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill={COLORS.text}>
            {Math.round(t)}
          </text>
        </g>
      ))}
      <path d={path} fill="none" stroke={COLORS.bar} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={p.label + i}>
          <title>{`${p.label}: ${p.tooltip ?? p.value}`}</title>
          {showDots && (
            <circle cx={x(i)} cy={y(p.value)} r={points.length > 20 ? 2.5 : 4} fill="#fff" stroke={COLORS.bar} strokeWidth="2" />
          )}
          {showValues && (
            <text x={x(i)} y={y(p.value) - 9} textAnchor="middle" fontSize="10" fill={COLORS.text}>
              {Math.round(p.value)}
            </text>
          )}
          {i % every === 0 && (
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill={COLORS.text}>
              {p.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
