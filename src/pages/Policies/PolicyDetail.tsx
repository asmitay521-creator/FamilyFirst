import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { policiesService, documentsService } from '@api/index';
import { ArrowLeft, Plus, Download, FileText, Trash2, Users, CreditCard, Award, Shield, Upload, X } from 'lucide-react';
import clsx from 'clsx';
import Modal from '@comps/common/Modal';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { DatePicker } from '@comps/common/DatePicker';
import { useAuthStore } from '@store/auth.store';
import { deletionRequestsService } from '@api/deletionRequestsService';

const STATUS_BADGE: Record<string, string> = {
  ACTIVE:    'badge-green',
  EXPIRED:   'badge-gray',
  LAPSED:    'badge-red',
  CANCELLED: 'badge-red',
  PENDING:   'badge-yellow',
  SURRENDERED: 'badge-gray',
};

const paymentSchema = z.object({
  amount:      z.coerce.number().positive('Enter a valid amount'),
  dueDate:     z.string().optional(),
  paidDate:    z.string().min(1, 'Required'),
  mode:        z.enum(['CASH', 'CHEQUE', 'NEFT', 'RTGS', 'UPI', 'CREDIT_CARD', 'DEBIT_CARD']).optional(),
  referenceNo: z.string().optional(),
  notes:       z.string().optional(),
  isPaid:      z.boolean().optional(),
});
type PaymentForm = z.infer<typeof paymentSchema>;

const memberSchema = z.object({
  name:         z.string().min(1, 'Full name required'),
  relationship: z.string().min(1, 'Required'),
  dateOfBirth:  z.string().optional(),
  gender:       z.enum(['MALE', 'FEMALE', 'OTHER', '']).optional(),
  sumInsured:   z.coerce.number().positive().optional(),
});
type MemberForm = z.infer<typeof memberSchema>;

const nomineeSchema = z.object({
  name:         z.string().min(1, 'Full name required'),
  relationship: z.string().min(1, 'Required'),
  sharePercent: z.coerce.number().min(0).max(100).optional(),
  dateOfBirth:  z.string().optional(),
});
type NomineeForm = z.infer<typeof nomineeSchema>;

