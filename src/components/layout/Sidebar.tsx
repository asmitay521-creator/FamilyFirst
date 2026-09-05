import { NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard, Users, TrendingUp, Shield, FileText,
  UserCheck, IndianRupee, MessageSquare, Calendar,
  CreditCard, Building2, Lock, Briefcase, Zap, Trash2, Presentation
} from 'lucide-react';
import { useState } from 'react';
import { subscriptionsService } from '@api/index';
import { useAuthStore } from '@store/auth.store';
import UpgradePromptModal from './UpgradePromptModal';
import clsx from 'clsx';

const NAV: { to: string; label: string; Icon: React.ElementType; roles?: string[]; feature?: string }[] = [
  { to: '/dashboard',    label: 'Dashboard',    Icon: LayoutDashboard, roles: ['OWNER', 'SUPERADMIN'], feature: 'dashboard' },
  { to: '/workspace',    label: 'Workspace',    Icon: Briefcase,       roles: ['EMPLOYEE', 'OWNER', 'SUPERADMIN'], feature: 'workspace' },
  { to: '/contacts',     label: 'Contacts',     Icon: Users,           feature: 'contacts' },
  { to: '/customers',    label: 'Customer',     Icon: UserCheck,       feature: 'contacts' },
  { to: '/leads',        label: 'Leads',        Icon: TrendingUp,      feature: 'leads' },
  { to: '/policies',     label: 'Policies',     Icon: Shield,          feature: 'policies' },
  { to: '/claims',       label: 'Claims',       Icon: FileText,        feature: 'claims' },
  { to: '/calendar',     label: 'Calendar',     Icon: Calendar,        feature: 'calendar' },
  { to: '/employees',    label: 'Employees',    Icon: UserCheck,       roles: ['OWNER', 'SUPERADMIN'], feature: 'employees' },
  { to: '/seminars',     label: 'Seminars',     Icon: Presentation,    feature: 'leads' },
];

interface NavItemProps {
  item: typeof NAV[0];
  isFeatureEnabled: (feature?: string) => boolean;
  setLockedFeature: (label: string) => void;
}

function NavItem({ item, isFeatureEnabled, setLockedFeature }: NavItemProps) {
  const { to, label, Icon, feature } = item;
  const enabled = isFeatureEnabled(feature);

  return (
    <NavLink
      key={to}
      to={to}
      title={label}
      onClick={(e) => { 
        if (!enabled) { 
          e.preventDefault(); 
          setLockedFeature(label); 
        }
      }}
      className={({ isActive }) =>
        clsx(
          'flex items-center justify-center sm:justify-start rounded-xl font-extrabold transition-all duration-200 relative group select-none gap-0 sm:gap-3.5 px-1 sm:px-3 py-2 text-[13px] hover:translate-x-0.5 my-0.5',
          isActive && enabled
            ? 'text-white shadow-lg scale-[1.02]'
            : 'text-[#F0EAFF]/80 hover:bg-white/[0.08] hover:text-white',
          !enabled && 'opacity-35 cursor-not-allowed',
        )
      }
      style={({ isActive }) => (isActive && enabled ? {
        background: 'linear-gradient(135deg, #5B2BA8 0%, #743BC4 100%)',
        boxShadow: '0 6px 16px rgba(91, 43, 168, 0.4)'
      } : {})}
    >
      {({ isActive }) => (
        <>
          <div className={clsx(
            "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200",
            isActive && enabled
              ? "bg-white/20 text-white shadow-sm"
              : "bg-white/[0.08] text-[#F0EAFF] group-hover:bg-white/[0.15] group-hover:text-white"
          )}>
            <Icon size={16} className="transition-transform duration-200 group-hover:scale-110" strokeWidth={2.25} />
          </div>
          <span className="hidden sm:inline-block flex-1 truncate leading-none ml-1">{label}</span>
          {!enabled && (
            <Lock size={11} className="hidden sm:inline-block text-[#F0EAFF]/50 shrink-0" />
          )}
        </>
      )}
    </NavLink>
  );
}

export default function Sidebar({ mobileOpen, setMobileOpen }: { mobileOpen?: boolean; setMobileOpen?: (v: boolean) => void }) {
  const [lockedFeature, setLockedFeature] = useState<string | null>(null);
  const user                              = useAuthStore(s => s.user);

  const isFeatureEnabled = (_feature?: string) => {
    return true;
  };

  const visibleByRole = (item: typeof NAV[0]) => {
    if (user?.role === 'OWNER' || user?.role === 'SUPERADMIN') return true;
    if (user?.role === 'EMPLOYEE') {
      const perms: string[] = (user as any)?.permissions || [];
      const modKey = item.to.replace('/', '').replace('-', '_');
      const hasPerm = perms.some((p: string) => p.includes(modKey));
      if (hasPerm) return true;
    }
    return !item.roles || item.roles.includes(user?.role ?? '');
  };

  const visibleItems = NAV.filter(i => visibleByRole(i));

  return (
    <aside
      className={clsx(
        'flex flex-col h-screen w-14 sm:w-64 shrink-0 select-none border-r border-[#E9E7F2]/10 z-30 sticky top-0 left-0 transition-all duration-300'
      )}
      style={{
        background: 'linear-gradient(180deg, #17143F 0%, #1E1850 50%, #24165A 100%)'
      }}
    >
      {/* ── Logo ─────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-center sm:justify-start shrink-0 px-2 sm:px-4 py-3 group relative gap-3 border-b border-white/10"
      >
        <img 
          src="/FamilyFirstLogo.png" 
          alt="Family First" 
          className="h-8 sm:h-9 w-auto object-contain cursor-pointer" 
        />
        <div className="hidden sm:flex flex-col leading-none min-w-0">
          <span className="font-extrabold text-[13px] text-white tracking-tight">
            Family First
          </span>
          <span className="text-[8.5px] font-extrabold tracking-[0.2em] uppercase mt-[5.5px] text-[#7C4DFF]">
            CRM Portal
          </span>
        </div>
      </div>

      {/* ── Navigation (Single Continuous List) ──────────────────────────── */}
      <nav className="flex-1 overflow-y-auto pt-2 pb-2 space-y-0.5 custom-scrollbar px-1.5 sm:px-3 relative">
        {visibleItems.map((item) => (
          <NavItem
            key={item.to}
            item={item}
            isFeatureEnabled={isFeatureEnabled}
            setLockedFeature={setLockedFeature}
          />
        ))}
      </nav>

      <UpgradePromptModal
        isOpen={!!lockedFeature}
        onClose={() => setLockedFeature(null)}
        featureName={lockedFeature || ''}
      />
    </aside>
  );
}
