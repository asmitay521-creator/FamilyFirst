import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { useAuthStore } from '@store/auth.store';
import { useClientStore } from '@store/client.store';
import { useQuery } from '@tanstack/react-query';
import { subscriptionsService } from '@api/index';
import Layout from '@comps/layout/Layout';
import ClientLayout from '@comps/layout/ClientLayout';

// Auth pages
import Login from '@pages/Auth/Login';

// Robust lazy import with automatic retry on network change / connection drop
const lazyWithRetry = (importFn: () => Promise<any>) =>
  lazy(async () => {
    try {
      return await importFn();
    } catch (error) {
      try {
        await new Promise((r) => setTimeout(r, 600));
        return await importFn();
      } catch (retryErr) {
        const key = 'module_retry_' + window.location.pathname;
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, '1');
          window.location.reload();
        }
        throw retryErr;
      }
    }
  });

// SuperAdmin pages
import SuperAdminLogin      from '@pages/Superadmin/Login';
import { SuperAdminLayout } from '@pages/Superadmin/SuperAdminLayout';
const SuperAdminDashboard = lazyWithRetry(() => import('@pages/Superadmin/Dashboard'));
const SuperAdminTenants   = lazyWithRetry(() => import('@pages/Superadmin/Tenants'));

// Client portal pages
import ClientLogin     from '@pages/Client/Login';
const ClientDashboard  = lazyWithRetry(() => import('@pages/Client/Dashboard'));
const ClientPolicies   = lazyWithRetry(() => import('@pages/Client/Policies'));
const ClientClaims     = lazyWithRetry(() => import('@pages/Client/Claims'));
const ClientProfile    = lazyWithRetry(() => import('@pages/Client/Profile'));

// Feature pages (lazy-loaded with auto-retry)
const Dashboard      = lazyWithRetry(() => import('@pages/Dashboard'));
const Workspace      = lazyWithRetry(() => import('@pages/Workspace'));
const Contacts       = lazyWithRetry(() => import('@pages/Contacts'));
const Customers      = lazyWithRetry(() => import('@pages/Customers'));
const ContactDetail  = lazyWithRetry(() => import('@pages/Contacts/ContactDetail'));
const Leads          = lazyWithRetry(() => import('@pages/Leads'));
const LeadDetail     = lazyWithRetry(() => import('@pages/Leads/LeadDetail'));
const Seminars       = lazyWithRetry(() => import('@pages/Seminars'));
const Policies       = lazyWithRetry(() => import('@pages/Policies'));
const PolicyDetail   = lazyWithRetry(() => import('@pages/Policies/PolicyDetail'));
const Claims         = lazyWithRetry(() => import('@pages/Claims'));
const ClaimDetail    = lazyWithRetry(() => import('@pages/Claims/ClaimDetail'));
const Employees        = lazyWithRetry(() => import('@pages/Employees'));
const EmployeesLayout  = lazyWithRetry(() => import('@pages/Employees/EmployeesLayout'));
const EmployeeTargets  = lazyWithRetry(() => import('@pages/Employees/Targets'));
const EmployeeAttend   = lazyWithRetry(() => import('@pages/Employees/Attendance'));
const EmployeeEod      = lazyWithRetry(() => import('@pages/Employees/EodReports'));
const EmployeeAccess   = lazyWithRetry(() => import('@pages/Employees/AccessControl'));
const EmployeeDetail   = lazyWithRetry(() => import('@pages/Employees/EmployeeDetail'));
const Commissions    = lazyWithRetry(() => import('@pages/Commissions'));
const WhatsApp       = lazyWithRetry(() => import('@pages/WhatsApp'));
const Calendar       = lazyWithRetry(() => import('@pages/Calendar'));
const Settings       = lazyWithRetry(() => import('@pages/Settings'));
const Subscription   = lazyWithRetry(() => import('@pages/Subscription'));
const Insurance      = lazyWithRetry(() => import('@pages/Insurance'));
const Documents      = lazyWithRetry(() => import('@pages/Documents'));
const DeletionRequests = lazyWithRetry(() => import('@pages/DeletionRequests'));
const GlobalSearch   = lazyWithRetry(() => import('@pages/Search'));
const FirmProfile    = lazyWithRetry(() => import('@pages/FirmProfile'));

