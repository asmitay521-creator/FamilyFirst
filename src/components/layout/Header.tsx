import { Bell, ChevronDown, User, Settings, LogOut, Camera, Users, Shield, FileText, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { notificationsService } from '@api/index';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@store/auth.store';
import { authService } from '@api/auth.service';

export default function Header({ title, setMobileOpen }: { title?: string, setMobileOpen?: (v: boolean) => void }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifPop, setShowNotifPop] = useState(false);
  const user = useAuthStore(s => s.user);
  const navigate = useNavigate();

  const { data: notifs, refetch: refetchNotifs } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => notificationsService.list({ limit: 10 }).catch(() => ({ data: [] })),
    refetchInterval: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const unreadCount = notifs?.meta?.unreadCount ?? 0;
  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`;

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch (e) { }
    navigate('/login');
  };

  return (
    <header className="h-16 bg-[#FFFFFF] backdrop-blur-md flex items-center px-3 sm:px-6 gap-3 sm:gap-4 sticky top-0 z-20 shrink-0 transition-all duration-200 border-b border-[#E9E7F2]">

      {/* Page title / breadcrumb */}
      {title && (
        <div className="flex flex-wrap items-center gap-2.5 shrink-0 hidden sm:flex">
          <span className="text-xs font-semibold tracking-wide uppercase text-[#68708A]">Family First</span>
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className="shrink-0 opacity-60">
            <path d="M4.5 3L7.5 6L4.5 9" stroke="#68708A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <h1 className="text-sm font-bold text-[#1D2035] tracking-tight">{title}</h1>
        </div>
      )}

      {/* Right actions */}
      <div className="flex flex-wrap items-center gap-2 ml-auto">


        {/* Notification bell */}
        <div className="relative">
          <button
            className="relative p-2 rounded-xl text-slate-400 bg-slate-50/20 hover:text-slate-700 hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all duration-200"
            onClick={() => setShowNotifPop(!showNotifPop)}
            aria-label="Notifications"
          >
            <Bell size={16} strokeWidth={2} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] bg-red-500 rounded-full text-[8px] font-bold text-white flex items-center justify-center px-0.5 shadow-[0_0_0_2px_#ffffff] animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Popover */}
          {showNotifPop && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowNotifPop(false)} />
              <div className="absolute right-0 top-full mt-2 w-[340px] bg-white rounded-2xl border border-slate-200 shadow-xl p-4 z-50 animate-fade-in">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Bell size={14} className="text-blue-600" />
                    <h4 className="text-xs font-bold text-slate-800">Notifications</h4>
                    {unreadCount > 0 && (
                      <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={async () => {
                        await notificationsService.markAllRead();
                        refetchNotifs();
                      }}
                      className="text-[10px] font-semibold text-blue-600 hover:text-blue-800"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-[300px] overflow-y-auto flex flex-col gap-2">
                  {(notifs?.data || []).length > 0 ? (
                    (notifs?.data || []).map((n: any) => (
                      <div
                        key={n.id}
                        onClick={async () => {
                          if (!n.isRead) {
                            await notificationsService.markRead(n.id);
                            refetchNotifs();
                          }
                          const recordType = n.data?.recordType;
                          const recordId = n.data?.recordId || n.data?.taskId;
                          if (recordId) {
                            setShowNotifPop(false);
                            if (n.type === 'TASK_ASSIGNED' || recordType?.toLowerCase() === 'task') {
                              navigate('/workspace');
                            } else if (recordType) {
                              const path = recordType.toLowerCase() === 'contact' ? 'contacts' : recordType.toLowerCase() === 'lead' ? 'leads' : recordType.toLowerCase() === 'policy' ? 'policies' : 'claims';
                              navigate(`/${path}/${recordId}`);
                            }
                          }
                        }}
                        className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                          n.isRead ? 'bg-slate-50/60 border-slate-100 text-slate-500' : 'bg-blue-50/40 border-blue-100 text-slate-800 font-medium hover:bg-blue-50'
                        }`}
                      >
                        <p className="font-semibold text-slate-800">{n.title}</p>
                        <p className="text-[11px] text-slate-600 mt-0.5">{n.body}</p>
                        <p className="text-[9px] text-slate-400 mt-1">
                          {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="py-6 text-center text-slate-400 text-xs">
                      No notifications yet
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Vertical divider */}
        <div className="h-6 w-px bg-slate-200/80 mx-1" />

        {/* User avatar chip wrapper */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex flex-wrap items-center gap-2.5 pl-1.5 pr-3.5 py-1.5 rounded-xl border border-transparent hover:border-slate-100 hover:bg-slate-50/70 hover:shadow-sm transition-all duration-200 group"
          >
            <div className="h-7 w-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center
                            text-white text-xs font-bold shrink-0 shadow-sm shadow-blue-500/20 group-hover:scale-105 transition-transform duration-200">
              {initials}
            </div>
            <div className="hidden sm:flex flex-col items-start leading-none gap-0.5">
              <span className="text-xs font-bold text-slate-800">
                {user?.firstName} {user?.lastName}
              </span>
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">
                {user?.role}
              </span>
            </div>
            <ChevronDown size={12} className="text-slate-400 hidden sm:block transition-transform duration-200 group-hover:translate-y-0.5" />
          </button>

          {/* Dropdown Card */}
          {showDropdown && (
            <>
              {/* Click outside to close backdrop */}
              <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />

              {/* Dropdown Menu */}
              <div className="absolute right-0 top-full mt-2 w-[280px] bg-white rounded-2xl border border-slate-150 shadow-[0_10px_35px_-5px_rgba(0,0,0,0.1),0_2px_10px_-2px_rgba(0,0,0,0.05)] p-5 z-50 flex flex-col items-center animate-fade-in">
                {/* Avatar details */}
                <div className="h-16 w-16 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white text-2xl font-bold relative mb-3 shadow-inner shadow-blue-500/20">
                  {initials}
                  <div className="absolute bottom-0 right-0 p-1 bg-white border border-slate-100 rounded-full shadow-sm">
                    <Camera size={10} className="text-slate-500" />
                  </div>
                </div>
                <h4 className="text-sm font-bold text-slate-800">Hi, {user?.firstName} {user?.lastName}!</h4>
                <p className="text-xs text-slate-400 mt-0.5">{user?.email}</p>

                <button
                  onClick={() => { navigate('/settings'); setShowDropdown(false); }}
                  className="mt-3.5 w-full py-1.5 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-full text-xs font-semibold text-slate-700 transition-colors text-center"
                >
                  Manage your Account
                </button>

                <div className="w-full h-px bg-slate-100 my-4" />

                <div className="w-full flex flex-col gap-1">
                  <button
                    onClick={() => { navigate('/settings'); setShowDropdown(false); }}
                    className="flex flex-wrap items-center gap-2.5 w-full px-3 py-2 text-xs font-semibold text-slate-650 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors text-left"
                  >
                    <User size={14} className="text-slate-450" />
                    Edit Profile
                  </button>
                  <button
                    onClick={() => { navigate('/settings'); setShowDropdown(false); }}
                    className="flex flex-wrap items-center gap-2.5 w-full px-3 py-2 text-xs font-semibold text-slate-650 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors text-left"
                  >
                    <Settings size={14} className="text-slate-450" />
                    Settings
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex flex-wrap items-center gap-2.5 w-full px-3 py-2 text-[10px] sm:text-xs font-semibold text-slate-650 hover:text-red-650 hover:bg-red-50/50 rounded-xl transition-colors text-left"
                  >
                    <LogOut size={14} className="text-slate-450" />
                    Sign out
                  </button>
                </div>

                <div className="text-[9px] font-medium text-slate-400 mt-4 tracking-wide">
                  Privacy Policy &bull; Terms of Service
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
