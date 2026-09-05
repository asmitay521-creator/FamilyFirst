import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { claimsService, documentsService } from '@api/index';
import { ArrowLeft, Upload, FileText, Trash2, X, Plus, DollarSign } from 'lucide-react';
import Modal from '@comps/common/Modal';
import { useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useLookupStore } from '@store/lookup.store';
import { getClaimNotesData, serializeNotes } from './index';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAddClaimExpense, useRemoveClaimExpense } from '@hooks/useClaims';
import { useAuthStore } from '@store/auth.store';
import { DatePicker } from '@comps/common/DatePicker';
import { deletionRequestsService } from '@api/deletionRequestsService';

const STATUS_BADGE: Record<string, string> = {
  INTIMATED: 'badge-yellow',
  DOC_COLLECTION: 'badge-blue',
  FILED: 'badge-blue',
  IN_REVIEW: 'badge-blue',
  APPROVED: 'badge-green',
  SETTLED: 'badge-green',
  REJECTED: 'badge-red',
};

const DISPLAY_STATUS_FLOW = ['INTIMATED', 'DOC_COLLECTION', 'FILED', 'IN_REVIEW', 'APPROVED', 'SETTLED', 'REJECTED'];

const expenseSchema = z.object({
  description: z.string().min(1, 'Description required'),
  amount: z.coerce.number().positive('Enter a valid amount'),
  category: z.enum(['HOSPITALIZATION', 'MEDICINES', 'LABORATORY', 'AMBULANCE', 'OTHER']),
  date: z.string().min(1, 'Date required'),
});
type ExpenseForm = z.infer<typeof expenseSchema>;