function PrivateRoute({ children }: { children: React.ReactNode }) {

  const token = useAuthStore(s => s.accessToken);
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

function OwnerRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore(s => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'EMPLOYEE') return <Navigate to="/workspace" replace />;
  if (user.role !== 'OWNER' && user.role !== 'SUPERADMIN') return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminOrAuthorizedRoute({ children, permission }: { children: React.ReactNode; permission?: string }) {
  const user = useAuthStore(s => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'OWNER' || user.role === 'SUPERADMIN') return <>{children}</>;
  if (user.role === 'EMPLOYEE' && permission && (user as any).permissions?.includes(permission)) {
    return <>{children}</>;
  }
  return <Navigate to="/workspace" replace />;
}

function PlanProtectedRoute({ children, feature }: { children: React.ReactNode; feature: string }) {
  const user = useAuthStore(s => s.user);
  
  const { data: subRes, isLoading } = useQuery({
    queryKey: ['subscription', 'current'],
    queryFn: () => subscriptionsService.current().catch(() => ({ data: { plan: { name: 'Enterprise' } } })),
    staleTime: 5 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    enabled: !!user,
  });

  if (isLoading) {
    return <Loader />;
  }

  const sub = subRes?.data;
  const planName = sub?.plan?.name || 'Enterprise';

  const isFeatureEnabled = (plan: string, feat: string): boolean => {
    if (user?.role === 'SUPERADMIN') return true;
    const freeFeatures = ['contacts', 'policies', 'claims', 'calendar', 'workspace'];
    if (freeFeatures.includes(feat)) return true;

    const starterFeatures = [...freeFeatures, 'dashboard', 'leads', 'documents', 'operations'];
    if (plan === 'Starter') {
      return starterFeatures.includes(feat);
    }

    const growthFeatures = [...starterFeatures, 'employees', 'commissions', 'branding'];
    if (plan === 'Growth') {
      return growthFeatures.includes(feat);
    }

    if (plan === 'Enterprise' || plan === 'Business') {
      return true;
    }

    return true;
  };

  if (!isFeatureEnabled(planName, feature)) {
    const redirectPath = (user?.role === 'EMPLOYEE') ? '/workspace' : '/dashboard';
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
}

function ClientRoute({ children }: { children: React.ReactNode }) {
  const token = useClientStore(s => s.accessToken);
  return token ? <>{children}</> : <Navigate to="/client/login" replace />;
}

function Loader() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
    </div>
  );
}

