import { Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useLookupStore } from '@store/lookup.store';
import Sidebar from './Sidebar';
import Header  from './Header';

const TITLES: Record<string, string> = {
  dashboard:    'Dashboard',
  workspace:    'Workspace',
  contacts:     'Contacts',
  customers:    'Customer',
  leads:        'Leads',
  policies:     'Policies',
  claims:       'Claims',
  employees:    'Employees',
  commissions:  'Commissions',
  whatsapp:     'WhatsApp',
  calendar:     'Calendar',
  settings:     'Settings',
  subscription: 'Subscription',
};

export default function Layout() {
  const { pathname } = useLocation();
  const section = pathname.split('/')[1] ?? '';
  const title   = TITLES[section] ?? '';
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    useLookupStore.getState().loadAll();
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header title={title} setMobileOpen={setMobileOpen} />
        <main className="flex-1 overflow-y-auto p-3 md:p-5 bg-[#FAF9FF] text-[#1D2035] custom-scrollbar">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
