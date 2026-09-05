import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { clientService } from '@api/client.service';
import { useClientStore } from '@store/client.store';
import { Shield, AlertCircle, FileText, Calendar, TrendingUp } from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';

const STATUS_COLOR: Record<string, string> = {
  ACTIVE:      'badge-green',
  EXPIRED:     'badge-gray',
  LAPSED:      'badge-red',
  CANCELLED:   'badge-red',
  SURRENDERED: 'badge-gray',
  INTIMATED:   'badge-yellow',
  FILED:       'badge-blue',
  IN_REVIEW:   'badge-blue',
  APPROVED:    'badge-green',
  SETTLED:     'badge-green',
  REJECTED:    'badge-red',
};

export default function ClientDashboard() {
  const user = useClientStore(s => s.user);

  const { data: policiesData } = useQuery({
    queryKey: ['client-policies'],
    queryFn:  clientService.getPolicies,
  });

  const { data: claimsData } = useQuery({
    queryKey: ['client-claims'],
    queryFn:  clientService.getClaims,
  });

  const { data: profileData } = useQuery({
    queryKey: ['client-me'],
    queryFn:  clientService.getMe,
  });

  const policies = policiesData?.data ?? [];
  const claims   = claimsData?.data   ?? [];
  const profile  = profileData?.data;

  const activePolicies    = policies.filter((p: any) => p.status === 'ACTIVE');
  const pendingClaims     = claims.filter((c: any) => ['INTIMATED', 'FILED', 'IN_REVIEW'].includes(c.status));

  // Upcoming renewals (next 90 days)
  const upcoming = policies
    .filter((p: any) => {
      if (!p.nextDueDate) return false;
      const days = differenceInDays(parseISO(p.nextDueDate), new Date());
      return days >= 0 && days <= 90;
    })
    .sort((a: any, b: any) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime())
    .slice(0, 5);

  const agencyName = profile?.tenant?.name ?? 'Your Agency';

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-2xl p-6 text-white">
        <p className="text-primary-100 text-sm mb-1">Welcome back</p>
        <h2 className="text-2xl font-bold">{user?.firstName} {user?.lastName}</h2>
        <p className="text-primary-200 text-sm mt-1">{agencyName}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Active Policies', value: activePolicies.length, icon: Shield,       color: 'text-green-600',  bg: 'bg-green-50' },
          { label: 'Total Policies',  value: policies.length,       icon: FileText,     color: 'text-blue-600',   bg: 'bg-blue-50' },
          { label: 'Open Claims',     value: pendingClaims.length,  icon: AlertCircle,  color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: 'Total Claims',    value: claims.length,         icon: TrendingUp,   color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center mb-3`}>
              <Icon className={color} size={18} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming renewals */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 flex flex-wrap items-center gap-2">
              <Calendar size={16} className="text-primary-500" />
              Upcoming Renewals
            </h3>
            <Link to="/client/policies" className="text-xs text-primary-600 hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {upcoming.length === 0 && (
              <p className="px-5 py-8 text-sm text-gray-400 text-center">No renewals in the next 90 days</p>
            )}
            {upcoming.map((p: any) => {
              const days = differenceInDays(parseISO(p.nextDueDate), new Date());
              return (
                <Link
                  key={p.id}
                  to={`/client/policies/${p.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">{p.policyNumber}</p>
                    <p className="text-xs text-gray-500">{p.plan?.name ?? '—'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-orange-600">{days === 0 ? 'Due today' : `${days}d left`}</p>
                    <p className="text-xs text-gray-400">{format(parseISO(p.nextDueDate), 'dd/MMM/yyyy')}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Recent claims */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 flex flex-wrap items-center gap-2">
              <AlertCircle size={16} className="text-primary-500" />
              Recent Claims
            </h3>
            <Link to="/client/claims" className="text-xs text-primary-600 hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {claims.length === 0 && (
              <p className="px-5 py-8 text-sm text-gray-400 text-center">No claims on record</p>
            )}
            {claims.slice(0, 5).map((c: any) => (
              <div key={c.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{c.claimNumber}</p>
                  <p className="text-xs text-gray-500">{c.claimType}</p>
                </div>
                <div className="text-right">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[c.status] ?? 'badge-gray'}`}>
                    {c.status}
                  </span>
                  <p className="text-xs text-gray-400 mt-0.5">
                    ₹{Number(c.claimAmount).toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
