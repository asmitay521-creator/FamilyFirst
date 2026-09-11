import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, TrendingUp, Shield, FileText,
  UserCheck, Calendar, Briefcase, Lock, Presentation,
  Sliders, MessageSquare, ChevronDown, X
} from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '@store/auth.store';
import UpgradePromptModal from './UpgradePromptModal';
import clsx from 'clsx';

interface SubNavItem {
  to: string;
  label: string;
  Icon: React.ElementType;
}

interface NavItemConfig {
  to: string;
  label: string;
  Icon: React.ElementType;
  roles?: string[];
  feature?: string;
  children?: SubNavItem[];
}

const NAV: NavItemConfig[] = [
  { to: '/dashboard',    label: 'Dashboard',    Icon: LayoutDashboard, roles: ['OWNER', 'SUPERADMIN'], feature: 'dashboard' },
  { to: '/workspace',    label: 'Workspace',    Icon: Briefcase,       roles: ['EMPLOYEE', 'OWNER', 'SUPERADMIN'], feature: 'workspace' },
  { to: '/contacts',     label: 'Contacts',     Icon: Users,           roles: ['EMPLOYEE', 'OWNER', 'SUPERADMIN'], feature: 'contacts' },
  { to: '/customers',    label: 'Customer',     Icon: UserCheck,       roles: ['EMPLOYEE', 'OWNER', 'SUPERADMIN'], feature: 'contacts' },
  { to: '/leads',        label: 'Leads',        Icon: TrendingUp,      roles: ['EMPLOYEE', 'OWNER', 'SUPERADMIN'], feature: 'leads' },
  { to: '/policies',     label: 'Policies',     Icon: Shield,          roles: ['EMPLOYEE', 'OWNER', 'SUPERADMIN'], feature: 'policies' },
  { to: '/claims',       label: 'Claims',       Icon: FileText,        roles: ['EMPLOYEE', 'OWNER', 'SUPERADMIN'], feature: 'claims' },
  { to: '/calendar',     label: 'Calendar',     Icon: Calendar,        roles: ['EMPLOYEE', 'OWNER', 'SUPERADMIN'], feature: 'calendar' },
  { to: '/employees',    label: 'Employees',    Icon: UserCheck,       roles: ['OWNER', 'SUPERADMIN'], feature: 'employees' },
  { to: '/seminars',     label: 'Seminars',     Icon: Presentation,    roles: ['OWNER', 'SUPERADMIN'], feature: 'leads' },
  {
    to: '/management',
    label: 'Management',
    Icon: Sliders,
    roles: ['EMPLOYEE', 'OWNER', 'SUPERADMIN'],
    feature: 'management',
    children: [
      { to: '/management/leads',    label: 'WhatsApp Msg for Leads',    Icon: MessageSquare },
      { to: '/management/seminars', label: 'WhatsApp Msg for Seminars', Icon: Presentation },
    ]
  },
];

interface NavItemProps {
  item: NavItemConfig;
  isFeatureEnabled: (feature?: string) => boolean;
  setLockedFeature: (label: string) => void;
  mobileOpen?: boolean;
  onNavClick?: () => void;
}

