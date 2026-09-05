import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

interface DataPoint { [key: string]: any }

// ── Line Chart ────────────────────────────────────────────────────────────────
export function LineChartWidget({
  data, xKey, lines, title,
}: { data: DataPoint[]; xKey: string; lines: { key: string; label: string; color?: string }[]; title?: string }) {
  return (
    <div className="card">
      {title && <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend iconType="circle" iconSize={8} />
          {lines.map((l, i) => (
            <Line
              key={l.key} type="monotone" dataKey={l.key} name={l.label}
              stroke={l.color ?? COLORS[i]} strokeWidth={2} dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Bar Chart ─────────────────────────────────────────────────────────────────
export function BarChartWidget({
  data, xKey, bars, title, className = "", height = 240
}: { data: DataPoint[]; xKey: string; bars: { key: string; label: string; color?: string; stackId?: string }[]; title?: string; className?: string; height?: number | string }) {
  return (
    <div className={`card ${className}`}>
      {title && <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend iconType="circle" iconSize={8} />
          {bars.map((b, i) => (
            <Bar 
              key={b.key} 
              dataKey={b.key} 
              name={b.label} 
              fill={b.color ?? COLORS[i % COLORS.length]} 
              stackId={b.stackId}
              radius={b.stackId ? [0, 0, 0, 0] : [4, 4, 0, 0]} 
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Pie / Donut Chart ─────────────────────────────────────────────────────────
export function PieChartWidget({
  data, nameKey, valueKey, title,
}: { data: DataPoint[]; nameKey: string; valueKey: string; title?: string }) {
  return (
    <div className="card">
      {title && <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data} dataKey={valueKey} nameKey={nameKey}
            cx="50%" cy="50%" innerRadius={60} outerRadius={90}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend iconType="circle" iconSize={8} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Coverage Ratio Bar Chart (Overlay) ────────────────────────────────────────

export function CoverageBarChartWidget({
  data, xKey, valueKey, totalKey, title,
  valueLabel = 'Persons Covered', totalLabel = 'Total Contacts', color
}: { 
  data: DataPoint[]; xKey: string; valueKey: string; totalKey: string; title?: string;
  valueLabel?: string; totalLabel?: string; color?: string;
}) {

  const renderCoverageLabel = (props: any) => {
    const { x, y, width, value, index } = props;
    const total = data[index]?.[totalKey] || 0;
    return (
      <text x={x + width / 2} y={y - 10} fill="#475569" textAnchor="middle" dominantBaseline="middle" className="text-[11px] font-bold">
        {`${value} / ${total}`}
      </text>
    );
  };

  return (
    <div className="card w-full">
      {title && <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 25, right: 20, bottom: 5, left: 0 }} barGap="-100%">
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip 
            cursor={{ fill: 'transparent' }}
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const p = payload[0].payload;
                return (
                  <div className="bg-white p-3 border border-slate-100 shadow-xl rounded-xl">
                    <p className="font-bold text-xs text-slate-800 mb-1">{p[xKey]}</p>
                    <p className="text-[11px] text-slate-600">{valueLabel}: <span className="font-bold text-blue-600" style={color ? { color } : {}}>{p[valueKey]}</span></p>
                    <p className="text-[11px] text-slate-600">{totalLabel}: <span className="font-bold text-slate-900">{p[totalKey]}</span></p>
                  </div>
                );
              }
              return null;
            }} 
          />
          <Legend iconType="circle" iconSize={8} />
          
          {/* Background Bar (Total) */}
          <Bar dataKey={totalKey} name={totalLabel} fill="#f1f5f9" radius={[4, 4, 0, 0]} barSize={40} />
          
          {/* Foreground Bar (Covered) Overlay */}
          <Bar dataKey={valueKey} name={valueLabel} radius={[4, 4, 0, 0]} barSize={40} label={renderCoverageLabel}>
            {data.map((_, i) => (
              <Cell key={i} fill={color ?? COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
