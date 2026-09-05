import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { clientService } from '@api/client.service';
import { ArrowLeft, Shield, Calendar, IndianRupee, Users } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const STATUS_COLOR: Record<string, string> = {
  ACTIVE:      'bg-green-100 text-green-700',
  EXPIRED:     'bg-gray-100 text-gray-600',
  LAPSED:      'bg-red-100 text-red-700',
  CANCELLED:   'bg-red-100 text-red-700',
  SURRENDERED: 'bg-gray-100 text-gray-600',
};

function fmt(d?: string | null) {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd/MMM/yyyy'); } catch { return d; }
}

function PolicyCard({ p }: { p: any }) {
  return (
    <Link
      to={`/client/policies/${p.id}`}
      className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow block"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Shield size={16} className="text-primary-500 shrink-0" />
            <p className="font-semibold text-gray-900 truncate">{p.policyNumber}</p>
          </div>
          <p className="text-sm text-gray-600">{p.plan?.name ?? '—'}</p>
          <p className="text-xs text-gray-400">{p.plan?.company?.name ?? ''}</p>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${STATUS_COLOR[p.status] ?? 'bg-gray-100 text-gray-600'}`}>
          {p.status}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-gray-400">Sum Assured</p>
          <p className="font-medium text-gray-800">₹{Number(p.sumAssured).toLocaleString('en-IN')}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Premium</p>
          <p className="font-medium text-gray-800">₹{Number(p.premiumAmount).toLocaleString('en-IN')}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Start Date</p>
          <p className="font-medium text-gray-700">{fmt(p.startDate)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">End Date</p>
          <p className="font-medium text-gray-700">{fmt(p.endDate)}</p>
        </div>
      </div>

      {p.nextDueDate && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-1.5 text-xs text-orange-600">
          <Calendar size={12} />
          Next payment: {fmt(p.nextDueDate)}
        </div>
      )}
    </Link>
  );
}

function PolicyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['client-policy', id],
    queryFn:  () => clientService.getPolicyDetail(id!),
    enabled:  !!id,
  });

  if (isLoading) return <div className="flex h-48 items-center justify-center text-gray-400">Loading…</div>;
  const p = data?.data;
  if (!p) return <div className="text-gray-500 p-8">Policy not found.</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-xl font-bold text-gray-900">{p.policyNumber}</h2>
          <p className="text-sm text-gray-500">{p.plan?.name} · {p.plan?.company?.name}</p>
        </div>
      </div>

      {/* Key info */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-800 mb-4 flex flex-wrap items-center gap-2">
          <Shield size={16} className="text-primary-500" /> Policy Details
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          {[
            ['Status',        p.status],
            ['Sum Assured',   `₹${Number(p.sumAssured).toLocaleString('en-IN')}`],
            ['Premium',       `₹${Number(p.premiumAmount).toLocaleString('en-IN')} / ${p.paymentFrequency}`],
            ['Start Date',    fmt(p.startDate)],
            ['End Date',      fmt(p.endDate)],
            ['Next Due Date', fmt(p.nextDueDate)],
            ['Maturity Date', fmt(p.maturityDate)],
            ['Agent Code',    p.agentCode ?? '—'],
          ].map(([label, val]) => (
            <div key={label}>
              <p className="text-xs text-gray-400">{label}</p>
              <p className="font-medium text-gray-800">{val}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Nominees */}
      {p.nominees?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-800 mb-3 flex flex-wrap items-center gap-2">
            <Users size={16} className="text-primary-500" /> Nominees
          </h3>
          <div className="divide-y divide-gray-100">
            {p.nominees.map((n: any) => (
              <div key={n.id} className="py-2.5 flex justify-between text-sm">
                <div>
                  <p className="font-medium text-gray-800">{n.name}</p>
                  <p className="text-xs text-gray-500">{n.relationship}</p>
                </div>
                <p className="text-gray-700">{n.sharePercent}% share</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent payments */}
      {p.payments?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-800 mb-3 flex flex-wrap items-center gap-2">
            <IndianRupee size={16} className="text-primary-500" /> Payment History
          </h3>
          <div className="divide-y divide-gray-100">
            {p.payments.map((pay: any) => (
              <div key={pay.id} className="py-2.5 flex justify-between text-sm">
                <div>
                  <p className="text-gray-700">{fmt(pay.dueDate)}</p>
                  <p className="text-xs text-gray-400">{pay.mode ?? '—'}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-800">₹{Number(pay.amount).toLocaleString('en-IN')}</p>
                  <span className={pay.isPaid ? 'text-xs text-green-600' : 'text-xs text-red-500'}>
                    {pay.isPaid ? 'Paid' : 'Unpaid'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ClientPolicies() {
  const { id } = useParams<{ id?: string }>();

  if (id) return <PolicyDetail />;

  const { data, isLoading } = useQuery({
    queryKey: ['client-policies'],
    queryFn:  clientService.getPolicies,
  });

  const policies = data?.data ?? [];

  if (isLoading) return <div className="flex h-48 items-center justify-center text-gray-400">Loading…</div>;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">My Policies</h2>
        <p className="text-sm text-gray-500 mt-0.5">{policies.length} polic{policies.length === 1 ? 'y' : 'ies'} found</p>
      </div>

      {policies.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-gray-100">
          <Shield size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No policies on record yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {policies.map((p: any) => <PolicyCard key={p.id} p={p} />)}
        </div>
      )}
    </div>
  );
}
