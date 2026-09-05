import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contactsService, policiesService, claimsService, leadsService } from '@api/index';
import { Phone, Mail, MapPin, Briefcase, Users, Edit2, Plus, Trash2, Shield, FileText, TrendingUp, UserPlus, X } from 'lucide-react';
import Modal from '@comps/common/Modal';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { DatePicker } from '@comps/common/DatePicker';

const addressSchema = z.object({
  line1: z.string().min(1, 'Required'),
  line2: z.string().optional(),
  city: z.string().min(1, 'Required'),
  state: z.string().min(1, 'Required'),
  pincode: z.string().min(6, 'Enter 6-digit pincode'),
  type: z.enum(['HOME', 'WORK', 'OTHER']),
});
type AddressForm = z.infer<typeof addressSchema>;

const occupationSchema = z.object({
  company: z.string().optional(),
  designation: z.string().optional(),
  industry: z.string().optional(),
  annualIncome: z.coerce.number().min(0).optional(),
});
type OccupationForm = z.infer<typeof occupationSchema>;

const relationSchema = z.object({
  relatedContactId: z.string().optional(),
  relationshipType: z.string().min(1, 'Required'),
  name: z.string().optional(),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
});
type RelationForm = z.infer<typeof relationSchema>;

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'badge-green',
  EXPIRED: 'badge-gray',
  LAPSED: 'badge-red',
  CANCELLED: 'badge-red',
  PENDING: 'badge-yellow',
  INTIMATED: 'badge-yellow',
  FILED: 'badge-blue',
  IN_REVIEW: 'badge-blue',
  APPROVED: 'badge-green',
  SETTLED: 'badge-green',
  REJECTED: 'badge-red',
};

interface Props {
  open: boolean;
  onClose: () => void;
  contactId: string | null;
  onEditClick?: (c: any) => void;
}

