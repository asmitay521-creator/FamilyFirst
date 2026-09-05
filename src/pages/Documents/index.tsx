import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsService } from '@api/index';
import { Upload, FileText, Trash2, Search, Eye, X } from 'lucide-react';
import Modal from '@comps/common/Modal';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useAuthStore } from '@store/auth.store';
import { deletionRequestsService } from '@api/deletionRequestsService';

const TAG_OPTIONS = ['POLICY', 'PREMIUM_RECEIPT', 'CLAIM', 'DISCHARGE_VOUCHER', 'MEDICAL_REPORT', 'ID_PROOF', 'KYC', 'OTHER'];

const TAG_BADGE: Record<string, string> = {
  POLICY: 'badge-blue', PREMIUM_RECEIPT: 'badge-green', CLAIM: 'badge-yellow',
  DISCHARGE_VOUCHER: 'badge-yellow', MEDICAL_REPORT: 'badge-blue', ID_PROOF: 'badge-gray',
  KYC: 'badge-gray', OTHER: 'badge-gray',
};

export default function Documents() {
  const qc = useQueryClient();
  const { user: authUser } = useAuthStore();
  const [search, setSearch]         = useState('');
  const [tagFilter, setTagFilter]   = useState('');
  const [uploadModal, setUploadModal] = useState(false);
  const [uploadFile, setUploadFile]  = useState<File | null>(null);
  const [uploadTag, setUploadTag]    = useState('POLICY');
  const [uploading, setUploading]    = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['documents', tagFilter, search],
    queryFn: () => documentsService.list({ tag: tagFilter || undefined, search: search || undefined }),
  });

  const removeDoc = useMutation({
    mutationFn: (id: string) => documentsService.remove(id),
    onSuccess: () => { refetch(); setDeleteTarget(null); toast.success('Document removed'); },
    onError: () => toast.error('Failed to remove document'),
  });

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    try {
      await documentsService.upload(uploadFile, { tag: uploadTag });
      refetch();
      setUploadModal(false);
      setUploadFile(null);
      setUploadTag('POLICY');
      toast.success('Document uploaded');
    } catch {
      toast.error('Upload failed. Please check file size and format.');
    } finally {
      setUploading(false);
    }
  };

  const viewDoc = async (doc: any) => {
    try {
      const res = await documentsService.url(doc.id);
      window.open(res.url, '_blank');
    } catch {
      toast.error('Could not load document URL');
    }
  };

  const docs: any[] = data?.data ?? data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Documents</h2>
        <button className="btn-primary" onClick={() => setUploadModal(true)}>
          <Upload size={16} /> Upload Document
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-8 w-56"
            placeholder="Search documents…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="input w-40" value={tagFilter} onChange={e => setTagFilter(e.target.value)}>
          <option value="">All Types</option>
          {TAG_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Documents grid */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card h-24 animate-pulse bg-gray-100" />
          ))}
        </div>
      )}

      {!isLoading && docs.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <FileText size={32} className="mx-auto mb-3 text-gray-200" />
          <p>{search || tagFilter ? 'No documents match your filters.' : 'No documents uploaded yet.'}</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {docs.map((doc: any) => (
          <div key={doc.id} className="card group hover:shadow-md transition-shadow">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary-50 shrink-0">
                <FileText size={20} className="text-primary-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate" title={doc.fileName ?? doc.originalName}>
                  {doc.fileName ?? doc.originalName ?? 'Document'}
                </p>
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${TAG_BADGE[doc.tag] ?? 'badge-gray'}`}>
                    {doc.tag}
                  </span>
                  {doc.fileSize && (
                    <span className="text-xs text-gray-400">{(doc.fileSize / 1024).toFixed(0)} KB</span>
                  )}
                </div>
                {doc.createdAt && (
                  <p className="text-xs text-gray-400 mt-0.5">{format(new Date(doc.createdAt), 'dd/MMM/yyyy')}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
              <button
                onClick={() => viewDoc(doc)}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 py-1.5 rounded-lg hover:bg-primary-50 transition-colors">
                <Eye size={13}/> View
              </button>
              <button
                onClick={() => setDeleteTarget(doc)}
                className="flex items-center justify-center gap-1.5 text-xs text-red-500 hover:text-red-600 py-1.5 px-3 rounded-lg hover:bg-red-50 transition-colors">
                <Trash2 size={13}/>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Upload Modal */}
      <Modal open={uploadModal} onClose={() => { setUploadModal(false); setUploadFile(null); setUploadTag('POLICY'); }} title="Upload Document">
        <div className="space-y-4">
          <div>
            <label className="label">Document Type</label>
            <select className="input" value={uploadTag} onChange={e => setUploadTag(e.target.value)}>
              {TAG_OPTIONS.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Select File</label>
            <div
              className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-primary-300 transition-colors cursor-pointer"
              onClick={() => document.getElementById('doc-file-input')?.click()}>
              {uploadFile ? (
                <div className="flex flex-wrap items-center gap-2 justify-center">
                  <FileText size={18} className="text-primary-500"/>
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-900">{uploadFile.name}</p>
                    <p className="text-xs text-gray-400">{(uploadFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button type="button" onClick={e => { e.stopPropagation(); setUploadFile(null); }}
                    className="ml-2 text-red-400 hover:text-red-600">
                    <X size={14}/>
                  </button>
                </div>
              ) : (
                <>
                  <Upload size={24} className="mx-auto text-gray-300 mb-2"/>
                  <p className="text-sm text-gray-500">Click to select or drag a file here</p>
                  <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG up to 10MB</p>
                </>
              )}
              <input
                id="doc-file-input"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={e => setUploadFile(e.target.files?.[0] ?? null)} />
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button className="btn-secondary" onClick={() => { setUploadModal(false); setUploadFile(null); setUploadTag('POLICY'); }}>Cancel</button>
            <button className="btn-primary" disabled={!uploadFile || uploading} onClick={handleUpload}>
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Document" size="sm">
        <p className="text-sm text-gray-600 mb-4">
          Delete <strong>{deleteTarget?.fileName ?? deleteTarget?.originalName ?? 'this document'}</strong>? This cannot be undone.
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
          <button className="btn-danger" disabled={removeDoc.isPending} onClick={async () => {
            const isAdmin = authUser?.role === 'SUPERADMIN' || authUser?.role === 'OWNER';
            if (isAdmin) {
              removeDoc.mutate(deleteTarget!.id);
            } else {
              const toastId = toast.loading('Submitting delete request to admin...');
              try {
                await deletionRequestsService.requestDeletion('Document', deleteTarget!.id, `Employee requested deletion of document ${deleteTarget?.fileName}`);
                toast.success('Deletion request submitted to admin successfully!', { id: toastId });
              } catch (err: any) {
                toast.error(err.response?.data?.message || 'Failed to submit request', { id: toastId });
              }
              setDeleteTarget(null);
            }
          }}>
            {removeDoc.isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
