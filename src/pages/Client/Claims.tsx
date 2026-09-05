import { useQuery } from '@tanstack/react-query';
import { clientService } from '@api/client.service';
import { AlertCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { getClaimNotesData, ClaimDetailView } from '../Claims/index';
import Modal from '@comps/common/Modal';
import { useState } from 'react';

const STATUS_COLOR: Record<string, string> = {
  INTIMATED: 'bg-yellow-100 text-yellow-700',
  DOC_COLLECTION: 'bg-blue-100 text-blue-700',
  FILED:     'bg-blue-100 text-blue-700',
  IN_REVIEW: 'bg-blue-100 text-blue-700',
  APPROVED:  'bg-green-100 text-green-700',
  SETTLED:   'bg-green-100 text-green-700',
  REJECTED:  'bg-red-100 text-red-700',
};

function fmt(d?: string | null) {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd/MMM/yyyy'); } catch { return d; }
}

export default function ClientClaims() {
  const { data, isLoading } = useQuery({
    queryKey: ['client-claims'],
    queryFn:  clientService.getClaims,
  });

  const [selectedClaim, setSelectedClaim] = useState<any | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const claims = data?.data ?? [];

  if (isLoading) return <div className="flex h-48 items-center justify-center text-gray-400">Loading…</div>;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">My Claims</h2>
        <p className="text-sm text-gray-500 mt-0.5">{claims.length} claim{claims.length !== 1 ? 's' : ''} found</p>
      </div>

      {claims.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-gray-100">
          <AlertCircle size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No claims on record.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {claims.map((c: any) => {
            const notesData = getClaimNotesData(c.notes);
            const displayStatus = notesData.statusOverride || c.status;
            return (
              <div
                key={c.id}
                onClick={() => { setSelectedClaim(c); setDetailOpen(true); }}
                className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:border-blue-300 cursor-pointer transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{c.claimNumber}</p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {c.claimType} · Policy {c.policy?.policyNumber ?? '—'}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${STATUS_COLOR[displayStatus] ?? 'bg-gray-100 text-gray-600'}`}>
                    {displayStatus.replace('_', ' ')}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-400">Claim Amount</p>
                    <p className="font-medium text-gray-800">₹{Number(c.claimAmount).toLocaleString('en-IN')}</p>
                  </div>
                  {c.approvedAmount != null && (
                    <div>
                      <p className="text-xs text-gray-400">Approved</p>
                      <p className="font-medium text-green-700">₹{Number(c.approvedAmount).toLocaleString('en-IN')}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-400">Intimated</p>
                    <p className="font-medium text-gray-700">{fmt(c.intimatedAt)}</p>
                  </div>
                  {c.settledAt && (
                    <div>
                      <p className="text-xs text-gray-400">Settled</p>
                      <p className="font-medium text-gray-700">{fmt(c.settledAt)}</p>
                    </div>
                  )}
                </div>

                {c.rejectionReason && (
                  <p className="mt-3 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                    Rejection reason: {c.rejectionReason}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* View-Only Claim Details Modal */}
      <Modal open={detailOpen} onClose={() => { setDetailOpen(false); setSelectedClaim(null); }} title="Claim Details" size="xl">
        {selectedClaim ? (
          <ClaimDetailView claim={selectedClaim} />
        ) : null}
      </Modal>
    </div>
  );
}
