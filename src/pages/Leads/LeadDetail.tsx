import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsService, policiesService } from '@api/index';
import { ArrowLeft, Edit2, ChevronRight } from 'lucide-react';
import Modal from '@comps/common/Modal';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { DatePicker } from '@comps/common/DatePicker';
import { cleanLeadPayload } from './index';

const STAGES = ['TO_CONTACT', 'CONTACTED', 'PROPOSAL_SENT', 'LOGIN_PROGRESS', 'PAYMENT_DONE', 'PROCESS_COMPLETED'];

const STAGE_LABELS: Record<string, string> = {
  TO_CONTACT: 'To Contact', CONTACTED: 'Contacted', PROPOSAL_SENT: 'Proposal Sent',
  LOGIN_PROGRESS: 'Login Progress', PAYMENT_DONE: 'Payment Done', PROCESS_COMPLETED: 'Process Completed',
};

const STAGE_COLORS: Record<string, string> = {
  TO_CONTACT: 'bg-blue-100 text-blue-700', CONTACTED: 'bg-indigo-100 text-indigo-700',
  PROPOSAL_SENT: 'bg-purple-100 text-purple-700', LOGIN_PROGRESS: 'bg-orange-100 text-orange-700',
  PAYMENT_DONE: 'bg-green-100 text-green-700', PROCESS_COMPLETED: 'bg-emerald-100 text-emerald-700',
};

