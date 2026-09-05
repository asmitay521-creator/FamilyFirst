import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { clientService } from '@api/client.service';
import { User, Phone, Mail, FileText, Building } from 'lucide-react';
import toast from 'react-hot-toast';

const schema = z.object({
  phone: z.string().optional(),
  email: z.string().email('Valid email required').optional().or(z.literal('')),
  notes: z.string().optional(),
});
type Form = z.infer<typeof schema>;

export default function ClientProfile() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['client-me'],
    queryFn:  clientService.getMe,
  });

  const profile = data?.data;

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
    values: { phone: profile?.phone ?? '', email: profile?.email ?? '', notes: profile?.notes ?? '' },
  });

  const update = useMutation({
    mutationFn: (body: Form) => clientService.updateProfile(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-me'] });
      setEditing(false);
      toast.success('Profile updated');
    },
    onError: () => toast.error('Failed to update profile'),
  });

  if (isLoading) return <div className="flex h-48 items-center justify-center text-gray-400">Loading…</div>;
  if (!profile)  return <div className="text-gray-500 p-8">Profile not found.</div>;

  const agency = profile.tenant;

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-xl font-bold text-gray-900">My Profile</h2>

      {/* Profile card */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center">
            <User className="text-primary-600" size={28} />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">{profile.firstName} {profile.lastName}</p>
            <p className="text-sm text-gray-500">{profile.gender ?? ''}</p>
          </div>
        </div>

        {editing ? (
          <form onSubmit={handleSubmit(d => update.mutate(d))} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input {...register('phone')} className="input w-full" />
              {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input {...register('email')} className="input w-full" type="email" />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea {...register('notes')} rows={3} className="input w-full" />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={isSubmitting} className="btn-primary text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 disabled:opacity-60">
                Save changes
              </button>
              <button type="button" onClick={() => { setEditing(false); reset(); }} className="btn-secondary text-sm px-4 py-2">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="flex flex-wrap items-center gap-2 text-gray-700">
                <Phone size={15} className="text-gray-400" />
                <span>{profile.phone ?? '—'}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-gray-700">
                <Mail size={15} className="text-gray-400" />
                <span>{profile.email ?? '—'}</span>
              </div>
              {profile.panNumber && (
                <div className="flex flex-wrap items-center gap-2 text-gray-700">
                  <FileText size={15} className="text-gray-400" />
                  <span>PAN: {profile.panNumber}</span>
                </div>
              )}
              {profile.annualIncome && (
                <div className="flex flex-wrap items-center gap-2 text-gray-700">
                  <FileText size={15} className="text-gray-400" />
                  <span>Income: ₹{Number(profile.annualIncome).toLocaleString('en-IN')}</span>
                </div>
              )}
            </div>
            {profile.notes && (
              <p className="mt-4 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{profile.notes}</p>
            )}
            <button
              onClick={() => setEditing(true)}
              className="mt-5 btn-secondary text-sm px-4 py-2"
            >
              Edit contact info
            </button>
          </>
        )}
      </div>

      {/* Agency info */}
      {agency && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-semibold text-gray-800 mb-4 flex flex-wrap items-center gap-2">
            <Building size={16} className="text-primary-500" />
            Your Agency
          </h3>
          <div className="space-y-2 text-sm text-gray-700">
            <p className="font-medium text-gray-900">{agency.name}</p>
            {agency.phone   && <p className="flex flex-wrap items-center gap-2"><Phone size={13} className="text-gray-400" /> {agency.phone}</p>}
            {agency.email   && <p className="flex flex-wrap items-center gap-2"><Mail  size={13} className="text-gray-400" />{agency.email}</p>}
            {agency.website && <p className="text-primary-600 text-xs">{agency.website}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
