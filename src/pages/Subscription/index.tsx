import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subscriptionsService, feedbackService, subscriptionLimitsService } from '@api/index';
import { useAuthStore } from '@store/auth.store';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  CheckCircle, XCircle, ArrowRight, Star, MessageSquare,
  Users, PhoneCall, TrendingUp, Shield, FileText, Calendar,
  DollarSign, Building2, Briefcase, LayoutDashboard, MessageCircle,
  CreditCard, AlertTriangle, AlertOctagon,
} from 'lucide-react';

/* ─── Module feature matrix (spec-exact) ───────────────────────────────────── */
const MODULES = [
  { key: 'workspace',   label: 'Workspace',       Icon: Briefcase,       free: true,  starter: true,  growth: true,  business: true  },
  { key: 'contacts',    label: 'Contacts',         Icon: Users,           free: true,  starter: true,  growth: true,  business: true  },
  { key: 'policies',    label: 'Policies',         Icon: Shield,          free: true,  starter: true,  growth: true,  business: true  },
  { key: 'claims',      label: 'Claims',           Icon: FileText,        free: true,  starter: true,  growth: true,  business: true  },
  { key: 'calendar',    label: 'Calendar',         Icon: Calendar,        free: true,  starter: true,  growth: true,  business: true  },
  { key: 'dashboard',   label: 'Dashboard',        Icon: LayoutDashboard, free: false, starter: true,  growth: true,  business: true  },
  { key: 'leads',       label: 'Leads',            Icon: TrendingUp,      free: false, starter: true,  growth: true,  business: true  },
  { key: 'operations',  label: 'Operations',       Icon: PhoneCall,       free: false, starter: true,  growth: true,  business: true  },
  { key: 'commissions', label: 'Commissions',      Icon: DollarSign,      free: false, starter: false, growth: true,  business: true  },
  { key: 'branding',    label: 'Firm Branding',    Icon: Building2,       free: false, starter: false, growth: true,  business: true  },
  { key: 'employees',   label: 'Employee Module',  Icon: Users,           free: false, starter: false, growth: true,  business: true  },
  { key: 'whatsapp',    label: 'WhatsApp Module',  Icon: MessageCircle,   free: false, starter: false, growth: false, business: true  },
];

/* ─── Plan display labels ──────────────────────────────────────────────────── */
const PLAN_ORDER = ['Free', 'Starter', 'Growth', 'Business'];

const PLAN_USER_LABEL: Record<string, string> = {
  Free:     'Owner only',
  Starter:  'Owner only',
  Growth:   'Owner + 2',
  Business: 'Owner + 4+',
};

const PLAN_COLORS: Record<string, string> = {
  Free:     'border-gray-200',
  Starter:  'border-blue-200',
  Growth:   'border-primary-400',
  Business: 'border-purple-400',
};

const PLAN_BADGE_COLORS: Record<string, string> = {
  Free:     'bg-gray-100 text-gray-700',
  Starter:  'bg-blue-50 text-blue-700',
  Growth:   'bg-primary-50 text-primary-700',
  Business: 'bg-purple-50 text-purple-700',
};

/* ─── Tick / Cross cell ─────────────────────────────────────────────────────── */
function Cell({ enabled }: { enabled: boolean }) {
  return enabled
    ? <CheckCircle size={15} className="mx-auto text-green-500" />
    : <XCircle    size={15} className="mx-auto text-gray-200"  />;
}

