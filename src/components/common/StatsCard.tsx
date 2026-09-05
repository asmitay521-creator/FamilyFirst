import clsx from 'clsx';

interface Props {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
  trend?: number;
  color?: 'blue' | 'green' | 'orange' | 'purple' | 'red';
  onClick?: () => void;
}

const colorMap = {
  blue:   { icon: 'bg-blue-50   text-blue-600',   border: 'hover:border-blue-200'   },
  green:  { icon: 'bg-green-50  text-green-600',  border: 'hover:border-green-200'  },
  orange: { icon: 'bg-orange-50 text-orange-600', border: 'hover:border-orange-200' },
  purple: { icon: 'bg-purple-50 text-purple-600', border: 'hover:border-purple-200' },
  red:    { icon: 'bg-red-50    text-red-600',    border: 'hover:border-red-200'    },
};

export default function StatsCard({ label, value, sub, icon, trend, color = 'blue', onClick }: Props) {
  const c = colorMap[color];
  return (
    <div
      onClick={onClick}
      className={clsx(
        'card flex items-start gap-4 transition-all duration-150',
        onClick && 'cursor-pointer hover:shadow-md',
        c.border,
      )}
    >
      {icon && (
        <div className={clsx('h-10 w-10 shrink-0 rounded-xl flex items-center justify-center', c.icon)}>
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 truncate">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5 tabular-nums">{value}</p>
        {(sub !== undefined || trend !== undefined) && (
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            {trend !== undefined && (
              <span className={clsx(
                'inline-flex items-center text-xs font-semibold px-1.5 py-0.5 rounded-md',
                trend >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700',
              )}>
                {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
              </span>
            )}
            {sub && <span className="text-xs text-gray-400">{sub}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