export default function PolicyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate  = useNavigate();
  const qc = useQueryClient();
  const { user: authUser } = useAuthStore();

  const [paymentModal, setPaymentModal] = useState(false);
  const [memberModal, setMemberModal]   = useState(false);
  const [nomineeModal, setNomineeModal] = useState(false);
  const [uploadModal, setUploadModal]   = useState(false);
  const [uploadFile, setUploadFile]     = useState<File | null>(null);
  const [uploadTag, setUploadTag]       = useState('');
  const [uploadUploading, setUploadUploading] = useState(false);
  const [deleteDocTarget, setDeleteDocTarget] = useState<any | null>(null);

  const { data: policy, isLoading } = useQuery({
    queryKey: ['policy', id],
    queryFn: () => policiesService.get(id!),
    enabled: !!id,
  });

  const { data: documents, refetch: refetchDocs } = useQuery({
    queryKey: ['policy-docs', id],
    queryFn: () => documentsService.list({ policyId: id }),
    enabled: !!id,
  });

  const paymentForm = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { mode: 'UPI', paidDate: format(new Date(), 'yyyy-MM-dd') },
  });

  const memberForm = useForm<MemberForm>({
    resolver: zodResolver(memberSchema),
    defaultValues: { gender: '' },
  });

  const nomineeForm = useForm<NomineeForm>({
    resolver: zodResolver(nomineeSchema),
    defaultValues: {},
  });

  const addPayment = useMutation({
    mutationFn: (body: PaymentForm) => {
      const cleanBody = {
        amount: Number(body.amount),
        dueDate: body.dueDate ? new Date(body.dueDate).toISOString() : undefined,
        paidDate: body.paidDate ? new Date(body.paidDate).toISOString() : new Date().toISOString(),
        mode: body.mode || 'UPI',
        referenceNo: body.referenceNo || undefined,
        notes: body.notes || undefined,
        isPaid: true,
      };
      return policiesService.addPayment(id!, cleanBody);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['policy', id] });
      setPaymentModal(false);
      paymentForm.reset({ mode: 'UPI', paidDate: format(new Date(), 'yyyy-MM-dd') });
      toast.success('Payment recorded');
    },
    onError: (e: any) => {
      const errs = e?.response?.data?.errors ?? [];
      const msg = errs.length ? errs.join(' | ') : (e?.response?.data?.message ?? 'Failed to add payment');
      toast.error(msg);
    },
  });

  const addMember = useMutation({
    mutationFn: (body: MemberForm) => {
      const cleanBody = {
        name: body.name,
        relationship: body.relationship,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth).toISOString() : undefined,
        gender: body.gender || undefined,
        sumInsured: body.sumInsured ? Number(body.sumInsured) : undefined,
      };
      return policiesService.addMember(id!, cleanBody);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['policy', id] });
      setMemberModal(false);
      memberForm.reset();
      toast.success('Member added');
    },
    onError: (e: any) => {
      const errs = e?.response?.data?.errors ?? [];
      const msg = errs.length ? errs.join(' | ') : (e?.response?.data?.message ?? 'Failed to add member');
      toast.error(msg);
    },
  });

  const removeMember = useMutation({
    mutationFn: (memberId: string) => policiesService.removeMember(id!, memberId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['policy', id] });
      toast.success('Member removed');
    },
    onError: (e: any) => {
      const errs = e?.response?.data?.errors ?? [];
      const msg = errs.length ? errs.join(' | ') : (e?.response?.data?.message ?? 'Failed to remove member');
      toast.error(msg);
    },
  });

  const addNominee = useMutation({
    mutationFn: (body: NomineeForm) => {
      const cleanBody = {
        name: body.name,
        relationship: body.relationship,
        sharePercent: Number(body.sharePercent || 100),
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth).toISOString() : undefined,
      };
      return policiesService.addNominee(id!, cleanBody);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['policy', id] });
      setNomineeModal(false);
      nomineeForm.reset();
      toast.success('Nominee added');
    },
    onError: (e: any) => {
      const errs = e?.response?.data?.errors ?? [];
      const msg = errs.length ? errs.join(' | ') : (e?.response?.data?.message ?? 'Failed to add nominee');
      toast.error(msg);
    },
  });

  const removeNominee = useMutation({
    mutationFn: (nomineeId: string) => policiesService.removeNominee(id!, nomineeId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['policy', id] });
      toast.success('Nominee removed');
    },
    onError: (e: any) => {
      const errs = e?.response?.data?.errors ?? [];
      const msg = errs.length ? errs.join(' | ') : (e?.response?.data?.message ?? 'Failed to remove nominee');
      toast.error(msg);
    },
  });

  const removeDoc = useMutation({
    mutationFn: (docId: string) => documentsService.remove(docId),
    onSuccess: () => {
      refetchDocs();
      toast.success('Document removed');
    },
    onError: (e: any) => {
      const errs = e?.response?.data?.errors ?? [];
      const msg = errs.length ? errs.join(' | ') : (e?.response?.data?.message ?? 'Failed to remove document');
      toast.error(msg);
    },
  });

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploadUploading(true);
    try {
      await documentsService.upload(uploadFile, { policyId: id!, type: uploadTag || 'POLICY' });
      refetchDocs();
      setUploadModal(false);
      setUploadFile(null);
      setUploadTag('');
      toast.success('Document uploaded');
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Upload failed';
      toast.error(msg);
    } finally {
      setUploadUploading(false);
    }
  };

  const viewDoc = async (docId: string) => {
    try {
      const res = await documentsService.url(docId);
      window.open(res.url, '_blank');
    } catch {
      toast.error('Could not load document URL');
    }
  };

  if (isLoading) return <div className="flex h-48 items-center justify-center text-gray-400">Loading…</div>;

  const p = policy?.data ?? policy;
  if (!p) return <div className="text-gray-500 p-8">Policy not found.</div>;

  const payList: any[] = p.payments ?? [];
  const docList: any[] = documents?.data ?? documents ?? [];
  const memberList: any[] = p.members ?? [];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold text-gray-900">{p.policyNumber}</h2>
            <span className={STATUS_BADGE[p.status] ?? 'badge-gray'}>{p.status}</span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {p.plan?.name} · {p.plan?.company?.name}
          </p>
        </div>
        <Link to={`/contacts/${p.contactId}`} className="text-sm text-primary-600 hover:underline">
          {p.contact?.firstName} {p.contact?.lastName}
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Policy Info */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card space-y-2">
            <h3 className="text-sm font-semibold text-gray-700">Policy Details</h3>
            <InfoRow label="Category" value={p.plan?.category} />
            <InfoRow label="Sum Assured" value={p.sumAssured ? `₹${Number(p.sumAssured).toLocaleString('en-IN')}` : '—'} />
            <InfoRow label="Premium" value={`₹${Number(p.premiumAmount).toLocaleString('en-IN')}`} />
            <InfoRow label="Frequency" value={p.paymentFrequency} />
            <InfoRow label="Agent Code" value={p.agentCode ?? '—'} />
            <InfoRow label="Start Date" value={p.startDate ? format(new Date(p.startDate), 'dd/MMM/yyyy') : '—'} />
            <InfoRow label="End / Expiry" value={p.endDate ? format(new Date(p.endDate), 'dd/MMM/yyyy') : '—'} />
            <InfoRow label="Next Due" value={p.nextDueDate ? format(new Date(p.nextDueDate), 'dd/MMM/yyyy') : '—'} />
            <InfoRow label="Maturity" value={p.maturityDate ? format(new Date(p.maturityDate), 'dd/MMM/yyyy') : '—'} />
            {p.notes && (
              <div className="mt-2 text-xs text-gray-500 bg-gray-50 rounded p-2">{p.notes}</div>
            )}
          </div>
        </div>

        {/* Right: Payments, Members, Documents */}
        <div className="lg:col-span-2 space-y-4">
          {/* Payments */}
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700 flex flex-wrap items-center gap-1.5"><CreditCard size={14}/>Payment Schedule</h3>
              <button onClick={() => setPaymentModal(true)} className="btn-sm btn-primary flex flex-wrap items-center gap-1"><Plus size={12}/>Record</button>
            </div>
            {payList.length === 0 && <p className="text-sm text-gray-400">No payments recorded yet.</p>}
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {payList.map((pay: any) => (
                <div key={pay.id} className={clsx("flex items-center justify-between p-3 rounded-lg border text-sm", pay.isPaid ? 'border-green-100 bg-green-50/30' : 'border-gray-100 bg-white')}>
                  <div>
                    <p className="font-medium text-gray-900">₹{Number(pay.amount).toLocaleString('en-IN')}</p>
                    <p className="text-xs text-gray-500">
                      Due: {pay.dueDate ? format(new Date(pay.dueDate), 'dd/MMM/yyyy') : '—'}
                      {pay.isPaid && <span className="ml-2 text-green-600 font-medium">✓ Paid</span>}
                    </p>
                    {pay.mode && <p className="text-xs text-gray-400 mt-1">{pay.mode} · {pay.referenceNo ?? ''}</p>}
                  </div>
                  <div className="text-right">
                    {pay.paidDate && <p className="text-gray-600 text-xs">Paid on: {format(new Date(pay.paidDate), 'dd/MMM/yyyy')}</p>}
                    {pay.notes && <p className="text-xs text-gray-400 mt-1">{pay.notes}</p>}
                    {!pay.isPaid && (
                       <button onClick={() => { setPaymentModal(true); paymentForm.reset({ amount: pay.amount, dueDate: pay.dueDate ? pay.dueDate.slice(0, 10) : undefined, mode: 'UPI', paidDate: format(new Date(), 'yyyy-MM-dd') }) }} className="mt-1 text-xs text-blue-600 hover:underline">Mark Paid</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Commissions & Loans */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="card space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700 flex flex-wrap items-center gap-1.5"><Shield size={14}/>Commissions</h3>
              </div>
              {p.commissions?.length === 0 && <p className="text-sm text-gray-400">No commissions recorded.</p>}
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {p.commissions?.map((c: any) => (
                  <div key={c.id} className="p-3 rounded-lg border border-gray-100 text-sm">
                    <p className="font-medium text-gray-900">₹{Number(c.amount).toLocaleString('en-IN')}</p>
                    <p className="text-xs text-gray-500">{c.status} · {c.date ? format(new Date(c.date), 'dd/MMM/yyyy') : '—'}</p>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="card space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700 flex flex-wrap items-center gap-1.5"><Shield size={14}/>Loans / Installments</h3>
              </div>
              {p.loans?.length === 0 && <p className="text-sm text-gray-400">No loans recorded.</p>}
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {p.loans?.map((l: any) => (
                  <div key={l.id} className="p-3 rounded-lg border border-gray-100 text-sm">
                    <p className="font-medium text-gray-900">₹{Number(l.loanAmount).toLocaleString('en-IN')}</p>
                    <p className="text-xs text-gray-500">Status: {l.status}</p>
                    {l.outstandingAmount && <p className="text-xs text-red-500 mt-1">Outstanding: ₹{Number(l.outstandingAmount).toLocaleString('en-IN')}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Members */}
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700 flex flex-wrap items-center gap-1.5"><Users size={14}/>Insured Members</h3>
              <button onClick={() => setMemberModal(true)} className="btn-sm btn-primary flex flex-wrap items-center gap-1"><Plus size={12}/>Add</button>
            </div>
            {memberList.length === 0 && <p className="text-sm text-gray-400">No members added.</p>}
            <div className="space-y-2">
              {memberList.map((m: any) => (
                <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 group">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{m.name ?? `${m.firstName || ''} ${m.lastName || ''}`}</p>
                    <p className="text-xs text-gray-400">{m.relationship}{m.dateOfBirth ? ` · DOB: ${format(new Date(m.dateOfBirth), 'dd/MMM/yyyy')}` : ''}</p>
                  </div>
                  <button onClick={() => removeMember.mutate(m.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-red-400">
                    <Trash2 size={13}/>
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 flex flex-wrap items-center gap-1.5"><Award size={14}/>Nominees</h3>
              <button onClick={() => setNomineeModal(true)} className="btn-sm btn-primary flex flex-wrap items-center gap-1"><Plus size={12}/>Add</button>
            </div>
            {p.nominees?.length === 0 && <p className="text-sm text-gray-400">No nominees added.</p>}
            <div className="space-y-2">
              {p.nominees?.map((n: any) => (
                <div key={n.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 group">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{n.name}</p>
                    <p className="text-xs text-gray-400">{n.relationship}{n.dateOfBirth ? ` · DOB: ${format(new Date(n.dateOfBirth), 'dd/MMM/yyyy')}` : ''}</p>
                    {n.sharePercent ? <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full inline-block mt-1">Share: {n.sharePercent}%</span> : null}
                  </div>
                  <button onClick={() => removeNominee.mutate(n.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-red-400">
                    <Trash2 size={13}/>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Documents */}
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700 flex flex-wrap items-center gap-1.5"><FileText size={14}/>Documents</h3>
              <button onClick={() => setUploadModal(true)} className="btn-sm btn-primary flex flex-wrap items-center gap-1"><Upload size={12}/>Upload</button>
            </div>
            {docList.length === 0 && <p className="text-sm text-gray-400">No documents uploaded.</p>}
            <div className="space-y-2">
              {docList.map((doc: any) => (
                <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 group">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <FileText size={14} className="text-gray-400 shrink-0"/>
                    <div className="min-w-0">
                      <p className="text-sm text-gray-900 truncate">{doc.fileName ?? doc.originalName ?? 'Document'}</p>
                      <p className="text-xs text-gray-400">{doc.tag} · {doc.createdAt ? format(new Date(doc.createdAt), 'dd/MMM/yyyy') : ''}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 shrink-0">
                    <button onClick={() => viewDoc(doc.id)} className="p-1.5 rounded hover:bg-gray-100 text-primary-600 text-xs">View</button>
                    <button onClick={() => setDeleteDocTarget(doc)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-red-400"><Trash2 size={13}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Record Payment Modal */}
      <Modal open={paymentModal} onClose={() => { setPaymentModal(false); paymentForm.reset({ mode: 'UPI', paidDate: format(new Date(), 'yyyy-MM-dd') }); }} title="Record Payment" size="xl">
        <form onSubmit={paymentForm.handleSubmit(d => addPayment.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="label">Amount (₹) *</label>
              <input {...paymentForm.register('amount')} type="number" step="0.01" className="input" placeholder="12000" />
              {paymentForm.formState.errors.amount && <p className="text-xs text-red-500">{paymentForm.formState.errors.amount.message}</p>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="label">Paid Date *</label>
              <DatePicker {...paymentForm.register('paidDate')} className="input" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="label">Mode</label>
              <select {...paymentForm.register('mode')} className="input">
                <option value="UPI">UPI</option>
                <option value="CREDIT_CARD">Credit Card</option>
                <option value="DEBIT_CARD">Debit Card</option>
                <option value="NEFT">NEFT</option>
                <option value="RTGS">RTGS</option>
                <option value="CHEQUE">Cheque</option>
                <option value="CASH">Cash</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="label">Receipt Number</label>
              <input {...paymentForm.register('referenceNo')} className="input" placeholder="Optional" />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label className="label">Notes</label>
            <textarea {...paymentForm.register('notes')} className="input" rows={2} />
          </div>
          <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-gray-100 mt-6">
            <button type="button" className="btn-secondary" onClick={() => { setPaymentModal(false); paymentForm.reset(); }}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={addPayment.isPending}>
              {addPayment.isPending ? 'Saving…' : 'Record Payment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Member Modal */}
      <Modal open={memberModal} onClose={() => { setMemberModal(false); memberForm.reset(); }} title="Add Insured Member" size="xl">
        <form onSubmit={memberForm.handleSubmit(d => addMember.mutate(d))} className="space-y-4">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label className="label">Full Name <span className="text-red-500">*</span></label>
            <input {...memberForm.register('name')} className="input" />
            {memberForm.formState.errors.name && <p className="text-xs text-red-500">{memberForm.formState.errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="label">Relationship <span className="text-red-500">*</span></label>
              <select {...memberForm.register('relationship')} className="input">
                <option value="">— Select —</option>
                <option value="SPOUSE">Spouse</option>
                <option value="CHILD">Child</option>
                <option value="PARENT">Parent</option>
                <option value="SIBLING">Sibling</option>
                <option value="SELF">Self</option>
                <option value="OTHER">Other</option>
              </select>
              {memberForm.formState.errors.relationship && <p className="text-xs text-red-500">{memberForm.formState.errors.relationship.message}</p>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="label">Gender</label>
              <select {...memberForm.register('gender')} className="input">
                <option value="">— Select —</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="label">Date of Birth</label>
              <DatePicker {...memberForm.register('dateOfBirth')} className="input" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="label">Sum Assured (₹)</label>
              <input {...memberForm.register('sumInsured')} type="number" className="input" placeholder="Optional" />
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-gray-100 mt-6">
            <button type="button" className="btn-secondary" onClick={() => { setMemberModal(false); memberForm.reset(); }}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={addMember.isPending}>
              {addMember.isPending ? 'Adding…' : 'Add Member'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Nominee Modal */}
      <Modal open={nomineeModal} onClose={() => { setNomineeModal(false); nomineeForm.reset(); }} title="Add Nominee" size="xl">
        <form onSubmit={nomineeForm.handleSubmit(d => addNominee.mutate(d))} className="space-y-4">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label className="label">Full Name <span className="text-red-500">*</span></label>
            <input {...nomineeForm.register('name')} className="input" />
            {nomineeForm.formState.errors.name && <p className="text-xs text-red-500">{nomineeForm.formState.errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="label">Relationship <span className="text-red-500">*</span></label>
              <select {...nomineeForm.register('relationship')} className="input">
                <option value="">— Select —</option>
                <option value="SPOUSE">Spouse</option>
                <option value="CHILD">Child</option>
                <option value="PARENT">Parent</option>
                <option value="SIBLING">Sibling</option>
                <option value="OTHER">Other</option>
              </select>
              {nomineeForm.formState.errors.relationship && <p className="text-xs text-red-500">{nomineeForm.formState.errors.relationship.message}</p>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="label">Date of Birth</label>
              <DatePicker {...nomineeForm.register('dateOfBirth')} className="input" />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label className="label">Share Percentage (%)</label>
            <input {...nomineeForm.register('sharePercent')} type="number" min="0" max="100" className="input" placeholder="e.g. 100" />
          </div>
          <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-gray-100 mt-6">
            <button type="button" className="btn-secondary" onClick={() => { setNomineeModal(false); nomineeForm.reset(); }}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={addNominee.isPending}>
              {addNominee.isPending ? 'Adding…' : 'Add Nominee'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Upload Document Modal */}
      <Modal open={uploadModal} onClose={() => { setUploadModal(false); setUploadFile(null); setUploadTag(''); }} title="Upload Document" size="xl">
        <div className="space-y-4">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label className="label">Document Tag</label>
            <select className="input" value={uploadTag} onChange={e => setUploadTag(e.target.value)}>
              <option value="POLICY">Policy Document</option>
              <option value="PREMIUM_RECEIPT">Premium Receipt</option>
              <option value="CLAIM">Claim Document</option>
              <option value="ID_PROOF">ID Proof</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label className="label">Select File</label>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="input"
              onChange={e => setUploadFile(e.target.files?.[0] ?? null)} />
          </div>
          {uploadFile && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded p-2">
              <FileText size={14} className="text-gray-400"/>
              <span className="truncate">{uploadFile.name}</span>
              <span className="text-xs text-gray-400 ml-auto">{(uploadFile.size / 1024).toFixed(1)} KB</span>
              <button onClick={() => setUploadFile(null)} className="text-red-400 hover:text-red-600"><X size={13}/></button>
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-gray-100 mt-6">
            <button className="btn-secondary" onClick={() => { setUploadModal(false); setUploadFile(null); setUploadTag(''); }}>Cancel</button>
            <button className="btn-primary" disabled={!uploadFile || uploadUploading} onClick={handleUpload}>
              {uploadUploading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteDocTarget} onClose={() => setDeleteDocTarget(null)} title="Delete Document" size="sm">
        <p className="text-sm text-gray-600 mb-4">
          Delete <strong>{deleteDocTarget?.fileName ?? deleteDocTarget?.originalName ?? 'this document'}</strong>?
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <button className="btn-secondary" onClick={() => setDeleteDocTarget(null)}>Cancel</button>
          <button
            className="btn-danger"
            disabled={removeDoc.isPending}
            onClick={async () => {
              const isAdmin = authUser?.role === 'SUPERADMIN' || authUser?.role === 'OWNER';
              if (isAdmin) {
                await removeDoc.mutateAsync(deleteDocTarget!.id);
              } else {
                const toastId = toast.loading('Submitting delete request to admin...');
                try {
                  await deletionRequestsService.requestDeletion('Document', deleteDocTarget!.id, `Employee requested deletion of document ${deleteDocTarget?.fileName}`);
                  toast.success('Deletion request submitted to admin successfully!', { id: toastId });
                } catch (err: any) {
                  toast.error(err.response?.data?.message || 'Failed to submit request', { id: toastId });
                }
              }
              setDeleteDocTarget(null);
            }}
          >
            {removeDoc.isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-800 font-medium text-right">{value ?? '—'}</span>
    </div>
  );
}