/* ─── Usage bar ─────────────────────────────────────────────────────────────── */
function UsageBar({
  label, current, limit, onUpgrade,
}: { label: string; current: number; limit: number; onUpgrade: () => void }) {
  if (limit === -1) {
    return (
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{label}</span>
        <span className="badge badge-green">Unlimited</span>
      </div>
    );
  }
  const pct     = Math.min(100, Math.round((current / limit) * 100));
  const isWarn  = pct >= 80 && pct < 100;
  const isBlock = pct >= 100;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-600 font-medium">{label}</span>
        <span className={isBlock ? 'text-red-600 font-bold' : isWarn ? 'text-yellow-600 font-semibold' : 'text-gray-500'}>
          {current} / {limit}
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isBlock ? 'bg-red-500' : isWarn ? 'bg-yellow-400' : 'bg-primary-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {isWarn && !isBlock && (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-2.5 py-1.5">
          <AlertTriangle size={12} />
          You've used {pct}% of your {label.toLowerCase()} limit. Consider upgrading soon.
          <button onClick={onUpgrade} className="ml-auto underline font-semibold">Upgrade</button>
        </div>
      )}
      {isBlock && (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
          <AlertOctagon size={12} />
          {label} limit reached. You cannot add more until you upgrade.
          <button onClick={onUpgrade} className="ml-auto underline font-semibold">Upgrade Now</button>
        </div>
      )}
    </div>
  );
}

/* ─── Feature Feedback Form ─────────────────────────────────────────────────── */
function FeedbackForm() {
  const [message, setMessage] = useState('');
  const [rating, setRating]   = useState<number>(0);
  const [hovered, setHovered] = useState<number>(0);

  const submit = useMutation({
    mutationFn: () => feedbackService.submit(message, rating || undefined),
    onSuccess:  () => { toast.success('Thank you for your feedback!'); setMessage(''); setRating(0); },
    onError:    (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to send feedback'),
  });

  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 pb-3">
        <div className="w-7 h-7 rounded-lg bg-primary-50 flex items-center justify-center">
          <MessageSquare size={13} className="text-primary-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Feature Feedback / Request</h3>
          <p className="text-[10px] text-gray-400">Help us build what matters to you. Feedback is shared with the Insumitra team.</p>
        </div>
      </div>
      {/* Star rating */}
      <div>
        <p className="text-xs font-medium text-gray-600 mb-2">How would you rate your experience? <span className="text-gray-400">(optional)</span></p>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n === rating ? 0 : n)}
              onMouseEnter={() => setHovered(n)}
              onMouseLeave={() => setHovered(0)}
              className="p-0.5 transition-transform hover:scale-110"
            >
              <Star
                size={20}
                className={`transition-colors ${(hovered || rating) >= n ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`}
              />
            </button>
          ))}
        </div>
      </div>
      {/* Message */}
      <div>
        <label className="label">Your message or feature request *</label>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          className="input"
          rows={3}
          placeholder="e.g. Would love bulk policy import, or a dark mode sidebar…"
        />
      </div>
      <button
        type="button"
        disabled={!message.trim() || submit.isPending}
        onClick={() => submit.mutate()}
        className="btn-primary"
      >
        {submit.isPending ? 'Sending…' : 'Send Feedback'}
      </button>
    </div>
  );
}

/* ─── Main Subscription Page ─────────────────────────────────────────────────── */
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