export default function ContactDetailModal({ open, onClose, contactId, onEditClick }: Props) {
  const qc = useQueryClient();

  const [addrModal, setAddrModal] = useState(false);
  const [occModal, setOccModal] = useState(false);
  const [relModal, setRelModal] = useState(false);
  const [relSearch, setRelSearch] = useState('');
  const [selectedRelContact, setSelectedRelContact] = useState<any>(null);
  const [relDropdown, setRelDropdown] = useState(false);



  const { data: contact, isLoading } = useQuery({
    queryKey: ['contact', contactId],
    queryFn: () => contactsService.get(contactId!),
    enabled: !!contactId && open,
  });

  const { data: activityRes } = useQuery({
    queryKey: ['contact-activity', contactId],
    queryFn: () => contactsService.activity(contactId!, { page: 1, limit: 100 }),
    enabled: !!contactId && open,
  });

  const { data: policies } = useQuery({
    queryKey: ['contact-policies', contactId],
    queryFn: () => policiesService.list({ contactId, limit: 50 }),
    enabled: !!contactId && open,
  });

  const { data: claims } = useQuery({
    queryKey: ['contact-claims', contactId],
    queryFn: () => claimsService.list({ contactId, limit: 50 }),
    enabled: !!contactId && open,
  });

  const { data: leads } = useQuery({
    queryKey: ['contact-leads', contactId],
    queryFn: () => leadsService.list({ contactId, limit: 50 }),
    enabled: !!contactId && open,
  });

  const { data: relContactResults } = useQuery({
    queryKey: ['contacts-search-rel', relSearch],
    queryFn: () => contactsService.list({ search: relSearch, limit: 8 }),
    enabled: relSearch.length >= 1,
  });

  const addrForm = useForm<AddressForm>({ resolver: zodResolver(addressSchema), defaultValues: { type: 'HOME' } });
  const occForm = useForm<OccupationForm>({ resolver: zodResolver(occupationSchema) });
  const relForm = useForm<RelationForm>({ resolver: zodResolver(relationSchema) });

  const addAddress = useMutation({
    mutationFn: (body: AddressForm) => contactsService.addAddress(contactId!, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contact', contactId] }); setAddrModal(false); addrForm.reset(); toast.success('Address added'); },
    onError: () => toast.error('Failed to add address'),
  });

  const removeAddress = useMutation({
    mutationFn: (addrId: string) => contactsService.removeAddress(contactId!, addrId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contact', contactId] }); toast.success('Address removed'); },
    onError: () => toast.error('Failed to remove address'),
  });

  const addOccupation = useMutation({
    mutationFn: (body: OccupationForm) => contactsService.addOccupation(contactId!, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contact', contactId] }); setOccModal(false); occForm.reset(); toast.success('Occupation added'); },
    onError: () => toast.error('Failed to add occupation'),
  });

  const removeOccupation = useMutation({
    mutationFn: (occId: string) => contactsService.removeOccupation(contactId!, occId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contact', contactId] }); toast.success('Occupation removed'); },
    onError: () => toast.error('Failed to remove occupation'),
  });

  const addRelationship = useMutation({
    mutationFn: (body: RelationForm) => contactsService.addRelationship(contactId!, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contact', contactId] }); setRelModal(false); relForm.reset(); setSelectedRelContact(null); setRelSearch(''); toast.success('Relationship added'); },
    onError: () => toast.error('Failed to add relationship'),
  });

  const removeRelationship = useMutation({
    mutationFn: (relId: string) => contactsService.removeRelationship(contactId!, relId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contact', contactId] }); toast.success('Relationship removed'); },
    onError: () => toast.error('Failed to remove relationship'),
  });

  const inviteToPortal = useMutation({
    mutationFn: () => contactsService.inviteToPortal(contactId!),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contact', contactId] }); toast.success('Portal invitation sent!'); },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Failed to send invitation'),
  });



  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title="Contact Profile Detail" size="xl">
      {isLoading ? (
        <div className="flex h-64 items-center justify-center text-gray-400">Loading profile details…</div>
      ) : !contact?.data && !contact?.id ? (
        <div className="text-gray-500 p-8 text-center">Contact not found.</div>
      ) : (() => {
        const c = contact?.data ?? contact;
        return (
          <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-1">
            {/* Header / Meta section */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">{c.firstName} {c.lastName}</h2>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {c.tags?.filter((t: string) => !t.startsWith('med:')).map((t: string) => (
                    <span key={t} className="inline-block text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100 rounded-full px-2 py-0.5">{t}</span>
                  ))}
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${c.isActive ? 'badge-green' : 'badge-gray'}`}>{c.isActive ? 'Active' : 'Inactive'}</span>
                  {c.userId && <span className="badge-blue text-[10px] font-bold uppercase">Portal Active</span>}
                </div>
              </div>
              <div className="flex gap-2">
                {!c.userId && c.email && (
                  <button
                    onClick={() => inviteToPortal.mutate()}
                    disabled={inviteToPortal.isPending}
                    className="btn-secondary flex flex-wrap items-center gap-1 text-xs px-2.5 py-1.5 disabled:opacity-60 cursor-pointer"
                  >
                    <UserPlus size={13} />
                    {inviteToPortal.isPending ? 'Sending…' : 'Invite'}
                  </button>
                )}
                <button
                  onClick={() => onEditClick?.(c)}
                  className="px-2.5 py-1.5 text-xs font-bold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg cursor-pointer flex flex-wrap items-center gap-1.5 transition-all shadow-xs"
                >
                  <Edit2 size={12} /> Edit Profile
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Basic Info, Addresses, Occupations */}
              <div className="lg:col-span-1 space-y-4">
                {/* Contact Info Card */}
                <div className="card space-y-3 p-4 bg-slate-50/50 rounded-xl border border-slate-100">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Contact Info</h3>
                  <div className="space-y-2 text-xs text-gray-600">
                    {c.phone && <p><strong>Phone:</strong> {c.phone}</p>}
                    {c.alternatePhone && <p><strong>Alt Phone:</strong> {c.alternatePhone}</p>}
                    {c.email && <p><strong>Email:</strong> {c.email}</p>}
                    {c.dateOfBirth && <p><strong>DOB:</strong> {format(new Date(c.dateOfBirth), 'dd/MMM/yyyy')}</p>}
                    {c.gender && <p><strong>Gender:</strong> {c.gender}</p>}
                    {c.panNumber && <p><strong>PAN:</strong> {c.panNumber}</p>}
                    {c.aadhaarNumber && <p><strong>Aadhaar:</strong> {c.aadhaarNumber}</p>}
                    {c.annualIncome != null && <p><strong>Income:</strong> ₹{Number(c.annualIncome).toLocaleString('en-IN')}</p>}
                    {c.notes && <p className="bg-white p-2 rounded border border-gray-100 mt-1"><strong>Notes:</strong> {c.notes}</p>}
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Medical Conditions</span>
                      {(() => {
                        const medTags = (c.tags || []).filter((t: string) => t.startsWith('med:')).map((t: string) => t.replace('med:', ''));
                        if (medTags.length === 0) return <span className="text-gray-400">No medical conditions reported</span>;
                        return (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {medTags.map((tag: string) => (
                              <span key={tag} className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-100 rounded text-[9px] font-extrabold uppercase">
                                {tag}
                              </span>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Addresses */}
                <div className="card space-y-2 p-4 bg-slate-50/50 rounded-xl border border-slate-100">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex flex-wrap items-center gap-1.5"><MapPin size={12} />Addresses</h3>
                    <button onClick={() => setAddrModal(true)} className="p-1 rounded hover:bg-gray-150 text-gray-400 hover:text-blue-600 cursor-pointer"><Plus size={13} /></button>
                  </div>
                  {(c.addresses ?? []).length === 0 && <p className="text-[11px] text-gray-400">No addresses added</p>}
                  {(c.addresses ?? []).map((a: any) => (
                    <div key={a.id} className="text-xs text-gray-600 bg-white rounded-lg p-2 border border-slate-200/60 relative group">
                      <span className="text-[9px] font-extrabold text-blue-600 uppercase tracking-wide">{a.type}</span>
                      <p>{a.line1}{a.line2 ? `, ${a.line2}` : ''}</p>
                      <p>{a.city}, {a.state} – {a.pincode}</p>
                      <button onClick={() => removeAddress.mutate(a.id)}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-red-400 cursor-pointer transition-all">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Occupations */}
                <div className="card space-y-2 p-4 bg-slate-50/50 rounded-xl border border-slate-100">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex flex-wrap items-center gap-1.5"><Briefcase size={12} />Occupations</h3>
                    <button onClick={() => setOccModal(true)} className="p-1 rounded hover:bg-gray-150 text-gray-400 hover:text-blue-600 cursor-pointer"><Plus size={13} /></button>
                  </div>
                  {(c.occupations ?? []).length === 0 && <p className="text-[11px] text-gray-400">No occupations added</p>}
                  {(c.occupations ?? []).map((o: any) => (
                    <div key={o.id} className="text-xs text-gray-600 bg-white rounded-lg p-2 border border-slate-200/60 relative group">
                      {o.designation && <p className="font-semibold">{o.designation}</p>}
                      {o.company && <p className="text-gray-500">{o.company}</p>}
                      {o.industry && <p className="text-[10px] text-gray-400">{o.industry}</p>}
                      <button onClick={() => removeOccupation.mutate(o.id)}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-red-400 cursor-pointer transition-all">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Relationships / Family Members */}
                <div className="card space-y-2 p-4 bg-slate-50/50 rounded-xl border border-slate-100">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex flex-wrap items-center gap-1.5">
                      <Users size={12} /> Family & Relationships
                    </h3>
                    <button onClick={() => setRelModal(true)} className="p-1 rounded hover:bg-gray-150 text-gray-400 hover:text-blue-600 cursor-pointer">
                      <Plus size={13} />
                    </button>
                  </div>
                  {(c.relationships ?? []).length === 0 && <p className="text-[11px] text-gray-400">No relationships added</p>}
                  {(c.relationships ?? []).map((r: any) => (
                    <div key={r.id} className="text-xs text-gray-600 bg-white rounded-lg p-2 border border-slate-200/60 relative group flex items-center justify-between">
                      <div>
                        <span className="text-[9px] font-extrabold text-blue-600 uppercase tracking-wide">{r.relationshipType}</span>
                        <p className="font-semibold">{r.relatedContact ? `${r.relatedContact.firstName} ${r.relatedContact.lastName}` : r.name}</p>
                        {r.phone && <p className="text-[10px] text-gray-400">{r.phone}</p>}
                      </div>
                      <button onClick={() => removeRelationship.mutate(r.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-red-400 cursor-pointer transition-all">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Policies, Claims, Leads, and Activity */}
              <div className="lg:col-span-2 space-y-4">
                {/* Policies */}
                <div className="card p-4 rounded-xl border border-slate-100">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex flex-wrap items-center gap-1.5 mb-2"><Shield size={12} />Policies</h3>
                  {(policies?.data ?? []).length === 0 && <p className="text-xs text-gray-400">No active policies found.</p>}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(policies?.data ?? []).map((p: any) => (
                      <div key={p.id} className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/30 flex justify-between items-center text-xs">
                        <div>
                          <p className="font-bold text-slate-800">{p.policyNumber}</p>
                          <p className="text-[10px] text-gray-400">{p.plan?.name} · {p.plan?.company?.name}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">₹{Number(p.premiumAmount).toLocaleString('en-IN')}</p>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${STATUS_BADGE[p.status] ?? 'badge-gray'}`}>{p.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Claims */}
                <div className="card p-4 rounded-xl border border-slate-100">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex flex-wrap items-center gap-1.5 mb-2"><FileText size={12} />Claims</h3>
                  {(claims?.data ?? []).length === 0 && <p className="text-xs text-gray-400">No claims filed.</p>}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(claims?.data ?? []).map((cl: any) => (
                      <div key={cl.id} className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/30 flex justify-between items-center text-xs">
                        <div>
                          <p className="font-bold text-slate-800">{cl.claimNumber}</p>
                          <p className="text-[10px] text-gray-400">{cl.claimType} · Policy: {cl.policy?.policyNumber}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">₹{Number(cl.claimAmount).toLocaleString('en-IN')}</p>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${STATUS_BADGE[cl.status] ?? 'badge-gray'}`}>{cl.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Leads / Interests */}
                <div className="card p-4 rounded-xl border border-slate-100">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex flex-wrap items-center gap-1.5 mb-2"><TrendingUp size={12} />Leads & Interests</h3>
                  {(leads?.data ?? []).length === 0 && <p className="text-xs text-gray-400">No leads associated.</p>}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(leads?.data ?? []).map((l: any) => (
                      <div key={l.id} className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/30 flex justify-between items-center text-xs">
                        <div>
                          <p className="font-bold text-slate-800">{l.plan?.name ?? 'General Inquiry'}</p>
                          <span className="px-2 py-0.5 rounded text-[9px] bg-slate-100 text-slate-600 font-extrabold uppercase">{l.stage}</span>
                        </div>
                        {l.premiumBudget && <p className="font-semibold text-gray-600">₹{Number(l.premiumBudget).toLocaleString('en-IN')}</p>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Activity & Update Timeline */}
                <div className="card p-4 rounded-xl border border-slate-100">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex flex-wrap items-center gap-1.5 mb-2"><FileText size={12} />Update Log & History</h3>
                  {(!activityRes?.data || activityRes.data.length === 0) && <p className="text-xs text-gray-400">No activities logged.</p>}
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {(activityRes?.data ?? []).map((log: any) => (
                      <div key={log.id} className="p-2 bg-slate-50 border border-slate-150 rounded text-[11px] space-y-1">
                        <div className="flex justify-between text-[9px] text-gray-400">
                          <span className="font-extrabold uppercase text-blue-600 bg-blue-50 px-1 rounded">{log.action}</span>
                          <span>{format(new Date(log.createdAt), 'dd/MMM/yyyy HH:mm')}</span>
                        </div>
                        <p className="text-gray-700">{log.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Address Form Modal overlay */}
            <Modal open={addrModal} onClose={() => { setAddrModal(false); addrForm.reset(); }} title="Add Address">
              <form onSubmit={addrForm.handleSubmit(d => addAddress.mutate(d))} className="space-y-3">
                <div>
                  <label className="label">Type</label>
                  <select {...addrForm.register('type')} className="input">
                    <option value="HOME">Home</option>
                    <option value="WORK">Work</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="label">Address Line 1 *</label>
                  <input {...addrForm.register('line1')} className="input" />
                  {addrForm.formState.errors.line1 && <p className="text-xs text-red-500">{addrForm.formState.errors.line1.message}</p>}
                </div>
                <div>
                  <label className="label">Address Line 2</label>
                  <input {...addrForm.register('line2')} className="input" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="label">City *</label>
                    <input {...addrForm.register('city')} className="input" />
                  </div>
                  <div>
                    <label className="label">State *</label>
                    <input {...addrForm.register('state')} className="input" />
                  </div>
                  <div>
                    <label className="label">Pincode *</label>
                    <input {...addrForm.register('pincode')} className="input" maxLength={6} />
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-2 pt-2">
                  <button type="button" className="btn-secondary" onClick={() => { setAddrModal(false); addrForm.reset(); }}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={addAddress.isPending}>
                    {addAddress.isPending ? 'Adding…' : 'Add Address'}
                  </button>
                </div>
              </form>
            </Modal>

            {/* Occupation Form Modal overlay */}
            <Modal open={occModal} onClose={() => { setOccModal(false); occForm.reset(); }} title="Add Occupation">
              <form onSubmit={occForm.handleSubmit(d => addOccupation.mutate(d))} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Company</label>
                    <input {...occForm.register('company')} className="input" />
                  </div>
                  <div>
                    <label className="label">Designation</label>
                    <input {...occForm.register('designation')} className="input" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Industry</label>
                    <input {...occForm.register('industry')} className="input" />
                  </div>
                  <div>
                    <label className="label">Annual Income (₹)</label>
                    <input {...occForm.register('annualIncome')} type="number" className="input" min="0" />
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-2 pt-2">
                  <button type="button" className="btn-secondary" onClick={() => { setOccModal(false); occForm.reset(); }}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={addOccupation.isPending}>
                    {addOccupation.isPending ? 'Adding…' : 'Add Occupation'}
                  </button>
                </div>
              </form>
            </Modal>

            {/* Add Relationship Modal */}
            <Modal open={relModal} onClose={() => { setRelModal(false); relForm.reset(); setSelectedRelContact(null); setRelSearch(''); }} title="Add Relationship">
              <form onSubmit={relForm.handleSubmit(d => addRelationship.mutate(d))} className="space-y-3">
                <div>
                  <label className="label">Relationship Type *</label>
                  <select {...relForm.register('relationshipType')} className="input">
                    <option value="">— Select —</option>
                    <option value="SPOUSE">Spouse</option>
                    <option value="CHILD">Child</option>
                    <option value="PARENT">Parent</option>
                    <option value="SIBLING">Sibling</option>
                    <option value="NOMINEE">Nominee</option>
                    <option value="OTHER">Other</option>
                  </select>
                  {relForm.formState.errors.relationshipType && <p className="text-xs text-red-500">{relForm.formState.errors.relationshipType.message}</p>}
                </div>
                <div>
                  <label className="label">Link to existing contact (optional)</label>
                  {selectedRelContact ? (
                    <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                      <span className="text-sm font-semibold">{selectedRelContact.firstName} {selectedRelContact.lastName}</span>
                      <button type="button" className="text-[10px] sm:text-xs text-red-500 font-bold" onClick={() => { setSelectedRelContact(null); relForm.setValue('relatedContactId', ''); }}>Remove</button>
                    </div>
                  ) : (
                    <div className="relative">
                      <input className="input w-full text-xs" placeholder="Search contact by name…" value={relSearch}
                        onChange={e => { setRelSearch(e.target.value); setRelDropdown(true); }}
                        onFocus={() => setRelDropdown(true)}
                        onBlur={() => setTimeout(() => setRelDropdown(false), 150)} />
                      {relDropdown && relSearch.length >= 1 && (
                        <ul className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                          {(relContactResults?.data ?? []).map((rc: any) => (
                            <li key={rc.id} onMouseDown={() => {
                              setSelectedRelContact(rc);
                              relForm.setValue('relatedContactId', rc.id);
                              setRelDropdown(false);
                              setRelSearch('');
                            }} className="px-3 py-2 text-xs hover:bg-blue-50 cursor-pointer font-semibold text-gray-700">
                              {rc.firstName} {rc.lastName} <span className="text-gray-400 font-normal">({rc.phone})</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
                <div className="border-t pt-3">
                  <p className="text-xs text-gray-400 mb-2">Or enter details manually:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="label">Name</label>
                      <input {...relForm.register('name')} className="input" placeholder="Full name" />
                    </div>
                    <div>
                      <label className="label">Phone</label>
                      <input {...relForm.register('phone')} className="input" placeholder="Phone number" />
                    </div>
                  </div>
                  <div className="mt-2">
                    <label className="label">Date of Birth</label>
                    <DatePicker {...relForm.register('dateOfBirth')} className="input" />
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-2 pt-2">
                  <button type="button" className="btn-secondary" onClick={() => { setRelModal(false); relForm.reset(); setSelectedRelContact(null); setRelSearch(''); }}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={addRelationship.isPending}>
                    {addRelationship.isPending ? 'Adding…' : 'Add Relationship'}
                  </button>
                </div>
              </form>
            </Modal>
          </div>
        );
      })()}
    </Modal>
  );
}
