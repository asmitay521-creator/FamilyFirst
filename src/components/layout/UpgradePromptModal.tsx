import { useAuthStore } from '@store/auth.store';
import { useNavigate } from 'react-router-dom';
import { X, Sparkles, ShieldCheck } from 'lucide-react';

interface UpgradePromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName: string;
}

export default function UpgradePromptModal({ isOpen, onClose, featureName }: UpgradePromptModalProps) {
  const user = useAuthStore(s => s.user);
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleUpgradeClick = () => {
    onClose();
    if (user?.role === 'OWNER') {
      navigate('/subscription');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
        
        {/* Decorative Top Accent */}
        <div className="h-2 bg-gradient-to-r from-primary-600 via-purple-500 to-indigo-600" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Content */}
        <div className="p-6 text-center">
          <div className="inline-flex items-center justify-center bg-primary-50 text-primary-600 p-4 rounded-full mb-4 ring-8 ring-primary-50">
            <Sparkles className="w-8 h-8" />
          </div>

          <h3 className="text-xl font-bold text-gray-950 mb-2">
            Unlock {featureName}
          </h3>
          
          <p className="text-sm text-gray-600 mb-6 px-2">
            The <span className="font-semibold text-gray-800">{featureName}</span> feature is not available on your current subscription plan.
            {user?.role === 'OWNER' 
              ? ' Upgrade your plan today to unlock premium features and scale your agency.'
              : ' Please contact your agency administrator or Owner to upgrade the account plan.'
            }
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={onClose}
              className="btn-secondary w-full sm:w-auto px-3 sm:px-5 py-1.5 sm:py-2.5 rounded-xl justify-center font-medium cursor-pointer"
            >
              Maybe Later
            </button>
            {user?.role === 'OWNER' ? (
              <button
                onClick={handleUpgradeClick}
                className="btn-primary w-full sm:w-auto px-3 sm:px-5 py-1.5 sm:py-2.5 rounded-xl justify-center font-semibold bg-gradient-to-r from-primary-700 to-primary-600 hover:from-primary-800 hover:to-primary-750 text-white cursor-pointer flex flex-wrap items-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4" /> Upgrade Plan
              </button>
            ) : (
              <button
                onClick={onClose}
                className="btn-primary w-full sm:w-auto px-3 sm:px-5 py-1.5 sm:py-2.5 rounded-xl justify-center font-semibold bg-primary-700 hover:bg-primary-800 text-white cursor-pointer"
              >
                Got It
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
