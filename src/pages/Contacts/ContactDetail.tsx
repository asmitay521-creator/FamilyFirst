import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contactsService, policiesService, claimsService, leadsService } from '@api/index';
import { ArrowLeft, Phone, Mail, MapPin, Briefcase, Users, Edit2, Plus, Trash2, Shield, FileText, TrendingUp, UserPlus } from 'lucide-react';
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

export default function ContactDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [addrModal, setAddrModal] = useState(false);
  const [occModal, setOccModal] = useState(false);
  const [relModal, setRelModal] = useState(false);
  const [relSearch, setRelSearch] = useState('');
  const [selectedRelContact, setSelectedRelContact] = useState<any>(null);
  const [relDropdown, setRelDropdown] = useState(false);

  // Profile Edit states
  const [editMode, setEditMode] = useState(false);
  const [fields, setFields] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    alternatePhone: '',
    email: '',
    dateOfBirth: '',
    gender: '',
    panNumber: '',
    aadhaarNumber: '',
    annualIncome: '',
    notes: '',
  });
  const [selectedMedHistory, setSelectedMedHistory] = useState<string[]>([]);

  const { data: contact, isLoading } = useQuery({
    queryKey: ['contact', id],
    queryFn: () => contactsService.get(id!),
    enabled: !!id,
  });

  const { data: activityRes } = useQuery({
    queryKey: ['contact-activity', id],
    queryFn: () => contactsService.activity(id!, { page: 1, limit: 100 }),
    enabled: !!id,
  });

  const { data: policies } = useQuery({
    queryKey: ['contact-policies', id],
    queryFn: () => policiesService.list({ contactId: id, limit: 50 }),
    enabled: !!id,
  });

  const { data: claims } = useQuery({
    queryKey: ['contact-claims', id],
    queryFn: () => claimsService.list({ contactId: id, limit: 50 }),
    enabled: !!id,
  });

  const { data: leads } = useQuery({
    queryKey: ['contact-leads', id],
    queryFn: () => leadsService.list({ contactId: id, limit: 50 }),
    enabled: !!id,
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
    mutationFn: (body: AddressForm) => contactsService.addAddress(id!, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contact', id] }); setAddrModal(false); addrForm.reset(); toast.success('Address added'); },
    onError: () => toast.error('Failed to add address'),
  });

  const removeAddress = useMutation({
    mutationFn: (addrId: string) => contactsService.removeAddress(id!, addrId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contact', id] }); toast.success('Address removed'); },
    onError: () => toast.error('Failed to remove address'),
  });

  const addOccupation = useMutation({
    mutationFn: (body: OccupationForm) => contactsService.addOccupation(id!, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contact', id] }); setOccModal(false); occForm.reset(); toast.success('Occupation added'); },
    onError: () => toast.error('Failed to add occupation'),
  });

  const removeOccupation = useMutation({
    mutationFn: (occId: string) => contactsService.removeOccupation(id!, occId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contact', id] }); toast.success('Occupation removed'); },
    onError: () => toast.error('Failed to remove occupation'),
  });

  const addRelationship = useMutation({
    mutationFn: (body: RelationForm) => contactsService.addRelationship(id!, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contact', id] }); setRelModal(false); relForm.reset(); setSelectedRelContact(null); setRelSearch(''); toast.success('Relationship added'); },
    onError: () => toast.error('Failed to add relationship'),
  });

  const removeRelationship = useMutation({
    mutationFn: (relId: string) => contactsService.removeRelationship(id!, relId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contact', id] }); toast.success('Relationship removed'); },
    onError: () => toast.error('Failed to remove relationship'),
  });

  const inviteToPortal = useMutation({
    mutationFn: () => contactsService.inviteToPortal(id!),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contact', id] }); toast.success('Portal invitation sent!'); },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Failed to send invitation'),
  });

  const updateContactMutation = useMutation({
    mutationFn: (body: any) => contactsService.update(id!, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact', id] });
      qc.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Profile updated');
      setEditMode(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    }
  });

  const startEdit = (c: any) => {
    setFields({
      firstName: c.firstName || '',
      lastName: c.lastName || '',
      phone: c.phone || '',
      alternatePhone: c.alternatePhone || '',
      email: c.email || '',
      dateOfBirth: c.dateOfBirth ? c.dateOfBirth.split('T')[0] : '',
      gender: c.gender || '',
      panNumber: c.panNumber || '',
      aadhaarNumber: c.aadhaarNumber || '',
      annualIncome: c.annualIncome != null ? String(c.annualIncome) : '',
      notes: c.notes || '',
    });
    const medTags = (c.tags || [])
      .filter((t: string) => t.startsWith('med:'))
      .map((t: string) => t.replace('med:', ''));
    setSelectedMedHistory(medTags);
    setEditMode(true);
  };

  const saveProfile = async (c: any) => {
    if (!fields.firstName.trim()) {
      toast.error('First Name is required');
      return;
    }
    if (!fields.phone.trim()) {
      toast.error('Mobile Number is required');
      return;
    }
    if (!/^\d{10}$/.test(fields.phone.trim())) {
      toast.error('Mobile Number must be exactly 10 digits');
      return;
    }
    if (!fields.aadhaarNumber.trim()) {
      toast.error('Aadhaar Number is required');
      return;
    }
    if (!/^\d{12}$/.test(fields.aadhaarNumber.trim())) {
      toast.error('Aadhaar Number must be exactly 12 digits');
      return;
    }

    const nonMedTags = (c.tags || []).filter((t: string) => !t.startsWith('med:'));
    const medTags = selectedMedHistory.map(cond => `med:${cond}`);
    const mergedTags = [...nonMedTags, ...medTags];

    await updateContactMutation.mutateAsync({
      firstName: fields.firstName,
      lastName: fields.lastName,
      phone: fields.phone,
      alternatePhone: fields.alternatePhone || null,
      email: fields.email || null,
      dateOfBirth: fields.dateOfBirth ? new Date(fields.dateOfBirth).toISOString() : null,
      gender: fields.gender || null,
      panNumber: fields.panNumber || null,
      aadhaarNumber: fields.aadhaarNumber || null,
      annualIncome: fields.annualIncome ? Number(fields.annualIncome) : null,
      notes: fields.notes || null,
      tags: mergedTags,
    });
  };

  if (isLoading) return <div className="flex h-48 items-center justify-center text-gray-400">Loading…</div>;
  if (!contact?.data && !contact?.id) return <div className="text-gray-500 p-8">Contact not found.</div>;

  const c = contact?.data ?? contact;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">{c.firstName} {c.lastName}</h2>
          <div className="flex gap-3 mt-0.5">
            {c.tags?.filter((t: string) => !t.startsWith('med:')).map((t: string) => (
              <span key={t} className="inline-block text-xs bg-primary-100 text-primary-700 rounded-full px-2 py-0.5">{t}</span>
            ))}
            <span className={c.isActive ? 'badge-green' : 'badge-gray'}>{c.isActive ? 'Active' : 'Inactive'}</span>
            {c.userId && <span className="badge-blue text-xs">Portal Active</span>}
          </div>
        </div>
        <div className="flex gap-2">
          {!c.userId && c.email && (
            <button
              onClick={() => inviteToPortal.mutate()}
              disabled={inviteToPortal.isPending}
              className="btn-secondary flex flex-wrap items-center gap-1.5 text-sm px-3 py-1.5 disabled:opacity-60"
              title="Send client portal invitation"
            >
              <UserPlus size={15} />
              {inviteToPortal.isPending ? 'Sending…' : 'Invite to Portal'}
            </button>
          )}
          {editMode ? (
            <div className="flex gap-2">
              <button
                onClick={() => setEditMode(false)}
                className="px-3 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg cursor-pointer animate-fadeIn"
              >
                Cancel
              </button>
              <button
                onClick={() => saveProfile(c)}
                disabled={updateContactMutation.isPending}
                className="px-3 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg cursor-pointer flex flex-wrap items-center gap-1 animate-fadeIn"
              >
                {updateContactMutation.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => startEdit(c)}
              className="px-3 py-1.5 text-xs font-bold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg cursor-pointer flex flex-wrap items-center gap-1.5 animate-fadeIn"
            >
              <Edit2 size={13} /> Edit Profile
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Contact info */}
        <div className="lg:col-span-1 space-y-4">
          {/* Basic Info Card */}
          <div className="card space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Contact Info</h3>
            
            {editMode ? (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="label text-[10px] font-bold text-gray-500">First Name</label>
                    <input
                      type="text"
                      className="input w-full p-1"
                      value={fields.firstName}
                      onChange={e => setFields(prev => ({ ...prev, firstName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label text-[10px] font-bold text-gray-500">Last Name</label>
                    <input
                      type="text"
                      className="input w-full p-1"
                      value={fields.lastName}
                      onChange={e => setFields(prev => ({ ...prev, lastName: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <label className="label text-[10px] font-bold text-gray-500">
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    className={`input w-full p-1 ${
                      fields.phone && !/^\d{10}$/.test(fields.phone)
                        ? 'border-red-400'
                        : ''
                    }`}
                    maxLength={10}
                    value={fields.phone}
                    onChange={e => setFields(prev => ({ ...prev, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                  />
                  {!fields.phone && (
                    <p className="text-red-500 text-[10px] font-semibold mt-0.5">Required</p>
                  )}
                  {fields.phone && !/^\d{10}$/.test(fields.phone) && (
                    <p className="text-red-500 text-[10px] font-semibold mt-0.5">Must be exactly 10 digits</p>
                  )}
                </div>

                <div>
                  <label className="label text-[10px] font-bold text-gray-500">Alternate Phone</label>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="10-digit mobile"
                    className="input w-full p-1"
                    value={fields.alternatePhone}
                    onChange={e => setFields(prev => ({ ...prev, alternatePhone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                  />
                </div>

                <div>
                  <label className="label text-[10px] font-bold text-gray-500">Email</label>
                  <input
                    type="email"
                    className="input w-full p-1"
                    value={fields.email}
                    onChange={e => setFields(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="label text-[10px] font-bold text-gray-500">Date of Birth</label>
                  <DatePicker
                    className="input w-full p-1"
                    value={fields.dateOfBirth}
                    onDateChange={val => setFields(prev => ({ ...prev, dateOfBirth: val }))}
                  />
                </div>

                <div>
                  <label className="label text-[10px] font-bold text-gray-500">Gender</label>
                  <select
                    className="input w-full p-1"
                    value={fields.gender}
                    onChange={e => setFields(prev => ({ ...prev, gender: e.target.value }))}
                  >
                    <option value="">— Select —</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="label text-[10px] font-bold text-gray-500">PAN Number</label>
                  <input
                    type="text"
                    className="input w-full p-1 uppercase"
                    maxLength={10}
                    value={fields.panNumber}
                    onChange={e => setFields(prev => ({ ...prev, panNumber: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="label text-[10px] font-bold text-gray-500">Aadhaar Number *</label>
                  <input
                    type="text"
                    className={`input w-full p-1 ${
                      fields.aadhaarNumber && !/^\d{12}$/.test(fields.aadhaarNumber)
                        ? 'border-red-400'
                        : ''
                    }`}
                    placeholder="XXXX XXXX XXXX"
                    maxLength={12}
                    value={fields.aadhaarNumber}
                    onChange={e => setFields(prev => ({ ...prev, aadhaarNumber: e.target.value.replace(/\D/g, '') }))}
                  />
                  {!fields.aadhaarNumber && (
                    <p className="text-red-500 text-[10px] font-semibold mt-0.5">Required</p>
                  )}
                  {fields.aadhaarNumber && !/^\d{12}$/.test(fields.aadhaarNumber) && (
                    <p className="text-red-500 text-[10px] font-semibold mt-0.5">Must be exactly 12 digits</p>
                  )}
                </div>

                <div>
                  <label className="label text-[10px] font-bold text-gray-500">Annual Income (₹)</label>
                  <input
                    type="number"
                    className="input w-full p-1"
                    value={fields.annualIncome}
                    onChange={e => setFields(prev => ({ ...prev, annualIncome: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="label text-[10px] font-bold text-gray-500">Notes / Medical History Details</label>
                  <textarea
                    className="input w-full p-1"
                    rows={2}
                    value={fields.notes}
                    onChange={e => setFields(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <span className="label text-[10px] font-bold text-gray-500 block">Medical Conditions</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {['Diabetes', 'Hypertension', 'Asthma', 'Heart Condition', 'Thyroid'].map((cond) => {
                      const has = selectedMedHistory.includes(cond);
                      return (
                        <label key={cond} className="inline-flex flex-wrap items-center gap-1 bg-slate-50 border border-slate-200 px-2 py-1 rounded-md text-[10px] font-semibold cursor-pointer select-none">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            checked={has}
                            onChange={() => {
                              setSelectedMedHistory(prev =>
                                has ? prev.filter(x => x !== cond) : [...prev, cond]
                              );
                            }}
                          />
                          <span>{cond}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {c.phone && (
                  <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                    <Phone size={14} className="text-gray-400" />
                    <span>{c.phone}</span>
                  </div>
                )}
                {c.alternatePhone && (
                  <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                    <Phone size={14} className="text-gray-400" />
                    <span>{c.alternatePhone} <span className="text-xs text-gray-400">(alt)</span></span>
                  </div>
                )}
                {c.email && (
                  <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                    <Mail size={14} className="text-gray-400" />
                    <span>{c.email}</span>
                  </div>
                )}
                {c.dateOfBirth && (
                  <div className="text-sm text-gray-600">
                    <span className="text-gray-400">DOB: </span>
                    {format(new Date(c.dateOfBirth), 'dd/MMM/yyyy')}
                  </div>
                )}
                {c.gender && <div className="text-sm text-gray-600"><span className="text-gray-400">Gender: </span>{c.gender}</div>}
                {c.panNumber && <div className="text-sm text-gray-600"><span className="text-gray-400">PAN: </span>{c.panNumber}</div>}
                {c.aadhaarNumber && <div className="text-sm text-gray-600"><span className="text-gray-400">Aadhaar: </span>{c.aadhaarNumber}</div>}
                {c.annualIncome != null && (
                  <div className="text-sm text-gray-600">
                    <span className="text-gray-400">Annual Income: </span>₹{Number(c.annualIncome).toLocaleString('en-IN')}
                  </div>
                )}
                {c.notes && (
                  <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-2">
                    <span className="text-gray-400 text-xs">Notes: </span>{c.notes}
                  </div>
                )}

                {/* Medical History Tags Display */}
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Medical History</span>
                  {(() => {
                    const medTags = (c.tags || [])
                      .filter((t: string) => t.startsWith('med:'))
                      .map((t: string) => t.replace('med:', ''));
                    if (medTags.length === 0) return <p className="text-xs text-gray-400">No medical history reported</p>;
                    return (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {medTags.map((tag: string) => (
                          <span key={tag} className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-100 rounded-full text-[10px] font-bold uppercase tracking-wide">
                            {tag}
                          </span>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>

          {/* Addresses Card */}
          <div className="card space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700 flex flex-wrap items-center gap-1.5"><MapPin size={14} />Addresses</h3>
              <button onClick={() => setAddrModal(true)} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-primary-600"><Plus size={14} /></button>
            </div>
            {(c.addresses ?? []).length === 0 && <p className="text-xs text-gray-400">No addresses added</p>}
            {(c.addresses ?? []).map((a: any) => (
              <div key={a.id} className="text-sm text-gray-600 bg-gray-50 rounded-lg p-2 relative group">
                <span className="text-xs font-semibold text-primary-600 uppercase">{a.type}</span>
                <p>{a.line1}{a.line2 ? `, ${a.line2}` : ''}</p>
                <p>{a.city}, {a.state} – {a.pincode}</p>
                <button onClick={() => removeAddress.mutate(a.id)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-red-400">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>

          {/* Occupation Card */}
          <div className="card space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700 flex flex-wrap items-center gap-1.5"><Briefcase size={14} />Occupations</h3>
              <button onClick={() => setOccModal(true)} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-primary-600"><Plus size={14} /></button>
            </div>
            {(c.occupations ?? []).length === 0 && <p className="text-xs text-gray-400">No occupation added</p>}
            {(c.occupations ?? []).map((o: any) => (
              <div key={o.id} className="text-sm text-gray-600 bg-gray-50 rounded-lg p-2 relative group">
                {o.designation && <p className="font-medium">{o.designation}</p>}
                {o.company && <p className="text-gray-500">{o.company}</p>}
                {o.industry && <p className="text-xs text-gray-400">{o.industry}</p>}
                {o.annualIncome != null && <p className="text-xs text-gray-400">Income: ₹{Number(o.annualIncome).toLocaleString('en-IN')}</p>}
                <button onClick={() => removeOccupation.mutate(o.id)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-red-400">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>

          {/* Relationships Card */}
          <div className="card space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700 flex flex-wrap items-center gap-1.5"><Users size={14} />Relationships</h3>
              <button onClick={() => setRelModal(true)} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-primary-600"><Plus size={14} /></button>
            </div>
            {(c.relationships ?? []).length === 0 && <p className="text-xs text-gray-400">No relationships added</p>}
            {(c.relationships ?? []).map((r: any) => (
              <div key={r.id} className="text-sm text-gray-600 bg-gray-50 rounded-lg p-2 relative group flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-primary-600 uppercase">{r.relationshipType}</span>
                  <p className="font-medium">{r.relatedContact ? `${r.relatedContact.firstName} ${r.relatedContact.lastName}` : r.name}</p>
                  {r.phone && <p className="text-xs text-gray-400">{r.phone}</p>}
                </div>
                <button onClick={() => removeRelationship.mutate(r.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-red-400">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Right column - Policies, Claims, Leads */}
        <div className="lg:col-span-2 space-y-4">
          {/* Policies */}
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700 flex flex-wrap items-center gap-1.5"><Shield size={14} />Policies</h3>
              <Link to="/policies" className="text-xs text-primary-600 hover:underline">+ New Policy</Link>
            </div>
            {(policies?.data ?? []).length === 0 && <p className="text-sm text-gray-400">No policies for this contact.</p>}
            <div className="space-y-2">
              {(policies?.data ?? []).map((p: any) => (
                <Link key={p.id} to={`/policies/${p.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-primary-200 hover:bg-primary-50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.policyNumber}</p>
                    <p className="text-xs text-gray-400">{p.plan?.name} · {p.plan?.company?.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">₹{Number(p.premiumAmount).toLocaleString('en-IN')}</p>
                    <span className={`text-xs ${STATUS_BADGE[p.status] ?? 'badge-gray'}`}>{p.status}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Claims */}
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700 flex flex-wrap items-center gap-1.5"><FileText size={14} />Claims</h3>
              <Link to="/claims" className="text-xs text-primary-600 hover:underline">+ New Claim</Link>
            </div>
            {(claims?.data ?? []).length === 0 && <p className="text-sm text-gray-400">No claims for this contact.</p>}
            <div className="space-y-2">
              {(claims?.data ?? []).map((cl: any) => (
                <Link key={cl.id} to={`/claims/${cl.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-primary-200 hover:bg-primary-50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{cl.claimNumber}</p>
                    <p className="text-xs text-gray-400">{cl.claimType} · {cl.policy?.policyNumber}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">₹{Number(cl.claimAmount).toLocaleString('en-IN')}</p>
                    <span className={`text-xs ${STATUS_BADGE[cl.status] ?? 'badge-gray'}`}>{cl.status}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Leads */}
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700 flex flex-wrap items-center gap-1.5"><TrendingUp size={14} />Leads</h3>
            </div>
            {(leads?.data ?? []).length === 0 && <p className="text-sm text-gray-400">No leads for this contact.</p>}
            <div className="space-y-2">
              {(leads?.data ?? []).map((l: any) => (
                <Link key={l.id} to={`/leads/${l.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-primary-200 hover:bg-primary-50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{l.plan?.name ?? 'General Lead'}</p>
                    <p className="text-xs text-gray-400">{l.stage}</p>
                  </div>
                  {l.premiumBudget && (
                    <p className="text-sm text-gray-600">Budget: ₹{Number(l.premiumBudget).toLocaleString('en-IN')}</p>
                  )}
                </Link>
              ))}
            </div>
          </div>

          {/* Activity & Update History Card */}
          <div className="card space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 flex flex-wrap items-center gap-1.5">
              <FileText size={14} /> Activity & Update History
            </h3>
            {(!activityRes?.data || activityRes.data.length === 0) && (
              <p className="text-sm text-gray-400">No activity logged for this contact.</p>
            )}
            <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar pr-1">
              {(activityRes?.data ?? []).map((log: any) => (
                <div key={log.id} className="p-3 bg-gray-50 border border-gray-150 rounded-lg text-xs space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-gray-400">
                    <span className="font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                      {log.action}
                    </span>
                    <span>{format(new Date(log.createdAt), 'dd/MMM/yyyy HH:mm')}</span>
                  </div>
                  <p className="text-gray-700 font-semibold">{log.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Add Address Modal */}
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

      {/* Add Occupation Modal */}
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
                <span className="text-sm">{selectedRelContact.firstName} {selectedRelContact.lastName}</span>
                <button type="button" className="text-[10px] sm:text-xs text-red-500" onClick={() => { setSelectedRelContact(null); relForm.setValue('relatedContactId', ''); }}>Remove</button>
              </div>
            ) : (
              <div className="relative">
                <input className="input w-full" placeholder="Search contact by name…" value={relSearch}
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
                      }} className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer">
                        {rc.firstName} {rc.lastName} <span className="text-gray-400 text-xs">{rc.phone}</span>
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
}