const editSchema = z.object({
  notes: z.string().optional(),
  sumAssuredRequired: z.coerce.number().positive().optional().or(z.literal('')),
  premiumBudget: z.coerce.number().positive().optional().or(z.literal('')),
  followUpDate: z.string().optional(),
  lostReason: z.string().optional(),
});
type EditForm = z.infer<typeof editSchema>;

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [editModal, setEditModal] = useState(false);

  const { data: lead, isLoading } = useQuery({
    queryKey: ['lead', id],
    queryFn: () => leadsService.get(id!),
    enabled: !!id,
  });

  const { register, handleSubmit, reset, setValue } = useForm<EditForm>({
    resolver: zodResolver(editSchema),
  });

  const updateLead = useMutation({
    mutationFn: (body: any) => leadsService.update(id!, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead', id] });
      setEditModal(false);
      toast.success('Lead updated');
    },
    onError: (e: any, variables: any) => {
      const errs = e.response?.data?.errors;
      const msg = Array.isArray(errs) && errs.length > 0
        ? errs.join(', ')
        : (e.response?.data?.message ?? 'Failed to update lead');

      if (process.env.NODE_ENV !== 'production') {
        console.error('[Lead Detail Update Failed]', {
          payload: variables,
          status: e.response?.status,
          response: e.response?.data,
        });
      }
      toast.error(msg);
    },
  });

  const moveStage = useMutation({
    mutationFn: (stage: string) => leadsService.moveStage(id!, stage),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead', id] });
      toast.success('Stage updated');
    },
    onError: () => toast.error('Failed to move stage'),
  });

  // Policy Modal States for PAYMENT_DONE -> PROCESS_COMPLETED transition
  const [policyModalOpen, setPolicyModalOpen] = useState(false);
  const [policySelectedType, setPolicySelectedType] = useState('');
  const [policySelectedCompany, setPolicySelectedCompany] = useState('');
  const [policySelectedPlanId, setPolicySelectedPlanId] = useState('');

  const { register: registerPolicy, handleSubmit: handleSubmitPolicy, reset: resetPolicy, setValue: setPolicyValue, watch: watchPolicy } = useForm<any>({
    defaultValues: {
      policyNumber: '',
      sumAssured: '',
      premiumAmount: '',
      startDate: '',
      endDate: '',
      paymentFrequency: 'YEARLY',
    }
  });

  const { data: allPlansRes } = useQuery({
    queryKey: ['all-plans-list-picker'],
    queryFn: () => policiesService.plans(),
  });
  const plansList = allPlansRes?.data ?? [];

  const availableTypes = useMemo(() => {
    return Array.from(new Set(plansList.map((p: any) => p.category))).filter(Boolean) as string[];
  }, [plansList]);

  const availableCompanies = useMemo(() => {
    if (!policySelectedType) return [];
    return Array.from(
      new Set(
        plansList
          .filter((p: any) => p.category === policySelectedType)
          .map((p: any) => p.company?.name)
          .filter(Boolean)
      )
    ) as string[];
  }, [plansList, policySelectedType]);

  const availablePlans = useMemo(() => {
    if (!policySelectedType || !policySelectedCompany) return [];
    return plansList.filter(
      (p: any) => p.category === policySelectedType && p.company?.name === policySelectedCompany
    );
  }, [plansList, policySelectedType, policySelectedCompany]);

  const watchPolicyStartDate = watchPolicy('startDate');
  useEffect(() => {
    if (watchPolicyStartDate) {
      const start = new Date(watchPolicyStartDate);
      if (!isNaN(start.getTime())) {
        const end = new Date(start);
        end.setFullYear(start.getFullYear() + 1); // default 1 year duration
        setPolicyValue('endDate', end.toISOString().split('T')[0]);
      }
    }
  }, [watchPolicyStartDate, setPolicyValue]);

  const triggerPolicyCreationForLead = (leadObj: any) => {
    const plan = leadObj.plan || {};
    
    if (plan.id) {
      setPolicySelectedType(plan.category || '');
      setPolicySelectedCompany(plan.company?.name || '');
      setPolicySelectedPlanId(plan.id);
    } else {
      setPolicySelectedType('');
      setPolicySelectedCompany('');
      setPolicySelectedPlanId('');
    }
    
    resetPolicy({
      policyNumber: '',
      sumAssured: leadObj.sumAssuredRequired ? String(leadObj.sumAssuredRequired) : '',
      premiumAmount: leadObj.premiumBudget ? String(leadObj.premiumBudget) : '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
      paymentFrequency: 'YEARLY',
    });
    
    setPolicyModalOpen(true);
  };

  const handlePolicyFormSubmit = async (data: any) => {
    const l = lead?.data ?? lead;
    if (!l) return;
    if (!policySelectedPlanId) {
      toast.error('Please select an insurance plan');
      return;
    }
    
    const toastId = toast.loading('Creating policy and updating lead status...');
    try {
      await policiesService.create({
        policyNumber: data.policyNumber,
        contactId: l.contactId,
        planId: policySelectedPlanId,
        sumAssured: Number(data.sumAssured),
        premiumAmount: Number(data.premiumAmount),
        paymentFrequency: data.paymentFrequency,
        startDate: new Date(data.startDate).toISOString(),
        endDate: new Date(data.endDate).toISOString(),
      });
      
      await moveStage.mutateAsync('PROCESS_COMPLETED');
      
      toast.success('Policy created and lead moved to Process Completed!', { id: toastId });
      setPolicyModalOpen(false);
      
      qc.invalidateQueries({ queryKey: ['lead', id] });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to complete process', { id: toastId });
    }
  };

  const openEdit = () => {
    const l = lead?.data ?? lead;
    setValue('notes', l?.notes ?? '');
    setValue('sumAssuredRequired', l?.sumAssuredRequired ?? '');
    setValue('premiumBudget', l?.premiumBudget ?? '');
    setValue('followUpDate', l?.followUpDate ? l.followUpDate.slice(0, 10) : '');
    setValue('lostReason', l?.lostReason ?? '');
    setEditModal(true);
  };

  if (isLoading) return <div className="flex h-48 items-center justify-center text-gray-400">Loading…</div>;

  const l = lead?.data ?? lead;
  if (!l) return <div className="text-gray-500 p-8">Lead not found.</div>;



  const currentIdx = STAGES.indexOf(l.stage);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold text-gray-900">
              {l.contact?.firstName} {l.contact?.lastName}
            </h2>
            <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', STAGE_COLORS[l.stage] ?? 'bg-gray-100 text-gray-700')}>
              {STAGE_LABELS[l.stage] ?? l.stage}
            </span>
          </div>
          {l.plan && <p className="text-sm text-gray-500 mt-0.5">{l.plan.name} · {l.plan.company?.name}</p>}
        </div>
        <button onClick={openEdit} className="btn-secondary flex flex-wrap items-center gap-1"><Edit2 size={14}/>Edit</button>
      </div>

      {/* Stage Pipeline */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Stage Pipeline</h3>
        <div className="flex flex-wrap items-center gap-1 flex-wrap">
          {STAGES.map((s, idx) => (
            <div key={s} className="flex items-center">
              <button
                onClick={() => {
                  if (s !== l.stage) {
                    if (s === 'PROCESS_COMPLETED') {
                      triggerPolicyCreationForLead(l);
                    } else {
                      moveStage.mutate(s);
                    }
                  }
                }}
                disabled={moveStage.isPending || s === l.stage}
                className={clsx(
                  'text-xs px-3 py-1.5 rounded-full font-medium transition-all',
                  s === l.stage
                    ? clsx(STAGE_COLORS[s], 'ring-2 ring-offset-1 ring-current cursor-default')
                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-700 cursor-pointer',
                )}>
                {STAGE_LABELS[s]}
              </button>
              {idx < STAGES.length - 1 && <ChevronRight size={12} className="text-gray-300 mx-0.5 shrink-0" />}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-3">Click any stage to move this lead there.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lead Details */}
        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Lead Details</h3>
          {l.sumAssuredRequired && (
            <InfoRow label="Sum Assured Required" value={`₹${Number(l.sumAssuredRequired).toLocaleString('en-IN')}`} />
          )}
          {l.premiumBudget && (
            <InfoRow label="Premium Budget" value={`₹${Number(l.premiumBudget).toLocaleString('en-IN')}`} />
          )}
          {l.followUpDate && (
            <InfoRow label="Follow-up Date" value={format(new Date(l.followUpDate), 'dd/MMM/yyyy')} />
          )}
          {l.lostReason && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg p-2">
              <span className="font-medium">Lost reason: </span>{l.lostReason}
            </div>
          )}
          {l.notes && (
            <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-2">{l.notes}</div>
          )}
          <InfoRow label="Created" value={l.createdAt ? format(new Date(l.createdAt), 'dd/MMM/yyyy') : '—'} />
        </div>

        {/* Contact & Plan */}
        <div className="space-y-4">
          {l.contact && (
            <div className="card space-y-2">
              <h3 className="text-sm font-semibold text-gray-700">Contact</h3>
              <Link to={`/contacts/${l.contact.id ?? l.contactId}`}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 text-sm">
                <div>
                  <p className="font-medium text-gray-900">{l.contact.firstName} {l.contact.lastName}</p>
                  <p className="text-xs text-gray-400">{l.contact.phone}</p>
                </div>
                <span className="text-primary-600 text-xs">View →</span>
              </Link>
            </div>
          )}
          {l.plan && (
            <div className="card space-y-2">
              <h3 className="text-sm font-semibold text-gray-700">Insurance Plan</h3>
              <p className="text-sm font-medium text-gray-900">{l.plan.name}</p>
              <p className="text-xs text-gray-400">{l.plan.company?.name} · {l.plan.category}</p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title="Edit Lead" size="xl">
        <form onSubmit={handleSubmit(body => {
          const lData = lead?.data ?? lead;
          const cleaned = cleanLeadPayload({
            ...body,
            contactId: lData?.contactId ?? lData?.contact?.id,
          });
          updateLead.mutate(cleaned);
        })} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="label">Sum Assured Required (₹)</label>
              <input {...register('sumAssuredRequired')} type="number" className="input" min="0" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="label">Premium Budget (₹)</label>
              <input {...register('premiumBudget')} type="number" className="input" min="0" />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label className="label">Follow-up Date</label>
            <DatePicker {...register('followUpDate')} className="input" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label className="label">Lost Reason</label>
            <input {...register('lostReason')} className="input" placeholder="If lost" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label className="label">Notes</label>
            <textarea {...register('notes')} className="input" rows={3} />
          </div>
          <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-gray-100 mt-6">
            <button type="button" className="btn-secondary" onClick={() => setEditModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={updateLead.isPending}>
              {updateLead.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Issue Policy on Move to Process Completed Modal */}
      <Modal 
        open={policyModalOpen} 
        onClose={() => setPolicyModalOpen(false)} 
        title="Add New Policy" 
        subtitle="Pre-fill details from lead to create a new policy." 
        size="xl"
      >
        <form onSubmit={handleSubmitPolicy(handlePolicyFormSubmit)} className="space-y-4 mt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Customer (Read-only display) */}
            <div className="col-span-2 flex flex-col gap-1 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-extrabold">Customer Details</label>
              <div className="flex flex-wrap items-center gap-3 mt-1.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
                  {(lead?.data ?? lead)?.contact?.firstName?.[0] || 'C'}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {(lead?.data ?? lead)?.contact?.firstName} {(lead?.data ?? lead)?.contact?.lastName}
                  </p>
                  <p className="text-xs text-slate-500 font-medium font-medium">
                    {(lead?.data ?? lead)?.contact?.email || 'No email'} · {(lead?.data ?? lead)?.contact?.phone || 'No phone'}
                  </p>
                </div>
              </div>
            </div>

            {/* Policy Number */}
            <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
              <label className="label">Policy Number <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                {...registerPolicy('policyNumber', { required: true })} 
                placeholder="Enter policy number..." 
                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                required
              />
            </div>

            {/* Policy Type (Select category) */}
            <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
              <label className="label">Policy Type <span className="text-red-500">*</span></label>
              <select
                className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
                value={policySelectedType}
                onChange={e => {
                  setPolicySelectedType(e.target.value);
                  setPolicySelectedCompany('');
                  setPolicySelectedPlanId('');
                }}
                required
              >
                <option value="">Select Type</option>
                {availableTypes.map(t => (
                  <option key={t} value={t}>{t === 'HEALTH' ? 'Health Insurance' : t === 'LIFE' ? 'Life Insurance' : t}</option>
                ))}
              </select>
            </div>

            {/* Insurance Company */}
            <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
              <label className="label">Insurance Company <span className="text-red-500">*</span></label>
              <select
                className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
                value={policySelectedCompany}
                onChange={e => {
                  setPolicySelectedCompany(e.target.value);
                  setPolicySelectedPlanId('');
                }}
                disabled={!policySelectedType}
                required
              >
                <option value="">Select Company</option>
                {availableCompanies.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Insurance Plan */}
            <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
              <label className="label">Insurance Plan <span className="text-red-500">*</span></label>
              <select
                className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
                value={policySelectedPlanId}
                onChange={e => setPolicySelectedPlanId(e.target.value)}
                disabled={!policySelectedCompany}
                required
              >
                <option value="">Select Plan</option>
                {availablePlans.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Sum Assured */}
            <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
              <label className="label">Sum Assured <span className="text-red-500">*</span></label>
              <input 
                type="number" 
                step="any"
                {...registerPolicy('sumAssured', { required: true })} 
                placeholder="Enter sum assured..." 
                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                required
              />
            </div>

            {/* Premium Amount */}
            <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
              <label className="label">Premium Amount <span className="text-red-500">*</span></label>
              <input 
                type="number" 
                step="any"
                {...registerPolicy('premiumAmount', { required: true })} 
                placeholder="Enter premium amount..." 
                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                required
              />
            </div>

            {/* Start Date */}
            <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
              <label className="label">Start Date <span className="text-red-500">*</span></label>
              <DatePicker 
                {...registerPolicy('startDate', { required: true })} 
                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                required
              />
            </div>

            {/* End Date */}
            <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
              <label className="label">End Date <span className="text-red-500">*</span></label>
              <DatePicker 
                {...registerPolicy('endDate', { required: true })} 
                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                required
              />
            </div>

            {/* Payment Frequency */}
            <div className="flex flex-col gap-1 col-span-2">
              <label className="label">Payment Frequency <span className="text-red-500">*</span></label>
              <select
                className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
                {...registerPolicy('paymentFrequency', { required: true })}
                required
              >
                <option value="YEARLY">Yearly</option>
                <option value="HALF_YEARLY">Half Yearly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="SINGLE">Single</option>
              </select>
            </div>

          </div>

          <div className="flex flex-wrap justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button 
              type="button" 
              className="px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer transition-all"
              onClick={() => setPolicyModalOpen(false)}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="px-3 sm:px-5 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl cursor-pointer shadow-md shadow-blue-500/20 transition-all hover:scale-105"
            >
              Issue Policy & Complete Lead
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-800 font-medium">{value ?? '—'}</span>
    </div>
  );
}
