import { NavLink, Outlet, useNavigate, Navigate } from 'react-router-dom';
import { LayoutDashboard, Building2, LogOut, ChevronLeft, Trash2 } from 'lucide-react';
import { useSuperAdminStore } from '@store/superadmin.store';
import { superAdminService } from '@api/superadmin.service';
import clsx from 'clsx';

const NAV = [
  { to: '/superadmin/dashboard', label: 'Dashboard',  Icon: LayoutDashboard },
  { to: '/superadmin/tenants',   label: 'Tenants',    Icon: Building2 },
  { to: '/superadmin/deletion-requests', label: 'Delete Requests', Icon: Trash2 },
];

function SuperAdminGuard({ children }: { children: React.ReactNode }) {
  const token = useSuperAdminStore(s => s.accessToken);
  return token ? <>{children}</> : <Navigate to="/superadmin/login" replace />;
}

export function SuperAdminLayout() {
  const admin    = useSuperAdminStore(s => s.admin);
  const navigate = useNavigate();

  const handleLogout = () => {
    superAdminService.logout();
    navigate('/superadmin/login');
  };

  return (
    <SuperAdminGuard>
      <div className="flex h-screen overflow-hidden bg-gray-50">
        {/* Sidebar */}
        <aside className="w-56 flex flex-col bg-gray-900 text-white shrink-0">
          {/* Brand */}
          <div className="flex flex-wrap items-center gap-2.5 px-4 py-5 border-b border-white/10">
            <img src="/InsumitraLogo.png" alt="Insumitra" className="h-8 w-auto object-contain" />
            <p className="text-[10px] text-gray-400 leading-tight">Super Admin</p>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 space-y-1">
            {NAV.map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                    isActive
                      ? 'bg-white/15 text-white font-medium'
                      : 'text-gray-400 hover:bg-white/8 hover:text-white',
                  )
                }
              >
                <Icon size={16} />
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Footer */}
          <div className="px-3 py-4 border-t border-white/10 space-y-1">
            <a
              href="/login"
              className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-white/8 transition-colors"
            >
              <ChevronLeft size={16} />
              Tenant Login
            </a>
            <button
              onClick={handleLogout}
              className="w-full flex flex-wrap items-center gap-3 px-3 py-2 text-xs sm:text-sm text-gray-400 hover:text-red-400 rounded-lg hover:bg-white/8 transition-colors"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>

          {/* Admin badge */}
          <div className="px-4 py-3 bg-black/20">
            <p className="text-xs text-gray-400 truncate">{admin?.name ?? 'Platform Admin'}</p>
            <p className="text-[10px] text-gray-500 truncate">{admin?.email}</p>
          </div>
        </aside>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </SuperAdminGuard>
  );
}