function NavItem({ item, isFeatureEnabled, setLockedFeature, mobileOpen, onNavClick }: NavItemProps) {
  const { to, label, Icon, feature, children } = item;
  const location = useLocation();
  const user = useAuthStore(s => s.user);
  const enabled = isFeatureEnabled(feature);
  
  const isChildActive = children?.some(c => location.pathname === c.to || location.pathname.startsWith(c.to));
  const isParentActive = location.pathname === to || isChildActive;
  
  // Management dropdown open state (default open if active)
  const [isOpen, setIsOpen] = useState(isChildActive);

  if (children && children.length > 0) {
    return (
      <div className="space-y-0.5">
        {/* Parent Management Item */}
        <div
          onClick={() => {
            if (!enabled) {
              setLockedFeature(label);
              return;
            }
            setIsOpen(!isOpen);
          }}
          className={clsx(
            'flex items-center justify-center lg:justify-between rounded-xl font-extrabold transition-all duration-200 relative group select-none gap-0 lg:gap-2 px-1 lg:px-3 py-2 text-[13px] cursor-pointer my-0.5',
            mobileOpen && 'justify-between px-3 gap-2',
            isParentActive && enabled
              ? 'text-white bg-white/[0.12]'
              : 'text-[#F0EAFF]/80 hover:bg-white/[0.08] hover:text-white',
            !enabled && 'opacity-35 cursor-not-allowed',
          )}
        >
          <div className="flex items-center gap-0 lg:gap-3.5">
            <div className={clsx(
              "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200",
              isParentActive && enabled
                ? "bg-purple-600/80 text-white shadow-sm"
                : "bg-white/[0.08] text-[#F0EAFF] group-hover:bg-white/[0.15] group-hover:text-white"
            )}>
              <Icon size={16} className="transition-transform duration-200 group-hover:scale-110" strokeWidth={2.25} />
            </div>
            <span className={clsx('truncate leading-none ml-1', mobileOpen ? 'inline-block' : 'hidden lg:inline-block')}>{label}</span>
          </div>

          <div className={clsx('items-center gap-1', mobileOpen ? 'flex' : 'hidden lg:flex')}>
            <ChevronDown
              size={14}
              className={clsx('text-[#F0EAFF]/70 transition-transform duration-200', isOpen && 'rotate-180')}
            />
          </div>

          <div className="fixed left-[68px] hidden group-hover:flex lg:group-hover:hidden items-center px-3 py-1.5 bg-[#17143F] text-white text-xs font-bold rounded-xl shadow-2xl border border-white/20 whitespace-nowrap z-[9999] pointer-events-none lg:hidden">
            {label}
          </div>
        </div>

        {/* Sub-items (Directly under Management in Sidebar) */}
        {isOpen && (
          <div className={clsx('space-y-0.5 pt-0.5', mobileOpen ? 'pl-3' : 'pl-0 lg:pl-3')}>
            {children
              .filter(child => !(user?.role === 'EMPLOYEE' && child.to.includes('seminars')))
              .map((child) => {
              const ChildIcon = child.Icon;
              const isCurrent = location.pathname === child.to || location.pathname.startsWith(child.to);

              return (
                <NavLink
                  key={child.to}
                  to={child.to}
                  onClick={() => onNavClick?.()}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center justify-center lg:justify-start rounded-xl font-extrabold transition-all duration-200 relative group select-none gap-0 lg:gap-2.5 px-1 lg:px-2.5 py-1.5 text-[12px] my-0.5',
                      mobileOpen && 'justify-start px-2.5 gap-2.5',
                      (isActive || isCurrent)
                        ? 'text-[#5B2BA8] bg-white font-black shadow-md'
                        : 'text-[#F0EAFF]/70 hover:bg-white/[0.06] hover:text-white',
                    )
                  }
                  style={({ isActive }) => ((isActive || isCurrent) ? {
                    background: '#FFFFFF',
                    boxShadow: '0 4px 12px rgba(255, 255, 255, 0.25)'
                  } : {})}
                >
                  <div className={clsx(
                    "w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200",
                    isCurrent
                      ? "bg-purple-100 text-[#5B2BA8]"
                      : "bg-white/[0.05] text-[#F0EAFF] group-hover:bg-white/[0.1] group-hover:text-white"
                  )}>
                    <ChildIcon size={14} strokeWidth={2.2} />
                  </div>
                  <span className={clsx('truncate leading-tight ml-0.5 text-[13px]', mobileOpen ? 'inline-block' : 'hidden lg:inline-block')}>
                    {child.label}
                  </span>
                  <div className="fixed left-[68px] hidden group-hover:flex lg:group-hover:hidden items-center px-3 py-1.5 bg-[#17143F] text-white text-xs font-bold rounded-xl shadow-2xl border border-white/20 whitespace-nowrap z-[9999] pointer-events-none lg:hidden">
                    {child.label}
                  </div>
                </NavLink>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <NavLink
      key={to}
      to={to}
      onClick={(e) => { 
        if (!enabled) { 
          e.preventDefault(); 
          setLockedFeature(label); 
        } else {
          onNavClick?.();
        }
      }}
      className={({ isActive }) =>
        clsx(
          'flex items-center justify-center lg:justify-start rounded-xl font-extrabold transition-all duration-200 relative group select-none gap-0 lg:gap-3.5 px-1 lg:px-3 py-2 text-[13px] hover:translate-x-0.5 my-0.5',
          mobileOpen && 'justify-start px-3 gap-3.5',
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
          <span className={clsx('truncate leading-none ml-1', mobileOpen ? 'inline-block' : 'hidden lg:inline-block')}>{label}</span>
          {!enabled && (
            <Lock size={11} className={clsx('text-[#F0EAFF]/50 shrink-0', mobileOpen ? 'inline-block' : 'hidden lg:inline-block')} />
          )}
          <div className="fixed left-[68px] hidden group-hover:flex lg:group-hover:hidden items-center px-3 py-1.5 bg-[#17143F] text-white text-xs font-bold rounded-xl shadow-2xl border border-white/20 whitespace-nowrap z-[9999] pointer-events-none lg:hidden">
            {label}
          </div>
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

  const visibleByRole = (item: NavItemConfig) => {
    if (user?.role === 'OWNER' || user?.role === 'SUPERADMIN') return true;
    if (user?.role === 'EMPLOYEE') {
      const perms: string[] = (user as any)?.permissions || [];
      const modKey = item.to.replace('/', '').replace('-', '_');
      const hasPerm = perms.some((p: string) => p.includes(modKey));
      if (hasPerm) return true;
      if (!item.roles || item.roles.includes('EMPLOYEE')) return true;
    }
    return !item.roles || item.roles.includes(user?.role ?? '');
  };

  const visibleItems = NAV.filter(i => visibleByRole(i));

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-300"
          onClick={() => setMobileOpen?.(false)}
        />
      )}

      <aside
        className={clsx(
          'flex flex-col h-screen shrink-0 select-none border-r border-[#E9E7F2]/10 z-40 transition-all duration-300',
          mobileOpen
            ? 'fixed inset-y-0 left-0 w-64 shadow-2xl z-50 translate-x-0'
            : 'sticky top-0 left-0 w-14 lg:w-64'
        )}
        style={{
          background: 'linear-gradient(180deg, #17143F 0%, #1E1850 50%, #24165A 100%)'
        }}
      >
        {/* ── Logo Section (With comfortable top spacing for all devices) ──────────────────── */}
        <div
          className="min-h-[64px] pt-3 sm:pt-4 pb-2.5 flex items-center justify-between shrink-0 px-3 sm:px-4 border-b border-white/10"
        >
          <div className="flex items-center gap-3 min-w-0">
            <img 
              src="/FamilyFirstLogo.png" 
              alt="Family First" 
              className="h-8 sm:h-9 w-auto object-contain cursor-pointer" 
            />
            <div className={clsx("flex flex-col leading-none min-w-0", mobileOpen ? "flex" : "hidden lg:flex")}>
              <span className="font-extrabold text-[13px] text-white tracking-tight">
                Family First
              </span>
              <span className="text-[8.5px] font-extrabold tracking-[0.2em] uppercase mt-[5.5px] text-[#7C4DFF]">
                CRM Portal
              </span>
            </div>
          </div>

          {/* Close button for mobile drawer */}
          {mobileOpen && (
            <button
              type="button"
              onClick={() => setMobileOpen?.(false)}
              className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg lg:hidden cursor-pointer"
              aria-label="Close Sidebar"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* ── Navigation (Single Continuous List with top spacing) ──────────────────── */}
        <nav className="flex-1 overflow-y-auto pt-3 sm:pt-4 pb-3 space-y-0.5 custom-scrollbar px-1.5 sm:px-3 relative">
          {visibleItems.map((item) => (
            <NavItem
              key={item.to}
              item={item}
              isFeatureEnabled={isFeatureEnabled}
              setLockedFeature={setLockedFeature}
              mobileOpen={mobileOpen}
              onNavClick={() => setMobileOpen?.(false)}
            />
          ))}
        </nav>

        <UpgradePromptModal
          isOpen={!!lockedFeature}
          onClose={() => setLockedFeature(null)}
          featureName={lockedFeature || ''}
        />
      </aside>
    </>
  );
}