export default function ClaimDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user: authUser } = useAuthStore();

  // Lookup store
  const employees = useLookupStore(s => s.employees);

  const [uploadModal, setUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTag, setUploadTag] = useState('CLAIM');
  const [uploading, setUploading] = useState(false);
  const [statusModal, setStatusModal] = useState(false);
  const [expenseModal, setExpenseModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [approvedAmount, setApprovedAmount] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [deleteDocTarget, setDeleteDocTarget] = useState<any | null>(null);

  const { data: claim, isLoading } = useQuery({
    queryKey: ['claim', id],
    queryFn: () => claimsService.get(id!),
    enabled: !!id,
  });

  const { data: documents, refetch: refetchDocs } = useQuery({
    queryKey: ['claim-docs', id],
    queryFn: () => documentsService.list({ claimId: id }),
    enabled: !!id,
  });

  const updateStatus = useMutation({
    // Direct status update
    mutationFn: ({ status, ...rest }: any) => {
      return claimsService.updateStatus(id!, {
        status: status,
        approvedAmount: rest.approvedAmount ? Number(rest.approvedAmount) : undefined,
        rejectionReason: rest.rejectionReason || undefined,
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['claim', id] }); setStatusModal(false); toast.success('Status updated'); },
    onError: () => toast.error('Failed to update status'),
  });

  const addExpense = useAddClaimExpense(id!);
  const removeExpense = useRemoveClaimExpense(id!);

  const expenseForm = useForm<ExpenseForm>({
    resolver: zodResolver(expenseSchema),
    defaultValues: { category: 'HOSPITALIZATION', date: format(new Date(), 'yyyy-MM-dd') },
  });

  const removeDoc = useMutation({
    // Document removal
    mutationFn: (docId: string) => documentsService.remove(docId),
    onSuccess: () => { refetchDocs(); toast.success('Document removed'); },
    onError: () => toast.error('Failed to remove document'),
  });

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    try {
      await documentsService.upload(uploadFile, { claimId: id!, tag: uploadTag });
      refetchDocs();
      setUploadModal(false);
      setUploadFile(null);
      toast.success('Document uploaded');
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
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

  const openStatusModal = () => {
    const cl = claim?.data ?? claim;
    setNewStatus(cl?.status || '');
    setApprovedAmount(cl?.approvedAmount ? String(cl.approvedAmount) : '');
    setRejectionReason(cl?.rejectionReason ?? '');
    setStatusModal(true);
  };

  const onExpenseSubmit = async (data: ExpenseForm) => {
    try {
      await addExpense.mutateAsync(data);
      setExpenseModal(false);
      expenseForm.reset({ category: 'HOSPITALIZATION', date: format(new Date(), 'yyyy-MM-dd'), description: '', amount: undefined });
    } catch {
      // toast shown by hook
    }
  };

  if (isLoading) return <div className="flex h-48 items-center justify-center text-gray-400">Loading…</div>;

  const cl = claim?.data ?? claim;
  if (!cl) return <div className="text-gray-500 p-8">Claim not found.</div>;

  const docList: any[] = documents?.data ?? documents ?? [];
  const notesData = getClaimNotesData(cl.notes);
  const displayStatus = cl.status;

  const emp = employees.find(e => e.userId === cl.assignedEmployeeId);
  const assigneeName = emp ? `${emp.firstName} ${emp.lastName}` : 'Unassigned';

  // Expense Calculations
  const expensesList: any[] = cl.expenses ?? [];
  const getSubtotal = (cat: string) =>
    expensesList.filter(e => e.category === cat).reduce((sum, e) => sum + (e.amount || 0), 0);

  const hospitalizationTotal = getSubtotal('HOSPITALIZATION');
  const medicinesTotal = getSubtotal('MEDICINES');
  const laboratoryTotal = getSubtotal('LABORATORY');
  const ambulanceTotal = getSubtotal('AMBULANCE');
  const otherTotal = getSubtotal('OTHER');
  const overallTotal = expensesList.reduce((sum, e) => sum + (e.amount || 0), 0);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold text-gray-900">{cl.claimNumber}</h2>
            <span className={STATUS_BADGE[displayStatus] ?? 'badge-gray'}>{displayStatus.replace('_', ' ')}</span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {cl.claimType} claim · Policy: {cl.policy?.policyNumber}
          </p>
        </div>
        <button onClick={openStatusModal} className="btn-primary">Update Status</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Claim Details */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Claim Details</h3>
            <InfoRow label="Claim Number" value={cl.claimNumber} />
            <InfoRow label="Type" value={cl.claimType} />
            <InfoRow label="Diagnosis" value={notesData.diagnosis || '—'} />
            <InfoRow label="Hospital" value={notesData.hospital || '—'} />
            <InfoRow label="Admission Date" value={notesData.admissionAt ? format(new Date(notesData.admissionAt), 'dd/MMM/yyyy') : '—'} />
            <InfoRow label="Discharge Date" value={notesData.dischargeAt ? format(new Date(notesData.dischargeAt), 'dd/MMM/yyyy') : '—'} />
            <InfoRow label="Claim Amount" value={`₹${Number(cl.claimAmount).toLocaleString('en-IN')}`} />
            <InfoRow label="Approved Amount" value={cl.approvedAmount ? `₹${Number(cl.approvedAmount).toLocaleString('en-IN')}` : '—'} />
            <InfoRow label="Intimated At" value={cl.intimatedAt ? format(new Date(cl.intimatedAt), 'dd/MMM/yyyy') : '—'} />
            <InfoRow label="Assignee" value={assigneeName} />
            {cl.rejectionReason && (
              <div className="mt-2 text-sm text-red-600 bg-red-50 rounded-lg p-2">
                <span className="font-medium">Rejection reason: </span>{cl.rejectionReason}
              </div>
            )}
            {notesData.notes && (
              <div className="mt-2 text-xs text-gray-500 bg-gray-50 rounded p-2">
                <span className="font-medium text-gray-700">Notes: </span>{notesData.notes}
              </div>
            )}
          </div>

          {/* People & Policy Links */}
          <div className="card space-y-2">
            <h3 className="text-sm font-semibold text-gray-700">Contact &amp; Policy</h3>
            {cl.contact && (
              <Link to={`/contacts/${cl.contact.id ?? cl.contactId}`}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 text-sm">
                <span className="font-medium text-gray-900">{cl.contact.firstName} {cl.contact.lastName}</span>
                <span className="text-primary-600 text-xs">View Contact →</span>
              </Link>
            )}
            {cl.policy && (
              <Link to={`/policies/${cl.policy.id ?? cl.policyId}`}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-55 text-sm">
                <span className="font-medium text-gray-900">{cl.policy.policyNumber}</span>
                <span className="text-primary-600 text-xs">View Policy →</span>
              </Link>
            )}
          </div>

          {/* Lifecycle Status flow visualization */}
          <div className="card space-y-2">
            <h3 className="text-sm font-semibold text-gray-700">Status Flow</h3>
            <div className="flex flex-wrap gap-2">
              {DISPLAY_STATUS_FLOW.map(s => (
                <span key={s}
                  className={`text-xs px-2 py-1 rounded-full border ${s === displayStatus
                    ? 'bg-primary-100 text-primary-700 border-primary-300 font-semibold'
                    : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                  {s.replace('_', ' ')}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Expenses Breakdown & Documents */}
        <div className="lg:col-span-2 space-y-4">

          {/* Expense Breakdown Card */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700 flex flex-wrap items-center gap-1.5">
                <DollarSign size={14} /> Expense Breakdown
              </h3>
              <button onClick={() => setExpenseModal(true)} className="btn-sm btn-primary flex flex-wrap items-center gap-1">
                <Plus size={12} /> Record Expense
              </button>
            </div>

            {/* Categorized Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-3 gap-2 bg-gray-50/50 p-3 rounded-lg text-xs font-medium">
              <div className="p-2 border border-gray-100 rounded bg-white">
                <span className="text-gray-400">Hospitalization</span>
                <p className="text-sm font-bold text-gray-800 mt-0.5">₹{hospitalizationTotal.toLocaleString('en-IN')}</p>
              </div>
              <div className="p-2 border border-gray-100 rounded bg-white">
                <span className="text-gray-400">Medicines</span>
                <p className="text-sm font-bold text-gray-800 mt-0.5">₹{medicinesTotal.toLocaleString('en-IN')}</p>
              </div>
              <div className="p-2 border border-gray-100 rounded bg-white">
                <span className="text-gray-400">Laboratory</span>
                <p className="text-sm font-bold text-gray-800 mt-0.5">₹{laboratoryTotal.toLocaleString('en-IN')}</p>
              </div>
              <div className="p-2 border border-gray-100 rounded bg-white">
                <span className="text-gray-400">Ambulance</span>
                <p className="text-sm font-bold text-gray-800 mt-0.5">₹{ambulanceTotal.toLocaleString('en-IN')}</p>
              </div>
              <div className="p-2 border border-gray-100 rounded bg-white">
                <span className="text-gray-400">Other Expenses</span>
                <p className="text-sm font-bold text-gray-800 mt-0.5">₹{otherTotal.toLocaleString('en-IN')}</p>
              </div>
              <div className="p-2 border border-blue-100 rounded bg-blue-50/50">
                <span className="text-blue-500 font-semibold">Total Expenses</span>
                <p className="text-sm font-bold text-blue-700 mt-0.5">₹{overallTotal.toLocaleString('en-IN')}</p>
              </div>
            </div>

            {/* Individual expenses list */}
            {expensesList.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No expenses recorded for this claim.</p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {expensesList.map((exp: any) => (
                  <div key={exp.id} className="flex items-center justify-between p-2.5 rounded-lg border border-gray-100 group text-sm">
                    <div>
                      <p className="font-semibold text-gray-900">{exp.description}</p>
                      <p className="text-xs text-gray-400">
                        {exp.category} · {exp.date ? format(new Date(exp.date), 'dd/MMM/yyyy') : '—'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-gray-800">₹{Number(exp.amount).toLocaleString('en-IN')}</span>
                      <button onClick={() => removeExpense.mutate(exp.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-red-400 transition-opacity">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Documents Card */}
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700 flex flex-wrap items-center gap-1.5">
                <FileText size={14} /> Documents
              </h3>
              <button onClick={() => setUploadModal(true)} className="btn-sm btn-primary flex flex-wrap items-center gap-1">
                <Upload size={12} /> Upload
              </button>
            </div>
            {docList.length === 0 && <p className="text-sm text-gray-400">No documents uploaded.</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {docList.map((doc: any) => (
                <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 group">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <FileText size={14} className="text-gray-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm text-gray-900 truncate">{doc.fileName ?? doc.originalName ?? 'Document'}</p>
                      <p className="text-xs text-gray-400">{doc.tag}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 shrink-0">
                    <button onClick={() => viewDoc(doc.id)} className="p-1.5 rounded hover:bg-gray-100 text-primary-600 text-xs">View</button>
                    <button onClick={() => setDeleteDocTarget(doc)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-red-400"><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Record Expense Modal */}
      <Modal open={expenseModal} onClose={() => setExpenseModal(false)} title="Record Claim Expense">
        <form onSubmit={expenseForm.handleSubmit(onExpenseSubmit)} className="space-y-3">
          <div>
            <label className="label">Description *</label>
            <input {...expenseForm.register('description')} className="input" placeholder="e.g. ICU Room Charges" />
            {expenseForm.formState.errors.description && <p className="text-xs text-red-500 mt-0.5">{expenseForm.formState.errors.description.message}</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Amount (₹) *</label>
              <input {...expenseForm.register('amount')} type="number" className="input" placeholder="15000" />
              {expenseForm.formState.errors.amount && <p className="text-xs text-red-500 mt-0.5">{expenseForm.formState.errors.amount.message}</p>}
            </div>
            <div>
              <label className="label">Expense Category</label>
              <select {...expenseForm.register('category')} className="input">
                <option value="HOSPITALIZATION">Hospitalization</option>
                <option value="MEDICINES">Medicines</option>
                <option value="LABORATORY">Laboratory</option>
                <option value="AMBULANCE">Ambulance</option>
                <option value="OTHER">Other Expenses</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Date *</label>
            <DatePicker {...expenseForm.register('date')} className="input" />
            {expenseForm.formState.errors.date && <p className="text-xs text-red-500 mt-0.5">{expenseForm.formState.errors.date.message}</p>}
          </div>
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setExpenseModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={addExpense.isPending}>
              {addExpense.isPending ? 'Recording…' : 'Record Expense'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Update Status Modal */}
      <Modal open={statusModal} onClose={() => setStatusModal(false)} title="Update Claim Status">
        <div className="space-y-4">
          <div>
            <label className="label">New Status</label>
            <select className="input" value={newStatus} onChange={e => setNewStatus(e.target.value)}>
              {DISPLAY_STATUS_FLOW.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </div>
          {(newStatus === 'APPROVED' || newStatus === 'SETTLED') && (
            <div>
              <label className="label">Approved Amount (₹)</label>
              <input type="number" className="input" value={approvedAmount} onChange={e => setApprovedAmount(e.target.value)} placeholder="Enter approved amount" />
            </div>
          )}
          {newStatus === 'REJECTED' && (
            <div>
              <label className="label">Rejection Reason</label>
              <textarea className="input" rows={2} value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} />
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <button className="btn-secondary" onClick={() => setStatusModal(false)}>Cancel</button>
            <button className="btn-primary" disabled={updateStatus.isPending}
              onClick={() => updateStatus.mutate({
                status: newStatus,
                ...(approvedAmount ? { approvedAmount: Number(approvedAmount) } : {}),
                ...(rejectionReason ? { rejectionReason } : {}),
              })}>
              {updateStatus.isPending ? 'Saving…' : 'Update'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Upload Document Modal */}
      <Modal open={uploadModal} onClose={() => { setUploadModal(false); setUploadFile(null); }} title="Upload Document">
        <div className="space-y-4">
          <div>
            <label className="label">Document Tag</label>
            <select className="input" value={uploadTag} onChange={e => setUploadTag(e.target.value)}>
              <option value="CLAIM">Claim Document</option>
              <option value="DISCHARGE_VOUCHER">Discharge Voucher</option>
              <option value="MEDICAL_REPORT">Medical Report</option>
              <option value="ID_PROOF">ID Proof</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <label className="label">Select File</label>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="input" onChange={e => setUploadFile(e.target.files?.[0] ?? null)} />
          </div>
          {uploadFile && (
            <div className="flex flex-wrap items-center gap-2 text-sm bg-gray-50 rounded p-2">
              <FileText size={14} className="text-gray-400" />
              <span className="truncate">{uploadFile.name}</span>
              <button onClick={() => setUploadFile(null)} className="ml-auto text-red-400"><X size={13} /></button>
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <button className="btn-secondary" onClick={() => { setUploadModal(false); setUploadFile(null); }}>Cancel</button>
            <button className="btn-primary" disabled={!uploadFile || uploading} onClick={handleUpload}>
              {uploading ? 'Uploading…' : 'Upload'}
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