function IndexRedirect() {
  const user = useAuthStore(s => s.user);

  const { data: subRes, isLoading } = useQuery({
    queryKey: ['subscription', 'current'],
    queryFn: () => subscriptionsService.current().catch(() => ({ data: { plan: { name: 'Enterprise' } } })),
    staleTime: 5 * 60_000,
    enabled: !!user,
  });

  if (!user) return <Navigate to="/login" replace />;

  if (user.role === 'SUPERADMIN') {
    return <Navigate to="/superadmin" replace />;
  }

  if (isLoading) {
    return <Loader />;
  }

  if (user.role === 'OWNER' || user.role === 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  if (user.role === 'EMPLOYEE') {
    return <Navigate to="/workspace" replace />;
  }

  return <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />

      {/* SuperAdmin */}
      <Route path="/superadmin/login" element={<SuperAdminLogin />} />
      <Route path="/superadmin" element={<SuperAdminLayout />}>
        <Route index element={<Navigate to="/superadmin/dashboard" replace />} />
        <Route path="dashboard" element={<Suspense fallback={<Loader />}><SuperAdminDashboard /></Suspense>} />
        <Route path="tenants"   element={<Suspense fallback={<Loader />}><SuperAdminTenants /></Suspense>} />
        <Route path="deletion-requests" element={<Suspense fallback={<Loader />}><DeletionRequests /></Suspense>} />
      </Route>

      {/* Client Portal */}
      <Route path="/client/login" element={<ClientLogin />} />
      <Route
        path="/client"
        element={<ClientRoute><ClientLayout /></ClientRoute>}
      >
        <Route index element={<Navigate to="/client/dashboard" replace />} />
        <Route path="dashboard" element={<Suspense fallback={<Loader />}><ClientDashboard /></Suspense>} />
        <Route path="policies"  element={<Suspense fallback={<Loader />}><ClientPolicies /></Suspense>} />
        <Route path="policies/:id" element={<Suspense fallback={<Loader />}><ClientPolicies /></Suspense>} />
        <Route path="claims"    element={<Suspense fallback={<Loader />}><ClientClaims /></Suspense>} />
        <Route path="profile"   element={<Suspense fallback={<Loader />}><ClientProfile /></Suspense>} />
      </Route>

      {/* Protected */}
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<IndexRedirect />} />
        <Route path="dashboard"    element={<OwnerRoute><PlanProtectedRoute feature="dashboard"><Suspense fallback={<Loader />}><Dashboard /></Suspense></PlanProtectedRoute></OwnerRoute>} />
        <Route path="workspace"    element={<PlanProtectedRoute feature="workspace"><Suspense fallback={<Loader />}><Workspace /></Suspense></PlanProtectedRoute>} />
        <Route path="contacts"     element={<Suspense fallback={<Loader />}><Contacts /></Suspense>} />
        <Route path="customers"    element={<Suspense fallback={<Loader />}><Customers /></Suspense>} />
        <Route path="contacts/:id" element={<Suspense fallback={<Loader />}><ContactDetail /></Suspense>} />
        <Route path="leads"        element={<PlanProtectedRoute feature="leads"><Suspense fallback={<Loader />}><Leads /></Suspense></PlanProtectedRoute>} />
        <Route path="leads/:id"    element={<PlanProtectedRoute feature="leads"><Suspense fallback={<Loader />}><LeadDetail /></Suspense></PlanProtectedRoute>} />
        <Route path="seminars"     element={<PlanProtectedRoute feature="leads"><Suspense fallback={<Loader />}><Seminars /></Suspense></PlanProtectedRoute>} />
        <Route path="policies"     element={<Suspense fallback={<Loader />}><Policies /></Suspense>} />
        <Route path="emi-tracking" element={<Suspense fallback={<Loader />}><Policies /></Suspense>} />
        <Route path="policies/:id" element={<Suspense fallback={<Loader />}><PolicyDetail /></Suspense>} />
        <Route path="claims"       element={<Suspense fallback={<Loader />}><Claims /></Suspense>} />
        <Route path="claims/:id"   element={<Suspense fallback={<Loader />}><ClaimDetail /></Suspense>} />
        <Route
          path="employees/*"
          element={
            <AdminOrAuthorizedRoute permission="manage_employees">
              <PlanProtectedRoute feature="employees">
                <Suspense fallback={<Loader />}><EmployeesLayout /></Suspense>
              </PlanProtectedRoute>
            </AdminOrAuthorizedRoute>
          }
        >
          <Route index                element={<Suspense fallback={<Loader />}><Employees /></Suspense>} />
          <Route path="targets"        element={<Suspense fallback={<Loader />}><EmployeeTargets /></Suspense>} />
          <Route path="attendance"     element={<Suspense fallback={<Loader />}><EmployeeAttend /></Suspense>} />
          <Route path="eod-reports"    element={<Suspense fallback={<Loader />}><EmployeeEod /></Suspense>} />
          <Route path="access-control" element={<Suspense fallback={<Loader />}><EmployeeAccess /></Suspense>} />
        </Route>
        <Route path="employees/:id" element={<AdminOrAuthorizedRoute permission="manage_employees"><PlanProtectedRoute feature="employees"><Suspense fallback={<Loader />}><EmployeeDetail /></Suspense></PlanProtectedRoute></AdminOrAuthorizedRoute>} />
        <Route path="commissions"  element={<OwnerRoute><PlanProtectedRoute feature="commissions"><Suspense fallback={<Loader />}><Commissions /></Suspense></PlanProtectedRoute></OwnerRoute>} />
        <Route path="whatsapp/*"   element={<AdminOrAuthorizedRoute permission="manage_whatsapp"><PlanProtectedRoute feature="whatsapp"><Suspense fallback={<Loader />}><WhatsApp /></Suspense></PlanProtectedRoute></AdminOrAuthorizedRoute>} />
        <Route path="calendar"     element={<Suspense fallback={<Loader />}><Calendar /></Suspense>} />
        <Route path="settings"     element={<OwnerRoute><Suspense fallback={<Loader />}><Settings /></Suspense></OwnerRoute>} />
        <Route path="firm-profile" element={<OwnerRoute><PlanProtectedRoute feature="branding"><Suspense fallback={<Loader />}><FirmProfile /></Suspense></PlanProtectedRoute></OwnerRoute>} />
        <Route path="subscription" element={<Navigate to="/dashboard" replace />} />
        <Route path="operations"   element={<OwnerRoute><PlanProtectedRoute feature="operations"><Suspense fallback={<Loader />}><Insurance /></Suspense></PlanProtectedRoute></OwnerRoute>} />
        <Route path="documents"    element={<OwnerRoute><PlanProtectedRoute feature="documents"><Suspense fallback={<Loader />}><Documents /></Suspense></PlanProtectedRoute></OwnerRoute>} />
        <Route path="search"       element={<OwnerRoute><Suspense fallback={<Loader />}><GlobalSearch /></Suspense></OwnerRoute>} />
        <Route path="deletion-requests" element={<OwnerRoute><Suspense fallback={<Loader />}><DeletionRequests /></Suspense></OwnerRoute>} />
      </Route>

      <Route path="*" element={<IndexRedirect />} />
    </Routes>
  );
}



