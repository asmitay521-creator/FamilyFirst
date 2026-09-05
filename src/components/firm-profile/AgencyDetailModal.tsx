import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Modal from '../common/Modal';
import { Save, RefreshCw } from 'lucide-react';

const schema = z.object({
  brokerName:           z.string().min(1, 'Broker name is required'),
  brokerCode:           z.string().optional(),
  subBrokerCode:        z.string().optional(),
  insuranceCompany:     z.string().optional(),
  homeBranchName:       z.string().optional(),
  homeBranchCode:       z.string().optional(),
  agentName:            z.string().optional(),
  agentCode:            z.string().optional(),
  bankAccountNo:        z.string().optional(),
  bankIfsc:             z.string().optional(),
  bankBranch:           z.string().optional(),
  email:                z.string().email('Invalid email').optional().or(z.literal('')),
  phone:                z.string().optional(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: FormData) => void;
  isSaving: boolean;
  initialData?: any;
}

export default function AgencyDetailModal({ open, onClose, onSave, isSaving, initialData }: Props) {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: initialData || {},
  });

  useEffect(() => {
    if (open) {
      if (initialData) form.reset(initialData);
      else form.reset({});
    }
  }, [open, initialData, form]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialData ? "Edit Agency Detail" : "Add Agency Detail"}
      size="2xl"
      actions={
        <button
          type="button"
          onClick={form.handleSubmit(onSave)}
          disabled={isSaving}
          className="btn-primary"
        >
          {isSaving ? <><RefreshCw size={14} className="animate-spin" /> Saving...</> : <><Save size={14} /> Save</>}
        </button>
      }
    >
      <form className="space-y-4 py-2" onSubmit={e => e.preventDefault()}>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <label className="label">Broker Name *</label>
            <input {...form.register('brokerName')} className="input" placeholder="e.g. Sharma Insurance" />
            {form.formState.errors.brokerName && <p className="text-xs text-red-500 mt-1">{form.formState.errors.brokerName.message}</p>}
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="label">Insurance Company</label>
            <input {...form.register('insuranceCompany')} className="input" placeholder="e.g. LIC" />
          </div>

          <div>
            <label className="label">Broker Code</label>
            <input {...form.register('brokerCode')} className="input" placeholder="BRK001" />
          </div>
          <div>
            <label className="label">Sub Broker Code</label>
            <input {...form.register('subBrokerCode')} className="input" placeholder="SUB001" />
          </div>

          <div>
            <label className="label">Agent Name</label>
            <input {...form.register('agentName')} className="input" placeholder="John Doe" />
          </div>
          <div>
            <label className="label">Agent Code</label>
            <input {...form.register('agentCode')} className="input" placeholder="AGT123" />
          </div>

          <div>
            <label className="label">Home Branch Name</label>
            <input {...form.register('homeBranchName')} className="input" placeholder="Mumbai Central" />
          </div>
          <div>
            <label className="label">Home Branch Code</label>
            <input {...form.register('homeBranchCode')} className="input" placeholder="MUM01" />
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4 mt-2">
          <h4 className="text-sm font-semibold text-gray-800 mb-3">Financial Details</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Bank Account No.</label>
              <input {...form.register('bankAccountNo')} className="input" placeholder="1234567890" />
            </div>
            <div>
              <label className="label">IFSC Code</label>
              <input {...form.register('bankIfsc')} className="input uppercase" placeholder="SBIN0001234" />
            </div>
            <div>
              <label className="label">Bank Branch</label>
              <input {...form.register('bankBranch')} className="input" placeholder="Main Branch" />
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4 mt-2">
          <h4 className="text-sm font-semibold text-gray-800 mb-3">Contact Details</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Registered Email</label>
              <input {...form.register('email')} className="input" placeholder="agency@example.com" />
              {form.formState.errors.email && <p className="text-xs text-red-500 mt-1">{form.formState.errors.email.message}</p>}
            </div>
            <div>
              <label className="label">Registered Phone</label>
              <input {...form.register('phone')} className="input" placeholder="+91 9876543210" />
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}
