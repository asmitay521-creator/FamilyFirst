import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useClientStore } from '@store/client.store';
import { Shield, FileText, AlertCircle, User, LogOut } from 'lucide-react';

const NAV = [
  { to: '/client/dashboard', label: 'Overview',  icon: Shield },
  { to: '/client/policies',  label: 'Policies',  icon: FileText },
  { to: '/client/claims',    label: 'Claims',    icon: AlertCircle },
  { to: '/client/profile',   label: 'Profile',   icon: User },
];

export default function ClientLayout() {
  const { user, logout } = useClientStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/client/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col">
      {/* Top nav */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-30 transition-all duration-200">
        <div className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg shadow-sm border border-blue-100/50">
              <Shield size={18} strokeWidth={2.5} />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-extrabold text-slate-800 text-base tracking-tight">Family First</span>
              <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mt-0.5">Client Portal</span>
            </div>
          </div>

          <nav className="hidden sm:flex flex-wrap items-center gap-1.5">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-250 border ${
                    isActive
                      ? 'bg-blue-50/80 text-blue-600 border-blue-100/60 shadow-sm shadow-blue-500/5'
                      : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-50'
                  }`
                }
              >
                <Icon size={14} strokeWidth={2.25} />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex flex-wrap items-center gap-4">
            <span className="text-xs font-bold text-slate-700 hidden sm:block bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
              {user?.firstName} {user?.lastName}
            </span>
            <button
              onClick={handleLogout}
              className="flex flex-wrap items-center gap-1.5 text-[10px] sm:text-xs font-semibold text-slate-500 hover:text-red-600 transition-colors py-1.5 px-2.5 rounded-lg hover:bg-red-50/50"
            >
              <LogOut size={14} strokeWidth={2} />
              <span className="hidden sm:block">Logout</span>
            </button>
          </div>
        </div>

        <nav className="sm:hidden flex border-t border-slate-100 bg-white/95 backdrop-blur-md">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center py-2.5 text-[10px] font-bold tracking-wide gap-1 transition-colors ${
                  isActive ? 'text-blue-600' : 'text-slate-500'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6">
        <Outlet />
      </main>

      <footer className="text-center text-xs text-gray-400 py-4">
        Powered by Insumitra · Insurance Agency Management
      </footer>
    </div>
  );
}
