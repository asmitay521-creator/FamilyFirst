import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Modal from '../common/Modal';
import { Save, RefreshCw, Image as ImageIcon } from 'lucide-react';

const schema = z.object({
  title:    z.string().min(1, 'Title is required').max(100),
  imageUrl: z.string().url('Must be a valid URL'),
  linkUrl:  z.string().url('Must be a valid URL').optional().or(z.literal('')),
  isActive: z.boolean().default(true),
  order:    z.number().default(0),
});
type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: FormData) => void;
  isSaving: boolean;
  initialData?: any;
}

export default function BannerModal({ open, onClose, onSave, isSaving, initialData }: Props) {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: initialData || { isActive: true, order: 0 },
  });

  const watchedImageUrl = form.watch('imageUrl');

  useEffect(() => {
    if (open) {
      if (initialData) form.reset(initialData);
      else form.reset({ isActive: true, order: 0 });
    }
  }, [open, initialData, form]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialData ? "Edit Banner" : "Add Banner"}
      size="lg"
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
        <div>
          <label className="label">Title *</label>
          <input {...form.register('title')} className="input" placeholder="e.g. Summer Offer" />
          {form.formState.errors.title && <p className="text-xs text-red-500 mt-1">{form.formState.errors.title.message}</p>}
        </div>

        <div>
          <label className="label">Image URL *</label>
          <input {...form.register('imageUrl')} className="input" placeholder="https://example.com/banner.jpg" />
          {form.formState.errors.imageUrl && <p className="text-xs text-red-500 mt-1">{form.formState.errors.imageUrl.message}</p>}
        </div>
        
        {/* Preview */}
        {watchedImageUrl ? (
          <div className="mt-2 rounded-xl overflow-hidden border border-gray-200">
            <img src={watchedImageUrl} alt="Preview" className="w-full h-32 object-cover bg-gray-100" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
          </div>
        ) : (
          <div className="mt-2 h-32 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400">
            <ImageIcon size={24} className="mb-2 opacity-50" />
            <span className="text-xs">Image Preview</span>
          </div>
        )}

        <div>
          <label className="label">Link URL (Optional)</label>
          <input {...form.register('linkUrl')} className="input" placeholder="https://example.com/landing-page" />
          <p className="text-[10px] text-gray-400 mt-1">Where should the user go when they click this banner?</p>
          {form.formState.errors.linkUrl && <p className="text-xs text-red-500 mt-1">{form.formState.errors.linkUrl.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Display Order</label>
            <input type="number" {...form.register('order', { valueAsNumber: true })} className="input" placeholder="0" />
            <p className="text-[10px] text-gray-400 mt-1">Lower numbers appear first</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-7">
            <input type="checkbox" {...form.register('isActive')} id="isActive" className="w-4 h-4 text-primary-600 rounded border-gray-300" />
            <label htmlFor="isActive" className="text-sm font-medium text-gray-700 cursor-pointer">Active</label>
          </div>
        </div>
      </form>
    </Modal>
  );
}