export default function Subscription() {
  const qc       = useQueryClient();
  const user     = useAuthStore(s => s.user);
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  /* ─ Queries ─ */
  const { data: plansData }   = useQuery({ queryKey: ['plans'],                  queryFn: subscriptionsService.plans,   staleTime: 5 * 60_000 });
  const { data: currentData } = useQuery({ queryKey: ['subscription', 'current'], queryFn: subscriptionsService.current, staleTime: 5 * 60_000 });
  const { data: billingData } = useQuery({ queryKey: ['subscription', 'billing'], queryFn: subscriptionsService.billing, staleTime: 5 * 60_000 });
  const { data: contactLimit } = useQuery({ queryKey: ['limits', 'contacts'],    queryFn: subscriptionLimitsService.contacts,  staleTime: 60_000, enabled: !!user });
  const { data: empLimit }     = useQuery({ queryKey: ['limits', 'employees'],   queryFn: subscriptionLimitsService.employees, staleTime: 60_000, enabled: !!user });

  /* ─ Upgrade mutation ─ */
  const upgrade = useMutation({
    mutationFn: (planId: string) => subscriptionsService.upgrade(planId),
    onSuccess:  (res) => {
      qc.invalidateQueries({ queryKey: ['subscription'] });
      qc.invalidateQueries({ queryKey: ['limits'] });
      toast.success(res?.message ?? 'Plan upgraded!');
    },
    onError:    (e: any) => toast.error(e?.response?.data?.message ?? 'Upgrade failed'),
  });

  /* ─ Derived data ─ */
  const allPlans: any[]  = plansData?.data ?? [];
  // Show only active plans in spec order
  const activePlans      = PLAN_ORDER.map(name => allPlans.find((p: any) => p.name === name)).filter(Boolean);
  const current          = currentData?.data;
  const billing: any[]   = billingData?.data ?? [];
  const contactUsage     = contactLimit?.data;
  const empUsage         = empLimit?.data;
  const currentPlanName  = current?.plan?.name ?? 'Free';

  const handleUpgrade = (planId: string) => {
    if (upgrade.isPending) return;
    upgrade.mutate(planId);
  };

  const handleGoToSubscription = () => navigate('/subscription');

  return (
    <div className="space-y-8 max-w-5xl">

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex flex-wrap items-center gap-2">
            <CreditCard size={18} className="text-primary-600" />
            Subscription & Billing
          </h2>
          {current && (
            <p className="text-sm text-gray-500 mt-0.5">
              Current plan: <span className={`font-semibold px-2 py-0.5 rounded-full text-xs ${PLAN_BADGE_COLORS[currentPlanName] ?? 'bg-gray-100 text-gray-700'}`}>{currentPlanName}</span>
              {' '}· Status: <span className="capitalize">{current.status?.toLowerCase()}</span>
               {current.endDate && <span className="text-gray-400"> · Renews {fmtDate(current.endDate)}</span>}
            </p>
          )}
        </div>
        {/* Billing cycle toggle */}
        <div className="flex flex-wrap items-center gap-1 bg-gray-100 rounded-xl p-1 text-xs font-semibold">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-3 py-1.5 rounded-lg transition-all ${billingCycle === 'monthly' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >Monthly</button>
          <button
            onClick={() => setBillingCycle('yearly')}
            className={`px-3 py-1.5 rounded-lg transition-all ${billingCycle === 'yearly' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >Yearly <span className="text-green-600 ml-1">-17%</span></button>
        </div>
      </div>

      {/* ── Current Usage ──────────────────────────────────────────────────── */}
      {(contactUsage || empUsage) && (
        <div className="card space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Current Usage</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {contactUsage && (
              <UsageBar
                label="Contacts"
                current={contactUsage.current ?? 0}
                limit={contactUsage.limit ?? -1}
                onUpgrade={handleGoToSubscription}
              />
            )}
            {empUsage && (
              <UsageBar
                label="Team Members"
                current={empUsage.current ?? 0}
                limit={empUsage.limit ?? -1}
                onUpgrade={handleGoToSubscription}
              />
            )}
          </div>
        </div>
      )}

      {/* ── Plan cards ─────────────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Subscription Plans</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {activePlans.map((plan: any) => {
            const isCurrent  = current?.planId === plan.id || currentPlanName === plan.name;
            const price      = billingCycle === 'monthly' ? plan.priceMonthly : plan.priceYearly;
            const perLabel   = billingCycle === 'monthly' ? '/mo' : '/yr';
            const colorClass = PLAN_COLORS[plan.name]  ?? 'border-gray-200';
            const badgeClass = PLAN_BADGE_COLORS[plan.name] ?? 'bg-gray-100 text-gray-700';
            const isHigher   = PLAN_ORDER.indexOf(plan.name) > PLAN_ORDER.indexOf(currentPlanName);

            return (
              <div
                key={plan.id}
                className={`card flex flex-col border-2 relative ${colorClass} ${isCurrent ? 'shadow-lg' : ''}`}
              >
                {isCurrent && (
                  <span className={`absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeClass}`}>
                    CURRENT
                  </span>
                )}
                <h3 className="text-sm font-bold text-gray-900">{plan.name}</h3>
                <p className="text-2xl font-extrabold text-gray-900 mt-2">
                  {price === 0 ? 'Free' : `₹${Number(price).toLocaleString('en-IN')}`}
                  {price > 0 && <span className="text-xs font-normal text-gray-400">{perLabel}</span>}
                </p>
                {billingCycle === 'yearly' && plan.priceMonthly > 0 && (
                  <p className="text-[10px] text-gray-400">₹{Number(plan.priceMonthly).toLocaleString('en-IN')}/mo equivalent</p>
                )}
                <ul className="mt-3 space-y-1 flex-1 text-xs text-gray-600">
                  <li>👤 {PLAN_USER_LABEL[plan.name] ?? `${plan.maxUsers} user(s)`}</li>
                  <li>📋 {plan.maxContacts === -1 ? 'Unlimited contacts' : `${plan.maxContacts} contacts`}</li>
                </ul>
                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={isCurrent || upgrade.isPending || !isHigher}
                  className={`mt-4 w-full text-xs py-2 rounded-lg font-semibold flex items-center justify-center gap-1 transition-all
                    ${isCurrent
                      ? 'bg-gray-100 text-gray-400 cursor-default'
                      : isHigher
                        ? 'btn-primary text-white'
                        : 'bg-gray-50 text-gray-300 cursor-not-allowed'
                    }`}
                >
                  {isCurrent ? 'Current Plan' : isHigher ? <>Upgrade <ArrowRight size={12}/></> : 'Downgrade'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Feature comparison matrix ────────────────────────────────────────── */}
      <div className="card overflow-hidden p-0">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Module Access by Plan</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-48">Module</th>
                {PLAN_ORDER.map(p => (
                  <th key={p} className={`px-3 py-3 text-center text-xs font-bold ${PLAN_BADGE_COLORS[p]?.replace('bg-', 'text-').split(' ')[0] ?? 'text-gray-700'}`}>
                    {p}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {MODULES.map(mod => {
                const Icon = mod.Icon;
                return (
                  <tr key={mod.key} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-2.5 text-xs text-gray-700 flex flex-wrap items-center gap-2">
                      <Icon size={13} className="text-gray-400 shrink-0" />
                      {mod.label}
                    </td>
                    <td className="px-3 py-2.5 text-center"><Cell enabled={mod.free}     /></td>
                    <td className="px-3 py-2.5 text-center"><Cell enabled={mod.starter}  /></td>
                    <td className="px-3 py-2.5 text-center"><Cell enabled={mod.growth}   /></td>
                    <td className="px-3 py-2.5 text-center"><Cell enabled={mod.business} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Billing history ─────────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Billing History</h3>
        {billing.length === 0 ? (
          <div className="card text-center py-8">
            <CreditCard size={24} className="mx-auto mb-2 text-gray-200" />
            <p className="text-sm text-gray-400">No billing records yet.</p>
          </div>
        ) : (
          <div className="card overflow-hidden p-0">
            <table className="min-w-full text-sm divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {['Date', 'Plan', 'Amount', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {billing.map((b: any) => (
                  <tr key={b.id} className="hover:bg-gray-50">
                     <td className="px-4 py-3 text-gray-700">{fmtDate(b.createdAt)}</td>
                    <td className="px-4 py-3 text-gray-700">{b.subscription?.plan?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-700 font-medium">₹{Number(b.amount ?? 0).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3">
                      <span className="badge-green text-[10px]">{b.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Feature Feedback form ────────────────────────────────────────────── */}
      <FeedbackForm />

    </div>
  );
}
