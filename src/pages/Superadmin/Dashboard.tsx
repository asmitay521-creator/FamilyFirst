import { useQuery } from '@tanstack/react-query';
import { superAdminService } from '@api/superadmin.service';
import { Building2, Users, Shield, FileText, CheckCircle, XCircle, MessageSquare, Star } from 'lucide-react';
import { useSuperAdminStore } from '@store/superadmin.store';

function StatCard({
  label, value, icon: Icon, color,
}: { label: string; value: number | string; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-wrap items-center gap-4">
      <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );
}

const fmtDate = (v: any) => {
  if (!v) return '';
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${day}/${months[d.getMonth()]}/${d.getFullYear()}`;
  } catch {
    return '';
  }
};

export default function SuperAdminDashboard() {
  const admin = useSuperAdminStore(s => s.admin);

  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ['superadmin', 'platform-stats'],
    queryFn:  () => superAdminService.getPlatformStats(),
    refetchInterval: 60_000,
  });

  const { data: feedbackData } = useQuery({
    queryKey: ['superadmin', 'feedback'],
    queryFn:  () => superAdminService.getAllFeedback({ limit: 20 }),
    staleTime: 60_000,
  });

  const feedbackList: any[] = feedbackData?.data ?? [];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Platform Overview</h1>
        <p className="text-sm text-gray-500 mt-1">
          Welcome back, <span className="font-medium text-gray-700">{admin?.name}</span>
        </p>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 h-20 animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <div className="bg-red-50 text-red-700 rounded-xl p-4 text-sm">
          Failed to load platform stats. Please refresh.
        </div>
      )}

      {stats && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
            <StatCard label="Total Tenants"   value={stats.totalTenants}   icon={Building2}  color="bg-blue-500" />
            <StatCard label="Active Tenants"  value={stats.activeTenants}  icon={CheckCircle} color="bg-green-500" />
            <StatCard label="Inactive Tenants" value={stats.totalTenants - stats.activeTenants} icon={XCircle} color="bg-red-400" />
            <StatCard label="Total Users"     value={stats.totalUsers}     icon={Users}       color="bg-violet-500" />
            <StatCard label="Total Policies"  value={stats.totalPolicies}  icon={Shield}      color="bg-amber-500" />
            <StatCard label="Total Contacts"  value={stats.totalContacts}  icon={FileText}    color="bg-cyan-500" />
          </div>

          {/* Quick summary panel */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Platform Health</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Active tenant ratio</span>
                <span className="font-medium text-gray-900">
                  {stats.totalTenants > 0
                    ? `${Math.round((stats.activeTenants / stats.totalTenants) * 100)}%`
                    : '—'}
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all"
                  style={{ width: `${stats.totalTenants > 0 ? (stats.activeTenants / stats.totalTenants) * 100 : 0}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-gray-600">Avg policies per tenant</span>
                <span className="font-medium text-gray-900">
                  {stats.totalTenants > 0 ? (stats.totalPolicies / stats.totalTenants).toFixed(1) : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Avg contacts per tenant</span>
                <span className="font-medium text-gray-900">
                  {stats.totalTenants > 0 ? (stats.totalContacts / stats.totalTenants).toFixed(1) : '—'}
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Feature Feedback — all tenants */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center gap-2">
          <MessageSquare size={16} className="text-primary-600" />
          <h2 className="text-base font-semibold text-gray-900">Feature Feedback</h2>
          {feedbackData?.meta?.total != null && (
            <span className="ml-auto text-xs text-gray-400">{feedbackData.meta.total} total</span>
          )}
        </div>
        {feedbackList.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-gray-400">No feedback yet.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {feedbackList.map((fb: any) => (
              <div key={fb.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-gray-800">{fb.tenant?.name ?? 'Unknown Agency'}</span>
                      <span className="text-[10px] text-gray-400">@{fb.tenant?.slug}</span>
                      {fb.rating && (
                        <div className="flex flex-wrap items-center gap-0.5 ml-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              size={11}
                              className={i < fb.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{fb.message}</p>
                  </div>
                  <span className="text-[10px] text-gray-400 shrink-0 mt-1">
                    {fmtDate(fb.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
